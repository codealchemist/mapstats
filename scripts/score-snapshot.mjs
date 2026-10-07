// Dumps the scoring model of a country for every source mode, so refactors can be checked
// for behaviour changes:  node scripts/score-snapshot.mjs ARG > before.json  (then diff).
// Live data is replaced by a small deterministic fixture so the live code paths are exercised too.
import fs from 'node:fs'
import { buildEntities, baseCities, adHocEntity } from '../src/lib/scoring.js'
import { countryByIso } from '../src/data/countries.js'
import { DEFAULT_WEIGHTS } from '../src/data/metrics.js'
import { familiesFor } from '../src/data/sources.js'

const iso3 = process.argv[2] || 'ARG'
const country = countryByIso(iso3)
const geo = JSON.parse(fs.readFileSync(`public/geo/${iso3}.json`, 'utf8'))
const ne = JSON.parse(fs.readFileSync(`public/geo/${iso3}-cities.json`, 'utf8'))
const cities = baseCities(country, ne).filter((c) => c.province)

// Deterministic pseudo-live values for the first few cities and one city-less province point.
const fixture = (ids) => {
  const live = { climate: {}, aqi: {}, uv: {}, flood: {}, quakes: [] }
  ids.forEach((id, i) => {
    live.climate[id] = { climateComfort: 40 + i * 7, meanTemp: 12 + i, annualPrecip: 600 + i * 50, snowfall: i, sunshine: 2000 + i * 30, elevation: 100 * i, tempMaxAnnual: 35 + i, tempMinAnnual: -2 + i }
    if (i % 2 === 0) live.aqi[id] = 20 + i * 5
    if (i % 3 === 0) live.uv[id] = { uvMean: 4 + i * 0.3, uvMax: 9 }
    if (i % 4 === 0) live.flood[id] = { river: true, floodWatch: 0.5 + i * 0.1, pastPeakRatio: 1.1, highWater: 100, forecastPeak: 60, normalFlow: 20 }
  })
  const c0 = cities[0]
  live.quakes = [{ lat: c0.lat + 0.3, lon: c0.lon + 0.3, mag: 5.2, time: '2001-01-01' }, { lat: c0.lat - 0.5, lon: c0.lon, mag: 5.8, time: '2011-01-01' }]
  return live
}
const liveIds = [...cities.slice(0, 6).map((c) => c.id), `prov:${geo.features.find((f) => !cities.some((c) => c.province === f.properties.id))?.properties.id}`]

const pick = (e) => ({
  id: e.id, type: e.type, name: e.name, province: e.province, provinceName: e.provinceName, score: e.score, rank: e.rank, rankOf: e.rankOf,
  categories: e.categories, bySource: e.bySource, spread: e.spread, sourceWeights: e.sourceWeights, coverage: e.coverage,
  values: e.values, inherited: e.inherited ? [...e.inherited].sort() : null, compare: e.compare,
})

const out = {}
for (const live of [{}, fixture(liveIds)]) {
  for (const f of familiesFor(iso3)) {
    const m = buildEntities({ country, provincesGeo: geo, cities, live, weights: DEFAULT_WEIGHTS, sourceMode: f.id })
    const key = `${Object.keys(live).length ? 'live' : 'empty'}:${f.id}`
    const prov = m.provinces.find((p) => p.id === cities[0].province)
    out[key] = {
      provinces: m.provinces.map(pick), cities: m.cities.map(pick), national: pick(m.national),
      adhoc: pick(adHocEntity({
        place: { id: 'adhoc:1', name: 'Somewhere', lat: prov.lat, lon: prov.lon, pop: 12345 }, provinceId: prov.id, provinceName: prov.name,
        provinceEntity: prov, country, live: { quakes: 1, aqi: 33, climateComfort: 55, meanTemp: 14 }, weights: DEFAULT_WEIGHTS, sourceMode: f.id, dist: m.dist,
      })),
      adhocNoProvince: pick(adHocEntity({ place: { id: 'adhoc:2', name: 'Elsewhere', lat: 0, lon: 0, pop: 1 }, country, live: { climateComfort: 70 }, weights: DEFAULT_WEIGHTS, sourceMode: f.id, dist: m.dist })),
    }
  }
}
process.stdout.write(JSON.stringify(out, null, 1))
