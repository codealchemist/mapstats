// DREES: physicians registered with the Ordre and active at 1 January, by département (RPPS), as the density DREES
// publishes per 100,000 inhabitants.
import { defineProvider } from '#core/define.js'

export const DATASET = 'https://www.data.gouv.fr/fr/datasets/la-demographie-des-professionnels-de-sante-depuis-2012'
const row = (label, value, unit) => ({ label, value, unit })

export default [
  defineProvider({
    id: 'drees', short: 'DREES', name: 'DREES – Démographie des professionnels de santé (RPPS)', url: DATASET,
    covers: 'Physicians active at 1 January (all specialties and modes of practice), headcount and density per 100,000 inhabitants, by département (Licence Ouverte 2.0)',
    kind: 'register', levels: ['region'], family: 'insee',
    provides: ['doctors'],
    access: 'import', cadence: 'Yearly (1 January, published in summer)', refresh: 'year', scope: 'France · département', types: ['society'],
    provenance: ({ detail: d }) => {
      if (!d) return null
      return {
        level: d.level === 'city' ? 'City (its own département)' : 'Département', area: d.name, period: `1 January ${d.year}`, status: 'Official download (data.gouv.fr)',
        rows: [row(`Physicians active at 1 January ${d.year}`, d.physicians, 'count'), row(`Density, ${d.year}`, d.density, 'per 100k')].filter((r) => r.value != null),
        note: 'Headcounts, not activities; each physician counted once at their most recent place of activity. Density is DREES’s own figure over INSEE’s population at 1 January; MapStats shows it per 1,000.',
      }
    },
  }),
]
