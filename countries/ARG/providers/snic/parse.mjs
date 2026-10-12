// SNIC bases → summary (pure: no I/O, so tests run on fixtures). Rules (see the SNIC methodology manual):
//  - Only parent crime codes ("15", not "15_1"): sub-codes break a parent down
//    from the year they were introduced, so adding both double-counts.
//  - Rates are used exactly as published (per 100,000 inhabitants). Missing rates
//    stay missing; nothing is recomputed from estimated populations. The only
//    derived figures are national rates: total count / total population, where
//    each province's population is implied by its own published count and rate.
//  - Homicide and road-death rates use victims; other crimes use incidents (hechos).
//  - "Departamento sin determinar" rows (no location) are skipped.

export const SERIES_YEARS = 10

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
export const CODES = new Set(Object.values(METRICS).flatMap((m) => m.codes))

// INDEC province code -> ISO 3166-2
export const PROV_ISO = {
  '02': 'AR-C', '06': 'AR-B', '10': 'AR-K', '14': 'AR-X', '18': 'AR-W', '22': 'AR-H', '26': 'AR-U', '30': 'AR-E',
  '34': 'AR-P', '38': 'AR-Y', '42': 'AR-L', '46': 'AR-F', '50': 'AR-M', '54': 'AR-N', '58': 'AR-Q', '62': 'AR-R',
  '66': 'AR-A', '70': 'AR-J', '74': 'AR-D', '78': 'AR-Z', '82': 'AR-S', '86': 'AR-G', '90': 'AR-T', '94': 'AR-V',
}

const num = (v) => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const pad = (v, n) => (v == null ? null : String(v).trim().padStart(n, '0'))

// key -> year -> code -> row
export async function ingest(state, rows, name = 'file') {
  const { store, names, deptProv } = state
  let kind = null, n = 0
  for await (const r of rows) {
    kind ||= 'departamento_id' in r ? 'department' : 'provincia_id' in r ? 'province' : null
    if (!kind) throw new Error(`${name}: not a SNIC base (no provincia_id / departamento_id column)`)
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

export function summarise(byYear, years) {
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
export function national(store, years) {
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

export const createState = () => ({ store: { province: {}, department: {} }, names: { province: {}, department: {} }, deptProv: {} })

/** The import summary toDataset() takes, from every ingested base. */
export function summary({ store, names, deptProv }, { files, origin, importedAt = new Date().toISOString().slice(0, 10) }) {
  if (!Object.keys(store.province).length) throw new Error('A provincial base is required (national and provincial rates come from it).')
  const allYears = [...new Set(Object.values(store.province).flatMap((p) => Object.keys(p).map(Number)))].sort((a, b) => a - b)
  const years = allYears.slice(-SERIES_YEARS)
  return {
    source: 'SNIC – Ministerio de Seguridad Nacional (https://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos)',
    importedAt,
    origin,
    files,
    metrics: Object.fromEntries(Object.entries(METRICS).map(([k, m]) => [k, { ...m, unit: 'per 100k' }])),
    years,
    latestYear: years.at(-1),
    national: summarise(national(store, years), years),
    provinces: Object.fromEntries(Object.entries(store.province).map(([id, by]) => [PROV_ISO[id], { name: names.province[id], ...summarise(by, years) }])),
    departments: Object.fromEntries(Object.entries(store.department).map(([id, by]) => [id, { name: names.department[id], province: deptProv[id], ...summarise(by, years) }])),
  }
}
