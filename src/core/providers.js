// Provider registry: the global providers plus every country's own (docs/architecture.md §4.2), and what the
// scoring and UI derive from them: which provider supplies each indicator, source families and their base
// reliability.
import { GLOBAL_PROVIDERS, ALWAYS_ON } from '../providers/index.js'
import { COUNTRIES } from './countries.js'
import { KINDS } from './define.js'
import { INDICATORS } from '../data/metrics.js'

/** Every provider: global first, then each country's own (ids "<ISO3>/<id>"). */
export const PROVIDERS = [...GLOBAL_PROVIDERS, ...COUNTRIES.flatMap((c) => c.providers.filter((p) => typeof p === 'object'))]
const byId = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]))
export const providerById = (id) => byId[id] || null

/** Providers serving a country: the always-on globals, plus the globals and own providers its config lists. */
export function providersFor(country) {
  const listed = country.providers.map((p) => (typeof p === 'string' ? providerById(p) : p))
  for (const p of listed) if (!p) throw new Error(`${country.iso3}: unknown provider in country.config.js`)
  return [...ALWAYS_ON.map(providerById), ...listed]
}

/** The country's own providers first (local, usually official, data), then global ones. */
export const localFirst = (providers) => [...providers.filter((p) => p.country), ...providers.filter((p) => !p.country)]

// Indicator → the provider that supplies it. Each indicator has one provider today; when two countries
// supply the same indicator through different providers, this becomes country-scoped.
const indicatorProvider = {}
for (const p of PROVIDERS) {
  for (const id of p.provides) {
    if (indicatorProvider[id]) throw new Error(`Indicator ${id} is provided by both ${indicatorProvider[id].id} and ${p.id}`)
    indicatorProvider[id] = p
  }
}
for (const i of INDICATORS) if (!indicatorProvider[i.id]) throw new Error(`No provider provides indicator ${i.id}`)

/** The provider behind an indicator. */
export const providerOf = (indicatorId) => indicatorProvider[indicatorId] || null

// ---------- Source families (the source selector's groups) ----------

const familyIdOf = (p) => (p.family == null ? null : typeof p.family === 'string' ? p.family : p.family.id)
const owners = PROVIDERS.filter((p) => p.family && typeof p.family === 'object')

/** Modes that integrate every source, then one entry per family (country providers first). */
export const SOURCE_FAMILIES = [
  { id: 'combined', label: 'All sources · median', short: 'Median of sources' },
  { id: 'weighted', label: 'All sources · weighted by reliability', short: 'Weighted' },
  ...[...owners.filter((p) => p.country), ...owners.filter((p) => !p.country)].map((p) => ({ ...p.family, kind: p.kind })),
]
export const familyById = Object.fromEntries(SOURCE_FAMILIES.map((f) => [f.id, f]))
for (const p of PROVIDERS) if (familyIdOf(p) && !familyById[familyIdOf(p)]) throw new Error(`Provider ${p.id}: unknown family ${familyIdOf(p)}`)

// Modes that integrate every source (vs. a single-source view).
export const isMultiSource = (mode) => mode === 'combined' || mode === 'weighted'

/** Source family of an indicator (null for descriptive context such as population). */
export const familyOf = (indicatorId) => {
  const p = providerOf(indicatorId)
  return p ? familyIdOf(p) : null
}

/** Base reliability of a family, from its kind: { w, why }. A family may word `why` more precisely. */
export const familyBase = (familyId) => {
  const f = familyById[familyId], kind = KINDS[f?.kind]
  return kind ? { w: kind.w, why: f.why || kind.why } : null
}

/** Providers of a family, e.g. to apply their weight factors. */
export const familyProviders = (familyId) => PROVIDERS.filter((p) => familyIdOf(p) === familyId)

// ---------- Lookups for UI ----------

const uniq = (ids) => [...new Set(ids)].filter(Boolean)

/** Provider ids behind a list of indicators. */
export const sourcesForIndicators = (ids) => uniq(ids.map((id) => providerOf(id)?.id))

/** Provider ids behind a category's indicators. */
export const sourcesForCategory = (categoryId) => sourcesForIndicators(INDICATORS.filter((i) => i.category === categoryId).map((i) => i.id))
