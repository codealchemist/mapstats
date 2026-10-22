// Prefill for the DREES: the "Médecins RPPS" workbook → countries/FRA/data/drees.json.
//
//   npm run prefill -- FRA --provider drees
//
// The workbook (≈ 70 MB) is downloaded once through its data.gouv.fr resource link into raw/ and streamed sheet by
// sheet (it does not fit in memory when read whole).
import { rawStore, readXlsx } from '#sdk'
import { fetchOnceStored, regionNames } from '../../lib/fr.mjs'
import { departmentRows, toValues } from './parse.mjs'
import { DATASET } from './provider.js'

const RESOURCE = 'https://www.data.gouv.fr/fr/datasets/r/58c6b89a-e364-4867-9fdf-2f7770117cc5' // Médecins RPPS 2012-2026.xlsx
const SHEETS = { density: ['Densités', /^densite_(\d{4})$/], physicians: ['Effectifs', /^effectif_(\d{4})$/] }

export async function prefill({ log }) {
  const raw = rawStore('FRA', 'drees')
  const file = await fetchOnceStored(raw, RESOURCE, { name: 'medecins_rpps_2012_2026.xlsx' })
  const read = async ([sheet, re]) => {
    const rows = []
    for await (const r of readXlsx(file.path, { sheet })) rows.push(r)
    if (!rows.length) throw new Error(`${file.ref.name}: no sheet "${sheet}"`)
    return departmentRows(rows, re)
  }
  const density = await read(SHEETS.density), physicians = await read(SHEETS.physicians)
  if (density.unmatched.length) log(`not on the map (skipped): ${density.unmatched.join(', ')}`)
  const covered = Object.values(density.byRegion).filter((d) => d[density.year] != null).length
  log(`${covered}/${Object.keys(density.byRegion).length} départements with a ${density.year} density`)
  return {
    ...toValues({ density, physicians, year: density.year }, { names: regionNames() }),
    origin: { files: [file.ref], notes: `official workbook, downloaded once through data.gouv.fr (Licence Ouverte 2.0): ${DATASET}` },
  }
}
