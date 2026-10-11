// SNIC: official crime statistics by province and department (Ministerio de Seguridad Nacional).
import { defineProvider, recency } from '#core/define.js'

// Latest rates in the report table, and every published figure in "values by source".
const TABLE = {
  homicide: 'Intentional homicide (victims)', robbery: 'Robbery', theft: 'Theft', injuries: 'Intentional injuries',
  threats: 'Threats', sexualAssault: 'Rape', drugs: 'Drug law offences', roadDeaths: 'Road deaths (victims)',
}
const ROWS = [
  ['homicide', 'Intentional homicide victims'], ['robbery', 'Robberies'], ['theft', 'Thefts'],
  ['propertyCrime', 'Robberies + thefts'], ['injuries', 'Intentional injuries'], ['threats', 'Threats'],
  ['sexualAssault', 'Rapes'], ['drugs', 'Drug law offences'], ['roadDeaths', 'Road traffic death victims'],
]
const row = (label, value, unit) => ({ label, value, unit })

export default [
  defineProvider({
    id: 'snic', short: 'SNIC', name: 'SNIC – Ministerio de Seguridad',
    url: 'https://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos',
    covers: 'Official crime statistics by province and department (partido): homicides, robberies, thefts, road deaths',
    kind: 'register', levels: ['region', 'subregion', 'city'],
    family: { id: 'snic', label: 'SNIC · official crime statistics', short: 'SNIC' },
    provides: ['homicide', 'propertyCrime', 'roadDeaths'],
    access: 'import', cadence: 'Annual (2000–latest year)', scope: 'Argentina · province & department', types: ['crime'],
    report: {
      category: 'safety',
      label: 'Official SNIC statistics',
      trends: {
        group: 'Crime trends', unit: 'per 100,000',
        charts: [
          { indicator: 'homicide', title: 'Homicide rate', subtitle: 'Victims of intentional homicide per 100,000', digits: 2 },
          { indicator: 'propertyCrime', title: 'Robberies and thefts', subtitle: 'Incidents per 100,000', digits: 0 },
          { indicator: 'roadDeaths', title: 'Road deaths', subtitle: 'Victims of road traffic deaths per 100,000', digits: 2, focusOnly: true },
        ],
      },
      latestTable: { title: 'Crime type', unit: 'per 100k', rows: TABLE },
      footnote: 'Scores use 3-year averages. Rates are as published by SNIC; blank cells are not published for this area.',
    },
    provenance: ({ entity, detail: d, meta }) => {
      if (!d) return entity.type === 'city' ? { rows: [], note: `No SNIC department matched to ${entity.name}.` } : null
      const y = d.latestYear
      const span = `${y - 2}–${String(y).slice(2)}`
      const origin = meta?.origin?.notes
      return {
        level: d.level === 'subregion' ? 'Department (partido)' : d.level === 'city' ? 'City' : 'Province',
        area: d.level === 'subregion' ? `${d.name} (INDEC ${d.code})` : d.name,
        period: `${y} (+ ${span} average)`,
        status: /mirror/i.test(origin || '') ? 'Unofficial mirror copy' : 'Official download',
        rows: ROWS.flatMap(([k, label]) => [
          row(`${label}, ${y}`, d.counts?.[k], 'count'),
          row(`${label}, ${y}`, d.latest[k], 'per 100k'),
          row(`${label}, ${span} average`, d.avg3[k], 'per 100k'),
        ]).filter((r) => r.value != null),
        note: `Rates as published by SNIC, rounded to 2 decimals. Counts are exact.${origin ? ` Files: ${origin}.` : ''}`,
      }
    },
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
