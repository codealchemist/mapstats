// Builds simplified admin-1 boundaries + major cities per country from Natural Earth.
// Usage: NE_DIR=/path/to/natural-earth-geojson node scripts/build-geo.mjs
// Expects ne_10m_admin_1_states_provinces.geojson and ne_10m_populated_places_simple.geojson in NE_DIR.
import fs from 'node:fs'
import path from 'node:path'
import mapshaper from 'mapshaper'

const NE_DIR = process.env.NE_DIR
if (!NE_DIR) throw new Error('Set NE_DIR to the folder holding the Natural Earth GeoJSON files')
const OUT = path.resolve('public/geo')
const COUNTRIES = ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'ESP', 'FRA', 'DEU', 'ITA', 'MEX', 'PER', 'PRT', 'PRY', 'URY', 'USA']

const read = (f) => JSON.parse(fs.readFileSync(path.join(NE_DIR, f), 'utf8'))
const adm1 = read('ne_10m_admin_1_states_provinces.geojson')
const places = read('ne_10m_populated_places_simple.geojson')

function pointInRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function pointInFeature(pt, f) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  return polys.some((p) => pointInRing(pt, p[0]) && !p.slice(1).some((h) => pointInRing(pt, h)))
}

for (const iso3 of COUNTRIES) {
  const feats = adm1.features
    .filter((f) => f.properties.adm0_a3 === iso3)
    .map((f) => ({
      type: 'Feature',
      properties: {
        id: f.properties.iso_3166_2 || f.properties.adm1_code,
        name: f.properties.name,
      },
      geometry: f.geometry,
    }))
  const input = { 'in.json': { type: 'FeatureCollection', features: feats } }
  const pct = iso3 === 'ARG' ? '18%' : '8%'
  const result = await mapshaper.applyCommands(
    `-i in.json -simplify ${pct} keep-shapes -o out.json precision=0.0001 format=geojson`,
    input,
  )
  const simplified = JSON.parse(result['out.json'])
  fs.writeFileSync(path.join(OUT, `${iso3}.json`), JSON.stringify(simplified))

  const cities = places.features
    .filter((p) => p.properties.adm0_a3 === iso3 && p.properties.pop_max >= 100000)
    .sort((a, b) => b.properties.pop_max - a.properties.pop_max)
    .slice(0, 120)
    .map((p) => {
      const pt = [p.properties.longitude, p.properties.latitude]
      const prov = simplified.features.find((f) => pointInFeature(pt, f)) || feats.find((f) => pointInFeature(pt, f))
      return {
        id: `${iso3}-${p.properties.nameascii.replace(/\W+/g, '-').toLowerCase()}`,
        name: p.properties.name,
        lat: +p.properties.latitude.toFixed(4),
        lon: +p.properties.longitude.toFixed(4),
        pop: p.properties.pop_max,
        province: prov ? prov.properties.id : null,
        capital: p.properties.adm0cap === 1,
      }
    })
  fs.writeFileSync(path.join(OUT, `${iso3}-cities.json`), JSON.stringify(cities))
  console.log(iso3, feats.length, 'regions', cities.length, 'cities', (fs.statSync(path.join(OUT, `${iso3}.json`)).size / 1024).toFixed(0) + 'KB')
}
