// Parsers for the files statistics offices publish: CSV, Excel, HTML.
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
 * Rows of one worksheet of an .xlsx, streamed (fine for files of hundreds of MB): yields { header: value }.
 * Formula cells give their result. @param opts.sheet  0-based worksheet index
 */
export async function* readXlsx(file, { sheet = 0, lowercase = true } = {}) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', worksheets: 'emit' })
  let index = 0
  for await (const ws of reader) {
    if (index++ < sheet) continue
    let header = null
    for await (const row of ws) {
      const v = row.values.slice(1).map((x) => (x && typeof x === 'object' && 'result' in x ? x.result : x))
      if (!header) { header = v.map((h) => (lowercase ? String(h ?? '').trim().toLowerCase() : String(h ?? '').trim())); continue }
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
