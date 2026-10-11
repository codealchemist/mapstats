// MapStats livability score.
//
// 1. Each indicator is normalised to 0–100 on its fixed score range (metrics.js scoreRange: anchors from
//    the data, else the hand-set domain), flipped when lower is better, and clamped.
// 2. A category score is the mean of its available indicator scores.
// 3. The MapStats score is the weight-averaged category score, renormalising
//    weights over the categories that have data, so missing data neither
//    rewards nor punishes a place. `coverage` reports how much data was used.

import { CATEGORIES, INDICATORS, indicatorById, scoreRange } from '../data/metrics.js'
import { haversineKm, labelPoint } from './geo.js'
import { familyOf, isMultiSource, isRegionOnly } from '../core/providers.js'
import { sourceWeight, percentile } from './sourceWeights.js'
import { resolvePlaces, weightedMean } from '../core/resolve.js'

const SCORED = INDICATORS.filter((i) => i.better)
const LIVE_KEYS = ['climateComfort', 'meanTemp', 'annualPrecip', 'snowfall', 'sunshine', 'elevation', 'aqi', 'quakes', 'tempMaxAnnual', 'tempMinAnnual', 'uvMean', 'floodWatch', 'floodPeakPast']

// True when the entity's value for `id` was measured for the entity itself (not copied from its province).
export const isOwnValue = (entity, id) => entity.values[id] != null && !entity.inherited?.has(id)

// City-level value or null: never falls back to the province baseline.
export const ownValue = (entity, id) => (isOwnValue(entity, id) ? entity.values[id] : null)

// Real-value [min, max] of every indicator over the country's places (own values, as on the map legend).
function valueRanges(entities) {
  const ranges = {}
  for (const e of entities) {
    for (const i of INDICATORS) {
      const v = ownValue(e, i.id)
      if (v == null) continue
      const r = (ranges[i.id] ||= [v, v])
      if (v < r[0]) r[0] = v
      if (v > r[1]) r[1] = v
    }
  }
  return ranges
}

// Meter position (0–100) of a real value on the country's range, widened to include the values shown
// (an ad-hoc place or the national average can fall outside it). Domains are for scores only.
export function meterScale(range, shown = []) {
  const vs = [...(range || []), ...shown.filter((v) => v != null)]
  const lo = Math.min(...vs), hi = Math.max(...vs)
  return (v) => (v == null ? null : hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100)
}

function normalise(id, v) {
  const ind = indicatorById[id]
  if (v == null || !ind?.better) return null
  const [lo, hi] = scoreRange(id).range
  const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)))
  return (ind.better === 'high' ? n : 1 - n) * 100
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
const median = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Category score per source family, then combined. Modes:
 *  - 'combined' (median): each family's indicators are normalised on fixed 0–100 domains and
 *    averaged; the category is the median of family scores (with two families, their mean).
 *  - 'weighted': each value becomes a percentile among the places that source covers (same type:
 *    cities vs cities); the category is the reliability-weighted mean of family scores
 *    (lib/sourceWeights.js) and `spread` is the weighted standard deviation between sources.
 *  - '<family>': only that family, fixed-domain normalisation.
 * Only values measured for the place itself vote. Values borrowed from the province (`inherited`)
 * fill a category only when no source has local data for it. Region-only families (e.g. provincial
 * statistics) are region-level by nature and always count.
 * ctx: { type, details, dist } — dist[type][indicator] = sorted own values (for percentiles).
 */
export function scoreValues(values, weights, mode = 'combined', inherited = null, ctx = {}) {
  const multi = isMultiSource(mode)
  const categories = {}, bySource = {}, spread = {}, sourceWeights = {}
  let used = 0, possible = 0
  for (const c of CATEGORIES) {
    const own = {}, borrowed = {}
    for (const i of SCORED.filter((x) => x.category === c.id)) {
      const f = familyOf(i.id)
      if (!multi && f !== mode) continue
      possible++
      const v = values[i.id]
      if (v == null) continue
      const n = mode === 'weighted' ? percentileScore(i, v, f, ctx) : normalise(i.id, v)
      if (n == null) continue
      const isBorrowed = inherited?.has(i.id) && !isRegionOnly(f)
      ;((isBorrowed ? borrowed : own)[f] ||= []).push(n)
    }
    // Single-source views never show borrowed values; combined views use them only as a fallback.
    const usingBorrowed = !Object.keys(own).length && multi
    const fam = usingBorrowed ? borrowed : own
    used += Object.values(fam).reduce((s, ns) => s + ns.length, 0)
    const scores = Object.fromEntries(Object.entries(fam).map(([f, ns]) => [f, avg(ns)]))
    bySource[c.id] = scores
    const list = Object.values(scores)
    if (mode === 'weighted') {
      const ws = Object.fromEntries(Object.keys(scores).map((f) => [f, sourceWeight(f, ctx, usingBorrowed)]))
      sourceWeights[c.id] = ws
      const W = Object.values(ws).reduce((s, x) => s + x.w, 0)
      const mean = W ? Object.entries(scores).reduce((s, [f, x]) => s + ws[f].w * x, 0) / W : null
      categories[c.id] = mean
      spread[c.id] = list.length > 1 && W
        ? Math.sqrt(Object.entries(scores).reduce((s, [f, x]) => s + ws[f].w * (x - mean) ** 2, 0) / W)
        : null
    } else {
      spread[c.id] = list.length > 1 ? Math.max(...list) - Math.min(...list) : null
      categories[c.id] = median(list)
    }
  }
  let wsum = 0, acc = 0
  for (const c of CATEGORIES) {
    if (categories[c.id] == null || !weights[c.id]) continue
    wsum += weights[c.id]
    acc += weights[c.id] * categories[c.id]
  }
  return { score: wsum ? acc / wsum : null, categories, bySource, spread, sourceWeights, coverage: possible ? used / possible : 0 }
}

// Percentile among places of the same type covered by the source; falls back to the fixed domain
// when fewer than 3 places have the value (a percentile of 1–2 places says nothing).
function percentileScore(ind, v, family, ctx) {
  // Province-level statistics are compared against provinces, even when shown for a city.
  const type = isRegionOnly(family) ? 'province' : ctx.type
  const sorted = ctx.dist?.[type]?.[ind.id]
  if (!sorted || sorted.length < 3) return normalise(ind.id, v)
  const p = percentile(sorted, v)
  return ind.better === 'high' ? p : 100 - p
}

// Sorted own (non-borrowed) values per entity type and indicator.
function distributions(entities) {
  const dist = { city: {}, province: {} }
  for (const e of entities) {
    for (const i of SCORED) {
      const v = e.values[i.id]
      if (v == null || e.inherited?.has(i.id)) continue
      ;(dist[e.type][i.id] ||= []).push(v)
    }
  }
  for (const t of Object.values(dist)) for (const a of Object.values(t)) a.sort((x, y) => x - y)
  return dist
}

const ctxOf = (e, dist) => ({ type: e.type === 'national' ? 'province' : e.type, details: e.details, dist })

export function countQuakesNear(quakes, lat, lon, km = 200) {
  if (!quakes) return null
  let n = 0
  for (const q of quakes) if (Math.abs(q.lat - lat) < 2.5 && haversineKm(lat, lon, q.lat, q.lon) <= km) n++
  return n
}

/** Dataset values per place for a country: depends only on its boundaries, places and datasets. */
export const resolveCountry = (provincesGeo, cities, datasets = []) =>
  resolvePlaces({ regionIds: provincesGeo.features.map((f) => f.properties.id), places: cities, datasets })

// Points that need live data: every city, plus provinces that have no city to aggregate from.
export function livePoints(provincesGeo, cities) {
  const withCities = new Set(cities.map((c) => c.region))
  const provPts = provincesGeo.features
    .filter((f) => !withCities.has(f.properties.id))
    .map((f) => {
      const [lon, lat] = labelPoint(f)
      return { id: `prov:${f.properties.id}`, lat, lon }
    })
  return [...cities.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon })), ...provPts]
}

export function liveValuesFor(id, lat, lon, live) {
  const clim = live.climate?.[id]
  return {
    climateComfort: clim?.climateComfort ?? null,
    meanTemp: clim?.meanTemp ?? null,
    annualPrecip: clim?.annualPrecip ?? null,
    snowfall: clim?.snowfall ?? null,
    sunshine: clim?.sunshine ?? null,
    elevation: clim?.elevation ?? null,
    aqi: live.aqi?.[id] ?? null,
    tempMaxAnnual: clim?.tempMaxAnnual ?? null,
    tempMinAnnual: clim?.tempMinAnnual ?? null,
    uvMean: live.uv?.[id]?.uvMean ?? null,
    floodWatch: live.flood?.[id]?.river ? live.flood[id].floodWatch : null,
    floodPeakPast: live.flood?.[id]?.river ? live.flood[id].pastPeakRatio : null,
    quakes: live.quakes ? countQuakesNear(live.quakes, lat, lon) : null,
  }
}

/**
 * Scored places of a country.
 * @param provincesGeo  region boundaries (FeatureCollection, properties.id / name)
 * @param cities        places: the country's curated list or Natural Earth's ({ id, name, region, lat, lon, pop, codes })
 * @param datasets      the country's datasets (countries/<ISO3>/data), see src/core/resolve.js
 * @param base          resolvePlaces() of the same geo, cities and datasets, when the caller keeps it between builds
 * @param live          live layers (useLiveData)
 */
export function buildEntities({ provincesGeo, cities, datasets = [], base = resolveCountry(provincesGeo, cities, datasets), live, weights, sourceMode = 'combined' }) {
  // Cities: dataset values (own or borrowed from the region) + live. Copied: `base` outlives this build.
  const cityEntities = cities.map((c) => {
    const b = base.cities[c.id]
    const values = { ...b.values }, inherited = new Set(b.inherited), details = b.details
    const lv = liveValuesFor(c.id, c.lat, c.lon, live)
    for (const k of LIVE_KEYS) values[k] = lv[k]
    return {
      type: 'city', id: c.id, name: c.name, province: c.region, lat: c.lat, lon: c.lon,
      capital: c.capital, codes: c.codes || {}, values, inherited, details,
    }
  })

  // Regions: dataset values + live aggregated from their cities (population-weighted), or their own point.
  const provEntities = provincesGeo.features.map((f) => {
    const id = f.properties.id
    const [lon, lat] = labelPoint(f)
    const own = cityEntities.filter((c) => c.province === id)
    const r = base.regions[id]
    const values = { ...r.values }
    for (const k of LIVE_KEYS) values[k] = own.length ? weightedMean(own, k) : null
    if (!own.length) Object.assign(values, liveValuesFor(`prov:${id}`, lat, lon, live))
    return { type: 'province', id, name: f.properties.name, lat, lon, values, cityCount: own.length, details: r.details, inheritable: r.inheritable }
  })

  const all = [...provEntities, ...cityEntities]
  const dist = distributions(all)
  for (const e of all) {
    const ctx = ctxOf(e, dist)
    Object.assign(e, scoreValues(e.values, weights, sourceMode, e.inherited, ctx))
    // Both integration methods, always, so reports can compare them side by side.
    e.compare = {
      combined: scoreValues(e.values, weights, 'combined', e.inherited, ctx),
      weighted: scoreValues(e.values, weights, 'weighted', e.inherited, ctx),
    }
  }
  rank(provEntities)
  rank(cityEntities)

  const provinceName = Object.fromEntries(provEntities.map((p) => [p.id, p.name]))
  cityEntities.forEach((c) => (c.provinceName = provinceName[c.province] || ''))

  const national = nationalAverage(provEntities, weights, sourceMode, dist)
  national.details = base.national.details
  return { provinces: provEntities, cities: cityEntities, national, dist, ranges: valueRanges(all), datasets: base.meta }
}

function rank(list) {
  const sorted = [...list].filter((e) => e.score != null).sort((a, b) => b.score - a.score)
  sorted.forEach((e, i) => (e.rank = i + 1))
  list.forEach((e) => (e.rankOf = sorted.length))
}

function nationalAverage(provinces, weights, sourceMode, dist) {
  const values = {}
  for (const ind of INDICATORS) values[ind.id] = weightedMean(provinces, ind.id)
  const totalPop = provinces.reduce((s, p) => s + (p.values.pop || 0), 0)
  values.pop = totalPop || null
  const ctx = { type: 'province', dist }
  return {
    type: 'national', id: 'national', name: 'National average', values, ...scoreValues(values, weights, sourceMode, null, ctx),
    compare: { combined: scoreValues(values, weights, 'combined', null, ctx), weighted: scoreValues(values, weights, 'weighted', null, ctx) },
  }
}

// For a city typed into search that isn't in our list: score it with live data
// (and what its region's cities borrow from it, when it falls inside the current country).
export function adHocEntity({ place, provinceId, provinceName, provinceEntity, live, weights, sourceMode = 'combined', dist = null }) {
  const prov = { ...provinceEntity?.inheritable }
  const values = { ...prov, pop: place.pop, ...live }
  const e = {
    type: 'city', id: place.id, name: place.name, province: provinceId, provinceName: provinceName || place.admin1 || '',
    lat: place.lat, lon: place.lon, values, inherited: new Set(Object.keys(prov).filter((k) => k !== 'pop')), adHoc: true,
  }
  const ctx = { type: 'city', dist }
  Object.assign(e, scoreValues(values, weights, sourceMode, e.inherited, ctx))
  e.compare = { combined: scoreValues(values, weights, 'combined', e.inherited, ctx), weighted: scoreValues(values, weights, 'weighted', e.inherited, ctx) }
  return e
}
