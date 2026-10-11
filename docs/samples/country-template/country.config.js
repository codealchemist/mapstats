// @ts-check
// Country manifest: pure metadata, imported by the app, the news function and the CLI. No data imports here.
import { defineCountry } from '#core/define.js'
import news from './news.js'

export default defineCountry({
  iso3: 'XXX',
  iso2: 'XX',
  name: 'Exampleland',
  regionLabel: 'Province',
  subregionLabel: 'Municipality',
  // [west, south, east, north]. Only when overseas territories or remote islands zoom the map out too far.
  bounds: null,
  // Natural Earth build settings (npm run geo:build -- XXX).
  geo: { simplify: '8%', minCityPop: 100_000, maxCities: 120 },
  // Global providers by id, then this country's own (namespaced to XXX/<id> automatically).
  providers: ['open-meteo', 'usgs', 'natural-earth', 'google-news', 'example-stats'],
  // Descriptive extras shown in reports, never scored. Scored indicators belong in the core catalogue.
  extraIndicators: [],
  news,
  maintainers: ['@your-github-handle'],
})
