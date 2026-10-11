// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'CHL',
  iso2: 'CL',
  name: 'Chile',
  regionLabel: 'Region',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-76, -56, -66, -17],
  providers: ['gem'],
  news: { lang: 'es', countryName: 'Chile', edition: { hl: 'es-419', gl: 'CL' } },
})
