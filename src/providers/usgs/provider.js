// USGS earthquake catalogue (CORS, keyless): fetched live in the browser through src/lib/live.js.
import { defineProvider } from '#core/define.js'

export default [
  defineProvider({
    // Shown, not scored: seismic hazard scores from the GEM hazard model.
    id: 'usgs', short: 'USGS (live)', name: 'USGS Earthquake Catalog', levels: ['point'],
    url: 'https://earthquake.usgs.gov/earthquakes/search/', covers: 'Earthquakes M5+ since 1980',
    provides: ['quakes'], access: 'live', cadence: 'Real time', scope: 'Global, M5+ since 1980', types: ['hazards'],
    usedFor: 'Earthquake overlay and report charts',
  }),
]
