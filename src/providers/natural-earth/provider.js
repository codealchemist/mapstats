// Natural Earth boundaries and populated places, built into countries/<ISO3>/geo/ by `npm run geo`.
import { defineProvider } from '#core/define.js'

export default [
  defineProvider({
    id: 'natural-earth', short: 'Natural Earth', name: 'Natural Earth', url: 'https://www.naturalearthdata.com/',
    covers: 'Region boundaries & populated places', access: 'bundled', cadence: 'v5', scope: 'World admin-1 & places', types: ['geo'],
    usedFor: 'Region boundaries; city list for countries without curated data',
  }),
]
