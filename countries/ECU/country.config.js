// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'ECU',
  iso2: 'EC',
  name: 'Ecuador',
  regionLabel: 'Province',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-81.2, -5.1, -75.1, 1.5],
  news: { lang: 'es', countryName: 'Ecuador', edition: { hl: 'es-419', gl: 'EC' } },
})
