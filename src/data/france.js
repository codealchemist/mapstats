// Curated baseline dataset for France: official département statistics imported offline by
// scripts/{ssmsi,baac,insee,drees}-import.mjs (npm run france:import). Nothing here is hand-entered.
//
// Départements are the map regions (public/geo/FRA.json). The 40 tracked cities are communes
// (france-cities.js); they inherit their département's figures, except commune-level figures
// published by INSEE (population, relative poverty), which are their own.
//
// Scored: homicide (SSMSI), roadDeaths (ONISR / BAAC), doctors (DREES), unemployment (INSEE).
// Descriptive: pop (INSEE), povertyRelative (INSEE Filosofi; a relative threshold, deliberately not
// mapped onto Argentina's basic-basket `poverty`).
// Left null on purpose, because no official département figure matches the indicator's definition:
// propertyCrime (SSMSI theft categories have different counting units; shown separately instead),
// poverty, lifeExp (only published by sex), hdi, water, sewer, internet, roadPaved, transit,
// seismicZone, fireRisk, floodRisk. See docs/france-data-sources.md.
import SSMSI from './ssmsi-france.json' with { type: 'json' }
import ONISR from './onisr-france.json' with { type: 'json' }
import INSEE from './insee-france.json' with { type: 'json' }
import DREES from './drees-france.json' with { type: 'json' }
import { CITY_ROWS } from './france-cities.js'

const popYear = INSEE.population.referenceYear
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
const ids = [...new Set([SSMSI, ONISR, DREES].flatMap((d) => Object.keys(d.departments)))]

export const REGIONS = Object.fromEntries(ids.map((id) => [id, {
  pop: INSEE.population.departments[id]?.[popYear] ?? null,
  homicide: SSMSI.departments[id]?.avg3.homicide ?? null,
  roadDeaths: ONISR.departments[id]?.avg3.roadDeaths ?? null,
  doctors: round2(DREES.departments[id]?.density[DREES.year] / 100), // DREES publishes per 100,000; the indicator is per 1,000
  unemployment: INSEE.unemployment.departments[id]?.value ?? null,
  povertyRelative: INSEE.poverty.departments[id]?.povertyRelative ?? null,
}]))

export const CITIES = CITY_ROWS.map(([id, name, province, lat, lon, commune]) => {
  const ownValues = {}
  const poverty = INSEE.poverty.communes[commune]?.povertyRelative
  if (poverty != null) ownValues.povertyRelative = poverty
  return { id, name, province, lat, lon, commune, pop: INSEE.communes[commune]?.pop ?? null, capital: id === 'FRA-paris', ownValues }
})

// Decimals for a published rate: small rates (homicides) keep 2, large ones (thefts) none.
const digitsFor = (v) => (v == null || v >= 100 ? 0 : v >= 10 ? 1 : 2)
const CHARTS = {
  homicide: ['Homicide rate', 'Victims of homicide per 100,000'],
  burglary: ['Residential burglaries', 'Offences per 100,000 dwellings'],
}
const SSMSI_METRICS = Object.fromEntries(Object.entries(SSMSI.metrics).map(([k, m]) => [k, { label: m.label, unit: m.unit, digits: digitsFor(SSMSI.national.latest[k]), chart: CHARTS[k] }]))

export const FRANCE = {
  iso3: 'FRA',
  regions: REGIONS,
  cities: CITIES,
  sources: { pop: 'INSEE population', homicide: 'SSMSI', roadDeaths: 'ONISR', doctors: 'DREES', unemployment: 'INSEE unemployment', povertyRelative: 'INSEE Filosofi' },
  periods: {
    pop: `1 January ${popYear}`, doctors: `1 January ${DREES.year}`,
    unemployment: `${INSEE.unemployment.year} annual average`, povertyRelative: String(INSEE.poverty.year),
  },
  subregion: { label: 'Commune' },
  official: {
    ssmsi: {
      key: 'SSMSI', label: 'SSMSI', years: SSMSI.years, latestYear: SSMSI.latestYear, origin: SSMSI.origin,
      metrics: SSMSI_METRICS, table: Object.keys(SSMSI_METRICS), tableLabel: 'Recorded offences',
      national: SSMSI.national, regions: SSMSI.departments,
      footnote: 'Scores use the 3-year average homicide rate only. Each indicator has its own counting unit (victims, offences, vehicles, persons charged), so they are never added up; burglaries are per 100,000 dwellings. Facts are counted where they were committed (fraud: where the victim lives).',
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
  },
  methodology: [
    `Official crime statistics come from the SSMSI départemental base (police and gendarmerie records by place of commission, ${SSMSI.years[0]}–${SSMSI.latestYear}). Only homicide victims per 100,000 are scored, as a 3-year average; thefts, burglaries and violence are shown separately and never summed into a composite, because their counting units differ from Argentina's robberies + thefts.`,
    `Road deaths come from the ONISR accident files (BAAC, ${ONISR.years[0]}–${ONISR.latestYear}): people killed within 30 days, per 100,000 inhabitants (INSEE population estimates), averaged over 3 years.`,
    `Unemployment is INSEE's localised ILO rate (${INSEE.unemployment.year} annual average; survey-based for overseas départements, none for Mayotte). Physicians are the DREES RPPS density at 1 January ${DREES.year}. Relative poverty (INSEE Filosofi ${INSEE.poverty.year}, 60% of the median) is shown for context but not scored, as it is not comparable with Argentina's basic-basket poverty.`,
    'Départements are the map regions. Cities are communes: they carry their own INSEE population and relative poverty, and inherit every other figure from their département. No commune-level crime is scored yet.',
  ],
}
