// Yearly heat and cold stress under UTCI from Copernicus ERA5-HEAT daily statistics (each day's highest and lowest
// UTCI per 0.25° grid point). Each day scores by the worst UTCI stress category it reached (data/standards.js,
// thermalStress option 'utci'): its highest UTCI on the heat side, its lowest on the cold side. A place's value is
// the yearly mean of day scores, plus the days in the categories its warnings count. Pure: tested offline.
import { heatStep, coldStep } from '../../lib/thermal.js'
import { featureBbox, labelPoint, pointInFeature } from '../../lib/geo.js'
import { STANDARDS } from '../../data/standards.js'

const UTCI = STANDARDS.thermalStress.options.find((o) => o.id === 'utci')
const HEAT = UTCI.daily.find((d) => d.limit > 0), COLD = UTCI.daily.find((d) => d.limit < 0)
const valid = (v) => Number.isFinite(v) && v > -100 && v < 100 // fill values (−9e33) and kelvin slips

/** Score of one day (0–100) from its highest and lowest UTCI (°C). */
export const dayScore = (max, min) => Math.min(heatStep(max, UTCI.heat.categories), coldStep(min, UTCI.cold.categories))

/** Per-cell yearly sums: add(max, min) once per day (°C arrays over the grid's cells), then result(). */
export function yearAccumulator(cells) {
  const sum = new Float64Array(cells), days = new Uint16Array(cells), heat = new Uint16Array(cells), cold = new Uint16Array(cells)
  return {
    add(max, min) {
      for (let i = 0; i < cells; i++) {
        const hi = max[i], lo = min[i]
        if (!valid(hi) || !valid(lo)) continue
        sum[i] += dayScore(hi, lo)
        days[i]++
        if (hi >= HEAT.limit) heat[i]++
        if (lo <= COLD.limit) cold[i]++
      }
    },
    result: () => ({ score: Float64Array.from(sum, (s, i) => (days[i] ? s / days[i] : NaN)), heatDays: heat, coldDays: cold, days }),
  }
}

/**
 * Values per region and place from yearly grids: [{ lat0, lon0, step, rows, cols, year: yearAccumulator().result() }]
 * (lat0/lon0: the first grid point, north-west; latitudes descend). Regions take the mean of the grid points inside
 * them, or the point nearest their label point when none is (small islands); places take their nearest point.
 * Days are kept whole only when the year is complete enough (`minDays`).
 */
export function sampleGrids(grids, regionsGeo, places, { minDays = 300 } = {}) {
  const at = (g, r, c) => {
    const i = r * g.cols + c
    return g.year.days[i] >= minDays && Number.isFinite(g.year.score[i]) ? { score: g.year.score[i], heat: g.year.heatDays[i], cold: g.year.coldDays[i] } : null
  }
  const nearest = (lon, lat) => {
    for (const g of grids) {
      const r = Math.round((g.lat0 - lat) / g.step), c = Math.round((lon - g.lon0) / g.step)
      if (r >= 0 && c >= 0 && r < g.rows && c < g.cols) return at(g, r, c)
    }
    return null
  }
  const values = (list) => ({ thermalUtci: Math.round(mean(list.map((v) => v.score))), utciHeatDays: Math.round(mean(list.map((v) => v.heat))), utciColdDays: Math.round(mean(list.map((v) => v.cold))) })

  const region = {}
  for (const f of regionsGeo.features) {
    const [x0, y0, x1, y1] = featureBbox(f.geometry)
    const inside = []
    for (const g of grids) {
      const r0 = Math.max(0, Math.ceil((g.lat0 - y1) / g.step)), r1 = Math.min(g.rows - 1, Math.floor((g.lat0 - y0) / g.step))
      const c0 = Math.max(0, Math.ceil((x0 - g.lon0) / g.step)), c1 = Math.min(g.cols - 1, Math.floor((x1 - g.lon0) / g.step))
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const v = at(g, r, c)
          if (v && pointInFeature([g.lon0 + c * g.step, g.lat0 - r * g.step], f)) inside.push(v)
        }
      }
    }
    if (!inside.length) {
      const v = nearest(...labelPoint(f))
      if (v) inside.push(v)
    }
    if (inside.length) region[f.properties.id] = values(inside)
  }

  const city = {}
  for (const p of places) {
    const v = nearest(p.lon, p.lat)
    if (v) city[p.id] = values([v])
  }
  return { region, city }
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length

/**
 * Areas to request for a country ([north, west, south, east], snapped outward to the grid): one per cluster of its
 * polygons and places, so far-apart parts (overseas regions, islands across the antimeridian) are separate small
 * requests instead of one box over half the globe. Polygons closer than `gap` degrees share a request.
 */
export function requestAreas(regionsGeo, places = [], { gap = 3, pad = 0.5, step = 0.25 } = {}) {
  const boxes = []
  for (const f of regionsGeo.features) {
    const g = f.geometry
    const polys = g.type === 'MultiPolygon' ? g.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })) : [g]
    for (const p of polys) boxes.push(featureBbox(p))
  }
  for (const p of places) boxes.push([p.lon, p.lat, p.lon, p.lat])
  const near = (a, b) => a[0] - gap <= b[2] && b[0] - gap <= a[2] && a[1] - gap <= b[3] && b[1] - gap <= a[3]
  let merged = boxes
  for (let changed = true; changed;) {
    changed = false
    const out = []
    for (const b of merged) {
      const hit = out.find((o) => near(o, b))
      if (hit) {
        hit[0] = Math.min(hit[0], b[0]); hit[1] = Math.min(hit[1], b[1]); hit[2] = Math.max(hit[2], b[2]); hit[3] = Math.max(hit[3], b[3])
        changed = true
      } else out.push([...b])
    }
    merged = out
  }
  const down = (v) => Math.floor(v / step) * step, up = (v) => Math.ceil(v / step) * step
  return merged
    .map(([x0, y0, x1, y1]) => [Math.min(90, up(y1 + pad)), Math.max(-180, down(x0 - pad)), Math.max(-60, down(y0 - pad)), Math.min(180, up(x1 + pad))])
    .filter(([n, , s]) => n > s) // wholly south of 60° S: outside the dataset
    .sort((a, b) => (b[0] - b[2]) * (b[3] - b[1]) - (a[0] - a[2]) * (a[3] - a[1]))
}
