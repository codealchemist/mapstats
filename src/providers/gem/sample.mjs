// Samples a hazard raster (EPSG:4326, one band) at a country's places: cities take the cell at their point;
// regions take the mean of the cells whose centre lies inside them (equal weights: cells are small next to
// regions) and their maximum. Pure: the raster comes as { origin, res, width, height, nodata, read(window) }.
import { pointInFeature, featureBbox } from '../../lib/geo.js'

const round = (v, d = 3) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

export async function sampleHazard(raster, regionsGeo, places) {
  const { origin: [ox, oy], res: [rx, ry], width, height, nodata } = raster
  const col = (lon) => Math.floor((lon - ox) / rx), row = (lat) => Math.floor((lat - oy) / ry)
  const valid = (v) => v != null && Number.isFinite(v) && v !== nodata && v >= 0
  const clampC = (c) => Math.max(0, Math.min(width - 1, c)), clampR = (r) => Math.max(0, Math.min(height - 1, r))

  const region = {}
  for (const f of regionsGeo.features) {
    const [x0, y0, x1, y1] = featureBbox(f.geometry)
    const c0 = clampC(col(x0)), c1 = clampC(col(x1)), r0 = clampR(row(y1)), r1 = clampR(row(y0))
    const data = await raster.read([c0, r0, c1 + 1, r1 + 1])
    const w = c1 - c0 + 1
    let sum = 0, n = 0, max = null
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const v = data[(r - r0) * w + (c - c0)]
        if (!valid(v) || !pointInFeature([ox + (c + 0.5) * rx, oy + (r + 0.5) * ry], f)) continue
        sum += v; n++; max = max == null ? v : Math.max(max, v)
      }
    }
    region[f.properties.id] = { pga475: n ? round(sum / n) : null, pga475Max: round(max) }
  }

  const city = {}
  for (const p of places) {
    const c = col(p.lon), r = row(p.lat)
    if (c < 0 || r < 0 || c >= width || r >= height) continue
    const [v] = await raster.read([c, r, c + 1, r + 1])
    city[p.id] = { pga475: valid(v) ? round(v) : null }
  }
  return { region, city }
}
