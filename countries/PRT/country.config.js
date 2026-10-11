// @ts-check
import { defineCountry } from '#core/define.js'

export default defineCountry({
  iso3: 'PRT',
  iso2: 'PT',
  name: 'Portugal',
  regionLabel: 'District',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-9.6, 36.9, -6.1, 42.2],
  news: { lang: 'pt', countryName: 'Portugal', edition: { hl: 'pt-150', gl: 'PT' } },
})
