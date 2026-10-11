// Contracts between a country folder and the core (docs/architecture.md §4). Browser-safe: imported by
// country manifests, which the app, the news function and the scripts all load.

const fail = (who, msg) => { throw new Error(`${who}: ${msg}`) }

/**
 * @typedef {object} CountryConfig
 * @property {string} iso3                 ISO 3166-1 alpha-3, also the folder name
 * @property {string} iso2
 * @property {string} name
 * @property {string} regionLabel          first-level division, singular ("Province")
 * @property {string} [subregionLabel]     second level, when providers publish it ("Department")
 * @property {[number, number, number, number] | null} [bounds]  [west, south, east, north] map frame override
 * @property {{ simplify?: string, minCityPop?: number, maxCities?: number }} [geo]  Natural Earth build settings
 * @property {Array<string | object>} [providers]  global provider ids (e.g. 'numbeo') and this country's own
 *   provider definitions (imported from ./providers/); global live providers are always on
 * @property {{ lang?: string, countryName?: string, edition?: { hl: string, gl: string } }} [news]
 * @property {string[]} [maintainers]      GitHub handles
 */

/** @param {CountryConfig} c */
export function defineCountry(c) {
  const who = `country ${c?.iso3 ?? '?'}`
  if (!/^[A-Z]{3}$/.test(c?.iso3 || '')) fail(who, 'iso3 must be 3 capital letters')
  if (!/^[A-Z]{2}$/.test(c.iso2 || '')) fail(who, 'iso2 must be 2 capital letters')
  if (!c.name) fail(who, 'name is required')
  if (!c.regionLabel) fail(who, 'regionLabel is required')
  if (c.bounds != null && !(Array.isArray(c.bounds) && c.bounds.length === 4 && c.bounds.every(Number.isFinite))) {
    fail(who, 'bounds must be [west, south, east, north]')
  }
  // The country's own providers are namespaced "<ISO3>/<id>"; global ones stay ids.
  const providers = (c.providers || []).flat().map((p) => (typeof p === 'string' ? p : Object.freeze({ ...p, id: `${c.iso3}/${p.id}`, country: c.iso3 })))
  return Object.freeze({
    subregionLabel: null,
    bounds: null,
    maintainers: [],
    ...c,
    providers,
    geo: { simplify: '8%', minCityPop: 100_000, maxCities: 120, ...c.geo },
    news: { lang: 'en', countryName: c.name, edition: { hl: 'en-US', gl: c.iso2 }, ...c.news },
  })
}

// Base reliability by kind of source (docs/architecture.md §4.2), shown verbatim in reports and the sources view.
export const KINDS = {
  register: { w: 1.0, why: 'official register of recorded cases' },
  measurement: { w: 1.0, why: 'physical measurement / reanalysis' },
  'official-survey': { w: 0.8, why: 'official sample survey' },
  'crowd-survey': { w: 0.5, why: 'crowd-sourced perception survey' },
  estimate: { w: 0.3, why: 'modelled estimate' },
  manual: { w: 0.3, why: 'hand-entered approximations' },
}

// How the app gets a source's data (sources view).
export const ACCESS = {
  live: { label: 'Live API', detail: 'fetched in your browser, cached locally' },
  import: { label: 'Imported file', detail: 'downloaded once, converted offline (npm run snic:import)' },
  snapshot: { label: 'Stored snapshot', detail: 'copied once (npm run numbeo:fetch / hand-entered), not re-fetched' },
  manual: { label: 'Hand-entered', detail: 'approximate values typed from the publication; verify before relying on them' },
  bundled: { label: 'Bundled', detail: 'shipped with the app' },
  tiles: { label: 'Map tiles', detail: 'streamed by the map' },
  once: { label: 'Used once', detail: 'used during data preparation, not at runtime' },
}

// What a source provides (sources view sections).
export const DATA_TYPES = [
  { id: 'crime', label: 'Crime & safety' },
  { id: 'climate', label: 'Climate & weather' },
  { id: 'air', label: 'Air quality & UV' },
  { id: 'hazards', label: 'Natural hazards' },
  { id: 'society', label: 'Population, economy & services' },
  { id: 'geo', label: 'Maps & geography' },
]

/**
 * @typedef {object} ProviderDef
 * @property {string} id                 kebab-case; country providers are namespaced to "<ISO3>/<id>" by defineCountry
 * @property {string} short              short label shown next to values ("SNIC")
 * @property {string} name
 * @property {string | null} url
 * @property {string} covers             one line: what it covers
 * @property {keyof KINDS} [kind]        required in a source family (scored data): drives base reliability
 * @property {string | { id: string, label: string, short: string, why?: string } | null} [family]
 *   source-selector group; the provider that defines the group passes the object, the others its id
 * @property {string[]} [levels]         geographic levels of its values: 'point' | 'city' | 'subregion' | 'region'
 * @property {string[]} [provides]       indicator ids
 * @property {keyof ACCESS} access
 * @property {string} [cadence]
 * @property {string} [scope]
 * @property {string[]} types            DATA_TYPES ids
 * @property {string} [usedFor]          what it is used for when it provides no indicator
 * @property {(entity: object, category: string) => string | null} [urlFor]  deep link for a place
 * @property {(ctx: { type: 'city' | 'province', level?: string, detail?: object }) => Array<[string, number]>} [weightFactors]
 *   extra reliability factors; `level` and `detail` describe this provider's data for the place (src/core/resolve.js)
 */

/** @param {ProviderDef} p */
export function defineProvider(p) {
  const who = `provider ${p?.id ?? '?'}`
  if (!/^[a-z0-9][a-z0-9-]*$/.test(p?.id || '')) fail(who, 'id must be kebab-case')
  if (!p.name || !p.short) fail(who, 'name and short are required')
  if (!ACCESS[p.access]) fail(who, `access must be one of ${Object.keys(ACCESS).join(', ')}`)
  if (!p.types?.length || p.types.some((t) => !DATA_TYPES.some((d) => d.id === t))) fail(who, 'types must be DATA_TYPES ids')
  if (p.family && !KINDS[p.kind]) fail(who, `a provider in a source family needs a kind: one of ${Object.keys(KINDS).join(', ')}`)
  return Object.freeze({ url: null, kind: null, family: null, levels: [], provides: [], ...p })
}

// Recency factor for weightFactors: full weight within a year of the reference period, then −15 % per
// extra year, floor 50 %.
export const recency = (year, now = new Date().getFullYear()) => (year == null ? 1 : Math.max(0.5, 1 - 0.15 * Math.max(0, now - year - 1)))
