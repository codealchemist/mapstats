// @ts-check
import { defineCountry } from '#core/define.js'
import ssmsi from './providers/ssmsi/provider.js'
import onisr from './providers/onisr/provider.js'
import insee from './providers/insee/provider.js'
import drees from './providers/drees/provider.js'
import georisques from './providers/georisques/provider.js'
import arcep from './providers/arcep/provider.js'
import news from './news.js'

export default defineCountry({
  iso3: 'FRA',
  iso2: 'FR',
  name: 'France',
  regionLabel: 'Department',
  subregionLabel: 'Commune',
  // Mainland frame: overseas territories / remote islands would zoom the map out too far.
  bounds: [-5.2, 41.3, 9.6, 51.1],
  providers: ['gem', ssmsi, onisr, insee, drees, georisques, arcep],
  news,
  maintainers: ['@gasp'],
})
