// Numbeo: links only. Its terms forbid automated collection and republishing its data on public sites without
// Numbeo's written consent, so MapStats stores and shows no Numbeo values: city reports link to the city's own
// pages on numbeo.com (their terms ask sites that use Numbeo to link back).
import { defineProvider } from '#core/define.js'

const page = (slug, section) => `https://es.numbeo.com/${section}/ciudad/${slug}`

export default [
  defineProvider({
    id: 'numbeo', short: 'Numbeo', name: 'Numbeo', url: 'https://www.numbeo.com/',
    covers: 'Crowd-sourced city indices (crime, cost of living, quality of life). Not stored or shown by MapStats: linked from city reports.',
    access: 'link', optIn: true, scope: 'Cities worldwide', types: ['crime', 'society'],
    usedFor: 'Links from city reports to the city’s pages on numbeo.com',
    // A city's page slug (places.js codes.numbeo) is an address, not Numbeo data.
    links: (e) => (e.codes?.numbeo
      ? [{ label: 'Numbeo crime', url: page(e.codes.numbeo, 'criminalidad') }, { label: 'Numbeo quality of life', url: page(e.codes.numbeo, 'calidad-de-vida') }]
      : []),
  }),
]
