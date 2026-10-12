// Country registry: every manifest in countries/index.js, plus lookups. Browser- and Node-safe.
import { COUNTRIES } from '../../countries/index.js'

export { COUNTRIES }

// A country is curated when it has providers of its own (opt-in global providers such as link-only Numbeo
// bring no data of the country's own).
export const isCurated = (country) => country.providers.some((p) => typeof p === 'object')

/** The country with this ISO3 code, or null. */
export const findCountry = (iso3) => COUNTRIES.find((c) => c.iso3 === String(iso3 || '').toUpperCase()) || null

/** The country with this code, else the first one (for codes remembered by an older build). */
export const countryByIso = (iso3) => findCountry(iso3) || COUNTRIES[0]

// News searches: language of the crime keywords, the country's name as local outlets write it, its Google
// News edition and the place names that need their region to be unambiguous.
export const newsSettings = (iso3) => {
  const { lang, countryName, edition, ambiguousNames } = countryByIso(iso3).news
  return { lang, countryName, edition, ambiguous: new Set(ambiguousNames) }
}
