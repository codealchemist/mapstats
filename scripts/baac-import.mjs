// Imports road deaths by department from the ONISR accident database (BAAC, "Bases de données
// annuelles des accidents corporels de la circulation routière") into src/data/onisr-france.json.
//
// 1. npm run baac:import -- --download   fetches, once, the "caractéristiques" and "usagers" CSVs of
//    each year listed in YEARS from data.gouv.fr into data/baac/raw/ (Licence Ouverte). Resource
//    URLs are pinned below because the catalogue renames files from year to year.
// 2. npm run insee:import                (population denominators, see that script)
// 3. npm run baac:import                 (offline; re-run any time)
//
// Rules applied (see the ONISR variable description shipped with the dataset):
//  - A death is a road user with grav = 2 ("tué": died within 30 days of the accident).
//  - Users are joined to their accident (Num_Acc; "Accident_Id" in the 2022 file) for the
//    department of the accident; one row per user, so nothing is multiplied through vehicles.
//    Department codes are zero-padded (the 2019 file writes "1" for Ain).
//  - Only the 101 departments of the map are kept (Saint-Pierre-et-Miquelon, Saint-Martin,
//    Saint-Barthélemy, Wallis-et-Futuna, Polynésie and Nouvelle-Calédonie are counted but dropped).
//  - Rates are deaths / INSEE population at 1 January of the same year × 100,000 (population
//    estimates from src/data/insee-france.json), rounded to 2 decimals; 3-year averages need all
//    three years. National = Σ deaths / Σ population over the same 101 departments.
import path from 'node:path'
import fs from 'node:fs'
import { DEP_TO_MAP, DEP_NAMES, csvRows, download, fileInfo, hasFlag, meanOf, round, today, writeJson } from './lib/fr.mjs'

const RAW = path.resolve(process.env.BAAC_RAW || 'data/baac/raw')
const OUT = path.resolve('src/data/onisr-france.json')
const INSEE = path.resolve('src/data/insee-france.json')
const DATASET = 'https://www.data.gouv.fr/fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024'
const R = 'https://static.data.gouv.fr/resources'
const YEARS = {
  2019: [`${R}/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104400/caracteristiques-2019.csv`, `${R}/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104232/usagers-2019.csv`],
  2020: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111202/caracteristiques-2020.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111817/usagers-2020.csv`],
  2021: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2022/20231009-140403/carcteristiques-2021.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2022/20231009-140337/usagers-2021.csv`],
  2022: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-093927/carcteristiques-2022.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-094229/usagers-2022.csv`],
  2023: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241028-103125/caract-2023.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241023-153328/usagers-2023.csv`],
  2024: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251021-115900/caract-2024.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251021-115506/usagers-2024.csv`],
}
const KILLED = '2'

async function main() {
  if (hasFlag('--download')) {
    for (const [y, [caract, usagers]] of Object.entries(YEARS)) {
      await download(caract, path.join(RAW, `caract-${y}.csv`))
      await download(usagers, path.join(RAW, `usagers-${y}.csv`))
    }
  }
  const years = Object.keys(YEARS).map(Number).filter((y) => fs.existsSync(path.join(RAW, `caract-${y}.csv`)) && fs.existsSync(path.join(RAW, `usagers-${y}.csv`)))
  if (!years.length) {
    console.log(`No BAAC files (caract-YYYY.csv + usagers-YYYY.csv) in ${path.relative(process.cwd(), RAW)}/. Download them from ${DATASET} or run with --download.`)
    process.exitCode = 1
    return
  }
  if (!fs.existsSync(INSEE)) throw new Error('src/data/insee-france.json is missing: run `npm run insee:import` first (population denominators).')
  const pop = JSON.parse(fs.readFileSync(INSEE, 'utf8')).population.departments

  const deaths = {} // map id -> year -> killed
  const files = []
  for (const y of years) {
    const caract = path.join(RAW, `caract-${y}.csv`), usagers = path.join(RAW, `usagers-${y}.csv`)
    const dep = new Map()
    // 2019 writes departments 01–09 as "1"–"9"; later years zero-pad them.
    for await (const r of csvRows(caract)) dep.set(r.Num_Acc ?? r.Accident_Id, r.dep?.length === 1 ? `0${r.dep}` : r.dep)
    let killed = 0, outside = 0, unknown = 0
    for await (const r of csvRows(usagers)) {
      if (r.grav !== KILLED) continue
      killed++
      const d = dep.get(r.Num_Acc)
      const id = DEP_TO_MAP[d]
      if (!id) { d ? outside++ : unknown++; continue }
      ;(deaths[id] ||= {})[y] = (deaths[id][y] || 0) + 1
    }
    console.log(`${y}: ${dep.size} accidents, ${killed} killed (${outside} outside the 101 departments, ${unknown} without a department)`)
    files.push(fileInfo(caract), fileInfo(usagers))
  }

  const rate = (n, p) => (n == null || !p ? null : round((n / p) * 1e5))
  const summarise = (count, popOf) => {
    const series = years.map((y) => rate(count(y), popOf(y)))
    return { latest: { roadDeaths: series.at(-1) }, counts: { roadDeaths: count(years.at(-1)) }, avg3: { roadDeaths: meanOf(series.slice(-3)) }, series: { roadDeaths: series }, latestYear: years.at(-1) }
  }
  const departments = Object.fromEntries(Object.entries(DEP_TO_MAP).map(([dep, id]) => [id, {
    name: DEP_NAMES[id], code: dep,
    ...summarise((y) => deaths[id]?.[y] ?? 0, (y) => pop[id]?.[y] ?? null),
    deaths: Object.fromEntries(years.map((y) => [y, deaths[id]?.[y] ?? 0])),
  }]))
  const total = (y) => Object.keys(DEP_TO_MAP).reduce((s, dep) => s + (deaths[DEP_TO_MAP[dep]]?.[y] ?? 0), 0)
  const totalPop = (y) => Object.values(DEP_TO_MAP).every((id) => pop[id]?.[y]) ? Object.values(DEP_TO_MAP).reduce((s, id) => s + pop[id][y], 0) : null

  const out = {
    source: `ONISR – Observatoire national interministériel de la sécurité routière, BAAC accident files (${DATASET})`,
    importedAt: today(),
    origin: 'official download from data.gouv.fr (Licence Ouverte); denominators: INSEE population estimates at 1 January',
    files,
    metrics: { roadDeaths: { label: 'Road deaths (killed within 30 days)', unit: 'per 100k' } },
    years, latestYear: years.at(-1),
    national: summarise(total, totalPop),
    departments,
  }
  writeJson(OUT, out, `${Object.keys(departments).length} departments, years ${years[0]}–${years.at(-1)}, national ${out.national.counts.roadDeaths} deaths in ${years.at(-1)}`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
