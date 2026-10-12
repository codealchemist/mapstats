// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'BRA',
  iso2: 'BR',
  name: 'Brazil',
  regionLabel: 'State',
  providers: ['gem'],
  news: { lang: 'pt', countryName: 'Brasil', edition: { hl: 'pt-419', gl: 'BR' } },
})
