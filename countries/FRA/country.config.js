// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'FRA',
  iso2: 'FR',
  name: 'France',
  regionLabel: 'Department',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-5.2, 41.3, 9.6, 51.1],
  news: { lang: 'fr', countryName: 'France', edition: { hl: 'fr', gl: 'FR' } },
})
