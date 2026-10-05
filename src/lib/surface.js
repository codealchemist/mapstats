// Interpolated climate surfaces ("heat maps" of a value, not of point density).
//
// Inverse-distance weighting over the sample points (cities + gap-filling grid), computed in
// Web Mercator pixel space so the image lines up with the map, then clipped to the country by
// drawing its polygons as a mask. IDW ignores terrain: across the Andes a surface can smooth over
// sharp elevation-driven changes, which the legend notes.
import { colorAt, rampFor } from './colors.js'

export const SURFACE_VARS = [
  { id: 'tempMaxAnnual', label: 'Hottest day (annual max)', unit: '°C', ramp: 'red', pick: (l, id) => l.climate?.[id]?.tempMaxAnnual },
  { id: 'tempMinAnnual', label: 'Coldest night (annual min)', unit: '°C', ramp: 'blue-rev', pick: (l, id) => l.climate?.[id]?.tempMinAnnual },
  { id: 'annualPrecip', label: 'Annual rain', unit: 'mm', ramp: 'blue', pick: (l, id) => l.climate?.[id]?.annualPrecip },
  { id: 'snowfall', label: 'Annual snow', unit: 'cm', ramp: 'violet', pick: (l, id) => l.climate?.[id]?.snowfall },
  { id: 'uvMean', label: 'UV index (mean daily max)', unit: '', ramp: 'orange', pick: (l, id) => l.uv?.[id]?.uvMean },
]
export const surfaceVarById = Object.fromEntries(SURFACE_VARS.map((v) => [v.id, v]))

const R = Math.PI / 180
const SMOOTH2 = 0.6 ** 2 // ≈ 65 km smoothing radius, in degrees²
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * R) / 2))
const latOf = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / R

/** Collect { lat, lon, v } samples for a surface variable from live data. */
export function surfaceSamples(variable, points, live) {
  return points.map((p) => ({ lat: p.lat, lon: p.lon, v: variable.pick(live, p.id) })).filter((p) => p.v != null && Number.isFinite(p.v))
}

/**
 * @returns { url, coordinates, domain, stops } or null — `coordinates` are the image corners for a
 * MapLibre image source (top-left, top-right, bottom-right, bottom-left).
 */
export function renderSurface({ samples, fc, bbox, rampName, width = 720 }) {
  if (samples.length < 3 || typeof document === 'undefined') return null
  const [x0, y0, x1, y1] = bbox
  const my0 = mercY(y0), my1 = mercY(y1)
  const height = Math.min(1400, Math.round((width * (my1 - my0)) / ((x1 - x0) * R)))

  // Colour scale over the 2nd–98th percentile of samples, so one outlier doesn't flatten the rest.
  const vals = samples.map((s) => s.v).sort((a, b) => a - b)
  const q = (p) => vals[Math.min(vals.length - 1, Math.max(0, Math.round(p * (vals.length - 1))))]
  let lo = q(0.02), hi = q(0.98)
  if (lo === hi) { lo -= 1; hi += 1 }
  const ramp = rampFor(rampName)
  const scale = { stops: ramp.map((c, i) => [lo + ((hi - lo) * i) / (ramp.length - 1), c]) }

  // 1) Smoothed IDW on a coarse grid (1/4 resolution), power 2, distances in degrees scaled by cos(lat).
  const cw = Math.ceil(width / 4), ch = Math.ceil(height / 4)
  const coarse = document.createElement('canvas')
  coarse.width = cw
  coarse.height = ch
  const cctx = coarse.getContext('2d')
  const img = cctx.createImageData(cw, ch)
  const pts = samples.map((s) => ({ ...s, cos: Math.cos(s.lat * R) }))
  for (let j = 0; j < ch; j++) {
    const lat = latOf(my1 - ((j + 0.5) / ch) * (my1 - my0))
    const cosLat = Math.cos(lat * R)
    for (let i = 0; i < cw; i++) {
      const lon = x0 + ((i + 0.5) / cw) * (x1 - x0)
      let num = 0, den = 0
      for (const p of pts) {
        const dx = (lon - p.lon) * cosLat, dy = lat - p.lat
        // Smoothed IDW: the SMOOTH² term stops the surface from spiking into a "bullseye" at each sample.
        const w = 1 / (dx * dx + dy * dy + SMOOTH2)
        num += w * p.v
        den += w
      }
      const v = num / den
      const hex = colorAt(scale, v, 'light')
      const k = (j * cw + i) * 4
      img.data[k] = parseInt(hex.slice(1, 3), 16)
      img.data[k + 1] = parseInt(hex.slice(3, 5), 16)
      img.data[k + 2] = parseInt(hex.slice(5, 7), 16)
      img.data[k + 3] = 255
    }
  }
  cctx.putImageData(img, 0, 0)

  // 2) Country mask at full resolution, then draw the smoothed surface only inside it.
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  const px = (lon) => ((lon - x0) / (x1 - x0)) * width
  const py = (lat) => ((my1 - mercY(Math.max(-85, Math.min(85, lat)))) / (my1 - my0)) * height
  ctx.beginPath()
  for (const f of fc.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) for (const ring of poly) {
      ring.forEach(([lon, lat], k) => (k ? ctx.lineTo(px(lon), py(lat)) : ctx.moveTo(px(lon), py(lat))))
      ctx.closePath()
    }
  }
  ctx.fillStyle = '#000'
  ctx.fill('evenodd')
  ctx.globalCompositeOperation = 'source-in'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(coarse, 0, 0, width, height)

  return {
    url: out.toDataURL('image/png'),
    coordinates: [[x0, y1], [x1, y1], [x1, y0], [x0, y0]],
    domain: [lo, hi],
    legend: ramp,
    samples: samples.length,
  }
}
