// INSEE API answers → département and commune values. Pure: the test runs the readers on inline observations.
//   Melodi observations: { dimensions: { GEO: '2026-DEP-26', TIME_PERIOD, … }, measures: { OBS_VALUE_NIVEAU: { value } }, attributes }
//   BDM (SDMX-ML): Series elements with attributes (REF_AREA "D75", IDBANK, TITLE_FR) and Obs children
import { rawStore, parseXml } from '#sdk'
import { DEP_TO_MAP, DEPS, fetchJsonOnce, round } from '../../lib/fr.mjs'
import { CITIES } from '../../places.js'

export const MELODI = 'https://api.insee.fr/melodi/data'
export const BDM = 'https://api.insee.fr/series/BDM/V1/data'
export const POP_YEARS = Array.from({ length: 11 }, (_, i) => 2016 + i)
export const LIFE_YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i)
export const COMMUNES = CITIES.map((c) => c.codes.subregion)

const q = (params) => params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
/** The API queries, one file each in raw/. */
export const FILES = {
  population: { name: 'population.json', url: `${MELODI}/DS_ESTIMATION_POPULATION?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ['EP_MEASURE', 'POP_JAN_1ST'], ['SEX', '_T'], ['AGE', '_T'], ...POP_YEARS.map((y) => ['TIME_PERIOD', y]), ['maxResult', 5000]])}` },
  communes: { name: 'communes.json', url: `${MELODI}/DS_POPULATIONS_REFERENCE?${q([...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['POPREF_MEASURE', 'PMUN'], ['maxResult', 1000]])}` },
  filosofi: { name: 'filosofi.json', url: `${MELODI}/DS_FILOSOFI_CC?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['FILOSOFI_MEASURE', 'PR_MD60'], ['FILOSOFI_MEASURE', 'MED_SL'], ['maxResult', 5000]])}` },
  mortality: { name: 'mortality.json', url: `${MELODI}/DS_DECES_MORTALITE_SERIES?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ['EC_MEASURE', 'LEXPEC'], ['AGE', 'Y0'], ['SEX', 'F'], ['SEX', 'M'], ...LIFE_YEARS.map((y) => ['TIME_PERIOD', y]), ['maxResult', 5000]])}` },
  commuting: { name: 'commuting.json', url: `${MELODI}/DS_RP_NAVETTES_PRINC?${q([...DEPS.map((d) => ['GEO', `DEP-${d}`]), ...COMMUNES.map((c) => ['GEO', `COM-${c}`]), ['TRANS', '_T'], ['TRANS', '6'], ['WORK_AREA', '_T'], ['TIME_PERIOD', 2023], ['maxResult', 2000]])}` },
  unemployment: { name: 'unemployment.xml', url: `${BDM}/TCRED-TRAVAIL-EMPLOI-TCHOMA-SA?startPeriod=2015` },
}

/** The stored population estimates (downloaded if missing): other prefills read them for denominators. */
export const populationFile = () => fetchJsonOnce(rawStore('FRA', 'insee'), FILES.population.url, FILES.population.name)

const geoDep = (geo) => DEP_TO_MAP[geo.replace(/^\d{4}-DEP-/, '')]
const geoCom = (geo) => geo.replace(/^\d{4}-COM-/, '')
const isDep = (geo) => /-DEP-/.test(geo)
const value = (o) => o.measures?.OBS_VALUE_NIVEAU?.value ?? null
const status = (o) => o.attributes?.OBS_STATUS_FR || o.attributes?.OBS_STATUS || null

/** Population at 1 January → { regionId: { year: persons } }, with each year's status (PROV / D). */
export function populationByYear({ observations }) {
  const byYear = {}, statuses = {}
  for (const o of observations) {
    const id = geoDep(o.dimensions.GEO)
    if (!id) continue
    const y = +o.dimensions.TIME_PERIOD
    ;(byYear[id] ||= {})[y] = value(o)
    statuses[y] = status(o) ?? statuses[y] ?? null
  }
  return Object.assign(byYear, { status: statuses })
}

/** Municipal populations → { communeCode: { pop, year } }. */
export function communePopulations({ observations }) {
  return Object.fromEntries(observations.map((o) => [geoCom(o.dimensions.GEO), { pop: value(o), year: +o.dimensions.TIME_PERIOD }]))
}

/** Filosofi → { year, region: { id: { povertyRelative, medianIncome } }, subregion: { code: … } }. Uncovered areas stay absent. */
export function filosofi({ observations }) {
  const out = { year: null, region: {}, subregion: {} }
  for (const o of observations) {
    const geo = o.dimensions.GEO
    const id = isDep(geo) ? geoDep(geo) : geoCom(geo)
    if (!id) continue
    const t = (isDep(geo) ? out.region : out.subregion)[id] ||= {}
    out.year = +o.dimensions.TIME_PERIOD
    if (o.dimensions.FILOSOFI_MEASURE === 'PR_MD60') t.povertyRelative = value(o)
    if (o.dimensions.FILOSOFI_MEASURE === 'MED_SL') t.medianIncome = value(o)
  }
  return out
}

/** Life expectancy at birth, women and men: the latest year both are published per département, and their mean (1 decimal). */
export function lifeExpectancy({ observations }, years = LIFE_YEARS) {
  const bySex = {}, statuses = {}
  for (const o of observations) {
    const id = geoDep(o.dimensions.GEO)
    if (!id) continue
    const y = +o.dimensions.TIME_PERIOD
    ;((bySex[id] ||= { F: {}, M: {} })[o.dimensions.SEX])[y] = value(o)
    statuses[y] = status(o) ?? statuses[y] ?? null
  }
  const out = { year: null, status: statuses, region: {} }
  for (const [id, s] of Object.entries(bySex)) {
    const year = Math.max(...years.filter((y) => s.F[y] != null && s.M[y] != null), 0) || null
    const women = year ? s.F[year] : null, men = year ? s.M[year] : null
    out.region[id] = { year, lifeExpWomen: women, lifeExpMen: men, lifeExp: women != null && men != null ? round((women + men) / 2, 1) : null }
    out.year = Math.max(out.year || 0, year || 0) || null
  }
  return out
}

/** Census commuters by mode → share whose main mode is public transport (TRANS 6), per département and commune. */
export function commuting({ observations }) {
  const modes = {}
  let year = null
  for (const o of observations) {
    ;(modes[o.dimensions.GEO] ||= {})[o.dimensions.TRANS] = value(o)
    year = +o.dimensions.TIME_PERIOD
  }
  const out = { year, region: {}, subregion: {} }
  for (const [geo, m] of Object.entries(modes)) {
    if (m._T == null || m[6] == null) continue
    const id = isDep(geo) ? geoDep(geo) : geoCom(geo)
    if (id) (isDep(geo) ? out.region : out.subregion)[id] = { transitCommute: round((100 * m[6]) / m._T, 1), workers: Math.round(m._T) }
  }
  return out
}

/** BDM annual unemployment series (all ages, both sexes) → the latest value per département, with the series behind it. */
export async function unemployment(xml) {
  const doc = await parseXml(xml, { arrays: ['Series', 'Obs'] })
  const out = { year: null, region: {}, national: {} }
  for (const s of doc['message:StructureSpecificData']['message:DataSet'].Series) {
    if (s.FREQ !== 'A' || s.SEXE !== '0' || s.AGE !== '00-') continue
    const obs = Object.fromEntries((s.Obs || []).map((o) => [+o.TIME_PERIOD, +o.OBS_VALUE]))
    const years = Object.keys(obs).map(Number).sort((a, b) => a - b)
    const entry = { unemployment: obs[years.at(-1)], year: years.at(-1), series: obs, idbank: s.IDBANK, title: s.TITLE_FR }
    const id = /^D/.test(s.REF_AREA) ? DEP_TO_MAP[s.REF_AREA.slice(1)] : null
    if (id) { out.region[id] = entry; out.year = Math.max(out.year || 0, entry.year) }
    else if (s.REF_AREA === 'FM' || s.REF_AREA === 'FR-D976') out.national[s.REF_AREA === 'FM' ? 'metropolitan' : 'franceExclMayotte'] = entry
  }
  return out
}
