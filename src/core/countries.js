// Country registry: every manifest in countries/index.js, plus lookups. Browser- and Node-safe.
import { COUNTRIES } from '../../countries/index.js'

export { COUNTRIES }

// A country is curated when it ships its own datasets (any provider beyond the global live ones).
export const isCurated = (country) => country.providers.length > 0

export const countryByIso = (iso3) => COUNTRIES.find((c) => c.iso3 === iso3) || COUNTRIES[0]

// News searches: language of the crime keywords and the country's name as local outlets write it.
export const newsSettings = (iso3) => {
  const { lang, countryName } = countryByIso(iso3).news
  return { lang, countryName }
}
