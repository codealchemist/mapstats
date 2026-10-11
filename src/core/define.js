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
 * @property {string[]} [providers]        datasets and extra providers; global live providers are always on
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
  return Object.freeze({
    subregionLabel: null,
    bounds: null,
    providers: [],
    maintainers: [],
    ...c,
    geo: { simplify: '8%', minCityPop: 100_000, maxCities: 120, ...c.geo },
    news: { lang: 'en', countryName: c.name, edition: { hl: 'en-US', gl: c.iso2 }, ...c.news },
  })
}
