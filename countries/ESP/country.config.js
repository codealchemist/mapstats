// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'ESP',
  iso2: 'ES',
  name: 'Spain',
  regionLabel: 'Province',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-9.4, 35.9, 4.4, 43.9],
  providers: ['gem'],
  news: { lang: 'es', countryName: 'España', edition: { hl: 'es', gl: 'ES' } },
})
