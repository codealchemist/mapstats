// Global providers, available to every country. They serve every country without being listed in its config,
// except those marked `optIn` (e.g. numbeo), which a country lists in its `providers`.
import openMeteo from './open-meteo/provider.js'
import usgs from './usgs/provider.js'
import numbeo from './numbeo/provider.js'
import naturalEarth from './natural-earth/provider.js'
import basemaps from './basemaps/provider.js'
import news from './news/provider.js'

export const GLOBAL_PROVIDERS = [...openMeteo, ...usgs, ...numbeo, ...naturalEarth, ...basemaps, ...news]

export const ALWAYS_ON = GLOBAL_PROVIDERS.filter((p) => !p.optIn).map((p) => p.id)
