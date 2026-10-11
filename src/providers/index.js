// Global providers, available to every country. The ones listed in ALWAYS_ON serve every country without being
// listed in its config; the others (e.g. numbeo) are opted into by a country's `providers`.
import openMeteo from './open-meteo/provider.js'
import usgs from './usgs/provider.js'
import numbeo from './numbeo/provider.js'
import naturalEarth from './natural-earth/provider.js'
import basemaps from './basemaps/provider.js'
import news from './news/provider.js'

export const GLOBAL_PROVIDERS = [...openMeteo, ...usgs, ...numbeo, ...naturalEarth, ...basemaps, ...news]

export const ALWAYS_ON = GLOBAL_PROVIDERS.filter((p) => p.id !== 'numbeo').map((p) => p.id)
