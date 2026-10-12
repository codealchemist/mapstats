// Parsers for the files statistics offices publish: CSV, Excel, HTML.
import fs from 'node:fs'
import ExcelJS from 'exceljs'

const detectDelimiter = (line) => [';', '\t', ','].map((d) => [d, line.split(d).length]).sort((a, b) => b[1] - a[1])[0][0]

/**
 * CSV (RFC 4180: quoted fields, "" escapes, newlines inside quotes) → [{ header: value }]. Values stay strings.
 * @param opts.delimiter  default: the most frequent of ; tab , in the header line
 * @param opts.lowercase  lowercase header names
 */
export function parseCsv(text, { delimiter, lowercase = false } = {}) {
  const src = String(text).replace(/^\uFEFF/, '')
  const d = delimiter || detectDelimiter(src.slice(0, src.indexOf('\n') >>> 0))
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === d) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x !== '')) rows.push(row)
  const header = (rows.shift() || []).map((h) => (lowercase ? h.trim().toLowerCase() : h.trim()))
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

/**
 * Every worksheet of an Excel workbook (.xlsx or the older .xls) as rows of cell values: [{ name, rows: any[][] }].
 * For statistics tables, whose titles and multi-row headers rule out a single header row. Blank cells are ''.
 * Read whole into memory: for very large single-table files use readXlsx.
 */
export async function readWorkbook(file) {
  // SheetJS (dev dependency, from cdn.sheetjs.com) reads both formats; exceljs only reads .xlsx.
  const XLSX = await import('xlsx')
  const wb = XLSX.read(fs.readFileSync(file))
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true }) }))
}

/**
 * Rows of one worksheet, as { header: value } from its first row. An .xlsx is streamed (fine for files of hundreds
 * of MB); an .xls is read whole (readWorkbook). Formula cells give their result. @param opts.sheet  0-based index
 */
export async function* readXlsx(file, { sheet = 0, lowercase = true } = {}) {
  const head = (h) => (lowercase ? String(h ?? '').trim().toLowerCase() : String(h ?? '').trim())
  if (/\.xls$/i.test(file)) {
    const [header = [], ...rows] = (await readWorkbook(file))[sheet]?.rows || []
    for (const r of rows) yield Object.fromEntries(header.map((h, i) => [head(h), r[i] === '' ? null : r[i] ?? null]))
    return
  }
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', worksheets: 'emit' })
  let index = 0
  for await (const ws of reader) {
    if (index++ < sheet) continue
    let header = null
    for await (const row of ws) {
      const v = row.values.slice(1).map((x) => (x && typeof x === 'object' && 'result' in x ? x.result : x))
      if (!header) { header = v.map(head); continue }
      yield Object.fromEntries(header.map((h, i) => [h, v[i] ?? null]))
    }
    return
  }
}

/** HTML → a cheerio document ($('table tr')…), for sources that publish tables only as web pages. */
export async function loadHtml(html) {
  const { load } = await import('cheerio')
  return load(html)
}

/**
 * A published number: "1.234,5" / "1,234.5" / "12,5" / 12.5 → number; blanks and dashes → null.
 * `decimal: "auto"` takes the last separator as the decimal one, so "1,234" reads 1.234: pass the source's
 * decimal separator when it writes thousands without decimals.
 */
export function num(v, { decimal = 'auto' } = {}) {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/\s/g, '')
  if (!s || /^[-–—.]+$/.test(s)) return null
  const dec = decimal === 'auto' ? (s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.') : decimal
  s = dec === ',' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
