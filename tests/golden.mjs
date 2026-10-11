// npm run golden — the scoring pipeline's output for fixed inputs, compared against tests/golden/*.json.
// Guards refactors that must not change any score. After an intended change: npm run golden -- --update
import fs from 'node:fs'
import { buildEntities, adHocEntity, livePoints, resolveCountry } from '../src/lib/scoring.js'
import { countryByIso } from '../src/core/countries.js'
import { DEFAULT_WEIGHTS, INDICATORS } from '../src/data/metrics.js'
import { SOURCE_FAMILIES, familyOf } from '../src/core/providers.js'
import { loadCountry } from '../tools/cli/context.mjs'
import { STANDARDS } from '../src/data/standards.js'

const UPDATE = process.argv.includes('--update')
const MODES = ['combined', 'weighted', 'snic', 'openmeteo', 'usgs', 'provincial']
const WEIGHTS = [DEFAULT_WEIGHTS, { ...DEFAULT_WEIGHTS, safety: 60, economy: 0 }]
const dir = new URL('./golden/', import.meta.url)

// Deterministic pseudo-random number in [0, 1) per (id, salt).
function rand(id, salt) {
  let h = 2166136261
  for (const ch of `${id}|${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 100000) / 100000
}
const between = (id, salt, lo, hi, digits = 1) => +(lo + rand(id, salt) * (hi - lo)).toFixed(digits)

// Live layers shaped like useLiveData's output, for every point the app would fetch.
function fakeLive(points) {
  const live = { climate: {}, aqi: {}, thermal: {}, uv: {}, flood: {}, quakes: [] }
  for (const { id, lat, lon } of points) {
    live.climate[id] = {
      climateComfort: between(id, 'cc', 30, 90, 0), meanTemp: between(id, 'mt', 5, 25), annualPrecip: between(id, 'ap', 100, 2000, 0),
      snowfall: between(id, 'sn', 0, 80, 0), sunshine: between(id, 'su', 1500, 3200, 0), elevation: between(id, 'el', 0, 3500, 0),
      tempMaxAnnual: between(id, 'tx', 28, 44), tempMinAnnual: between(id, 'tn', -15, 8),
      hotDays: between(id, 'hd', 0, 40, 0), tropicalNights: between(id, 'trn', 0, 60, 0), frostDays: between(id, 'fd', 0, 90, 0), heavyRainDays: between(id, 'hr', 0, 15, 0), drySpell: between(id, 'ds', 5, 90, 0),
    }
    if (rand(id, 'aqi?') > 0.1) live.aqi[id] = { aqi: between(id, 'aqi', 10, 70, 0), usAqi: between(id, 'usaqi', 15, 120, 0), pm25: between(id, 'pm25', 2, 40), aqiRecent: between(id, 'aqr', 10, 70, 0), pm25WorstDay: between(id, 'pmw', 10, 90), aqiPoorDays: between(id, 'apd', 0, 60, 0), usAqiUnhealthyDays: between(id, 'uud', 0, 30, 0), pm25HighDays: between(id, 'phd', 0, 50, 0) }
    live.uv[id] = { uvMean: between(id, 'uv', 3, 12), uvMax: between(id, 'uvx', 8, 16) }
    live.thermal[id] = { thermalNws: between(id, 'tnws', 40, 100, 0), thermalEccc: between(id, 'teccc', 35, 100, 0), heatDangerDays: between(id, 'hdd', 0, 20, 0), humidexDangerDays: between(id, 'xdd', 0, 15, 0), frostbiteDays: between(id, 'fbd', 0, 10, 0) }
    live.flood[id] = rand(id, 'river') > 0.4 ? { river: true, floodWatch: between(id, 'fw', 0.3, 2, 2), pastPeakRatio: between(id, 'pp', 1, 3, 2) } : { river: false }
    const n = Math.floor(rand(id, 'nq') * 6)
    for (let k = 0; k < n; k++) live.quakes.push({ lat: lat + between(id, `qa${k}`, -1, 1, 3), lon: lon + between(id, `qo${k}`, -1, 1, 3), mag: 5 })
  }
  return live
}

// Null and absent mean the same to every consumer, so only values that exist are compared.
const present = (values) => Object.fromEntries(Object.entries(values).filter(([, v]) => v != null))
const borrowed = (e) => (e.inherited ? [...e.inherited].filter((k) => e.values[k] != null).sort() : null)
// Which providers have data for the place, at which level.
const detailLevels = (e) => Object.fromEntries(Object.entries(e.details || {}).map(([p, d]) => [p, d.level]))
const r6 = (v) => (typeof v === 'number' ? +v.toFixed(6) : v)
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => r6(v)))
const pick = (e) => ({
  id: e.id, type: e.type, score: e.score, rank: e.rank, rankOf: e.rankOf, coverage: e.coverage,
  categories: e.categories, bySource: e.bySource, spread: e.spread,
  sourceWeights: e.sourceWeights,
})

async function snapshot(iso3) {
  const country = countryByIso(iso3)
  const { geo, places, datasets } = await loadCountry(country)
  const cities = places.filter((c) => c.region) // as the app loads them (useCountryData)
  const resolved = resolveCountry(geo, cities, datasets)
  const live = fakeLive(livePoints(geo, cities))
  const out = { entities: {}, runs: {} }
  const base = buildEntities({ provincesGeo: geo, cities, base: resolved, live, weights: DEFAULT_WEIGHTS })
  for (const e of [...base.provinces, ...base.cities, base.national]) {
    out.entities[e.id] = { name: e.name, province: e.province, values: present(e.values), inherited: borrowed(e), details: detailLevels(e) }
  }
  out.ranges = base.ranges
  out.families = Object.fromEntries(SOURCE_FAMILIES.map((f) => [f.id, f.label]))
  out.indicators = Object.fromEntries(INDICATORS.map((i) => [i.id, { family: familyOf(i.id) }]))
  WEIGHTS.forEach((weights, w) => {
    for (const mode of MODES) {
      const m = buildEntities({ provincesGeo: geo, cities, base: resolved, live, weights, sourceMode: mode })
      out.runs[`w${w}:${mode}`] = [...m.provinces, ...m.cities, m.national].map(pick)
      // A searched place inside the first region, scored with the first city's live values.
      const prov = m.provinces[0], c0 = base.cities[0]
      const adHoc = adHocEntity({
        place: { id: 'geo-1', name: 'Searched place', lat: c0.lat + 0.1, lon: c0.lon, pop: 25000 },
        provinceId: prov.id, provinceName: prov.name, provinceEntity: prov, country, weights, sourceMode: mode, dist: m.dist,
        live: Object.fromEntries(Object.entries(c0.values).filter(([k]) => ['climateComfort', 'aqi', 'quakes', 'meanTemp'].includes(k))),
      })
      out.runs[`w${w}:${mode}`].push({ ...pick(adHoc), values: present(adHoc.values), inherited: borrowed(adHoc) })
    }
  })
  // Every alternative standard, default weights, median of sources: each scores every place alike.
  for (const [ind, s] of Object.entries(STANDARDS)) {
    for (const o of s.options.filter((x) => x.id !== s.default)) {
      const m = buildEntities({ provincesGeo: geo, cities, base: resolved, live, weights: DEFAULT_WEIGHTS, standards: { [ind]: o.id } })
      out.runs[`std:${ind}=${o.id}`] = [...m.provinces, ...m.cities, m.national].map(pick)
    }
  }
  return round(out)
}

function diff(a, b, path = '', out = []) {
  if (out.length >= 15) return out
  if (a === b) return out
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) { out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`); return out }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, out)
  return out
}

let failures = 0
for (const iso3 of ['ARG', 'BOL']) {
  const file = new URL(`${iso3}.json`, dir)
  const got = await snapshot(iso3)
  if (UPDATE || !fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(got))
    console.log(`✓ ${iso3}: snapshot written`)
    continue
  }
  const d = diff(JSON.parse(fs.readFileSync(file, 'utf8')), got)
  if (d.length) { failures++; console.log(`✗ ${iso3}: output differs from the snapshot\n  ${d.join('\n  ')}`) }
  else console.log(`✓ ${iso3}: identical to the snapshot (${Object.keys(got.entities).length} places × ${Object.keys(got.runs).length} runs)`)
}
if (failures) process.exit(1)
