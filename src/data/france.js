// Curated baseline dataset for France: official département statistics imported offline by
// scripts/{ssmsi,baac,insee,drees,georisques,arcep}-import.mjs (npm run france:import). Nothing here
// is hand-entered.
//
// Départements are the map regions (public/geo/FRA.json). The 40 tracked cities are communes
// (france-cities.js); they inherit their département's figures, except figures published or
// derived for the commune itself (population, relative poverty, seismic zone, flood and fire
// exposure, fibre coverage, public-transport commuting), which are their own.
//
// Scored: homicide and the 7-category theft composite (SSMSI), roadDeaths (ONISR / BAAC), doctors
// (DREES), unemployment (INSEE), lifeExp (INSEE, mean of the published women's and men's values),
// seismicZone (regulatory zoning, zone − 1), floodRisk and fireRisk (MapStats 1–5 classes derived
// from GASPAR records, like Argentina's INA / SNMF estimates).
// Descriptive: pop, povertyRelative (Filosofi; a relative threshold, deliberately not mapped onto
// Argentina's basic-basket `poverty`), lifeExpWomen / lifeExpMen, transitCommute, fibreCoverage.
// Left null on purpose, because no official département figure matches the indicator's definition:
// poverty, hdi, water, sewer, internet (subscriptions), roadPaved, transit. See docs/france-data-sources.md.
import SSMSI from './ssmsi-france.json' with { type: 'json' }
import ONISR from './onisr-france.json' with { type: 'json' }
import INSEE from './insee-france.json' with { type: 'json' }
import DREES from './drees-france.json' with { type: 'json' }
import GEORISQUES from './georisques-france.json' with { type: 'json' }
import ARCEP from './arcep-france.json' with { type: 'json' }
import { CITY_ROWS } from './france-cities.js'

const popYear = INSEE.population.referenceYear
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
// French seismic zones run 1–5; the shared indicator uses Argentina's 0–4 scale.
const seismic = (zone) => (zone == null ? null : round1(zone - 1))
const lifeExp = (le) => (le?.women != null && le?.men != null ? round1((le.women + le.men) / 2) : null)
const ids = [...new Set([SSMSI, ONISR, DREES, GEORISQUES].flatMap((d) => Object.keys(d.departments)))]

export const REGIONS = Object.fromEntries(ids.map((id) => {
  const le = INSEE.lifeExpectancy.departments[id], hz = GEORISQUES.departments[id] || {}
  return [id, {
    pop: INSEE.population.departments[id]?.[popYear] ?? null,
    homicide: SSMSI.departments[id]?.avg3.homicide ?? null,
    propertyCrime: SSMSI.departments[id]?.avg3.propertyCrime ?? null,
    roadDeaths: ONISR.departments[id]?.avg3.roadDeaths ?? null,
    seismicZone: seismic(hz.seismicZone),
    fireRisk: hz.fireExposure ?? null,
    floodRisk: hz.floodExposure ?? null,
    doctors: round2(DREES.departments[id]?.density[DREES.year] / 100), // DREES publishes per 100,000; the indicator is per 1,000
    fibreCoverage: ARCEP.departments[id]?.ftth ?? null,
    transitCommute: INSEE.commuting.departments[id]?.publicTransport ?? null,
    unemployment: INSEE.unemployment.departments[id]?.value ?? null,
    povertyRelative: INSEE.poverty.departments[id]?.povertyRelative ?? null,
    lifeExp: lifeExp(le), lifeExpWomen: le?.women ?? null, lifeExpMen: le?.men ?? null,
  }]
}))

export const CITIES = CITY_ROWS.map(([id, name, province, lat, lon, commune]) => {
  const hz = GEORISQUES.communes[commune] || {}
  const own = {
    povertyRelative: INSEE.poverty.communes[commune]?.povertyRelative, seismicZone: seismic(hz.zone), floodRisk: hz.flood, fireRisk: hz.fire,
    fibreCoverage: ARCEP.communes[commune]?.ftth, transitCommute: INSEE.commuting.communes[commune]?.publicTransport,
  }
  const ownValues = Object.fromEntries(Object.entries(own).filter(([, v]) => v != null))
  return { id, name, province, lat, lon, commune, pop: INSEE.communes[commune]?.pop ?? null, capital: id === 'FRA-paris', ownValues }
})

// Decimals for a published rate: small rates (homicides) keep 2, large ones (thefts) none.
const digitsFor = (v) => (v == null || v >= 100 ? 0 : v >= 10 ? 1 : 2)
const CHARTS = {
  homicide: ['Homicide rate', 'Victims of homicide per 100,000'],
  propertyCrime: ['Thefts and robberies', 'Seven SSMSI theft categories combined, per 100,000'],
  burglary: ['Residential burglaries', 'Offences per 100,000 dwellings'],
}
const SSMSI_METRICS = Object.fromEntries(Object.entries(SSMSI.metrics).map(([k, m]) => [k, { label: m.label, unit: m.unit, digits: digitsFor(SSMSI.national.latest[k]), chart: CHARTS[k] }]))
const SSMSI_TABLE = ['homicide', 'propertyCrime', ...Object.keys(SSMSI_METRICS).filter((k) => k !== 'homicide' && k !== 'propertyCrime')]
const gasparYear = +(GEORISQUES.gasparDate || GEORISQUES.importedAt).slice(0, 4)
const lifeYear = INSEE.lifeExpectancy.year
const lifePeriod = `${lifeYear}${INSEE.lifeExpectancy.status[lifeYear] === 'PROV' ? ' (provisional)' : ''}`

export const FRANCE = {
  iso3: 'FRA',
  regions: REGIONS,
  cities: CITIES,
  sources: {
    pop: 'INSEE population', homicide: 'SSMSI', propertyCrime: 'SSMSI', roadDeaths: 'ONISR',
    seismicZone: 'Géorisques', floodRisk: 'GASPAR', fireRisk: 'GASPAR',
    doctors: 'DREES', fibreCoverage: 'ARCEP', transitCommute: 'INSEE census',
    unemployment: 'INSEE unemployment', povertyRelative: 'INSEE Filosofi',
    lifeExp: 'INSEE life expectancy', lifeExpWomen: 'INSEE life expectancy', lifeExpMen: 'INSEE life expectancy',
  },
  periods: {
    pop: `1 January ${popYear}`, doctors: `1 January ${DREES.year}`,
    seismicZone: 'zoning in force since 2011 (zones 1–5, shown as 0–4)',
    floodRisk: `CatNat flood declarations ${GEORISQUES.flood.since}–${gasparYear} and flood PPR`, fireRisk: `DDRM and PPRif records, ${GEORISQUES.gasparDate}`,
    fibreCoverage: ARCEP.date, transitCommute: `census ${INSEE.commuting.year}`,
    unemployment: `${INSEE.unemployment.year} annual average`, povertyRelative: String(INSEE.poverty.year),
    lifeExp: `${lifePeriod}, mean of women and men`, lifeExpWomen: lifePeriod, lifeExpMen: lifePeriod,
  },
  subregion: { label: 'Commune' },
  official: {
    ssmsi: {
      key: 'SSMSI', label: 'SSMSI', years: SSMSI.years, latestYear: SSMSI.latestYear, origin: SSMSI.origin,
      metrics: SSMSI_METRICS, table: SSMSI_TABLE, tableLabel: 'Recorded offences',
      national: SSMSI.national, regions: SSMSI.departments,
      footnote: 'Scores use the 3-year averages of the homicide rate and of the theft composite. Each indicator has its own counting unit (victims, offences, vehicles, persons charged); the only sum is the theft composite (armed and violent robberies, thefts from persons, burglaries, vehicle thefts, thefts from and of parts of vehicles), per 100,000 inhabitants. Published burglary rates are per 100,000 dwellings. Facts are counted where they were committed (fraud: where the victim lives).',
      note: 'Rates as published by the SSMSI (per 1,000, shown per 100,000), rounded to 2 decimals. Counts are exact. National rates are computed from the 101 départements.',
    },
    onisr: {
      key: 'ONISR', label: 'ONISR', years: ONISR.years, latestYear: ONISR.latestYear, origin: ONISR.origin,
      metrics: { roadDeaths: { label: 'Road deaths (killed within 30 days)', unit: 'per 100k', digits: 1, chart: ['Road deaths', 'People killed within 30 days per 100,000 inhabitants'] } },
      table: ['roadDeaths'], tableLabel: 'Road safety',
      national: ONISR.national, regions: ONISR.departments,
      footnote: 'Scores use the 3-year average. Deaths are counted in the département of the accident, over INSEE\'s population estimate at 1 January of the same year.',
      note: 'People killed within 30 days, counted from the BAAC accident files; rates per 100,000 inhabitants computed by MapStats from INSEE population estimates.',
    },
    // No series, only the reference period of the département figures (recency weight).
    insee: { key: 'INSEE unemployment', label: 'INSEE & DREES', latestYear: Math.min(INSEE.unemployment.year, DREES.year) },
    georisques: { key: 'Géorisques', label: 'Géorisques', latestYear: gasparYear },
  },
  methodology: [
    `Official crime statistics come from the SSMSI départemental base (police and gendarmerie records by place of commission, ${SSMSI.years[0]}–${SSMSI.latestYear}). Two figures are scored as 3-year averages: homicide victims per 100,000, and a theft composite adding the seven SSMSI theft and robbery categories per 100,000 inhabitants, the French counterpart of Argentina's robberies + thefts. Violence, drug offences, fraud and criminal damage are shown separately and never summed.`,
    `Road deaths come from the ONISR accident files (BAAC, ${ONISR.years[0]}–${ONISR.latestYear}): people killed within 30 days, per 100,000 inhabitants (INSEE population estimates), averaged over 3 years.`,
    `Natural risks: the seismic zone is the regulatory zoning of each commune (zones 1–5, décrets 2010-1255 and 2015-5), shown as 0–4 and population-weighted for a département. Flood exposure (1–5) counts each commune's flood "catastrophe naturelle" declarations since ${GEORISQUES.flood.since} (${GEORISQUES.flood.classes}); forest-fire exposure (1–5) follows the commune's DDRM listing and prevention plan (${GEORISQUES.fire.classes}). Both are MapStats classes built on GASPAR records, comparable in spirit to Argentina's INA and SNMF estimates, and weighted 0.6 accordingly.`,
    `Unemployment is INSEE's localised ILO rate (${INSEE.unemployment.year} annual average; survey-based for overseas départements, none for Mayotte). Physicians are the DREES RPPS density at 1 January ${DREES.year}. Life expectancy at birth is the mean of INSEE's published women's and men's values for ${lifePeriod}, which is within about 0.2 year of a combined life table; both published values are shown. Relative poverty (INSEE Filosofi ${INSEE.poverty.year}, 60% of the median) is shown for context but not scored, as it is not comparable with Argentina's basic-basket poverty.`,
    `Shown but not scored: the share of premises eligible to fibre (ARCEP, ${ARCEP.date}), which measures availability rather than the subscriptions of Argentina's indicator, and the share of commuters using public transport (census ${INSEE.commuting.year}), a measure of use rather than of network coverage.`,
    'Départements are the map regions. Cities are communes: they carry their own INSEE population, relative poverty, seismic zone, flood and fire exposure, fibre coverage and commuting share, and inherit every other figure from their département. No commune-level crime is scored yet.',
  ],
}
