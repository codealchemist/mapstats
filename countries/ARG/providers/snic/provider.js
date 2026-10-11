// SNIC: official crime statistics by province and department (Ministerio de Seguridad Nacional).
import { defineProvider, recency } from '#core/define.js'

export default [
  defineProvider({
    id: 'snic', short: 'SNIC', name: 'SNIC – Ministerio de Seguridad',
    url: 'https://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos',
    covers: 'Official crime statistics by province and department (partido): homicides, robberies, thefts, road deaths',
    kind: 'register', levels: ['region', 'subregion', 'city'],
    family: { id: 'snic', label: 'SNIC · official crime statistics', short: 'SNIC' },
    provides: ['homicide', 'propertyCrime', 'roadDeaths'],
    access: 'import', cadence: 'Annual (2000–latest year)', scope: 'Argentina · province & department', types: ['crime'],
    weightFactors: ({ type, level, detail }) => {
      const factors = []
      if (type === 'city' && level === 'subregion') factors.push(['department, not city boundary', 0.9])
      const r = recency(detail?.latestYear)
      if (r < 1) factors.push([`data from ${detail.latestYear}`, r])
      return factors
    },
  }),
  defineProvider({
    id: 'snic-mirror', short: 'SNIC mirror', name: 'dashboard-snic (GitHub)', url: 'https://github.com/crisgomez79/dashboard-snic',
    covers: 'Unofficial copy of the SNIC provincial and departmental bases currently imported',
    access: 'once', cadence: 'Copy of the 2000–2025 bases', scope: 'Argentina', types: ['crime'],
    usedFor: 'Files behind the current SNIC import (replace with the official downloads)',
  }),
  defineProvider({
    id: 'departments', short: 'Departments', name: 'Argentine department boundaries', url: 'https://github.com/mgaitan/departamentos_argentina',
    covers: 'Partido / departamento polygons, used once to match each city to its SNIC department',
    access: 'once', cadence: 'Static', scope: 'Argentina · 527 departments', types: ['geo', 'crime'],
    usedFor: 'Matching each city to its SNIC department',
  }),
]
