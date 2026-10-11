// Numbeo city indices: crowd-sourced, stored as a snapshot per country (Numbeo blocks cross-origin requests,
// and its terms restrict automated collection), with deep links to each city's live page.
import { defineProvider, recency } from '#core/define.js'

export default [
  defineProvider({
    id: 'numbeo', short: 'Numbeo', name: 'Numbeo', url: 'https://es.numbeo.com/criminalidad/pa%C3%ADs/Argentina',
    covers: 'Crime, healthcare, pollution, traffic, cost of living & quality-of-life indices (city snapshot)',
    kind: 'crowd-survey', levels: ['city'],
    family: { id: 'numbeo', label: 'Numbeo · crowd-sourced indices', short: 'Numbeo' },
    provides: ['crimeIndex', 'pollutionIndex', 'healthcareIndex', 'trafficIndex', 'purchasingPower', 'costOfLiving', 'qualityOfLife'],
    access: 'snapshot', cadence: 'Crowd-sourced, continuously updated', scope: 'Cities worldwide', types: ['crime', 'society', 'air'],
    // Deep-link to the city's page when we know its Numbeo slug.
    urlFor: (e, category) =>
      e?.codes?.numbeo ? `https://es.numbeo.com/${category === 'safety' ? 'criminalidad' : 'calidad-de-vida'}/ciudad/${e.codes.numbeo}` : null,
    weightFactors: ({ detail: n }) => {
      if (!n) return []
      const factors = []
      if (n.source === 'snapshot') factors.push(['approximate snapshot, unverified', 0.4])
      else if (n.contributors != null) factors.push([`${n.contributors} contributors (full weight at 50+)`, Math.min(1, Math.max(0.2, n.contributors / 50))])
      else factors.push(['contributor count unknown', 0.7])
      const r = recency(n.fetchedAt ? +n.fetchedAt.slice(0, 4) : null)
      if (r < 1) factors.push([`collected ${n.fetchedAt}`, r])
      return factors
    },
  }),
]
