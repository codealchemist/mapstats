// Imports physician density by department from the DREES "Démographie des professionnels de santé"
// workbook (RPPS, médecins) into src/data/drees-france.json.
//
// 1. npm run drees:import -- --download   fetches "Médecins RPPS 2012-2026.xlsx" once (≈ 70 MB) through
//    its data.gouv.fr resource link into data/drees/raw/ (Licence Ouverte 2.0). The workbook is
//    streamed sheet by sheet: it does not fit in memory when read whole.
// 2. npm run drees:import                 (offline; re-run any time)
//
// Rules applied (see the "Lisez-moi" sheet):
//  - Physicians registered with the Ordre and active at 1 January of the year, all specialties and
//    modes of practice, counted once at their most recent place of activity (headcounts, not activities).
//  - Density is DREES's own figure: physicians per 100,000 inhabitants, over INSEE's population
//    estimate at 1 January of the same year. It is kept per 100,000 here; the app converts to per 1,000.
//  - Only the "Ensemble" rows by department are read; "ND" (fewer than 10 professionals) stays null.
import path from 'node:path'
import fs from 'node:fs'
import ExcelJS from 'exceljs'
import { DEP_TO_MAP, DEP_NAMES, download, fileInfo, hasFlag, num, today, writeJson } from './lib/fr.mjs'

const RAW = path.resolve(process.env.DREES_RAW || 'data/drees/raw')
const OUT = path.resolve('src/data/drees-france.json')
const RESOURCE = 'https://www.data.gouv.fr/fr/datasets/r/58c6b89a-e364-4867-9fdf-2f7770117cc5' // Médecins RPPS 2012-2026.xlsx
const DATASET = 'https://www.data.gouv.fr/fr/datasets/la-demographie-des-professionnels-de-sante-depuis-2012'
const SHEETS = { Densités: ['density', /^densite_(\d{4})$/], Effectifs: ['physicians', /^effectif_(\d{4})$/] }

// "075-Paris" / "02A-Corse-du-Sud" / "971 -Guadeloupe" -> INSEE department code
const depCode = (label) => {
  const c = String(label ?? '').split('-')[0].trim().toUpperCase()
  return DEP_TO_MAP[c] ? c : DEP_TO_MAP[c.replace(/^0/, '')] ? c.replace(/^0/, '') : null
}
const cell = (x) => (x && typeof x === 'object' ? x.result ?? x.richText?.map((t) => t.text).join('') ?? null : x)
const isTotal = (v) => /Ensemble/i.test(String(v ?? ''))

async function main() {
  if (hasFlag('--download')) await download(RESOURCE, path.join(RAW, 'medecins_rpps.xlsx'))
  const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => /medecins.*\.xlsx$/i.test(f)).map((f) => path.join(RAW, f)) : []
  if (files.length !== 1) {
    console.log(`Expected one "Médecins RPPS" workbook in ${path.relative(process.cwd(), RAW)}/, found ${files.length}.\nDownload it from ${DATASET} or run with --download.`)
    process.exitCode = 1
    return
  }
  const [file] = files
  const departments = Object.fromEntries(Object.entries(DEP_TO_MAP).map(([dep, id]) => [id, { name: DEP_NAMES[id], code: dep, density: {}, physicians: {} }]))
  const unmatched = new Set()
  let year = 0

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', worksheets: 'emit', entries: 'emit' })
  for await (const ws of reader) {
    const sheet = SHEETS[ws.name]
    if (!sheet) continue
    const [field, re] = sheet
    let header = null, n = 0
    for await (const row of ws) {
      const v = row.values.slice(1).map(cell)
      if (!header) { header = v.map((h) => String(h ?? '').trim()); continue }
      const r = Object.fromEntries(header.map((h, i) => [h, v[i]]))
      if (!['specialites_agregees', 'specialites', 'exercice', 'tranche_age', 'sexe'].every((k) => isTotal(r[k])) || isTotal(r.departement)) continue
      const dep = depCode(r.departement)
      if (!dep) { unmatched.add(r.departement); continue }
      for (const h of header) {
        const m = h.match(re)
        if (!m) continue
        departments[DEP_TO_MAP[dep]][field][+m[1]] = num(r[h])
        year = Math.max(year, +m[1])
      }
      n++
    }
    console.log(`${ws.name}: ${n} department rows`)
  }
  if (unmatched.size) console.log(`Not on the map (skipped): ${[...unmatched].join(', ')}`)
  const covered = Object.values(departments).filter((d) => d.density[year] != null).length

  const out = {
    source: `DREES – La démographie des professionnels de santé depuis 2012, médecins (RPPS) (${DATASET})`,
    importedAt: today(),
    origin: 'official workbook, downloaded once through data.gouv.fr (Licence Ouverte 2.0)',
    files: [fileInfo(file)],
    metrics: { density: { label: 'Physicians (all specialties, active at 1 January)', unit: 'per 100k' }, physicians: { label: 'Physicians (headcount)', unit: 'count' } },
    year, departments,
  }
  writeJson(OUT, out, `${covered}/${Object.keys(departments).length} departments with a ${year} density`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
