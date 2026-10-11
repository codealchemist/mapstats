// @ts-check
import { defineCountry } from '#core/define.js'
import snic from './providers/snic/provider.js'
import provincialStats from './providers/provincial-stats/provider.js'

export default defineCountry({
  iso3: 'ARG',
  iso2: 'AR',
  name: 'Argentina',
  regionLabel: 'Province',
  subregionLabel: 'Department',
  geo: { simplify: '18%' },
  providers: ['numbeo', snic, provincialStats],
  news: { lang: 'es', countryName: 'Argentina', edition: { hl: 'es-419', gl: 'AR' } },
})
