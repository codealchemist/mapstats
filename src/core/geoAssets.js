// Browser only: URLs of each country's generated boundaries and city list (countries/<ISO3>/geo/).
// Vite emits them as hashed assets, fetched only for the selected country.
const ASSETS = import.meta.glob(['/countries/*/geo/*.json', '!/countries/_template/**'], { query: '?url', import: 'default', eager: true })

/** @returns {{ regions: string, cities: string }} */
export function geoUrls(iso3) {
  const url = (file) => ASSETS[`/countries/${iso3}/geo/${file}.json`]
  return { regions: url('regions'), cities: url('cities') }
}
