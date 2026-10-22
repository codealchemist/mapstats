// Prefill for the SSMSI: the département base of recorded crime → countries/FRA/data/ssmsi.json.
//
//   npm run prefill -- FRA --provider ssmsi
//
// The département CSV is downloaded once from its data.gouv.fr resource (stable id) into raw/; later runs read the
// stored copy. A file downloaded by hand (donnee-dep*.csv, as data.gouv.fr names it) is registered on first use.
import { rawStore, parseCsv } from '#sdk'
import { fetchOnceStored, regionNames } from '../../lib/fr.mjs'
import { toValues } from './parse.mjs'
import { DATASET } from './provider.js'

const RESOURCE = 'https://www.data.gouv.fr/fr/datasets/r/2b27a675-e3bf-41ef-a852-5fb9ab483967' // département CSV

export async function prefill({ args, log }) {
  const raw = rawStore('FRA', 'ssmsi')
  const name = raw.list(/^donnee-dep.*\.csv$/i)[0] || 'donnee-dep-data.gouv.csv'
  const file = await fetchOnceStored(raw, RESOURCE, { name, note: `département base, ${DATASET}` })
  if (args.refresh) await raw.fetchOnce(RESOURCE, { name, refresh: true })
  const { years, used, skipped, ...parts } = toValues(parseCsv(file.text), { names: regionNames() })
  log(`${name}: ${used} rows used, ${skipped} skipped (other indicators or areas); years ${years[0]}–${years.at(-1)}`)
  return {
    ...parts,
    origin: { files: [file.ref], notes: `official download from data.gouv.fr (Licence Ouverte 2.0): ${DATASET}` },
  }
}
