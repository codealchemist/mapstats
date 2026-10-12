// Provincial statistics, imported by prefill.mjs (countries/ARG/data/provincial-stats.json): INDEC's published tables
// and the Health Ministry and PAHO's Indicadores Básicos; plus the INPRES seismic zones, hand-entered
// (hand-entered.json). Every publication is its own provider so values cite it; they share the "provincial" family.
import { defineProvider } from '#core/define.js'

const indec = { kind: 'official-survey', levels: ['region'], access: 'import', scope: 'Argentina · province', types: ['society'], family: 'provincial', refresh: 'year' }
// Hand-entered: reviewed yearly against each publication's latest release.
const manual = { ...indec, kind: 'manual', access: 'manual' }

export default [
  defineProvider({
    ...indec, id: 'indec', short: 'INDEC', name: 'INDEC – population projections 2022–2040', url: 'https://www.indec.gob.ar/',
    covers: 'Life expectancy at birth by province (projections based on Censo 2022)', provides: ['lifeExp'], cadence: 'Projections, revised after each census',
    family: { id: 'provincial', label: 'Provincial statistics · INDEC', short: 'Provincial stats', why: 'official statistics office tables (census, household survey, projections)' },
  }),
  defineProvider({
    ...indec, id: 'eph', short: 'EPH', name: 'INDEC – EPH', url: 'https://www.indec.gob.ar/', covers: 'Poverty and unemployment (Encuesta Permanente de Hogares)',
    provides: ['poverty', 'unemployment'], cadence: 'Semi-annual (poverty) · yearly by province (unemployment)', scope: 'Argentina · urban areas',
  }),
  defineProvider({
    ...indec, id: 'censo-2022', short: 'Censo 2022', name: 'INDEC – Censo 2022', url: 'https://censo.gob.ar/', covers: 'Households with public water and sewer networks, and with internet at home',
    provides: ['water', 'sewer', 'internet'], cadence: 'Census 2022', refresh: null,
  }),
  defineProvider({
    ...indec, id: 'census-population', short: 'INDEC', name: 'INDEC projections / Natural Earth', url: 'https://www.indec.gob.ar/', covers: 'Population',
    // Context, not a scored source: no family.
    family: null, kind: null, provides: ['pop'], cadence: 'Yearly projections / approximate', scope: 'Provinces · cities',
  }),
  defineProvider({
    ...indec, kind: 'register', id: 'refeps', short: 'REFEPS', name: 'REFEPS / OFETHUS – Ministerio de Salud', url: 'https://iris.paho.org/handle/10665.2/69845',
    covers: 'Registered physicians under 65 per 1,000 inhabitants, by province of registration (Indicadores Básicos 2025, Ministerio de Salud and PAHO)',
    provides: ['doctors'], cadence: 'Yearly (Indicadores Básicos)',
  }),
  defineProvider({
    ...manual, id: 'inpres', short: 'INPRES', name: 'INPRES', url: 'https://www.inpres.gob.ar/', covers: 'Seismic zoning (CIRSOC 103)',
    provides: ['seismicZone'], cadence: 'Building-code zoning', types: ['hazards'],
  }),
  defineProvider({
    ...indec, kind: 'estimate', id: 'pnud', short: 'PNUD', name: 'PNUD Argentina', url: 'https://iris.paho.org/handle/10665.2/69845',
    covers: 'Provincial Human Development Index, 2021 (PNUD 2022, as published in Indicadores Básicos 2025)',
    provides: ['hdi'], cadence: 'Periodic reports',
  }),
]
