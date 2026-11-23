// Offline test (npm test) of the SDK readers the prefills share: readXlsx (sheet by index or name, rich text,
// formulas, .xls) and parseXml, on small files written here.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { unzipSync, zipSync } from 'fflate'
import { check, section, done } from './test.mjs'
import { readXlsx, parseXml } from './parse.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapstats-parse-'))
const rows = async (file, opts) => { const out = []; for await (const r of readXlsx(file, opts)) out.push(r); return out }

section('readXlsx (.xlsx, streamed)')
const xlsx = path.join(dir, 'book.xlsx')
const book = new ExcelJS.Workbook()
book.addWorksheet('Notes').addRows([['Read me'], ['Source: a statistics office']])
const data = book.addWorksheet('Densités')
data.addRow([' Département ', 'densite_2026', 'Effectif'])
data.addRow([{ richText: [{ text: '21-' }, { font: { bold: true }, text: "Côte-d'Or" }] }, 3.6, { formula: 'B2*1000', result: 3600 }])
data.addRow(['75-Paris', 9.1, null])
await book.xlsx.writeFile(xlsx)
// The streamed reader needs the workbook before its sheets, as Excel writes them (ExcelJS writes it last).
const entries = Object.entries(unzipSync(new Uint8Array(fs.readFileSync(xlsx))))
fs.writeFileSync(xlsx, zipSync(Object.fromEntries([...entries.filter(([n]) => !n.startsWith('xl/worksheets/')), ...entries.filter(([n]) => n.startsWith('xl/worksheets/'))])))
const byName = await rows(xlsx, { sheet: 'Densités' })
check('a sheet by name, headers trimmed and lowercased', byName.length === 2 && Object.keys(byName[0]).join() === 'département,densite_2026,effectif')
check('rich text gives its plain text', byName[0]['département'] === "21-Côte-d'Or", JSON.stringify(byName[0]['département']))
check('a formula gives its result', byName[0].effectif === 3600)
check('an empty cell is null', byName[1].effectif === null)
check('the same sheet by 0-based index', JSON.stringify(await rows(xlsx, { sheet: 1 })) === JSON.stringify(byName))
check('the first sheet by default', (await rows(xlsx))[0]?.['read me'] === 'Source: a statistics office')
check('lowercase: false keeps the headers\' case', Object.keys((await rows(xlsx, { sheet: 'Densités', lowercase: false }))[0])[0] === 'Département')
check('no rows for a sheet that isn\'t there', (await rows(xlsx, { sheet: 'Effectifs' })).length === 0)

section('readXlsx (.xls, read whole)')
const XLSX = await import('xlsx')
const xls = path.join(dir, 'book.xls')
const old = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(old, XLSX.utils.aoa_to_sheet([['Read me']]), 'Notes')
XLSX.utils.book_append_sheet(old, XLSX.utils.aoa_to_sheet([['Province', 'Tasa'], ['Chaco', 7.5], ['Salta', '']]), 'Cuadro 2.1')
fs.writeFileSync(xls, XLSX.write(old, { bookType: 'biff8', type: 'buffer' }))
const xlsRows = await rows(xls, { sheet: 'Cuadro 2.1' })
check('a sheet by name', xlsRows.length === 2 && xlsRows[0].province === 'Chaco' && xlsRows[0].tasa === 7.5)
check('a blank cell is null', xlsRows[1].tasa === null)
check('the same sheet by index', JSON.stringify(await rows(xls, { sheet: 1 })) === JSON.stringify(xlsRows))

section('parseXml')
const sdmx = `<?xml version="1.0" encoding="UTF-8"?>
<message:StructureSpecificData xmlns:message="urn:sdmx"><message:DataSet>
<Series REF_AREA="D75" IDBANK="001515842" TITLE_FR="Taux de chômage localisé - Paris"><Obs TIME_PERIOD="2025" OBS_VALUE="6.3"/></Series>
<Note lang="fr">Données &amp; méthodes</Note>
</message:DataSet></message:StructureSpecificData>`
const doc = await parseXml(sdmx, { arrays: ['Series', 'Obs'] })
const set = doc['message:StructureSpecificData']['message:DataSet']
check('elements keep their prefixed names; attributes become fields, unprefixed', set.Series[0].REF_AREA === 'D75' && set.Series[0].TITLE_FR === 'Taux de chômage localisé - Paris')
check('`arrays` elements are lists even when there is one; attribute values stay strings', Array.isArray(set.Series) && Array.isArray(set.Series[0].Obs) && set.Series[0].Obs[0].OBS_VALUE === '6.3')
check('text next to attributes, entities decoded', set.Note['#text'] === 'Données & méthodes' && set.Note.lang === 'fr')
check('without `arrays`, a single element is an object', !Array.isArray((await parseXml(sdmx))['message:StructureSpecificData']['message:DataSet'].Series))

fs.rmSync(dir, { recursive: true, force: true })
done()
