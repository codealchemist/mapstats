// Imports INSEE department statistics for France into src/data/insee-france.json, from INSEE's
// open APIs (api.insee.fr, no key; INSEE Open Licence 2.0 – attribution and update date kept below):
//   - Melodi DS_ESTIMATION_POPULATION   population at 1 January by department and year (incl. Mayotte)
//   - Melodi DS_POPULATIONS_REFERENCE   municipal population of the tracked communes (populations légales)
//   - Melodi DS_FILOSOFI_CC             relative poverty rate (60% of the metropolitan median) and median
//                                       standard of living, departments and tracked communes
//   - BDM TCRED-TRAVAIL-EMPLOI-TCHOMA-SA localised unemployment rate, annual average, by department
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
import path from 'node:path'
import fs from 'node:fs'
import { XMLParser } from 'fast-xml-parser'
import { CITY_ROWS } from '../src/data/france-cities.js'
import { DEP_TO_MAP, DEPS, download, fileInfo, hasFlag, today, writeJson } from './lib/fr.mjs'

const RAW = path.resolve(process.env.INSEE_RAW || 'data/insee/raw')
const OUT = path.resolve('src/data/insee-france.json')
const MELODI = 'https://api.insee.fr/melodi/data'
const BDM = 'https://api.insee.fr/series/BDM/V1/data'
const POP_YEARS = Array.from({ length: 11 }, (_, i) => 2016 + i)
const POP_REFERENCE_YEAR = 2023
const COMMUNES = CITY_ROWS.map((r) => r[5])

const q = (params) => params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
const FILES = {
  population: `${MELODI}/DS_ESTIMATION_POPULATION?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ['EP_MEASURE', 'POP_JAN_1ST'], ['SEX', '_T'], ['AGE', '_T'], ...POP_YEARS.map((y) => ['TIME_PERIOD', y]), ['maxResult', 5000]])}`,
  communes: `${MELODI}/DS_POPULATIONS_REFERENCE?${q([...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['POPREF_MEASURE', 'PMUN'], ['maxResult', 1000]])}`,
  filosofi: `${MELODI}/DS_FILOSOFI_CC?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['FILOSOFI_MEASURE', 'PR_MD60'], ['FILOSOFI_MEASURE', 'MED_SL'], ['maxResult', 5000]])}`,
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
    for (const k of ['population', 'communes', 'filosofi']) await downloadMelodi(FILES[k], rawPath(k))
    await download(FILES.unemployment, rawPath('unemployment'), { headers: { Accept: 'application/xml' } })
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
    source: 'INSEE – api.insee.fr (Melodi: DS_ESTIMATION_POPULATION, DS_POPULATIONS_REFERENCE, DS_FILOSOFI_CC; BDM: TCRED-TRAVAIL-EMPLOI-TCHOMA-SA)',
    importedAt: today(),
    origin: 'INSEE open APIs, fetched once (INSEE Open Licence 2.0)',
    files: Object.keys(FILES).map((k) => ({ ...fileInfo(rawPath(k)), url: FILES[k] })),
    population, communes, poverty, unemployment,
  }
  const n = (o) => Object.keys(o).length
  writeJson(OUT, out, `population ${n(population.departments)} departments × ${POP_YEARS.length} years, ${n(communes)} communes, poverty ${n(poverty.departments)} departments (${poverty.year}), unemployment ${n(unemployment.departments)} departments (${unemployment.year})`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
