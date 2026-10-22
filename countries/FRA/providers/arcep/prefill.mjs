// Prefill for ARCEP's "Ma connexion internet" → countries/FRA/data/arcep.json.
//
//   npm run prefill -- FRA --provider arcep
//
// The "last" URLs always serve the latest quarter; the files carry their reference date, kept in the dataset. Delete
// the stored files (raw/*.csv) to fetch a newer quarter.
import { rawStore, parseCsv } from '#sdk'
import { fetchOnceStored, regionNames } from '../../lib/fr.mjs'
import { COMMUNE_NAMES } from '../../places.js'
import { coverage, byDepartment, byCommune, toValues } from './parse.mjs'
import { DATASET } from './provider.js'

const BASE = 'https://data.arcep.fr/fixe/maconnexioninternet/statistiques/last'
const FILES = ['departement_techno', 'departement_debit', 'commune_techno', 'commune_debit']

export async function prefill({ log }) {
  const raw = rawStore('FRA', 'arcep')
  const files = {}
  for (const k of FILES) files[k] = await fetchOnceStored(raw, `${BASE}/${k.split('_')[0]}/${k}.csv`, { name: `${k}.csv` })
  const rows = (k) => parseCsv(files[k].text)
  const departments = coverage(rows('departement_techno'), rows('departement_debit'), byDepartment)
  const communes = coverage(rows('commune_techno'), rows('commune_debit'), byCommune(new Set(Object.keys(COMMUNE_NAMES))))
  log(`${Object.keys(departments.out).length} départements, ${Object.keys(communes.out).length} communes, data at ${departments.date}`)
  return {
    ...toValues({ departments: departments.out, communes: communes.out }, { names: regionNames(), communeNames: COMMUNE_NAMES }),
    period: { latest: +departments.date.slice(0, 4), date: departments.date },
    origin: { files: FILES.map((k) => files[k].ref), notes: `official download from data.arcep.fr (Licence Ouverte 2.0): ${DATASET}; shares computed by MapStats from the published counts` },
  }
}
