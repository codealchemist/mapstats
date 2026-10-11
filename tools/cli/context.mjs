// What the CLI needs to know about a country: its config, region ids, places and datasets.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { findCountry } from '../../src/core/countries.js'
import { normalisePlaces } from '../../src/core/resolve.js'

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
export const countryDir = (iso3) => path.join(ROOT, 'countries', iso3)

export function countryOrExit(code) {
  const country = findCountry(code)
  if (!country) {
    console.error(code ? `Unknown country ${String(code).toUpperCase()}: add it to countries/index.js (npm run country:new).` : 'Which country? e.g. npm run country:check -- ARG')
    process.exit(1)
  }
  return country
}

// Every provider test (countries/<ISO3>/providers/<id>/provider.test.mjs) of one country, or of all of them.
export function providerTests(iso3) {
  const dirs = iso3 ? [iso3] : fs.readdirSync(path.join(ROOT, 'countries'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  return dirs.flatMap((d) => {
    const dir = path.join(countryDir(d), 'providers')
    return fs.existsSync(dir) ? fs.readdirSync(dir).map((p) => path.join(dir, p, 'provider.test.mjs')).filter((f) => fs.existsSync(f)) : []
  })
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
