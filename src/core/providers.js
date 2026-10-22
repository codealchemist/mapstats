// Provider registry: the global providers plus every country's own (docs/architecture.md §4.2), and what the
// scoring and UI derive from them: which provider supplies each indicator, source families and their base
// reliability.
import { GLOBAL_PROVIDERS, ALWAYS_ON } from '../providers/index.js'
import { COUNTRIES } from './countries.js'
import { KINDS } from './define.js'
import { INDICATORS } from '../data/metrics.js'
import { standardFor } from '../data/standards.js'

/** Every provider: global first, then each country's own (ids "<ISO3>/<id>"). */
export const PROVIDERS = [...GLOBAL_PROVIDERS, ...COUNTRIES.flatMap((c) => c.providers.filter((p) => typeof p === 'object'))]
const byId = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]))
export const providerById = (id) => byId[id] || null

// Per-country lists, computed once per country (components ask on every render).
const perCountry = (fn) => {
  const cache = new WeakMap()
  return (country) => {
    if (!country?.iso3) throw new Error('a country (countries/index.js) is required')
    if (!cache.has(country)) cache.set(country, fn(country))
    return cache.get(country)
  }
}

/** Providers serving a country: the always-on globals, plus the globals and own providers its config lists. */
export const providersFor = perCountry((country) => {
  const listed = country.providers.map((p) => (typeof p === 'string' ? providerById(p) : p))
  for (const p of listed) if (!p) throw new Error(`${country.iso3}: unknown provider in country.config.js`)
  return [...ALWAYS_ON.map(providerById), ...listed]
})

/** The country's own providers first (local, usually official, data), then global ones. */
export const localFirst = (providers) => [...providers.filter((p) => p.country), ...providers.filter((p) => !p.country)]

// Indicator → the provider that supplies it, per country: two countries may publish the same indicator through
// different providers (Argentina's SNIC and France's SSMSI both provide `homicide`), but within one country each
// indicator has exactly one. Validated at load for every registered country.
const indicatorProviders = perCountry((country) => {
  const map = {}
  for (const p of providersFor(country)) {
    for (const id of p.provides) {
      if (map[id]) throw new Error(`${country.iso3}: indicator ${id} is provided by both ${map[id].id} and ${p.id}`)
      map[id] = p
    }
  }
  return map
})
for (const c of COUNTRIES) indicatorProviders(c)
const provided = new Set(PROVIDERS.flatMap((p) => p.provides))
for (const i of INDICATORS) if (!provided.has(i.id)) throw new Error(`No provider provides indicator ${i.id}`)

/** The provider behind an indicator in a country (null when none of the country's providers publishes it). */
export const providerOf = (indicatorId, country) => indicatorProviders(country)[indicatorId] || null

/** The provider behind an indicator's value under a standards selection: an indicator scored by a standard shows that
 *  standard's measure (data/standards.js `input`), so the measure's provider is behind it (UTCI: Copernicus). */
export const providerUnder = (indicatorId, country, standards) => providerOf(standardFor(indicatorId, standards)?.input ?? indicatorId, country)

// ---------- Source families (the source selector's groups) ----------

/** Family id of a provider (null when it is not in a source family, e.g. descriptive context). */
export const familyIdOf = (p) => (p.family == null ? null : typeof p.family === 'string' ? p.family : p.family.id)
// Providers that declare a family; countries may share one by declaring the same id, label and short.
const owners = []
for (const p of PROVIDERS.filter((x) => x.family && typeof x.family === 'object')) {
  const same = owners.find((o) => o.family.id === p.family.id)
  if (!same) owners.push(p)
  else if (same.family.label !== p.family.label || same.family.short !== p.family.short) throw new Error(`Family ${p.family.id} is declared differently by ${same.id} and ${p.id}`)
}

/** Modes that integrate every source, then one entry per family (country providers first). */
export const SOURCE_FAMILIES = [
  { id: 'combined', label: 'All sources · median', short: 'Median of sources' },
  { id: 'weighted', label: 'All sources · weighted by reliability', short: 'Weighted' },
  ...[...owners.filter((p) => p.country), ...owners.filter((p) => !p.country)].map((p) => ({ ...p.family, kind: p.kind })),
]
export const familyById = Object.fromEntries(SOURCE_FAMILIES.map((f) => [f.id, f]))
for (const p of PROVIDERS) if (familyIdOf(p) && !familyById[familyIdOf(p)]) throw new Error(`Provider ${p.id}: unknown family ${familyIdOf(p)}`)

/** The source-selector entries for a country: the integration modes, then the families its providers belong to. */
export const familiesFor = perCountry((country) => {
  const ids = new Set(providersFor(country).map(familyIdOf).filter(Boolean))
  return SOURCE_FAMILIES.filter((f) => isMultiSource(f.id) || ids.has(f.id))
})

/** familiesFor, without the families that score nothing under these standards (Copernicus only scores under UTCI). */
export const scoringFamiliesFor = (country, standards) =>
  familiesFor(country).filter((f) => isMultiSource(f.id) || INDICATORS.some((i) => i.better && familyOf(i.id, country, standards) === f.id))

// Modes that integrate every source (vs. a single-source view).
export const isMultiSource = (mode) => mode === 'combined' || mode === 'weighted'

/** Source family of an indicator in a country (null for descriptive context such as population). */
export const familyOf = (indicatorId, country, standards) => {
  const p = providerUnder(indicatorId, country, standards)
  return p ? familyIdOf(p) : null
}

// What scoring needs per family, computed once: base reliability, providers, and whether it only publishes
// region-wide figures (then a city's value is the region's, compared among regions and discounted for cities).
const families = Object.fromEntries(SOURCE_FAMILIES.filter((f) => !isMultiSource(f.id)).map((f) => {
  const providers = PROVIDERS.filter((p) => familyIdOf(p) === f.id)
  const kind = KINDS[f.kind]
  return [f.id, {
    base: kind ? { w: kind.w, why: f.why || kind.why } : null, // a family may word `why` more precisely
    providers,
    regionOnly: providers.length > 0 && providers.every((p) => p.levels.length > 0 && p.levels.every((l) => l === 'region')),
  }]
}))

/** Base reliability of a family, from its kind: { w, why }. */
export const familyBase = (familyId) => families[familyId]?.base || null

/** Providers of a family, e.g. to apply their weight factors. */
export const familyProviders = (familyId) => families[familyId]?.providers || []

/** True when a family only publishes region-wide figures (e.g. Argentina's provincial statistics). */
export const isRegionOnly = (familyId) => !!families[familyId]?.regionOnly

// ---------- Lookups for UI ----------

const uniq = (ids) => [...new Set(ids)].filter(Boolean)

/** Provider ids behind a list of indicators in a country (under a standards selection: see providerUnder). */
export const sourcesForIndicators = (ids, country, standards) => uniq(ids.map((id) => providerUnder(id, country, standards)?.id))

/** The country's providers that present data in a report category (`report.category`), its own first. */
export const reportProviders = (country, category) => localFirst(providersFor(country)).filter((p) => p.report?.category === category)

/** Provider ids behind a category's indicators in a country. */
export const sourcesForCategory = (categoryId, country, standards) => sourcesForIndicators(INDICATORS.filter((i) => i.category === categoryId).map((i) => i.id), country, standards)
