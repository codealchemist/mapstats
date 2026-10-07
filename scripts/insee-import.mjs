// Imports INSEE department statistics for France into src/data/insee-france.json, from INSEE's
// open APIs (api.insee.fr, no key; INSEE Open Licence 2.0 – attribution and update date kept below):
//   - Melodi DS_ESTIMATION_POPULATION   population at 1 January by department and year (incl. Mayotte)
//   - Melodi DS_POPULATIONS_REFERENCE   municipal population of the tracked communes (populations légales)
//   - Melodi DS_FILOSOFI_CC             relative poverty rate (60% of the metropolitan median) and median
//                                       standard of living, departments and tracked communes
//   - Melodi DS_DECES_MORTALITE_SERIES   life expectancy at birth by department, women and men
//   - Melodi DS_RP_NAVETTES_PRINC        census commuters by mode of transport, departments and tracked communes
//   - BDM TCRED-TRAVAIL-EMPLOI-TCHOMA-SA localised unemployment rate, annual average, by department
//   - the reference-population file of every commune (populations légales), kept raw as the
//     population weights of the other imports (scripts/lib/fr.mjs communePopulations)
//
// 1. npm run insee:import -- --download    fetches each response once into data/insee/raw/ (delete a
//    file to refresh it). insee.fr's robots.txt disallows fetching its xlsx/csv files, so the APIs
//    are the only automated route; everything else is read from the raw folder.
// 2. npm run insee:import                  (offline; re-run any time)
//
// Rules applied:
//  - Values are stored as published, with the reference period of each series. Nothing is
//    recomputed; Filosofi covers metropolitan France and La Réunion only, so the other overseas
//    departments stay null (never filled with a national mean).
//  - Unemployment: metropolitan departments use the localised ILO rates; overseas departments only
//    have the survey-based ILO rate (same concept, different series) and Mayotte has none. The
//    exact series (idbank, title) is kept per department.
//  - Population at 1 January 2023 is the reference used as `pop` (definitive, aligned with the 2023
//    census populations); provisional later years are kept for denominators.
//  - Life expectancy: INSEE publishes département figures for women and men only; both are kept,
//    with the latest year both are available and its status (provisional for recent years).
//  - Commuting: share of employed residents aged 15+ whose main mode of transport to work is public
//    transport, census 2023 (France excluding Mayotte).
import path from 'node:path'
import fs from 'node:fs'
import { XMLParser } from 'fast-xml-parser'
import { CITY_ROWS } from '../src/data/france-cities.js'
import { DEP_TO_MAP, DEPS, POPULATIONS_ZIP, download, fileInfo, hasFlag, round, today, writeJson } from './lib/fr.mjs'

const RAW = path.resolve(process.env.INSEE_RAW || 'data/insee/raw')
const OUT = path.resolve('src/data/insee-france.json')
const MELODI = 'https://api.insee.fr/melodi/data'
const BDM = 'https://api.insee.fr/series/BDM/V1/data'
const POP_YEARS = Array.from({ length: 11 }, (_, i) => 2016 + i)
const POP_REFERENCE_YEAR = 2023
const LIFE_YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i)
const COMMUTE_YEAR = 2023
const COMMUNES = CITY_ROWS.map((r) => r[5])

const q = (params) => params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
const FILES = {
  population: `${MELODI}/DS_ESTIMATION_POPULATION?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ['EP_MEASURE', 'POP_JAN_1ST'], ['SEX', '_T'], ['AGE', '_T'], ...POP_YEARS.map((y) => ['TIME_PERIOD', y]), ['maxResult', 5000]])}`,
  communes: `${MELODI}/DS_POPULATIONS_REFERENCE?${q([...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['POPREF_MEASURE', 'PMUN'], ['maxResult', 1000]])}`,
  filosofi: `${MELODI}/DS_FILOSOFI_CC?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['FILOSOFI_MEASURE', 'PR_MD60'], ['FILOSOFI_MEASURE', 'MED_SL'], ['maxResult', 5000]])}`,
  mortality: `${MELODI}/DS_DECES_MORTALITE_SERIES?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ['EC_MEASURE', 'LEXPEC'], ['AGE', 'Y0'], ['SEX', 'F'], ['SEX', 'M'], ...LIFE_YEARS.map((y) => ['TIME_PERIOD', y]), ['maxResult', 5000]])}`,
  commuting: `${MELODI}/DS_RP_NAVETTES_PRINC?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['TRANS', '_T'], ['TRANS', '6'], ['WORK_AREA', '_T'], ['TIME_PERIOD', COMMUTE_YEAR], ['maxResult', 2000]])}`,
  unemployment: `${BDM}/TCRED-TRAVAIL-EMPLOI-TCHOMA-SA?startPeriod=2015`,
}
const rawPath = (k) => path.join(RAW, `${k}.${k === 'unemployment' ? 'xml' : 'json'}`)

// Melodi pages its answers; follow `paging.next` and concatenate observations into one raw file.
async function downloadMelodi(url, dest) {
  if (fs.existsSync(dest)) return console.log(`already downloaded: ${path.basename(dest)} (delete it to fetch again)`)
  const observations = []
  let next = url, first = null
  while (next) {
    console.log(`downloading ${next.slice(0, 110)}…`)
    const res = await fetch(next, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`${res.status} ${next}`)
    const d = await res.json()
    first ||= d
    observations.push(...(d.observations || []))
    next = d.paging?.next || null
  }
  fs.mkdirSync(RAW, { recursive: true })
  fs.writeFileSync(dest, JSON.stringify({ ...first, observations, paging: undefined, fetchedAt: today(), url }))
}

const geoDep = (geo) => DEP_TO_MAP[geo.replace(/^\d{4}-DEP-/, '')]
const geoCom = (geo) => geo.replace(/^\d{4}-COM-/, '')
const value = (o) => o.measures?.OBS_VALUE_NIVEAU?.value ?? null

async function main() {
  if (hasFlag('--download')) {
    for (const k of ['population', 'communes', 'filosofi', 'mortality', 'commuting']) await downloadMelodi(FILES[k], rawPath(k))
    await download(FILES.unemployment, rawPath('unemployment'), { headers: { Accept: 'application/xml' } })
    await download(POPULATIONS_ZIP.url, POPULATIONS_ZIP.file)
  }
  const missing = Object.keys(FILES).filter((k) => !fs.existsSync(rawPath(k)))
  if (missing.length) {
    console.log(`Missing raw files in ${path.relative(process.cwd(), RAW)}/: ${missing.join(', ')}. Run with --download.`)
    process.exitCode = 1
    return
  }
  const json = (k) => JSON.parse(fs.readFileSync(rawPath(k), 'utf8'))

  // Population at 1 January, by department and year
  const population = { measure: 'POP_JAN_1ST', unit: 'persons', years: POP_YEARS, referenceYear: POP_REFERENCE_YEAR, status: {}, departments: {} }
  for (const o of json('population').observations) {
    const id = geoDep(o.dimensions.GEO)
    if (!id) continue
    const y = +o.dimensions.TIME_PERIOD
    ;(population.departments[id] ||= {})[y] = value(o)
    population.status[y] = o.attributes?.OBS_STATUS_FR || o.attributes?.OBS_STATUS || null
  }

  // Municipal population of the tracked communes (populations légales)
  const communes = {}
  for (const o of json('communes').observations) communes[geoCom(o.dimensions.GEO)] = { pop: value(o), popYear: +o.dimensions.TIME_PERIOD }

  // Filosofi: relative poverty and median standard of living
  const poverty = { year: null, measure: 'PR_MD60', unit: '%', threshold: '60% of the metropolitan median standard of living', coverage: 'metropolitan France and La Réunion', departments: {}, communes: {} }
  for (const o of json('filosofi').observations) {
    const geo = o.dimensions.GEO
    const target = /-DEP-/.test(geo) ? (geoDep(geo) && (poverty.departments[geoDep(geo)] ||= {})) : (poverty.communes[geoCom(geo)] ||= {})
    if (!target) continue
    poverty.year = +o.dimensions.TIME_PERIOD
    if (o.dimensions.FILOSOFI_MEASURE === 'PR_MD60') target.povertyRelative = value(o)
    if (o.dimensions.FILOSOFI_MEASURE === 'MED_SL') target.medianIncome = value(o)
  }

  // Life expectancy at birth, women and men (no both-sex figure is published below the national level)
  const lifeExpectancy = { measure: 'LEXPEC', unit: 'years', definition: 'life expectancy at birth, women and men separately', year: null, status: {}, departments: {} }
  const bySex = {}
  for (const o of json('mortality').observations) {
    const id = geoDep(o.dimensions.GEO)
    if (!id) continue
    const y = +o.dimensions.TIME_PERIOD
    ;((bySex[id] ||= { women: {}, men: {} })[o.dimensions.SEX === 'F' ? 'women' : 'men'])[y] = value(o)
    lifeExpectancy.status[y] = o.attributes?.OBS_STATUS_FR || o.attributes?.OBS_STATUS || null
  }
  for (const [id, s] of Object.entries(bySex)) {
    const year = Math.max(...LIFE_YEARS.filter((y) => s.women[y] != null && s.men[y] != null), 0) || null
    lifeExpectancy.departments[id] = { year, women: year ? s.women[year] : null, men: year ? s.men[year] : null, series: s }
    lifeExpectancy.year = Math.max(lifeExpectancy.year || 0, year || 0)
  }

  // Census commuters by mode: share using public transport, departments and tracked communes
  const commuting = { year: COMMUTE_YEAR, unit: '%', definition: 'employed residents aged 15 or more whose main mode of transport to work is public transport', coverage: 'France excluding Mayotte', departments: {}, communes: {} }
  const modes = {}
  for (const o of json('commuting').observations) (modes[o.dimensions.GEO] ||= {})[o.dimensions.TRANS] = value(o)
  for (const [geo, m] of Object.entries(modes)) {
    if (m._T == null || m[6] == null) continue
    const entry = { publicTransport: round((100 * m[6]) / m._T, 1), workers: Math.round(m._T) }
    if (/-DEP-/.test(geo)) { if (geoDep(geo)) commuting.departments[geoDep(geo)] = entry } else commuting.communes[geoCom(geo)] = entry
  }

  // Localised unemployment, annual averages (SDMX)
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => name === 'Series' || name === 'Obs' })
  const doc = parser.parse(fs.readFileSync(rawPath('unemployment'), 'utf8'))
  const series = doc['message:StructureSpecificData']['message:DataSet'].Series
  const unemployment = { year: null, unit: '%', definition: 'ILO unemployment rate, annual average: localised rates for metropolitan departments, Labour Force Survey rates for overseas departments', departments: {}, national: {} }
  for (const s of series) {
    if (s.FREQ !== 'A' || s.SEXE !== '0' || s.AGE !== '00-') continue
    const obs = Object.fromEntries((s.Obs || []).map((o) => [+o.TIME_PERIOD, +o.OBS_VALUE]))
    const years = Object.keys(obs).map(Number).sort((a, b) => a - b)
    const entry = { value: obs[years.at(-1)], year: years.at(-1), series: obs, idbank: s.IDBANK, title: s.TITLE_FR }
    const id = /^D/.test(s.REF_AREA) ? DEP_TO_MAP[s.REF_AREA.slice(1)] : null
    if (id) { unemployment.departments[id] = entry; unemployment.year = Math.max(unemployment.year || 0, entry.year) }
    else if (s.REF_AREA === 'FM' || s.REF_AREA === 'FR-D976') unemployment.national[s.REF_AREA === 'FM' ? 'metropolitan' : 'franceExclMayotte'] = entry
  }

  const out = {
    source: 'INSEE – api.insee.fr (Melodi: DS_ESTIMATION_POPULATION, DS_POPULATIONS_REFERENCE, DS_FILOSOFI_CC, DS_DECES_MORTALITE_SERIES, DS_RP_NAVETTES_PRINC; BDM: TCRED-TRAVAIL-EMPLOI-TCHOMA-SA)',
    importedAt: today(),
    origin: 'INSEE open APIs, fetched once (INSEE Open Licence 2.0)',
    files: Object.keys(FILES).map((k) => ({ ...fileInfo(rawPath(k)), url: FILES[k] })),
    population, communes, poverty, unemployment, lifeExpectancy, commuting,
  }
  const n = (o) => Object.keys(o).length
  writeJson(OUT, out, `population ${n(population.departments)} departments × ${POP_YEARS.length} years, ${n(communes)} communes, poverty ${n(poverty.departments)} departments (${poverty.year}), unemployment ${n(unemployment.departments)} departments (${unemployment.year}), life expectancy ${n(lifeExpectancy.departments)} departments (${lifeExpectancy.year}), commuting ${n(commuting.departments)} departments + ${n(commuting.communes)} communes (${commuting.year})`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
