// Countries with bundled boundaries (public/geo/{iso3}.json, built by scripts/build-geo.mjs).
// `bounds` overrides the data bbox where overseas territories / remote islands would zoom the map out too far.
// `curated` countries ship socio-economic baselines; the rest are scored on live environmental data only.
export const COUNTRIES = [
  { iso3: 'ARG', iso2: 'AR', name: 'Argentina', regionLabel: 'Province', curated: true },
  { iso3: 'BOL', iso2: 'BO', name: 'Bolivia', regionLabel: 'Department' },
  { iso3: 'BRA', iso2: 'BR', name: 'Brazil', regionLabel: 'State' },
  { iso3: 'CHL', iso2: 'CL', bounds: [-76, -56, -66, -17], name: 'Chile', regionLabel: 'Region' },
  { iso3: 'COL', iso2: 'CO', bounds: [-79.5, -4.5, -66.8, 12.6], name: 'Colombia', regionLabel: 'Department' },
  { iso3: 'ECU', iso2: 'EC', bounds: [-81.2, -5.1, -75.1, 1.5], name: 'Ecuador', regionLabel: 'Province' },
  { iso3: 'FRA', iso2: 'FR', bounds: [-5.2, 41.3, 9.6, 51.1], name: 'France', regionLabel: 'Department', curated: true },
  { iso3: 'DEU', iso2: 'DE', name: 'Germany', regionLabel: 'State' },
  { iso3: 'ITA', iso2: 'IT', name: 'Italy', regionLabel: 'Province' },
  { iso3: 'MEX', iso2: 'MX', name: 'Mexico', regionLabel: 'State' },
  { iso3: 'PRY', iso2: 'PY', name: 'Paraguay', regionLabel: 'Department' },
  { iso3: 'PER', iso2: 'PE', name: 'Peru', regionLabel: 'Region' },
  { iso3: 'PRT', iso2: 'PT', bounds: [-9.6, 36.9, -6.1, 42.2], name: 'Portugal', regionLabel: 'District' },
  { iso3: 'ESP', iso2: 'ES', bounds: [-9.4, 35.9, 4.4, 43.9], name: 'Spain', regionLabel: 'Province' },
  { iso3: 'USA', iso2: 'US', bounds: [-125, 24.5, -66.9, 49.5], name: 'United States', regionLabel: 'State' },
  { iso3: 'URY', iso2: 'UY', name: 'Uruguay', regionLabel: 'Department' },
]

export const countryByIso = (iso3) => COUNTRIES.find((c) => c.iso3 === iso3) || COUNTRIES[0]

// News searches: language of the crime keywords and the country's name as local outlets write it.
const NEWS = {
  ARG: ['es', 'Argentina'], BOL: ['es', 'Bolivia'], BRA: ['pt', 'Brasil'], CHL: ['es', 'Chile'], COL: ['es', 'Colombia'],
  ECU: ['es', 'Ecuador'], FRA: ['fr', 'France'], DEU: ['de', 'Deutschland'], ITA: ['it', 'Italia'], MEX: ['es', 'México'],
  PRY: ['es', 'Paraguay'], PER: ['es', 'Perú'], PRT: ['pt', 'Portugal'], ESP: ['es', 'España'], USA: ['en', 'United States'], URY: ['es', 'Uruguay'],
}
export const newsSettings = (iso3) => {
  const [lang, countryName] = NEWS[iso3] || ['en', countryByIso(iso3).name]
  return { lang, countryName }
}
