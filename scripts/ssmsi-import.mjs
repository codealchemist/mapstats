// Imports the SSMSI departmental base of recorded crime (police + gendarmerie nationales) into
// src/data/ssmsi-france.json.
//
// 1. npm run ssmsi:import -- --download     fetches the department CSV once from data.gouv.fr into
//    data/ssmsi/raw/ (dataset "Bases statistiques communale, départementale et régionale de la
//    délinquance enregistrée", Licence Ouverte 2.0). Or drop the CSV there by hand.
// 2. npm run ssmsi:import                   (offline; re-run any time)
//
// Rules applied (see the SSMSI methodology note shipped with the dataset):
//  - Facts are counted by place of commission (fraud by victim's residence); each indicator has its
//    own counting unit (victims, offences, vehicles, persons charged), so indicators are never summed.
//  - Rates are used as published ("taux pour mille") × 100 → per 100,000, rounded to 2 decimals.
//    Burglaries are per 1,000 dwellings in the source and stay per 100,000 dwellings here.
//  - National rates = Σ facts / Σ the matching denominator (insee_pop, or insee_log for burglaries)
//    over the 101 departments of the map; no national row is published in this base.
//  - 3-year averages need all three annual rates; the "Usage de stupéfiants" AFD / hors AFD
//    sub-splits are skipped (the total is kept).
//  - Mayotte's population is frozen at the 2017 census in the source, so its rates use it as published.
import path from 'node:path'
import fs from 'node:fs'
import { DEP_TO_MAP, DEP_NAMES, csvRows, download, fileInfo, hasFlag, meanOf, num, round, today, writeJson } from './lib/fr.mjs'

const RAW = path.resolve(process.env.SSMSI_RAW || 'data/ssmsi/raw')
const OUT = path.resolve('src/data/ssmsi-france.json')
const RESOURCE = 'https://www.data.gouv.fr/fr/datasets/r/2b27a675-e3bf-41ef-a852-5fb9ab483967' // DEP CSV, stable resource id
const DATASET = 'https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales'

// SSMSI indicator label -> metric. `per` is the denominator column of the published rate.
export const METRICS = {
  homicide: { indicator: 'Homicides', label: 'Homicides (victims, incl. fatal assaults)', per: 'insee_pop', series: true },
  homicideAttempt: { indicator: "Tentatives d'homicide", label: 'Attempted homicides (victims)', per: 'insee_pop' },
  domesticViolence: { indicator: 'Violences physiques intrafamiliales', label: 'Domestic physical violence (victims)', per: 'insee_pop' },
  assault: { indicator: 'Violences physiques hors cadre familial', label: 'Physical violence outside the family (victims)', per: 'insee_pop' },
  sexualViolence: { indicator: 'Violences sexuelles', label: 'Sexual violence (victims)', per: 'insee_pop' },
  armedRobbery: { indicator: 'Vols avec armes', label: 'Armed robberies (offences)', per: 'insee_pop' },
  violentTheft: { indicator: 'Vols violents sans arme', label: 'Violent thefts without a weapon (offences)', per: 'insee_pop' },
  theftFromPersons: { indicator: 'Vols sans violence contre des personnes', label: 'Non-violent thefts from persons (victims)', per: 'insee_pop' },
  burglary: { indicator: 'Cambriolages de logement', label: 'Residential burglaries (offences)', per: 'insee_log', series: true },
  vehicleTheft: { indicator: 'Vols de véhicule', label: 'Vehicle thefts', per: 'insee_pop' },
  theftFromVehicles: { indicator: 'Vols dans les véhicules', label: 'Thefts from vehicles', per: 'insee_pop' },
  vehicleAccessoryTheft: { indicator: "Vols d'accessoires sur véhicules", label: 'Thefts of vehicle accessories', per: 'insee_pop' },
  vandalism: { indicator: 'Destructions et dégradations volontaires', label: 'Criminal damage (offences)', per: 'insee_pop' },
  drugUse: { indicator: 'Usage de stupéfiants', label: 'Drug use (persons charged)', per: 'insee_pop' },
  drugTrafficking: { indicator: 'Trafic de stupéfiants', label: 'Drug trafficking (persons charged)', per: 'insee_pop' },
  fraud: { indicator: 'Escroqueries et fraudes aux moyens de paiement', label: 'Fraud and payment fraud (victims, by residence)', per: 'insee_pop' },
}
const byIndicator = Object.fromEntries(Object.entries(METRICS).map(([k, m]) => [m.indicator, k]))

async function main() {
  if (hasFlag('--download')) await download(RESOURCE, path.join(RAW, 'donnee-dep-data.gouv.csv'))
  const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => /^donnee-dep.*\.csv$/i.test(f)).map((f) => path.join(RAW, f)) : []
  if (files.length !== 1) {
    console.log(`Expected one SSMSI department CSV (donnee-dep*.csv) in ${path.relative(process.cwd(), RAW)}/, found ${files.length}.\nDownload it from ${DATASET} or run with --download.`)
    process.exitCode = 1
    return
  }
  const [file] = files

  // dep -> year -> metric -> { n, rate, pop, log }
  const data = {}
  let rows = 0, skipped = 0
  for await (const r of csvRows(file)) {
    const k = byIndicator[r.indicateur]
    if (!k) { skipped++; continue }
    const dep = r.Code_departement
    if (!DEP_TO_MAP[dep]) { skipped++; continue }
    const y = num(r.annee)
    ;((data[dep] ||= {})[y] ||= {})[k] = { n: num(r.nombre), rate: num(r.taux_pour_mille), pop: num(r.insee_pop), log: num(r.insee_log) }
    rows++
  }
  const years = [...new Set(Object.values(data).flatMap((d) => Object.keys(d).map(Number)))].sort((a, b) => a - b)
  const latest = years.at(-1)

  const summarise = (byYear) => {
    const out = { latest: {}, counts: {}, avg3: {}, series: {}, latestYear: latest }
    for (const [k, m] of Object.entries(METRICS)) {
      const s = years.map((y) => round(byYear[y]?.[k]?.rate == null ? null : byYear[y][k].rate * 100))
      out.latest[k] = s.at(-1)
      out.counts[k] = byYear[latest]?.[k]?.n ?? null
      out.avg3[k] = meanOf(s.slice(-3))
      if (m.series) out.series[k] = s
    }
    return out
  }

  // National = Σ facts / Σ denominators, in the same per-mille form the departments use.
  const national = {}
  for (const y of years) {
    national[y] = {}
    for (const [k, m] of Object.entries(METRICS)) {
      let n = 0, den = 0, ok = true
      for (const dep of Object.keys(DEP_TO_MAP)) {
        const c = data[dep]?.[y]?.[k]
        if (!c || c.n == null) { ok = false; break }
        n += c.n
        den += m.per === 'insee_log' ? c.log : c.pop
      }
      national[y][k] = ok && den ? { n, rate: (n / den) * 1000 } : { n: null, rate: null }
    }
  }

  const departments = Object.fromEntries(Object.entries(DEP_TO_MAP).filter(([dep]) => data[dep]).map(([dep, id]) => [id, { name: DEP_NAMES[id], code: dep, ...summarise(data[dep]) }]))
  const out = {
    source: `SSMSI – Ministère de l'Intérieur, base statistique départementale de la délinquance enregistrée (${DATASET})`,
    importedAt: today(),
    origin: 'official download from data.gouv.fr (Licence Ouverte 2.0)',
    files: [fileInfo(file)],
    metrics: Object.fromEntries(Object.entries(METRICS).map(([k, m]) => [k, { indicator: m.indicator, label: m.label, unit: m.per === 'insee_log' ? 'per 100k dwellings' : 'per 100k' }])),
    years, latestYear: latest,
    national: summarise(national),
    departments,
  }
  console.log(`${path.basename(file)}: ${rows} rows used, ${skipped} skipped (other indicators / areas)`)
  writeJson(OUT, out, `${Object.keys(departments).length} departments, ${Object.keys(METRICS).length} indicators, years ${years[0]}–${latest}`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
