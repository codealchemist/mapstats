// Imports fixed-broadband coverage by département and tracked commune from ARCEP's "Ma connexion
// internet" open data into src/data/arcep-france.json.
//
// 1. npm run arcep:import -- --download   fetches once, from data.arcep.fr into data/arcep/raw/, the
//    département and commune statistics of eligibility by technology and by speed class (Licence
//    Ouverte 2.0). The "last" URLs always serve the latest quarter; the files carry their reference
//    date, which is kept in the output (delete them to refresh).
// 2. npm run arcep:import                 (offline; re-run any time)
//
// Rules applied:
//  - Shares are eligible premises / all premises (dwellings and business locations) × 100, rounded
//    to 1 decimal: FttH-eligible (fibre to the home) and eligible to at least 30 Mbit/s with any
//    technology. Eligibility measures availability, not subscriptions.
//  - Only the 101 départements of the map and the 40 tracked communes are kept.
import path from 'node:path'
import fs from 'node:fs'
import { CITY_ROWS } from '../src/data/france-cities.js'
import { DEP_TO_MAP, DEP_NAMES, csvRows, download, fileInfo, hasFlag, num, round, today, writeJson } from './lib/fr.mjs'

const RAW = path.resolve(process.env.ARCEP_RAW || 'data/arcep/raw')
const OUT = path.resolve('src/data/arcep-france.json')
const BASE = 'https://data.arcep.fr/fixe/maconnexioninternet/statistiques/last'
const DATASET = 'https://www.data.gouv.fr/datasets/ma-connexion-internet'
const FILES = ['departement_techno', 'departement_debit', 'commune_techno', 'commune_debit']
const COMMUNES = new Set(CITY_ROWS.map((r) => r[5]))
const rawPath = (k) => path.join(RAW, `${k}.csv`)

const share = (part, total) => (part == null || !total ? null : round((100 * part) / total, 1))

async function read(level, keep) {
  const out = {}
  let date = null
  for await (const r of csvRows(rawPath(`${level}_techno`))) {
    const id = keep(r)
    if (!id) continue
    out[id] = { premises: num(r.nbr), ftth: share(num(r.elig_ftth), num(r.nbr)) }
    date = r.date
  }
  for await (const r of csvRows(rawPath(`${level}_debit`))) {
    const id = keep(r)
    if (id && out[id]) out[id].thd30 = share(num(r.elig_thd30), num(r.nbr))
  }
  return { out, date }
}

async function main() {
  if (hasFlag('--download')) for (const k of FILES) await download(`${BASE}/${k.split('_')[0]}/${k}.csv`, rawPath(k))
  const missing = FILES.filter((k) => !fs.existsSync(rawPath(k)))
  if (missing.length) {
    console.log(`Missing raw files in ${path.relative(process.cwd(), RAW)}/: ${missing.join(', ')}. Run with --download (${DATASET}).`)
    process.exitCode = 1
    return
  }
  const deps = await read('departement', (r) => DEP_TO_MAP[r.code_dep])
  const communes = await read('commune', (r) => (COMMUNES.has(r.code_insee) ? r.code_insee : null))
  for (const [id, d] of Object.entries(deps.out)) d.name = DEP_NAMES[id]

  const out = {
    source: `ARCEP – Ma connexion internet, statistiques d'éligibilité (${DATASET})`,
    importedAt: today(),
    origin: 'official download from data.arcep.fr (Licence Ouverte 2.0)',
    files: FILES.map((k) => fileInfo(rawPath(k))),
    date: deps.date,
    metrics: { ftth: { label: 'Premises eligible to fibre (FttH)', unit: '%' }, thd30: { label: 'Premises eligible to ≥ 30 Mbit/s', unit: '%' } },
    departments: deps.out, communes: communes.out,
  }
  writeJson(OUT, out, `${Object.keys(deps.out).length} departments, ${Object.keys(communes.out).length} communes, data at ${deps.date}`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
