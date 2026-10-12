// Browser only: a country's places and datasets (countries/<ISO3>/country.data.js), loaded on demand so each
// country is its own chunk. Countries without one use the Natural Earth city list and live data only.
const LOADERS = import.meta.glob(['/countries/*/country.data.js', '!/countries/_template/**'])

const EMPTY = { places: null, datasets: [] }

export async function loadCountryData(iso3) {
  const load = LOADERS[`/countries/${iso3}/country.data.js`]
  return load ? { ...EMPTY, ...(await load()).default } : EMPTY
}
