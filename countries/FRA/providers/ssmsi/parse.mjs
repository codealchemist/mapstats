// SSMSI département base (one row per département, year and indicator) → yearly rates, 3-year averages and the
// theft composite. Pure: the test runs it on fixtures/.
//
// Rules (see the methodology note shipped with the dataset):
//  - Facts are counted by place of commission (fraud by the victim's residence); each indicator has its own counting
//    unit (victims, offences, vehicles, persons charged), so indicators are never summed, except the composite below.
//  - Rates are used as published ("taux pour mille") × 100 → per 100,000, rounded to 2 decimals. Burglaries are per
//    1,000 dwellings in the source and stay per 100,000 dwellings here.
//  - propertyCrime, the one composite: the seven theft and robbery categories added up per département and year,
//    over the population (burglaries by count, not by dwelling rate). The categories are disjoint in the SSMSI
//    nomenclature; it is the French counterpart of SNIC's "robberies + thefts".
//  - 3-year averages need all three annual rates; the "Usage de stupéfiants" AFD / hors AFD sub-splits are skipped.
//  - National rates = Σ facts / Σ the matching denominator over the départements of the map (no national row is
//    published); Mayotte's population is frozen at the 2017 census in the source, so its rates are as published.
import { num } from '#sdk'
import { DEP_TO_MAP, DEPS, meanOf, round, withCityJurisdictions } from '../../lib/fr.mjs'

// MapStats key → SSMSI "indicateur" label and the denominator column of its published rate.
export const METRICS = {
  homicide: { indicator: 'Homicides', per: 'insee_pop', series: true },
  homicideAttempt: { indicator: "Tentatives d'homicide", per: 'insee_pop' },
  domesticViolence: { indicator: 'Violences physiques intrafamiliales', per: 'insee_pop' },
  assault: { indicator: 'Violences physiques hors cadre familial', per: 'insee_pop' },
  sexualViolence: { indicator: 'Violences sexuelles', per: 'insee_pop' },
  armedRobbery: { indicator: 'Vols avec armes', per: 'insee_pop' },
  violentTheft: { indicator: 'Vols violents sans arme', per: 'insee_pop' },
  theftFromPersons: { indicator: 'Vols sans violence contre des personnes', per: 'insee_pop' },
  burglary: { indicator: 'Cambriolages de logement', per: 'insee_log' },
  vehicleTheft: { indicator: 'Vols de véhicule', per: 'insee_pop' },
  theftFromVehicles: { indicator: 'Vols dans les véhicules', per: 'insee_pop' },
  vehicleAccessoryTheft: { indicator: "Vols d'accessoires sur véhicules", per: 'insee_pop' },
  vandalism: { indicator: 'Destructions et dégradations volontaires', per: 'insee_pop' },
  drugUse: { indicator: 'Usage de stupéfiants', per: 'insee_pop' },
  drugTrafficking: { indicator: 'Trafic de stupéfiants', per: 'insee_pop' },
  fraud: { indicator: 'Escroqueries et fraudes aux moyens de paiement', per: 'insee_pop' },
  propertyCrime: { indicator: null, per: 'insee_pop', series: true, composite: ['armedRobbery', 'violentTheft', 'theftFromPersons', 'burglary', 'vehicleTheft', 'theftFromVehicles', 'vehicleAccessoryTheft'] },
}
const byIndicator = Object.fromEntries(Object.entries(METRICS).filter(([, m]) => m.indicator).map(([k, m]) => [m.indicator, k]))
const SCORED = ['homicide', 'propertyCrime']

/** Rows of the département CSV → { data: dep → year → key → { n, rate (per mille), pop, log }, used, skipped }. */
export function ingest(rows, { deps = DEPS } = {}) {
  const data = {}
  let used = 0, skipped = 0
  for (const r of rows) {
    const k = byIndicator[r.indicateur]
    const dep = r.Code_departement
    if (!k || !deps.includes(dep)) { skipped++; continue }
    ;((data[dep] ||= {})[num(r.annee)] ||= {})[k] = { n: num(r.nombre), rate: num(r.taux_pour_mille), pop: num(r.insee_pop), log: num(r.insee_log) }
    used++
  }
  for (const [k, m] of Object.entries(METRICS).filter(([, m]) => m.composite)) {
    for (const byYear of Object.values(data)) {
      for (const year of Object.values(byYear)) {
        const parts = m.composite.map((p) => year[p])
        if (parts.some((p) => p?.n == null)) continue
        const n = parts.reduce((s, p) => s + p.n, 0)
        year[k] = { n, rate: parts[0].pop ? (n / parts[0].pop) * 1000 : null, pop: parts[0].pop, log: null }
      }
    }
  }
  return { data, used, skipped }
}

/** One area's years → latest-year rates and counts, 3-year averages and the scored series (per 100,000). */
export function summarise(byYear, years) {
  const latestYear = years.at(-1)
  const out = { latestYear, latest: {}, counts: {}, avg3: {}, series: {} }
  for (const [k, m] of Object.entries(METRICS)) {
    const s = years.map((y) => round(byYear[y]?.[k]?.rate == null ? null : byYear[y][k].rate * 100))
    out.latest[k] = s.at(-1)
    out.counts[k] = byYear[latestYear]?.[k]?.n ?? null
    out.avg3[k] = meanOf(s.slice(-3))
    if (m.series) out.series[k] = s
  }
  return out
}

/** National = Σ facts / Σ denominators over `deps`, in the per-mille form the départements use; null unless every département has the year. */
export function national(data, years, { deps = DEPS } = {}) {
  const out = {}
  for (const y of years) {
    out[y] = {}
    for (const [k, m] of Object.entries(METRICS)) {
      let n = 0, den = 0, ok = true
      for (const dep of deps) {
        const c = data[dep]?.[y]?.[k]
        if (!c || c.n == null) { ok = false; break }
        n += c.n
        den += m.per === 'insee_log' ? c.log : c.pop
      }
      out[y][k] = ok && den ? { n, rate: (n / den) * 1000 } : { n: null, rate: null }
    }
  }
  return out
}

/** The dataset's parts (values, names, series, details, period) from the CSV rows. */
export function toValues(rows, { deps = DEPS, names = {} } = {}) {
  const { data, used, skipped } = ingest(rows, { deps })
  const years = [...new Set(Object.values(data).flatMap((d) => Object.keys(d).map(Number)))].sort((a, b) => a - b)
  if (!years.length) throw new Error('no SSMSI rows for the départements of the map')
  const latest = years.at(-1)
  const parts = { values: { national: {}, region: {} }, names: { region: {} }, series: { years, national: {}, region: {} }, details: { national: {}, region: {} } }
  const put = (level, id, s, name) => {
    parts.values[level][id] = Object.fromEntries(SCORED.map((k) => [k, s.avg3[k]]))
    parts.series[level][id] = s.series
    parts.details[level][id] = { latestYear: s.latestYear, latest: s.latest, counts: s.counts, avg3: s.avg3 }
    if (name) parts.names[level][id] = name
  }
  put('national', 'FRA', summarise(national(data, years, { deps }), years))
  for (const dep of deps.filter((d) => data[d])) put('region', DEP_TO_MAP[dep], summarise(data[dep], years), names[DEP_TO_MAP[dep]])
  return { ...withCityJurisdictions(parts), period: { latest, aggregation: `mean of ${latest - 2}–${latest} (per 100,000)` }, years, used, skipped }
}
