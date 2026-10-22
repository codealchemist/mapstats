// ONISR: road deaths from the BAAC accident files (Observatoire national interministériel de la sécurité routière),
// counted per département by MapStats over INSEE's population estimates.
import { defineProvider, recency } from '#core/define.js'

export const DATASET = 'https://www.data.gouv.fr/fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024'
const row = (label, value, unit) => ({ label, value, unit })

export default [
  defineProvider({
    id: 'onisr', short: 'ONISR', name: 'ONISR – BAAC accident files', url: DATASET,
    covers: 'People killed in road crashes (within 30 days), by département of the accident, from the yearly BAAC files (Licence Ouverte)',
    kind: 'register', levels: ['region'],
    family: { id: 'onisr', label: 'ONISR · road accident records', short: 'ONISR' },
    provides: ['roadDeaths'],
    access: 'import', cadence: 'Yearly (the previous year each autumn)', refresh: 'year', scope: 'France · département', types: ['crime'],
    report: {
      category: 'safety',
      label: 'Road deaths (ONISR)',
      trends: {
        group: 'Road safety', unit: 'per 100,000',
        charts: [{ indicator: 'roadDeaths', title: 'Road deaths', subtitle: 'People killed within 30 days per 100,000 inhabitants', digits: 1 }],
      },
      latestTable: { title: 'Road safety', unit: 'per 100k', rows: { roadDeaths: 'Road deaths (killed within 30 days)' } },
      footnote: 'Scores use the 3-year average. Deaths are counted in the département of the accident, over INSEE’s population estimate at 1 January of the same year.',
    },
    provenance: ({ detail: d }) => {
      if (!d) return null
      const y = d.latestYear, span = `${y - 2}–${String(y).slice(2)}`
      return {
        level: d.level === 'city' ? 'City (its own département)' : 'Département', area: d.name, period: `${y} (+ ${span} average)`, status: 'Official download (data.gouv.fr)',
        rows: [
          ...Object.entries(d.deaths || {}).map(([year, n]) => row(`People killed within 30 days, ${year}`, n, 'count')),
          row(`Road deaths, ${y}`, d.latest?.roadDeaths, 'per 100k'), row(`Road deaths, ${span} average`, d.avg3?.roadDeaths, 'per 100k'),
        ].filter((r) => r.value != null),
        note: 'Counted by MapStats from the BAAC "usagers" files (grav = 2) joined to their accident’s département; rates per 100,000 inhabitants over INSEE population estimates.',
      }
    },
    weightFactors: ({ detail }) => {
      const r = recency(detail?.latestYear)
      return r < 1 ? [[`data from ${detail.latestYear}`, r]] : []
    },
  }),
]
