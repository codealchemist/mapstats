// BAAC accident files → deaths per département and year, rates over INSEE population. Pure.
//
// Rules (see the ONISR variable description shipped with the dataset):
//  - A death is a road user with grav = 2 ("tué": died within 30 days of the accident).
//  - Users are joined to their accident (Num_Acc; "Accident_Id" in the 2022 file) for the département of the accident;
//    one row per user, so nothing is multiplied through vehicles. Département codes are zero-padded (the 2019 file
//    writes "1" for Ain).
//  - Only the départements of the map are kept (Saint-Pierre-et-Miquelon, Saint-Martin, Saint-Barthélemy,
//    Wallis-et-Futuna, Polynésie and Nouvelle-Calédonie are counted but dropped).
//  - Rates are deaths / INSEE population at 1 January of the same year × 100,000, rounded to 2 decimals; 3-year
//    averages need all three years. National = Σ deaths / Σ population over the same départements.
import { DEP_TO_MAP, DEPS, meanOf, round, withCityJurisdictions } from '../../lib/fr.mjs'

export const KILLED = '2'

/** "caractéristiques" rows → Map accident id → département code, zero-padded. */
export function accidentDepartments(rows) {
  const m = new Map()
  for (const r of rows) {
    const d = r.dep ?? ''
    m.set(r.Num_Acc ?? r.Accident_Id, d.length === 1 ? `0${d}` : d)
  }
  return m
}

/** "usagers" rows + their accidents' départements → { byRegion: { regionId: killed }, killed, outside, unknown }. */
export function killedByDepartment(rows, departments) {
  const byRegion = {}
  let killed = 0, outside = 0, unknown = 0
  for (const r of rows) {
    if (r.grav !== KILLED) continue
    killed++
    const d = departments.get(r.Num_Acc ?? r.Accident_Id)
    const id = DEP_TO_MAP[d]
    if (!id) { d ? outside++ : unknown++; continue }
    byRegion[id] = (byRegion[id] || 0) + 1
  }
  return { byRegion, killed, outside, unknown }
}

const rate = (n, p) => (n == null || !p ? null : round((n / p) * 1e5))

/**
 * Deaths per region and year + population per region and year → the dataset's parts.
 * @param deaths      { regionId: { year: killed } } (a region with no row had 0 deaths that year)
 * @param population  { regionId: { year: persons } }
 */
export function toValues({ years, deaths, population }, { deps = DEPS, names = {} } = {}) {
  const regions = deps.map((d) => DEP_TO_MAP[d])
  const summarise = (count, popOf, extra = {}) => {
    const series = years.map((y) => rate(count(y), popOf(y)))
    return { latestYear: years.at(-1), latest: { roadDeaths: series.at(-1) }, counts: { roadDeaths: count(years.at(-1)) }, avg3: { roadDeaths: meanOf(series.slice(-3)) }, series: { roadDeaths: series }, ...extra }
  }
  const parts = { values: { national: {}, region: {} }, names: { region: {} }, series: { years, national: {}, region: {} }, details: { national: {}, region: {} } }
  const put = (level, id, s, name) => {
    parts.values[level][id] = { roadDeaths: s.avg3.roadDeaths }
    parts.series[level][id] = s.series
    parts.details[level][id] = { latestYear: s.latestYear, latest: s.latest, counts: s.counts, avg3: s.avg3, ...(s.deaths && { deaths: s.deaths }) }
    if (name) parts.names[level][id] = name
  }
  for (const id of regions) {
    put('region', id, summarise((y) => deaths[id]?.[y] ?? 0, (y) => population[id]?.[y] ?? null, { deaths: Object.fromEntries(years.map((y) => [y, deaths[id]?.[y] ?? 0])) }), names[id])
  }
  const total = (y) => regions.reduce((s, id) => s + (deaths[id]?.[y] ?? 0), 0)
  const totalPop = (y) => (regions.every((id) => population[id]?.[y]) ? regions.reduce((s, id) => s + population[id][y], 0) : null)
  put('national', 'FRA', summarise(total, totalPop))
  const latest = years.at(-1)
  return { ...withCityJurisdictions(parts), period: { latest, aggregation: `mean of ${latest - 2}–${latest} (per 100,000)` } }
}
