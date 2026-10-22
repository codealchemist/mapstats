// Shared helpers for France's prefills (Node only): département codes, INSEE commune codes, archives the sources
// publish (zip, dBase), semicolon CSVs with stray separators, and the INSEE reference populations every
// population-weighted aggregation uses.
import fs from 'node:fs'
import path from 'node:path'
import { Unzip, unzipSync, strFromU8 } from 'fflate'
import { rawStore, num } from '#sdk'

// INSEE département code → region id in geo/regions.json (ISO 3166-2). Codes stay strings ("01", "2A", "971").
export const DEP_TO_MAP = Object.fromEntries([
  ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0')).filter((d) => d !== '20').map((d) => [d, `FR-${d}`]),
  ['2A', 'FR-2A'], ['2B', 'FR-2B'], ['971', 'FR-GP'], ['972', 'FR-MQ'], ['973', 'FR-GF'], ['974', 'FR-RE'], ['976', 'FR-YT'],
])
export const DEPS = Object.keys(DEP_TO_MAP)

// Cities that are their own département: their département figures are published at city level too, so the
// core counts them as the city's own (Paris is both commune 75056 and département 75).
export const CITY_JURISDICTIONS = { 'FRA-paris': 'FR-75' }

/** Région id → name, from the country's boundaries. */
export function regionNames() {
  const geo = JSON.parse(fs.readFileSync(new URL('../geo/regions.json', import.meta.url), 'utf8'))
  return Object.fromEntries(geo.features.map((f) => [f.properties.id, f.properties.name]))
}

export const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

/** Mean of exactly `n` published values: a window with a gap stays null rather than averaging fewer years. */
export const meanOf = (a, n = 3) => (a.length === n && a.every((x) => x != null) ? round(a.reduce((s, x) => s + x, 0) / n) : null)

/** INSEE commune code of the commune proper: the municipal arrondissements of Paris, Lyon and Marseille fold in. */
export const communeOf = (code) => (/^751\d\d$/.test(code) ? '75056' : /^6938\d$/.test(code) ? '69123' : /^132\d\d$/.test(code) ? '13055' : code)
/** Département code of a commune code ("97411" → "974", "2A004" → "2A"). */
export const depOf = (code) => (code.startsWith('97') ? code.slice(0, 3) : code.slice(0, 2))

/**
 * Copies each level's region records to the cities that are their own département (CITY_JURISDICTIONS), for every
 * part of a dataset that has them (values, series, details, names).
 */
export function withCityJurisdictions(parts) {
  for (const part of ['values', 'series', 'details', 'names']) {
    const p = parts[part]
    if (!p?.region) continue
    for (const [city, region] of Object.entries(CITY_JURISDICTIONS)) if (p.region[region] !== undefined) (p.city ||= {})[city] = p.region[region]
  }
  return parts
}

/** Names of the entries of a zip archive, without inflating anything. */
export function zipEntryNames(file) {
  const names = []
  const u = new Unzip()
  u.onfile = (f) => names.push(f.name)
  u.push(new Uint8Array(fs.readFileSync(file)), true)
  return names
}

/** One entry of a zip archive, by name pattern, inflated on its own (the other entries are skipped). */
export function zipEntry(file, match) {
  const files = unzipSync(new Uint8Array(fs.readFileSync(file)), { filter: (f) => match.test(f.name) })
  const name = Object.keys(files)[0]
  if (!name) throw new Error(`${path.basename(file)}: no entry matching ${match}`)
  return { name, data: files[name], text: () => strFromU8(files[name]) }
}

/** dBase III attribute table (the .dbf of a shapefile) → rows keyed by field name, text as UTF-8. */
export function dbfRows(buf) {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = b.readUInt32LE(4), headerLen = b.readUInt16LE(8), recordLen = b.readUInt16LE(10)
  const fields = []
  for (let p = 32; b[p] !== 0x0d && p < headerLen; p += 32) fields.push({ name: b.toString('ascii', p, p + 11).replace(/\0.*$/, ''), len: b[p + 16] })
  const rows = []
  for (let r = 0, p = headerLen; r < count; r++, p += recordLen) {
    if (b[p] === 0x2a) continue // deleted record
    const row = {}
    let q = p + 1
    for (const f of fields) { row[f.name] = b.toString('utf8', q, q + f.len).trim(); q += f.len }
    rows.push(row)
  }
  return rows
}

/**
 * Semicolon CSV whose free-text fields sometimes contain the separator unquoted (GASPAR): the first `fromStart`
 * columns are read from the start of the row and every other column from its end, so an over-long row still
 * aligns; rows with too few fields are dropped. Returns { rows, realigned, dropped }.
 */
export function looseCsv(text, { fromStart = 2 } = {}) {
  const lines = text.split('\n').filter((l) => l.trim())
  const header = lines[0].replace(/^\uFEFF/, '').split(';').map((h) => h.trim())
  let realigned = 0, dropped = 0
  const rows = lines.slice(1).flatMap((l) => {
    const v = l.replace(/\r$/, '').split(';')
    if (v.length < header.length) { dropped++; return [] }
    if (v.length > header.length) realigned++
    return [Object.fromEntries(header.map((h, i) => [h, i < fromStart ? v[i] : v[v.length - header.length + i]]))]
  })
  return { rows, realigned, dropped }
}

// INSEE reference populations of every commune (populations légales, municipal population): the weights of
// every commune-to-département aggregation. Stored once in the INSEE provider's raw folder.
export const POPULATIONS = { url: 'https://api.insee.fr/melodi/file/DS_POPULATIONS_REFERENCE/DS_POPULATIONS_REFERENCE_2023_CSV_FR', name: 'populations-reference-2023.zip' }

/** Pure: the reference-population CSV → { pop: Map commune code → persons, year }. */
export function parseReferencePopulations(csv) {
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

/**
 * fetchOnce, after registering a file that was put in raw/ by hand under `name` (e.g. downloaded before the store
 * existed, or with a browser) with the URL it came from.
 */
export async function fetchOnceStored(raw, url, { name = decodeURIComponent(new URL(url).pathname.split('/').pop()), note } = {}) {
  if (!raw.manifest.files[name] && fs.existsSync(path.join(raw.dir, name))) raw.add(name, { url, note })
  return raw.fetchOnce(url, { name })
}

export async function communePopulations() {
  const file = await fetchOnceStored(rawStore('FRA', 'insee'), POPULATIONS.url, { name: POPULATIONS.name })
  return { ...parseReferencePopulations(zipEntry(file.path, /_data\.csv$/).text()), ref: file.ref }
}

const UA = process.env.MAPSTATS_USER_AGENT || 'MapStats data import (+https://github.com/codealchemist/mapstats)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Downloads a paged JSON API answer once (INSEE Melodi pages with `paging.next`; the Géorisques API takes 20 communes
 * per call) into the store under `name`, registered with its URL: { path, text, ref } like fetchOnce. `pages`
 * lists the URLs to fetch, or a function from the previous answer to the next URL.
 */
export async function fetchJsonOnce(raw, url, name, { next = (d) => d.paging?.next || null, items = 'observations', refresh = false } = {}) {
  const stored = fs.existsSync(path.join(raw.dir, name))
  if (stored && !raw.manifest.files[name]) raw.add(name, { url: Array.isArray(url) ? url[0] : url })
  if (!refresh && stored && raw.manifest.files[name]) return raw.read(name)
  const urls = Array.isArray(url) ? [...url] : [url]
  const all = []
  let first = null
  for (let u = urls.shift(); u; u = urls.shift()) {
    const res = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${res.status} ${u}`)
    const d = await res.json()
    first ||= d
    all.push(...(d[items] || []))
    const n = Array.isArray(url) ? null : next(d)
    if (n) urls.push(n)
    if (urls.length) await sleep(1000)
  }
  fs.mkdirSync(raw.dir, { recursive: true })
  fs.writeFileSync(path.join(raw.dir, name), JSON.stringify({ ...first, [items]: all, paging: undefined, fetchedAt: new Date().toISOString().slice(0, 10) }))
  return raw.add(name, { url: Array.isArray(url) ? url[0] : url })
}
