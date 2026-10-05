// Shared helpers for the French import scripts (SSMSI, BAAC, INSEE, DREES).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

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
