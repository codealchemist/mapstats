// Imports official SNIC crime statistics (Ministerio de Seguridad Nacional) into
// src/data/snic-argentina.json.
//
// 1. Download the files once from
//    https://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos
//    (provincial and departmental "hechos y víctimas" bases, .xlsx or .csv)
//    into data/snic/raw/. Or let the script download them once:
//      npm run snic:import -- --download <url> [--download <url> ...]
// 2. npm run snic:import          (offline; re-run any time)
//    npm run snic:import -- --origin "where the files came from"   (stored in the output)
//
// Rules applied (see the SNIC methodology manual):
//  - Only parent crime codes ("15", not "15_1"): sub-codes break a parent down
//    from the year they were introduced, so adding both double-counts.
//  - Rates are used exactly as published (per 100,000 inhabitants). Missing rates
//    stay missing; nothing is recomputed from estimated populations. The only
//    derived figures are national rates: total count / total population, where
//    each province's population is implied by its own published count and rate.
//  - Homicide and road-death rates use victims; other crimes use incidents (hechos).
//  - "Departamento sin determinar" rows (no location) are skipped.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ExcelJS from 'exceljs'

const RAW = path.resolve(process.env.SNIC_RAW || 'data/snic/raw')
const OUT = path.resolve('src/data/snic-argentina.json')
const SERIES_YEARS = 10

// metric -> codes summed, measure. Sums only when every component is published.
export const METRICS = {
  homicide: { codes: ['1'], measure: 'victimas', label: 'Intentional homicides (victims)' },
  roadDeaths: { codes: ['3'], measure: 'victimas', label: 'Road traffic deaths (victims)' },
  robbery: { codes: ['15', '17'], measure: 'hechos', label: 'Robberies' },
  theft: { codes: ['19'], measure: 'hechos', label: 'Thefts' },
  propertyCrime: { codes: ['15', '17', '19'], measure: 'hechos', label: 'Robberies + thefts' },
  injuries: { codes: ['5'], measure: 'hechos', label: 'Intentional injuries' },
  sexualAssault: { codes: ['10'], measure: 'hechos', label: 'Rape' },
  threats: { codes: ['13'], measure: 'hechos', label: 'Threats' },
  drugs: { codes: ['28'], measure: 'hechos', label: 'Drug law offences (Ley 23.737)' },
}
const CODES = new Set(Object.values(METRICS).flatMap((m) => m.codes))

// INDEC province code -> ISO 3166-2
const PROV_ISO = {
  '02': 'AR-C', '06': 'AR-B', '10': 'AR-K', '14': 'AR-X', '18': 'AR-W', '22': 'AR-H', '26': 'AR-U', '30': 'AR-E',
  '34': 'AR-P', '38': 'AR-Y', '42': 'AR-L', '46': 'AR-F', '50': 'AR-M', '54': 'AR-N', '58': 'AR-Q', '62': 'AR-R',
  '66': 'AR-A', '70': 'AR-J', '74': 'AR-D', '78': 'AR-Z', '82': 'AR-S', '86': 'AR-G', '90': 'AR-T', '94': 'AR-V',
}

const args = process.argv.slice(2)
const downloads = args.flatMap((a, i) => (a === '--download' ? [args[i + 1]] : []))
// Free-text note on where the raw files came from, stored in the output for traceability.
const origin = args.flatMap((a, i) => (a === '--origin' ? [args[i + 1]] : []))[0] || 'official download'

const num = (v) => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const pad = (v, n) => (v == null ? null : String(v).trim().padStart(n, '0'))

async function* readRows(file) {
  if (/\.xlsx$/i.test(file)) {
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', worksheets: 'emit' })
    for await (const ws of reader) {
      let header = null
      for await (const row of ws) {
        const v = row.values.slice(1).map((x) => (x && typeof x === 'object' && 'result' in x ? x.result : x))
        if (!header) { header = v.map((h) => String(h ?? '').trim().toLowerCase()); continue }
        yield Object.fromEntries(header.map((h, i) => [h, v[i] ?? null]))
      }
      break // first sheet only
    }
  } else {
    const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
    const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ','
    const split = (l) => l.split(sep).map((c) => c.replace(/^"|"$/g, ''))
    const header = split(lines.shift()).map((h) => h.trim().toLowerCase())
    for (const l of lines) { const c = split(l); yield Object.fromEntries(header.map((h, i) => [h, c[i] ?? null])) }
  }
}

async function download(url) {
  fs.mkdirSync(RAW, { recursive: true })
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop())
  const dest = path.join(RAW, name)
  if (fs.existsSync(dest)) return console.log(`already downloaded: ${name} (delete it to fetch again)`)
  console.log(`downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

// key -> year -> code -> row
const store = { province: {}, department: {} }
const names = { province: {}, department: {} }
const deptProv = {}

async function ingest(file) {
  let kind = null, n = 0
  for await (const r of readRows(file)) {
    kind ||= 'departamento_id' in r ? 'department' : 'provincia_id' in r ? 'province' : null
    if (!kind) throw new Error(`${path.basename(file)}: not a SNIC base (no provincia_id / departamento_id column)`)
    const code = String(r.codigo_delito_snic_id ?? '').trim()
    if (!CODES.has(code)) continue
    const year = num(r.anio)
    const prov = pad(r.provincia_id, 2)
    let key = prov
    if (kind === 'department') {
      if (/sin determinar/i.test(r.departamento_nombre || '')) continue
      key = pad(r.departamento_id, 5)
      names.department[key] = r.departamento_nombre
      deptProv[key] = PROV_ISO[prov]
    } else names.province[key] = r.provincia_nombre
    const byYear = ((store[kind][key] ||= {})[year] ||= {})
    byYear[code] = {
      hechos: num(r.cantidad_hechos), victimas: num(r.cantidad_victimas),
      tasa_hechos: num(r.tasa_hechos), tasa_victimas: num(r.tasa_victimas),
    }
    n++
  }
  return { kind, rows: n }
}

function metricValue(yearRow, m) {
  if (!yearRow) return null
  let sum = 0
  for (const c of m.codes) {
    const v = yearRow[c]?.[`tasa_${m.measure}`]
    if (v == null) return null
    sum += v
  }
  return Math.round(sum * 100) / 100
}

const mean = (a) => { const v = a.filter((x) => x != null); return v.length >= 2 ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null }

function summarise(byYear, years) {
  const latest = years.at(-1)
  const out = { latest: {}, counts: {}, avg3: {}, series: {} }
  for (const [k, m] of Object.entries(METRICS)) {
    const s = years.map((y) => metricValue(byYear[y], m))
    out.latest[k] = s.at(-1)
    // Exact published counts (incidents or victims) for the latest year.
    const counts = m.codes.map((c) => byYear[latest]?.[c]?.[m.measure])
    out.counts[k] = counts.every((c) => c != null) ? counts.reduce((a, b) => a + b, 0) : null
    out.avg3[k] = mean(s.slice(-3))
    if (['homicide', 'propertyCrime', 'roadDeaths'].includes(k)) out.series[k] = s
  }
  out.latestYear = latest
  return out
}

// National rate = sum(count) / sum(population implied by each province's own count and rate).
function national(years) {
  const byYear = {}
  for (const y of years) {
    const row = (byYear[y] = {})
    for (const c of CODES) {
      for (const measure of ['hechos', 'victimas']) {
        let count = 0, pop = 0, ok = true
        for (const p of Object.values(store.province)) {
          const r = p[y]?.[c]
          if (!r) continue
          const cnt = r[measure], rate = r[`tasa_${measure}`]
          if (cnt == null) { ok = false; continue }
          count += cnt
          if (rate > 0) pop += (cnt / rate) * 1e5
        }
        row[c] ||= {}
        row[c][measure] = ok ? count : null
        row[c][`tasa_${measure}`] = ok && pop ? (count / pop) * 1e5 : null
      }
    }
  }
  return byYear
}

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16)

async function main() {
  for (const url of downloads) await download(url)
  const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => /\.(xlsx|csv)$/i.test(f)).map((f) => path.join(RAW, f)) : []
  if (!files.length) {
    console.log(`No SNIC files in ${path.relative(process.cwd(), RAW)}/. Download the provincial and departmental bases from\nhttps://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos`)
    process.exitCode = 1
    return
  }
  const imported = []
  for (const f of files) {
    const t = Date.now()
    const r = await ingest(f)
    console.log(`${path.basename(f)}: ${r.kind}, ${r.rows} rows used (${((Date.now() - t) / 1000).toFixed(1)}s)`)
    imported.push({ file: path.basename(f), kind: r.kind, sha256: sha(f) })
  }
  if (!Object.keys(store.province).length) throw new Error('A provincial base is required (national and provincial rates come from it).')

  const allYears = [...new Set(Object.values(store.province).flatMap((p) => Object.keys(p).map(Number)))].sort((a, b) => a - b)
  const years = allYears.slice(-SERIES_YEARS)
  const out = {
    source: 'SNIC – Ministerio de Seguridad Nacional (https://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos)',
    importedAt: new Date().toISOString().slice(0, 10),
    origin,
    files: imported,
    metrics: Object.fromEntries(Object.entries(METRICS).map(([k, m]) => [k, { ...m, unit: 'per 100k' }])),
    years,
    latestYear: years.at(-1),
    national: summarise(national(years), years),
    provinces: Object.fromEntries(Object.entries(store.province).map(([id, by]) => [PROV_ISO[id], { name: names.province[id], ...summarise(by, years) }])),
    departments: Object.fromEntries(Object.entries(store.department).map(([id, by]) => [id, { name: names.department[id], province: deptProv[id], ...summarise(by, years) }])),
  }
  fs.writeFileSync(OUT, JSON.stringify(out) + '\n')
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${Object.keys(out.provinces).length} provinces, ${Object.keys(out.departments).length} departments, years ${years[0]}–${out.latestYear} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
