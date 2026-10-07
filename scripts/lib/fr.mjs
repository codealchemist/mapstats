// Shared helpers for the French import scripts (SSMSI, BAAC, INSEE, DREES).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

// INSEE department code -> map region id (public/geo/FRA.json properties.id). Codes stay strings.
export const DEP_TO_MAP = Object.fromEntries([
  ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0')).filter((d) => d !== '20').map((d) => [d, `FR-${d}`]),
  ['2A', 'FR-2A'], ['2B', 'FR-2B'], ['971', 'FR-GP'], ['972', 'FR-MQ'], ['973', 'FR-GF'], ['974', 'FR-RE'], ['976', 'FR-YT'],
])
export const DEPS = Object.keys(DEP_TO_MAP)

const geo = JSON.parse(fs.readFileSync(path.resolve('public/geo/FRA.json'), 'utf8'))
export const DEP_NAMES = Object.fromEntries(geo.features.map((f) => [f.properties.id, f.properties.name]))

export const num = (v) => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const n = Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
export const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

// Mean of exactly `n` published values: a window with a gap stays null rather than averaging fewer years.
export const meanOf = (a, n = 3) => (a.length === n && a.every((x) => x != null) ? round(a.reduce((s, x) => s + x, 0) / n) : null)

// Semicolon-separated CSV with quoted fields (the data.gouv.fr convention), streamed line by line.
export async function* csvRows(file, sep = ';') {
  const rl = (await import('node:readline')).createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity })
  let header = null
  for await (const line of rl) {
    if (!line) continue
    const cells = line.replace(/^\uFEFF/, '').split(sep).map((c) => c.replace(/^"|"$/g, ''))
    if (!header) { header = cells.map((h) => h.trim()); continue }
    yield Object.fromEntries(header.map((h, i) => [h, cells[i] ?? null]))
  }
}

export const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16)

export const fileInfo = (f) => ({ file: path.basename(f), sha256: sha(f) })

// Downloads once: an existing file is never re-fetched (delete it to refresh).
export async function download(url, dest, { headers } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (fs.existsSync(dest)) return console.log(`already downloaded: ${path.basename(dest)} (delete it to fetch again)`)
  console.log(`downloading ${url}`)
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

export const today = () => new Date().toISOString().slice(0, 10)

export const argValue = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null }
export const hasFlag = (flag) => process.argv.includes(flag)

export function writeJson(out, data, summary) {
  fs.writeFileSync(out, JSON.stringify(data) + '\n')
  console.log(`Wrote ${path.relative(process.cwd(), out)}: ${summary} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`)
}

// INSEE commune code -> department code; municipal arrondissements of Paris, Lyon and Marseille
// are folded into their commune (statistical files use either).
export const communeOf = (code) =>
  /^751\d\d$/.test(code) ? '75056' : /^6938\d$/.test(code) ? '69123' : /^132\d\d$/.test(code) ? '13055' : code
export const depOf = (code) => (code.startsWith('97') ? code.slice(0, 3) : code.slice(0, 2))

// Entries of a zip archive from its central directory (stored or deflated; no zip64).
function zipEntries(buf, file) {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error(`${path.basename(file)} is not a zip archive`)
  const entries = []
  let p = buf.readUInt32LE(eocd + 16)
  for (let i = buf.readUInt16LE(eocd + 10); i > 0; i--) {
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32)
    entries.push({ name: buf.toString('utf8', p + 46, p + 46 + nameLen), method: buf.readUInt16LE(p + 10), csize: buf.readUInt32LE(p + 20), local: buf.readUInt32LE(p + 42) })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}
export const zipEntryNames = (file) => zipEntries(fs.readFileSync(file), file).map((e) => e.name)

export function readZipEntry(file, match) {
  const buf = fs.readFileSync(file)
  const e = zipEntries(buf, file).find((x) => match.test(x.name))
  if (!e) throw new Error(`${path.basename(file)}: no entry matching ${match}`)
  const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28)
  const data = buf.subarray(start, start + e.csize)
  return e.method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data)
}

// dBase III attribute table (the .dbf of a shapefile) -> rows keyed by field name, text as UTF-8.
export function dbfRows(buf) {
  const count = buf.readUInt32LE(4), headerLen = buf.readUInt16LE(8), recordLen = buf.readUInt16LE(10)
  const fields = []
  for (let p = 32; buf[p] !== 0x0d && p < headerLen; p += 32) {
    fields.push({ name: buf.toString('ascii', p, p + 11).replace(/\0.*$/, ''), len: buf[p + 16] })
  }
  const rows = []
  for (let r = 0, p = headerLen; r < count; r++, p += recordLen) {
    if (buf[p] === 0x2a) continue // deleted record
    const row = {}
    let q = p + 1
    for (const f of fields) { row[f.name] = buf.toString('utf8', q, q + f.len).trim(); q += f.len }
    rows.push(row)
  }
  return rows
}

// INSEE reference populations of every commune (populations légales, municipal population),
// shared by the imports that weight communes by population. Downloaded by insee-import.
export const POPULATIONS_ZIP = { url: 'https://api.insee.fr/melodi/file/DS_POPULATIONS_REFERENCE/DS_POPULATIONS_REFERENCE_2023_CSV_FR', file: path.resolve('data/insee/raw/populations-reference-2023.zip') }
export function communePopulations() {
  if (!fs.existsSync(POPULATIONS_ZIP.file)) throw new Error(`${path.relative(process.cwd(), POPULATIONS_ZIP.file)} is missing: run \`npm run insee:import -- --download\` first`)
  const csv = readZipEntry(POPULATIONS_ZIP.file, /_data\.csv$/).toString('utf8')
  const pop = new Map()
  let year = null
  for (const line of csv.split('\n').slice(1)) {
    const [geo, level, , measure, period, value] = line.replace(/"/g, '').split(';')
    if (level !== 'COM' || measure !== 'PMUN') continue
    pop.set(geo, num(value))
    year = +period
  }
  return { pop, year }
}
