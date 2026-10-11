// @ts-check
// Country manifest: pure metadata, imported by the app, the news function and the CLI. No data imports here.
import { defineCountry } from '#core/define.js'
import exampleStats from './providers/example-stats/provider.js'
import news from './news.js'

export default defineCountry({
  iso3: 'XXX',
  iso2: 'XX',
  name: 'Exampleland',
  regionLabel: 'Province',
  subregionLabel: 'Municipality',
  // [west, south, east, north]. Only when overseas territories or remote islands zoom the map out too far.
  bounds: null,
  // Natural Earth build settings (npm run geo -- XXX).
  geo: { simplify: '8%', minCityPop: 100_000, maxCities: 120 },
  // Global live providers (Open-Meteo, USGS, Natural Earth, news…) are always on. List opt-in global ones by id
  // (e.g. 'numbeo') and this country's own provider definitions; they are namespaced "XXX/<id>".
  providers: [exampleStats],
  news,
  maintainers: ['@your-github-handle'],
})
