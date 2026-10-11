// GEM Global Seismic Hazard Map: peak ground acceleration with a 10 % chance of being exceeded in 50 years (a
// 475-year return period), on rock. GEM publishes it as a raster (download after accepting its licence), so it is
// sampled offline per country (prefill.mjs) into countries/<ISO3>/data/gem.json. Opt-in: a country lists 'gem'.
import { defineProvider } from '#core/define.js'

export default [
  defineProvider({
    id: 'gem', short: 'GEM', name: 'GEM Global Seismic Hazard Map', optIn: true,
    url: 'https://www.globalquakemodel.org/product/global-seismic-hazard-map',
    covers: 'Peak ground acceleration with a 10 % chance of exceedance in 50 years (475-year return period), on rock',
    levels: ['region', 'city'], provides: ['pga475', 'pga475Max'],
    access: 'import', cadence: 'New versions every few years', scope: 'Global grid', types: ['hazards'],
    usedFor: 'Seismic hazard of each region and city',
  }),
]
