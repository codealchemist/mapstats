// Numbeo city indices: crowd-sourced, stored as a snapshot per country (Numbeo blocks cross-origin requests,
// and its terms restrict automated collection), with deep links to each city's live page.
import { defineProvider, recency } from '#core/define.js'
import { SURVEY, SURVEY_SAFER_HIGH } from './survey.js'

const INDICES = [
  ['crimeIndex', 'Crime index'], ['healthcareIndex', 'Health care index'], ['pollutionIndex', 'Pollution index'],
  ['trafficIndex', 'Traffic commute time index'], ['costOfLiving', 'Cost of living index'],
  ['purchasingPower', 'Purchasing power index'], ['qualityOfLife', 'Quality of life index'],
]
const page = (slug, section) => `https://es.numbeo.com/${section}/ciudad/${slug}`
const row = (label, value, unit = '') => ({ label, value, unit })

export default [
  defineProvider({
    id: 'numbeo', short: 'Numbeo', name: 'Numbeo', url: 'https://es.numbeo.com/criminalidad/pa%C3%ADs/Argentina',
    covers: 'Crime, healthcare, pollution, traffic, cost of living & quality-of-life indices (city snapshot)',
    kind: 'crowd-survey', levels: ['city'],
    family: { id: 'numbeo', label: 'Numbeo · crowd-sourced indices', short: 'Numbeo' },
    provides: ['crimeIndex', 'pollutionIndex', 'healthcareIndex', 'trafficIndex', 'purchasingPower', 'costOfLiving', 'qualityOfLife'],
    access: 'snapshot', cadence: 'Crowd-sourced, continuously updated', scope: 'Cities worldwide', types: ['crime', 'society', 'air'],
    // Deep-link to the city's page when we know its Numbeo slug.
    urlFor: (e, category) => (e?.codes?.numbeo ? page(e.codes.numbeo, category === 'safety' ? 'criminalidad' : 'calidad-de-vida') : null),
    links: (e) => (e.codes?.numbeo
      ? [{ label: 'Numbeo crime', url: page(e.codes.numbeo, 'criminalidad') }, { label: 'Numbeo quality of life', url: page(e.codes.numbeo, 'calidad-de-vida') }]
      : []),
    report: {
      category: 'safety',
      label: 'Numbeo survey',
      facts: [{ key: 'safetyIndex', label: 'Safety index', digits: 2 }, { key: 'contributors', label: 'Contributors' }],
      note: (d, e) => (d?.source === 'snapshot' ? `Numbeo values for ${e.name} are an approximate snapshot. Run the Numbeo scraper or check the live page.` : null),
      survey: {
        heading: 'Numbeo crowd-sourced survey',
        status: (d) => `${d.source === 'scraped' ? 'scraped' : d.source} ${d.fetchedAt || ''}`,
        questions: SURVEY,
        saferHigh: SURVEY_SAFER_HIGH,
        worse: { title: 'Crime perception survey', subtitle: 'Numbeo, 0–100 · higher = worse', footnote: '0–20 very low · 20–40 low · 40–60 moderate · 60–80 high · 80–100 very high' },
        safer: { title: 'Perceived safety walking alone', subtitle: 'Numbeo, 0–100 · higher = safer' },
        compare: { group: 'Crime survey (Numbeo)', label: 'Crime perception survey', row: 'Numbeo crime survey', sub: '0–100 · higher = worse, except walking safety' },
      },
    },
    provenance: ({ entity, detail: nb }) => {
      if (entity.type !== 'city') return null
      const own = (k) => entity.values[k] != null && !entity.inherited?.has(k)
      const rows = nb
        ? [
            ...INDICES.filter(([k]) => own(k)).map(([k, label]) => row(label, entity.values[k])),
            ...(nb.safetyIndex != null ? [row('Safety index', nb.safetyIndex)] : []),
            ...SURVEY.filter(([k]) => nb.survey?.[k] != null).map(([k, label]) => row(label, nb.survey[k], '0–100')),
            ...(nb.contributors != null ? [row('Contributors', nb.contributors)] : []),
          ]
        : []
      return {
        level: 'City', area: entity.name, period: nb?.fetchedAt || null,
        status: !nb ? null : nb.source === 'scraped' ? 'Downloaded from numbeo.com' : nb.source === 'snapshot' ? 'Approximate snapshot, not verified' : nb.source,
        rows,
        note: rows.length ? null : `No Numbeo data stored for ${entity.name}.`,
      }
    },
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
