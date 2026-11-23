// ARCEP "Ma connexion internet": fixed-broadband eligibility of premises by département and commune, from the
// telecoms regulator's quarterly open data. Availability, not subscriptions: shown for context.
import { defineProvider } from '#core/define.js'

export const DATASET = 'https://www.data.gouv.fr/datasets/ma-connexion-internet'
const row = (label, value, unit) => ({ label, value, unit })

export default [
  defineProvider({
    id: 'arcep', short: 'ARCEP', name: 'ARCEP – Ma connexion internet', url: DATASET,
    covers: 'Premises eligible to fibre (FttH) and to at least 30 Mbit/s, by département and commune (Licence Ouverte 2.0)',
    kind: 'register', levels: ['region', 'subregion'],
    provides: ['fibreCoverage'],
    access: 'import', cadence: 'Quarterly', refresh: 'quarter', scope: 'France · département & commune', types: ['society'],
    provenance: ({ detail: d, country }) => {
      if (!d) return null
      return {
        level: d.level === 'subregion' ? country.subregionLabel : d.level === 'city' ? 'City (its own département)' : country.regionLabel,
        area: d.name, period: d.date, status: 'Official download (data.arcep.fr)',
        rows: [row('Premises (dwellings and business locations)', d.premises, 'count'), row('Eligible to fibre (FttH)', d.ftth, '%'), row('Eligible to ≥ 30 Mbit/s, any technology', d.thd30, '%')].filter((r) => r.value != null),
        note: 'Shares computed by MapStats as eligible premises ÷ all premises from ARCEP’s counts. Eligibility measures availability, not subscriptions.',
      }
    },
  }),
]
