// Builds simplified admin-1 boundaries + major cities per country from Natural Earth, into
// countries/<ISO3>/geo/{regions,cities}.json, using each country's `geo` settings (country.config.js).
// Usage: NE_DIR=/path/to/natural-earth-geojson npm run geo [-- ARG BOL …]   (default: every country)
// Expects ne_10m_admin_1_states_provinces.geojson and ne_10m_populated_places_simple.geojson in NE_DIR.
import fs from 'node:fs'
import path from 'node:path'
import mapshaper from 'mapshaper'
import { COUNTRIES } from '../src/core/countries.js'

const NE_DIR = process.env.NE_DIR
if (!NE_DIR) throw new Error('Set NE_DIR to the folder holding the Natural Earth GeoJSON files')
const only = process.argv.slice(2).map((a) => a.toUpperCase())
const targets = only.length
  ? only.map((iso3) => COUNTRIES.find((c) => c.iso3 === iso3) || fail(iso3))
  : COUNTRIES
function fail(iso3) { throw new Error(`Unknown country ${iso3} (not in countries/index.js)`) }

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

for (const { iso3, geo } of targets) {
  const OUT = path.resolve(`countries/${iso3}/geo`)
  fs.mkdirSync(OUT, { recursive: true })
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
  const result = await mapshaper.applyCommands(
    `-i in.json -simplify ${geo.simplify} keep-shapes -o out.json precision=0.0001 format=geojson`,
    input,
  )
  const simplified = JSON.parse(result['out.json'])
  fs.writeFileSync(path.join(OUT, 'regions.json'), JSON.stringify(simplified))

  const cities = places.features
    .filter((p) => p.properties.adm0_a3 === iso3 && p.properties.pop_max >= geo.minCityPop)
    .sort((a, b) => b.properties.pop_max - a.properties.pop_max)
    .slice(0, geo.maxCities)
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
  fs.writeFileSync(path.join(OUT, 'cities.json'), JSON.stringify(cities))
  console.log(iso3, feats.length, 'regions', cities.length, 'cities', (fs.statSync(path.join(OUT, 'regions.json')).size / 1024).toFixed(0) + 'KB')
}
