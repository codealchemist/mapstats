// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'COL',
  iso2: 'CO',
  name: 'Colombia',
  regionLabel: 'Department',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-79.5, -4.5, -66.8, 12.6],
  news: { lang: 'es', countryName: 'Colombia', edition: { hl: 'es-419', gl: 'CO' } },
})
