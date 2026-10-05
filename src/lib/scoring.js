// MapStats livability score.
//
// 1. Each indicator is normalised to 0–100 on its fixed domain (metrics.js),
//    flipped when lower is better, and clamped.
// 2. A category score is the mean of its available indicator scores.
// 3. The MapStats score is the weight-averaged category score, renormalising
//    weights over the categories that have data, so missing data neither
//    rewards nor punishes a place. `coverage` reports how much data was used.

import { CATEGORIES, INDICATORS, indicatorById } from '../data/metrics.js'
import { PROVINCES as AR_PROVINCES, CITIES as AR_CITIES, SNIC } from '../data/argentina.js'
import { haversineKm, labelPoint } from './geo.js'
import { familyOf, isMultiSource } from '../data/sources.js'
import { sourceWeight, percentile } from './sourceWeights.js'

const SCORED = INDICATORS.filter((i) => i.better)
const NUMBEO_KEYS = ['crimeIndex', 'healthcareIndex', 'pollutionIndex', 'trafficIndex', 'costOfLiving', 'purchasingPower', 'qualityOfLife']
const LIVE_KEYS = ['climateComfort', 'meanTemp', 'annualPrecip', 'snowfall', 'sunshine', 'elevation', 'aqi', 'quakes', 'tempMaxAnnual', 'tempMinAnnual', 'uvMean', 'floodWatch', 'floodPeakPast']

// True when the entity's value for `id` was measured for the entity itself (not copied from its province).
export const isOwnValue = (entity, id) => entity.values[id] != null && !entity.inherited?.has(id)

// City-level value or null: never falls back to the province baseline.
export const ownValue = (entity, id) => (isOwnValue(entity, id) ? entity.values[id] : null)

export function normalise(id, v) {
  const ind = indicatorById[id]
  if (v == null || !ind?.better) return null
  const [lo, hi] = ind.domain
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
 * fill a category only when no source has local data for it. Provincial statistics are
 * province-level by nature and always count.
 * ctx: { type, snic, numbeo, dist } — dist[type][indicator] = sorted own values (for percentiles).
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
      const isBorrowed = inherited?.has(i.id) && f !== 'provincial'
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
  const type = family === 'provincial' ? 'province' : ctx.type
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

const ctxOf = (e, dist) => ({ type: e.type === 'national' ? 'province' : e.type, snic: e.snic, numbeo: e.numbeo, dist })

const weightedMean = (items, key) => {
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

export function countQuakesNear(quakes, lat, lon, km = 200) {
  if (!quakes) return null
  let n = 0
  for (const q of quakes) if (Math.abs(q.lat - lat) < 2.5 && haversineKm(lat, lon, q.lat, q.lon) <= km) n++
  return n
}

// Points that need live data: every city, plus provinces that have no city to aggregate from.
export function livePoints(provincesGeo, cities) {
  const withCities = new Set(cities.map((c) => c.province))
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

// Base (curated) data for cities in a country. Non-curated countries use Natural Earth cities.
export function baseCities(country, neCities) {
  return country.curated && country.iso3 === 'ARG' ? AR_CITIES : neCities
}

export function buildEntities({ country, provincesGeo, cities, live, weights, sourceMode = 'combined' }) {
  const curated = country.iso3 === 'ARG' ? AR_PROVINCES : {}

  // Province-level Numbeo baseline (population-weighted over cities Numbeo covers), so
  // uncovered towns are compared on the same indicators instead of silently skipping them.
  const numbeoBaseline = {}
  for (const c of cities) {
    if (!NUMBEO_KEYS.some((k) => c[k] != null)) continue
    const b = (numbeoBaseline[c.province] ||= [])
    b.push({ values: { ...Object.fromEntries(NUMBEO_KEYS.map((k) => [k, c[k] ?? null])), pop: c.pop } })
  }

  // Cities: province baseline -> city-specific (Numbeo) -> live.
  const cityEntities = cities.map((c) => {
    const prov = curated[c.province] || {}
    const values = { ...prov, pop: c.pop }
    const inherited = new Set(Object.keys(prov).filter((k) => k !== 'pop'))
    for (const k of NUMBEO_KEYS) {
      if (c[k] != null) values[k] = c[k]
      else if (numbeoBaseline[c.province]) {
        values[k] = weightedMean(numbeoBaseline[c.province], k)
        if (values[k] != null) inherited.add(k)
      }
    }
    // Values measured for the city itself (e.g. its SNIC department) override the province baseline.
    for (const [k, v] of Object.entries(c.ownValues || {})) {
      values[k] = v
      inherited.delete(k)
    }
    const lv = liveValuesFor(c.id, c.lat, c.lon, live)
    for (const k of LIVE_KEYS) values[k] = lv[k]
    return {
      type: 'city', id: c.id, name: c.name, province: c.province, lat: c.lat, lon: c.lon,
      capital: c.capital, numbeoSlug: c.numbeoSlug, values, inherited, snic: c.snic || null,
      numbeo: c.numbeoSource ? { source: c.numbeoSource, fetchedAt: c.numbeoFetchedAt, contributors: c.numbeoContributors, survey: c.numbeoSurvey, safetyIndex: c.safetyIndex ?? null } : null,
    }
  })

  // Provinces: curated values, Numbeo + live aggregated from their cities (population-weighted).
  const provEntities = provincesGeo.features.map((f) => {
    const id = f.properties.id
    const [lon, lat] = labelPoint(f)
    const own = cityEntities.filter((c) => c.province === id)
    const values = { ...(curated[id] || {}) }
    if (values.pop) values.pop *= 1000
    for (const k of LIVE_KEYS) values[k] = own.length ? weightedMean(own, k) : null
    for (const k of NUMBEO_KEYS) values[k] = numbeoBaseline[id] ? weightedMean(numbeoBaseline[id], k) : null
    if (!own.length) Object.assign(values, liveValuesFor(`prov:${id}`, lat, lon, live))
    const snic = country.iso3 === 'ARG' && SNIC.provinces?.[id] ? { level: 'province', ...SNIC.provinces[id] } : null
    return { type: 'province', id, name: f.properties.name, lat, lon, values, cityCount: own.length, snic }
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
  if (country.iso3 === 'ARG' && SNIC.national) national.snic = { ...SNIC.national, years: SNIC.years }
  return { provinces: provEntities, cities: cityEntities, national, dist, snicOrigin: country.iso3 === 'ARG' ? SNIC.origin || null : null }
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
// (and its province's curated baseline when it falls inside the current country).
export function adHocEntity({ place, provinceId, provinceName, provinceEntity, country, live, weights, sourceMode = 'combined', dist = null }) {
  const prov = { ...(country.iso3 === 'ARG' ? AR_PROVINCES[provinceId] || {} : {}) }
  for (const k of NUMBEO_KEYS) if (provinceEntity?.values[k] != null) prov[k] = provinceEntity.values[k]
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
