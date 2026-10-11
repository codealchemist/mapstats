// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'MEX',
  iso2: 'MX',
  name: 'Mexico',
  regionLabel: 'State',
  providers: ['gem'],
  news: { lang: 'es', countryName: 'México', edition: { hl: 'es-419', gl: 'MX' } },
})
