// A country's places and datasets for the golden test, as the app loads them (src/hooks/useCountryData.js).
import fs from 'node:fs'
import { normalisePlaces } from '../src/core/resolve.js'

export async function countryData(iso3) {
  const entry = new URL(`../countries/${iso3}/country.data.js`, import.meta.url)
  const data = fs.existsSync(entry) ? (await import(entry)).default : { places: null, datasets: [] }
  return { places: (ne) => normalisePlaces(data.places || ne).filter((c) => c.region), datasets: data.datasets }
}
