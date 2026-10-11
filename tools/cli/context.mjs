// What the CLI needs to know about a country: its config, region ids, places and datasets.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { COUNTRIES } from '../../src/core/countries.js'
import { normalisePlaces } from '../../src/core/resolve.js'

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
export const countryDir = (iso3) => path.join(ROOT, 'countries', iso3)

export function countryOrExit(code) {
  const iso3 = String(code || '').toUpperCase()
  const country = COUNTRIES.find((c) => c.iso3 === iso3)
  if (!country) {
    console.error(code ? `Unknown country ${iso3}: add it to countries/index.js (npm run country:new).` : 'Which country? e.g. npm run country:check -- ARG')
    process.exit(1)
  }
  return country
}

export async function loadCountry(country) {
  const dir = countryDir(country.iso3)
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const geo = fs.existsSync(path.join(dir, 'geo/regions.json')) ? read('geo/regions.json') : null
  const neCities = fs.existsSync(path.join(dir, 'geo/cities.json')) ? read('geo/cities.json') : []
  const entry = path.join(dir, 'country.data.js')
  const data = fs.existsSync(entry) ? (await import(pathToFileURL(entry))).default : { places: null, datasets: [] }
  return {
    geo,
    regionIds: geo ? geo.features.map((f) => f.properties.id) : [],
    curated: !!data.places,
    places: normalisePlaces(data.places || neCities),
    datasets: data.datasets || [],
  }
}
