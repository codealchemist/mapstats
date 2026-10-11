// USGS earthquake catalogue (CORS, keyless): fetched live in the browser through src/lib/live.js.
import { defineProvider } from '#core/define.js'

export default [
  defineProvider({
    id: 'usgs', short: 'USGS (live)', name: 'USGS Earthquake Catalog', kind: 'measurement', levels: ['point'],
    family: { id: 'usgs', label: 'USGS · earthquakes', short: 'USGS', why: 'instrumental earthquake catalogue' },
    url: 'https://earthquake.usgs.gov/earthquakes/search/', covers: 'Earthquakes M5+ since 1980',
    provides: ['quakes'], access: 'live', cadence: 'Real time', scope: 'Global, M5+ since 1980', types: ['hazards'],
    usedFor: 'Earthquake overlay and report charts',
  }),
]
