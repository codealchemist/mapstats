// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'ITA',
  iso2: 'IT',
  name: 'Italy',
  regionLabel: 'Province',
  providers: ['gem'],
  news: { lang: 'it', countryName: 'Italia', edition: { hl: 'it', gl: 'IT' } },
})
