// Prefill for the GEM Global Seismic Hazard Map, for any country: npm run prefill -- <ISO3> --provider gem
//
// 1. Download the map's PGA raster (475-year return period, on rock) from
//    https://www.globalquakemodel.org/product/global-seismic-hazard-map after accepting its licence, as a
//    GeoTIFF in longitude/latitude (EPSG:4326), into src/providers/gem/raw/. The file is shared by all countries;
//    the first run registers it (--origin "GEM v2023.1, downloaded …" says where it came from).
// 2. Add 'gem' to the country's providers (country.config.js) and data/gem.json to its country.data.js.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromArrayBuffer } from 'geotiff'
import { rawStore } from '#sdk'
import { loadCountry } from '../../../tools/cli/context.mjs'
import { sampleHazard } from './sample.mjs'

const RAW = path.join(path.dirname(fileURLToPath(import.meta.url)), 'raw')

/** A raster for sampleHazard from a GeoTIFF buffer: checks it is a single-band longitude/latitude grid. */
export async function openRaster(buffer) {
  const image = await (await fromArrayBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))).getImage()
  const keys = image.getGeoKeys() || {}
  if (keys.ProjectedCSTypeGeoKey || (keys.GeographicTypeGeoKey && keys.GeographicTypeGeoKey !== 4326)) {
    throw new Error('The GEM raster must be in longitude/latitude (EPSG:4326); reproject it first (e.g. gdalwarp -t_srs EPSG:4326).')
  }
  const [ox, oy] = image.getOrigin(), [rx, ry] = image.getResolution()
  return {
    origin: [ox, oy], res: [rx, ry], width: image.getWidth(), height: image.getHeight(), nodata: image.getGDALNoData(),
    read: async (window) => (await image.readRasters({ window, samples: [0] }))[0],
  }
}

export async function prefill({ country, args, log }) {
  const raw = rawStore('GLOBAL', 'gem', { dir: RAW, delayMs: 0 })
  const tifs = raw.list(/\.tiff?$/i)
  if (tifs.length !== 1) throw new Error(`Put exactly one GEM GeoTIFF in ${RAW} (found ${tifs.length}).`)
  const name = tifs[0]
  if (!raw.manifest.files[name] || raw.read(name).changed) {
    if (!args.origin && !raw.manifest.files[name]) throw new Error(`Say where ${name} came from: --origin "GEM v2023.1, downloaded <date>"`)
    raw.add(name, { note: args.origin || raw.manifest.files[name].note })
  }
  const file = raw.read(name)
  const raster = await openRaster(file.buffer)
  const { geo, places } = await loadCountry(country)
  const values = await sampleHazard(raster, geo, places.filter((p) => p.region))
  const regions = Object.values(values.region).filter((v) => v.pga475 != null).length
  log(`${regions} of ${geo.features.length} regions and ${Object.keys(values.city).length} places sampled from ${name}`)
  return {
    period: { latest: +(args.version || 2023), aggregation: 'regions: mean of the raster cells inside them; cities: the cell at their point' },
    origin: { files: [file.ref], notes: `${raw.manifest.files[name].note || 'GEM Global Seismic Hazard Map'}. Licence: as published by GEM (check before redistributing).` },
    values,
  }
}
