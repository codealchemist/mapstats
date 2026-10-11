// Provincial statistics, hand-entered from each publication (countries/ARG/data). Every reference is its own
// provider so values cite it; they share the "provincial" source family and its caveat.
import { defineProvider } from '#core/define.js'

const manual = { kind: 'manual', levels: ['region'], access: 'manual', scope: 'Argentina · province', types: ['society'], family: 'provincial' }

export default [
  defineProvider({
    ...manual, id: 'indec', short: 'INDEC', name: 'INDEC', url: 'https://www.indec.gob.ar/', covers: 'Life expectancy projections',
    provides: ['lifeExp'], cadence: 'Projections',
    family: { id: 'provincial', label: 'Provincial statistics · hand-entered', short: 'Provincial stats' },
  }),
  defineProvider({
    ...manual, id: 'eph', short: 'EPH', name: 'INDEC – EPH', url: 'https://www.indec.gob.ar/', covers: 'Poverty and unemployment (Encuesta Permanente de Hogares)',
    provides: ['poverty', 'unemployment'], cadence: 'Semi-annual survey', scope: 'Argentina · urban areas',
  }),
  defineProvider({
    ...manual, id: 'censo-2022', short: 'Censo 2022', name: 'Censo 2022', url: 'https://censo.gob.ar/', covers: 'Water & sewer network coverage',
    provides: ['water', 'sewer'], cadence: 'Census 2022',
  }),
  defineProvider({
    ...manual, id: 'census-population', short: 'Censo / Natural Earth', name: 'Censo 2022 / Natural Earth', url: 'https://censo.gob.ar/', covers: 'Population',
    // Context, not a scored source: no family.
    family: null, kind: null, provides: ['pop'], cadence: 'Census 2022 / approximate', scope: 'Cities',
  }),
  defineProvider({
    ...manual, id: 'enacom', short: 'ENACOM', name: 'ENACOM', url: 'https://indicadores.enacom.gob.ar/', covers: 'Fixed internet accesses per 100 households',
    provides: ['internet'], cadence: 'Quarterly',
  }),
  defineProvider({
    ...manual, id: 'refeps', short: 'REFEPS', name: 'REFEPS – Ministerio de Salud', url: 'https://sisa.msal.gov.ar/', covers: 'Physicians per 1,000 inhabitants',
    provides: ['doctors'], cadence: 'Registry',
  }),
  defineProvider({
    ...manual, id: 'dnv', short: 'DNV', name: 'Vialidad Nacional', url: 'https://www.argentina.gob.ar/obras-publicas/vialidad-nacional', covers: 'Paved road network',
    provides: ['roadPaved'], cadence: 'MapStats estimate',
  }),
  defineProvider({
    ...manual, id: 'inpres', short: 'INPRES', name: 'INPRES', url: 'https://www.inpres.gob.ar/', covers: 'Seismic zoning (CIRSOC 103)',
    provides: ['seismicZone'], cadence: 'Building-code zoning', types: ['hazards'],
  }),
  defineProvider({
    ...manual, id: 'snmf', short: 'SNMF', name: 'Servicio Nacional de Manejo del Fuego', url: 'https://www.argentina.gob.ar/ambiente/fuego', covers: 'Wildfire exposure',
    provides: ['fireRisk'], cadence: 'MapStats estimate', types: ['hazards'],
  }),
  defineProvider({
    ...manual, id: 'ina', short: 'INA', name: 'INA – Instituto Nacional del Agua', url: 'https://www.ina.gob.ar/', covers: 'Flood exposure',
    provides: ['floodRisk'], cadence: 'MapStats estimate', types: ['hazards'],
  }),
  defineProvider({
    ...manual, id: 'pnud', short: 'PNUD', name: 'PNUD Argentina', url: 'https://www.undp.org/es/argentina', covers: 'Provincial Human Development Index',
    provides: ['hdi'], cadence: 'Periodic reports',
  }),
  defineProvider({
    ...manual, id: 'mapstats-estimate', short: 'MapStats est.', name: 'MapStats estimate', url: null, covers: 'Public transport coverage score (see methodology)',
    provides: ['transit'], cadence: 'MapStats estimate',
  }),
]
