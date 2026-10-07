// Imports natural-hazard exposure by département for France into src/data/georisques-france.json:
//   - the regulatory seismic zoning (zones 1–5 of article D563-8-1 of the Code de l'environnement,
//     décrets 2010-1255 and 2015-5), by commune;
//   - flood exposure from GASPAR: "catastrophe naturelle" declarations for floods since 2000 and
//     approved flood prevention plans (PPRi);
//   - forest-fire exposure from GASPAR: communes listed for forest-fire risk in their DDRM and
//     forest-fire prevention plans (PPRif).
//
// 1. npm run insee:import -- --download        (commune populations, used as weights)
// 2. npm run georisques:import -- --download   fetches once into data/georisques/raw/ and data/gaspar/raw/:
//      - the national seismic zoning table (shapefile zip on data.gouv.fr, Licence Ouverte; only the
//        .dbf attribute table is read, the geometry is ignored),
//      - the Géorisques zoning API answer for the 40 tracked communes (the current official zoning,
//        used to cross-check the table and as the cities' own values),
//      - the GASPAR export (zip of CSVs, Licence Ouverte).
// 3. npm run georisques:import                 (offline; re-run any time)
//
// Rules applied:
//  - A département's seismic zone is the population-weighted mean of its communes' zones (1–5);
//    cities carry their commune's zone. The app shows zone − 1 on Argentina's 0–4 scale.
//  - Flood exposure class per commune, 1–5, from the number of distinct flood CatNat events since
//    2000 (arrêtés whose risk starts with "Inondation", one per commune and event start date):
//    0 → 1, 1–3 → 2, 4–7 → 3, 8–12 → 4, 13+ → 5; an approved (opposable) flood PPR raises it to at least 3.
//  - Forest-fire exposure class per commune, 1–5: 1 unless the DDRM lists forest fire (3), a PPRif is
//    prescribed (4) or approved (5).
//  - Département classes are population-weighted means of commune classes (1 decimal), with the
//    share of population living in exposed communes kept alongside. These classes are MapStats
//    estimates built on administrative records, not measured hazard intensities.
import path from 'node:path'
import fs from 'node:fs'
import { CITY_ROWS } from '../src/data/france-cities.js'
import { DEP_TO_MAP, DEP_NAMES, communeOf, communePopulations, dbfRows, depOf, download, fileInfo, hasFlag, readZipEntry, round, today, writeJson, zipEntryNames } from './lib/fr.mjs'

const RAW = path.resolve(process.env.GEORISQUES_RAW || 'data/georisques/raw')
const GASPAR_RAW = path.resolve(process.env.GASPAR_RAW || 'data/gaspar/raw')
const OUT = path.resolve('src/data/georisques-france.json')
const ZONING = { url: 'https://static.data.gouv.fr/resources/zonage-sismique-de-la-france-1/20180730-100725/France_zonage_sismique.zip', file: path.join(RAW, 'France_zonage_sismique.zip'), dataset: 'https://www.data.gouv.fr/datasets/zonage-sismique-de-la-france-1' }
const GASPAR = { url: 'http://files.georisques.fr/GASPAR/gaspar.zip', file: path.join(GASPAR_RAW, 'gaspar.zip'), dataset: 'https://www.data.gouv.fr/datasets/base-nationale-de-gestion-assistee-des-procedures-administratives-relatives-aux-risques-gaspar' }
const API = 'https://www.georisques.gouv.fr/api/v1/zonage_sismique'
const CITIES_FILE = path.join(RAW, 'zonage-sismique-communes.json')
const COMMUNES = CITY_ROWS.map((r) => r[5])
const FLOOD_SINCE = 2000

const floodClass = (events) => (events === 0 ? 1 : events <= 3 ? 2 : events <= 7 ? 3 : events <= 12 ? 4 : 5)
const PPRIF = ['none', 'prescribed', 'approved']

// The API answers at most 20 commune codes per call.
async function downloadCities() {
  if (fs.existsSync(CITIES_FILE)) return console.log(`already downloaded: ${path.basename(CITIES_FILE)} (delete it to fetch again)`)
  const data = []
  for (let i = 0; i < COMMUNES.length; i += 20) {
    const url = `${API}?code_insee=${COMMUNES.slice(i, i + 20).join(',')}&page_size=100`
    console.log(`downloading ${url.slice(0, 90)}…`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    data.push(...(await res.json()).data)
  }
  fs.mkdirSync(RAW, { recursive: true })
  fs.writeFileSync(CITIES_FILE, JSON.stringify({ fetchedAt: today(), url: API, data }))
}

// Semicolon CSV inside the GASPAR zip. Free-text fields near the start of a row (procedure name,
// organisation, river) sometimes contain the separator: the first two columns are read from the
// start of the row and every other column from the end, so an over-long row still aligns.
function gasparRows(re) {
  const lines = readZipEntry(GASPAR.file, re).toString('utf8').split('\n').filter(Boolean)
  const header = lines[0].replace(/^\uFEFF/, '').split(';').map((h) => h.trim())
  const fromStart = 2
  let short = 0, long = 0
  const rows = lines.slice(1).flatMap((l) => {
    const v = l.split(';')
    if (v.length < header.length) { short++; return [] }
    if (v.length > header.length) long++
    return [Object.fromEntries(header.map((h, i) => [h, i < fromStart ? v[i] : v[v.length - header.length + i]]))]
  })
  if (short || long) console.log(`${re}: ${long} rows with an extra separator realigned, ${short} too short dropped`)
  return rows
}

async function main() {
  if (hasFlag('--download')) {
    await download(ZONING.url, ZONING.file)
    await download(GASPAR.url, GASPAR.file)
    await downloadCities()
  }
  const missing = [ZONING.file, GASPAR.file, CITIES_FILE].filter((f) => !fs.existsSync(f))
  if (missing.length) {
    console.log(`Missing raw files: ${missing.map((f) => path.relative(process.cwd(), f)).join(', ')}. Run with --download.`)
    process.exitCode = 1
    return
  }
  const { pop, year: popYear } = communePopulations()

  // Seismic zone per commune: the national table (2018 geography), overridden by the API for the
  // tracked communes, which also checks the table is still current.
  const zone = new Map()
  for (const r of dbfRows(readZipEntry(ZONING.file, /\.dbf$/))) { const z = +r.Sismicite[0]; if (z) zone.set(r.insee, z) }
  const api = JSON.parse(fs.readFileSync(CITIES_FILE, 'utf8'))
  let mismatches = 0
  for (const c of api.data) {
    const z = +c.code_zone
    if (zone.has(c.code_insee) && zone.get(c.code_insee) !== z) { mismatches++; console.log(`zone differs for ${c.code_insee} ${c.libelle_commune}: table ${zone.get(c.code_insee)}, API ${z}`) }
    zone.set(c.code_insee, z)
  }
  console.log(`seismic zoning: ${zone.size} communes in the table, ${api.data.length} checked against the API (${mismatches} differ)`)

  // GASPAR: flood CatNat events, DDRM forest-fire listings, PPR flood / forest fire
  const floodEvents = new Map()
  let catnat = 0
  for (const r of gasparRows(/^catnat_/)) {
    if (!/^Inondation/.test(r.lib_risque_jo) || +r.date_debut.slice(0, 4) < FLOOD_SINCE) continue
    catnat++
    const c = communeOf(r.code_commune)
    if (!floodEvents.has(c)) floodEvents.set(c, new Set())
    floodEvents.get(c).add(r.date_debut.slice(0, 10))
  }
  const ddrmFire = new Set()
  for (const r of gasparRows(/^ddrm_risq_/)) if (r.lib_risque === 'Feu de forêt') ddrmFire.add(communeOf(r.cod_commune))
  const ppri = new Set(), pprif = new Map()
  for (const r of gasparRows(/^pprn_/)) {
    const risks = [r['LIBELLE RISQUE 1'], r['LIBELLE RISQUE 2'], r['LIBELLE RISQUE 3']].join('|'), c = communeOf(r['CODE INSEE COMMUNE']), state = r['LIBELLE ETAT']
    if (state === 'Opposable' && (r['CODE MODELE'] === 'PPRN-I' || /Inondation/.test(risks))) ppri.add(c)
    if (r['CODE MODELE'] === 'PPRN-IF' || /Feu de for/.test(risks)) {
      const rank = state === 'Opposable' ? 2 : state === 'Prescrit' ? 1 : 0
      if (rank > (pprif.get(c) ?? -1)) pprif.set(c, rank)
    }
  }
  const classes = (c) => {
    const events = floodEvents.get(c)?.size ?? 0
    return {
      zone: zone.get(c) ?? null,
      floodEvents: events, ppri: ppri.has(c), flood: Math.max(floodClass(events), ppri.has(c) ? 3 : 1),
      fireListed: ddrmFire.has(c), pprif: PPRIF[pprif.get(c) ?? 0], fire: pprif.get(c) === 2 ? 5 : pprif.get(c) === 1 ? 4 : ddrmFire.has(c) ? 3 : 1,
    }
  }

  // Population-weighted aggregation over the current communes of each département
  const acc = {}
  let unknownEvents = 0
  for (const c of floodEvents.keys()) if (!pop.has(c)) unknownEvents += floodEvents.get(c).size
  for (const [c, p] of pop) {
    const id = DEP_TO_MAP[depOf(c)]
    if (!id || !p) continue
    const a = (acc[id] ||= { pop: 0, communes: 0, zonePop: 0, zoneSum: 0, zoneMax: 0, floodSum: 0, floodPop: 0, fireSum: 0, firePop: 0 })
    const k = classes(c)
    a.pop += p
    a.communes++
    if (k.zone) { a.zonePop += p; a.zoneSum += p * k.zone; a.zoneMax = Math.max(a.zoneMax, k.zone) }
    a.floodSum += p * k.flood
    if (k.floodEvents) a.floodPop += p
    a.fireSum += p * k.fire
    if (k.fireListed) a.firePop += p
  }
  const departments = Object.fromEntries(Object.entries(DEP_TO_MAP).map(([, id]) => {
    const a = acc[id]
    if (!a) return [id, { name: DEP_NAMES[id], communes: 0 }]
    return [id, {
      name: DEP_NAMES[id], communes: a.communes, pop: a.pop,
      seismicZone: a.zonePop ? round(a.zoneSum / a.zonePop) : null, seismicZoneMax: a.zoneMax || null, zoningCoverage: round(a.zonePop / a.pop, 3),
      floodExposure: round(a.floodSum / a.pop, 1), floodExposedShare: round((100 * a.floodPop) / a.pop, 1),
      fireExposure: round(a.fireSum / a.pop, 1), fireListedShare: round((100 * a.firePop) / a.pop, 1),
    }]
  }))
  const communes = Object.fromEntries(COMMUNES.map((c) => [c, { pop: pop.get(c) ?? null, ...classes(c) }]))
  const gasparDate = zipEntryNames(GASPAR.file).map((n) => n.match(/(\d{4}-\d\d-\d\d)\.csv$/)?.[1]).find(Boolean) || null

  const out = {
    source: `Géorisques – zonage sismique réglementaire (${ZONING.dataset}); GASPAR – procédures administratives relatives aux risques (${GASPAR.dataset})`,
    importedAt: today(),
    origin: 'official downloads from data.gouv.fr / files.georisques.fr (Licence Ouverte), zoning API of georisques.gouv.fr; population weights from INSEE reference populations',
    files: [fileInfo(ZONING.file), fileInfo(GASPAR.file), fileInfo(CITIES_FILE)],
    gasparDate, zoningApiFetchedAt: api.fetchedAt, populationYear: popYear,
    seismic: { scale: 'zones 1 (très faible) to 5 (forte), décrets 2010-1255 and 2015-5', aggregation: 'population-weighted mean of commune zones' },
    flood: { since: FLOOD_SINCE, classes: '0 events → 1, 1–3 → 2, 4–7 → 3, 8–12 → 4, 13+ → 5; approved flood PPR → at least 3', events: catnat },
    fire: { classes: 'not listed → 1, forest fire in the DDRM → 3, PPRif prescribed → 4, PPRif approved → 5' },
    departments, communes,
  }
  const covered = Object.values(departments).filter((d) => d.seismicZone != null).length
  console.log(`flood events since ${FLOOD_SINCE}: ${catnat} rows, ${floodEvents.size} communes (${unknownEvents} events on commune codes absent from the ${popYear} population file); forest fire listed in ${ddrmFire.size} communes, PPRif in ${pprif.size}, approved PPRi in ${ppri.size}`)
  writeJson(OUT, out, `${Object.keys(departments).length} departments (${covered} with a seismic zone), ${COMMUNES.length} communes`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
