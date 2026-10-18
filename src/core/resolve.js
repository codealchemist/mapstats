// Datasets → values per place, with provenance (docs/architecture.md §5). The one place that decides how a
// published value reaches a place; it knows levels, not providers.
//
//   city       its own city-level values, then its subregion's (codes.subregion): both count as its own
//   region     region-level values; indicators only published per city are the population-weighted mean
//              of the region's cities that have them
//   borrowed   a city without its own value takes its region's, marked `inherited` (scores and labels
//              treat it as the region's figure, not the city's)
// Extensive quantities (population) are never borrowed.
import { INDICATORS } from '../data/metrics.js'

export const LEVELS = ['national', 'region', 'subregion', 'city']
const NOT_INHERITED = new Set(['pop'])

/** Population-weighted mean of `key` over places that have it (weight 1 when the population is unknown). */
export function weightedMean(items, key) {
  let w = 0, s = 0
  for (const it of items) {
    const v = it.values[key]
    if (v == null) continue
    const k = it.values.pop || 1
    w += k
    s += v * k
  }
  return w ? s / w : null
}

/**
 * Indexes datasets by level and place: { [level]: { [placeId]: { values, providers, details } } }, plus each
 * provider's dataset-wide info. A value's provider is the dataset's `providers[indicator]` or its `provider`.
 */
export function indexDatasets(datasets) {
  const at = Object.fromEntries(LEVELS.map((l) => [l, {}]))
  const meta = {}
  const known = new Set(INDICATORS.map((i) => i.id))
  const slot = (level, id) => (at[level][id] ||= { values: {}, providers: {}, details: {} })
  for (const ds of datasets) {
    if (ds.provider) meta[ds.provider] = { period: ds.period, origin: ds.origin, years: ds.series?.years || null, generatedAt: ds.generatedAt }
    for (const level of LEVELS) {
      for (const [id, vals] of Object.entries(ds.values?.[level] || {})) {
        const s = slot(level, id)
        for (const [k, v] of Object.entries(vals)) {
          if (!known.has(k)) throw new Error(`${ds.provider || ds.country} dataset: unknown indicator ${k}`)
          const provider = ds.providers?.[k] ?? ds.provider
          if (s.providers[k] && s.providers[k] !== provider) throw new Error(`${level} ${id}: ${k} published by both ${s.providers[k]} and ${provider}`)
          s.values[k] = v
          s.providers[k] = provider
        }
      }
      for (const [id, d] of Object.entries(ds.details?.[level] || {})) {
        slot(level, id).details[ds.provider] = { ...d, name: ds.names?.[level]?.[id] ?? null, series: ds.series?.[level]?.[id] ?? null }
      }
    }
  }
  return { at, meta }
}

/** Places in one shape whatever their origin: Natural Earth cities name their region `province`. */
export const normalisePlaces = (places) => places.map(({ province, ...p }) => ({ region: province, codes: {}, ...p }))

const detailsAt = (slot, level, extra = {}) =>
  Object.fromEntries(Object.entries(slot?.details || {}).map(([p, d]) => [p, { level, ...extra, ...d }]))

/**
 * Base values (no live data) for every region and city of a country.
 * @param regionIds  region ids from the country's boundaries
 * @param places     [{ id, region, pop, codes }]
 * @returns { regions: { [id]: { values, details, inheritable } }, cities: { [id]: { values, inherited, details } }, national: { details }, meta }
 */
export function resolvePlaces({ regionIds, places, datasets }) {
  const { at, meta } = indexDatasets(datasets)

  // Indicators published per city, averaged per region over the cities that have them.
  const byRegion = {}
  for (const p of places) (byRegion[p.region] ||= []).push({ values: { ...at.city[p.id]?.values, pop: p.pop } })
  const cityLevelKeys = new Set(Object.values(at.city).flatMap((s) => Object.keys(s.values)))
  const aggregate = (regionId) => {
    const out = {}
    for (const k of cityLevelKeys) {
      if (k in (at.region[regionId]?.values || {})) continue
      const v = byRegion[regionId] ? weightedMean(byRegion[regionId], k) : null
      if (v != null) out[k] = v
    }
    return out
  }

  const regions = {}
  for (const id of regionIds) {
    const values = { ...at.region[id]?.values, ...aggregate(id) }
    const inheritable = Object.fromEntries(Object.entries(values).filter(([k]) => !NOT_INHERITED.has(k)))
    regions[id] = { values, inheritable, details: detailsAt(at.region[id], 'region') }
  }

  const cities = {}
  for (const p of places) {
    const values = {}
    const inherited = new Set()
    for (const [k, v] of Object.entries(regions[p.region]?.inheritable || {})) {
      values[k] = v
      inherited.add(k)
    }
    // Subregion and city values count as the place's own, even when published as missing.
    const sub = p.codes?.subregion ? at.subregion[p.codes.subregion] : null
    for (const s of [sub, at.city[p.id]]) {
      for (const [k, v] of Object.entries(s?.values || {})) {
        values[k] = v
        inherited.delete(k)
      }
    }
    values.pop = p.pop
    cities[p.id] = {
      values, inherited,
      details: { ...detailsAt(sub, 'subregion', { code: p.codes?.subregion }), ...detailsAt(at.city[p.id], 'city') },
    }
  }

  const national = { details: Object.fromEntries(Object.entries(detailsAt(at.national[Object.keys(at.national)[0]], 'national')).map(([p, d]) => [p, { ...d, years: meta[p]?.years }])) }
  return { regions, cities, national, meta }
}
