// Offline test (npm test): sampling a synthetic hazard GeoTIFF, no download.
import { writeArrayBuffer } from 'geotiff'
import { check, done } from '#sdk/test.mjs'
import { openRaster } from './prefill.mjs'
import { sampleHazard } from './sample.mjs'

// A 4 × 4 grid of 1° cells from (-62, -30) to (-58, -34): hazard rises eastward (0.1, 0.2, 0.3, 0.4 g); one
// no-data cell.
const width = 4, height = 4, NODATA = -9999
const values = new Float32Array(width * height).map((_, i) => ((i % width) + 1) / 10)
values[0] = NODATA
const tiff = await writeArrayBuffer(values, { width, height, ModelPixelScale: [1, 1, 0], ModelTiepoint: [0, 0, 0, -62, -30, 0], GeographicTypeGeoKey: 4326, GTModelTypeGeoKey: 2, GDAL_NODATA: String(NODATA) })
const raster = await openRaster(Buffer.from(tiff))

const square = (id, x0, y0, x1, y1) => ({ type: 'Feature', properties: { id }, geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } })
const geo = { type: 'FeatureCollection', features: [square('XX-W', -62, -34, -60, -30), square('XX-E', -60, -34, -58, -30)] }
const places = [{ id: 'XXX-a', lat: -31.5, lon: -58.5 }, { id: 'XXX-out', lat: -40, lon: -58.5 }]
const { region, city } = await sampleHazard(raster, geo, places)

check('raster read as a longitude/latitude grid', raster.width === 4 && raster.res[0] === 1 && raster.res[1] === -1)
check('region mean of the cells inside it, skipping no-data', Math.abs(region['XX-W'].pga475 - (0.2 * 4 + 0.1 * 3) / 7) < 0.001, region['XX-W'].pga475)
check('region maximum', region['XX-E'].pga475Max === 0.4 && region['XX-W'].pga475Max === 0.2)
check('city takes the cell at its point', city['XXX-a'].pga475 === 0.4)
check('places outside the raster are left out', !('XXX-out' in city))
done()
