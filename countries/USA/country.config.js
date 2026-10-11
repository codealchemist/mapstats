// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'USA',
  iso2: 'US',
  name: 'United States',
  regionLabel: 'State',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-125, 24.5, -66.9, 49.5],
  providers: ['gem'],
  news: { lang: 'en', countryName: 'United States', edition: { hl: 'en-US', gl: 'US' } },
})
