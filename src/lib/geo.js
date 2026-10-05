export function featureBbox(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]
      if (c[0] > maxX) maxX = c[0]
      if (c[1] < minY) minY = c[1]
      if (c[1] > maxY) maxY = c[1]
    } else c.forEach(walk)
  }
  walk(geom.coordinates)
  return [minX, minY, maxX, maxY]
}

export function collectionBbox(fc) {
  return fc.features.reduce(
    (b, f) => {
      const [a, c, d, e] = featureBbox(f.geometry)
      return [Math.min(b[0], a), Math.min(b[1], c), Math.max(b[2], d), Math.max(b[3], e)]
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  )
}

function pointInRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const polygonsOf = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates)

export function pointInFeature(pt, feature) {
  return polygonsOf(feature.geometry).some(
    (p) => pointInRing(pt, p[0]) && !p.slice(1).some((h) => pointInRing(pt, h)),
  )
}

function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  return Math.abs(a / 2)
}

// Centroid of the largest polygon; falls back to its bbox centre when the centroid lands outside (concave shapes).
export function labelPoint(feature) {
  const polys = polygonsOf(feature.geometry)
  const outer = polys.map((p) => p[0]).sort((a, b) => ringArea(b) - ringArea(a))[0]
  let cx = 0, cy = 0, a = 0
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const f = outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1]
    cx += (outer[j][0] + outer[i][0]) * f
    cy += (outer[j][1] + outer[i][1]) * f
    a += f
  }
  const c = a ? [cx / (3 * a), cy / (3 * a)] : outer[0]
  if (pointInFeature(c, feature)) return c
  const [x0, y0, x1, y1] = featureBbox({ coordinates: [outer] })
  return [(x0 + x1) / 2, (y0 + y1) / 2]
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

// Extra sample points for interpolated surfaces: a regular grid inside the country, keeping only
// cells farther than `minKm` from every existing point (fills empty areas like Patagonia).
export function gapGrid(fc, existing, bbox = collectionBbox(fc), stepDeg = 2, minKm = 150) {
  const [x0, y0, x1, y1] = bbox
  const out = []
  for (let lat = Math.ceil(y0 / stepDeg) * stepDeg; lat <= y1; lat += stepDeg) {
    for (let lon = Math.ceil(x0 / stepDeg) * stepDeg; lon <= x1; lon += stepDeg) {
      if (!fc.features.some((f) => pointInFeature([lon, lat], f))) continue
      if ([...existing, ...out].some((p) => haversineKm(lat, lon, p.lat, p.lon) < minKm)) continue
      out.push({ id: `grid:${lat.toFixed(1)},${lon.toFixed(1)}`, lat, lon })
    }
  }
  return out
}
