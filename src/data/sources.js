// Data source registry. Keys match the `source` labels used in metrics.js, so any
// indicator, category or layer can resolve the sources behind it.
import { INDICATORS, indicatorById } from './metrics.js'

export const SOURCES = {
  Numbeo: {
    name: 'Numbeo', url: 'https://es.numbeo.com/criminalidad/pa%C3%ADs/Argentina',
    covers: 'Crime, healthcare, pollution, traffic, cost of living & quality-of-life indices (city snapshot)',
    // Deep-link to the city's page when we know its Numbeo slug.
    urlFor: (e, category) =>
      e?.numbeoSlug ? `https://es.numbeo.com/${category === 'safety' ? 'criminalidad' : 'calidad-de-vida'}/ciudad/${e.numbeoSlug}` : null,
  },
  SNIC: { name: 'SNIC – Ministerio de Seguridad', url: 'https://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos', covers: 'Official crime statistics by province and department (partido): homicides, robberies, thefts, road deaths' },
  INDEC: { name: 'INDEC', url: 'https://www.indec.gob.ar/', covers: 'Life expectancy projections' },
  EPH: { name: 'INDEC – EPH', url: 'https://www.indec.gob.ar/', covers: 'Poverty and unemployment (Encuesta Permanente de Hogares)' },
  'Censo 2022': { name: 'Censo 2022', url: 'https://censo.gob.ar/', covers: 'Water & sewer network coverage' },
  'Censo / Natural Earth': { name: 'Censo 2022 / Natural Earth', url: 'https://censo.gob.ar/', covers: 'Population' },
  ENACOM: { name: 'ENACOM', url: 'https://indicadores.enacom.gob.ar/', covers: 'Fixed internet accesses per 100 households' },
  REFEPS: { name: 'REFEPS – Ministerio de Salud', url: 'https://sisa.msal.gov.ar/', covers: 'Physicians per 1,000 inhabitants' },
  DNV: { name: 'Vialidad Nacional', url: 'https://www.argentina.gob.ar/obras-publicas/vialidad-nacional', covers: 'Paved road network' },
  INPRES: { name: 'INPRES', url: 'https://www.inpres.gob.ar/', covers: 'Seismic zoning (CIRSOC 103)' },
  SNMF: { name: 'Servicio Nacional de Manejo del Fuego', url: 'https://www.argentina.gob.ar/ambiente/fuego', covers: 'Wildfire exposure' },
  INA: { name: 'INA – Instituto Nacional del Agua', url: 'https://www.ina.gob.ar/', covers: 'Flood exposure' },
  PNUD: { name: 'PNUD Argentina', url: 'https://www.undp.org/es/argentina', covers: 'Provincial Human Development Index' },
  'MapStats est.': { name: 'MapStats estimate', url: null, covers: 'Public transport coverage score (see methodology)' },
  'Open-Meteo ERA5 (live)': { name: 'Open-Meteo · ERA5', url: 'https://open-meteo.com/en/docs/historical-weather-api', covers: 'Historical weather: temperature, rain, snow, sunshine, wind' },
  'Open-Meteo CAMS (live)': { name: 'Open-Meteo · CAMS', url: 'https://open-meteo.com/en/docs/air-quality-api', covers: 'Air quality (European AQI, pollutants)' },
  'Open-Meteo DEM (live)': { name: 'Open-Meteo · Elevation', url: 'https://open-meteo.com/en/docs/elevation-api', covers: 'Elevation' },
  'Open-Meteo UV (live)': { name: 'Open-Meteo · Forecast', url: 'https://open-meteo.com/en/docs', covers: 'Daily maximum UV index' },
  'Open-Meteo UV history (live)': { name: 'Open-Meteo · Historical forecast', url: 'https://open-meteo.com/en/docs/historical-forecast-api', covers: 'Daily maximum UV index over the last full year' },
  'Open-Meteo GloFAS (live)': { name: 'Open-Meteo · Flood (GloFAS)', url: 'https://open-meteo.com/en/docs/flood-api', covers: 'Copernicus GloFAS river discharge: past year and 30-day forecast' },
  'USGS (live)': { name: 'USGS Earthquake Catalog', url: 'https://earthquake.usgs.gov/earthquakes/search/', covers: 'Earthquakes M5+ since 1980' },
  'Natural Earth': { name: 'Natural Earth', url: 'https://www.naturalearthdata.com/', covers: 'Region boundaries & populated places' },
  Terrain: { name: 'Terrain tiles (AWS Open Data)', url: 'https://registry.opendata.aws/terrain-tiles/', covers: 'Hillshade & elevation relief' },
  'Google News RSS': { name: 'Google News (RSS search)', url: 'https://news.google.com/', covers: 'Finds recent articles mentioning a place together with crime keywords; links decoded to the publisher' },
  'Outlet RSS': { name: 'Local outlets’ RSS feeds', url: null, covers: 'Feeds of ~40 Argentine regional newspapers (El Eco, La Voz, La Capital, Los Andes…), matched by place and crime keywords' },
  'News service': { name: 'MapStats news service', url: null, covers: 'Our Netlify function: reads each article page, extracts ≤ 400 characters of the main text (respecting robots.txt), caches 24 h in Netlify Blobs' },
  CARTO: { name: 'CARTO basemaps', url: 'https://carto.com/basemaps', covers: 'Positron / Dark Matter base map (© OpenStreetMap contributors)' },
  Geocoding: { name: 'Open-Meteo · Geocoding', url: 'https://open-meteo.com/en/docs/geocoding-api', covers: 'Worldwide place search (GeoNames)' },
  Departments: { name: 'Argentine department boundaries', url: 'https://github.com/mgaitan/departamentos_argentina', covers: 'Partido / departamento polygons, used once to match each city to its SNIC department' },
  'SNIC mirror': { name: 'dashboard-snic (GitHub)', url: 'https://github.com/crisgomez79/dashboard-snic', covers: 'Unofficial copy of the SNIC provincial and departmental bases currently imported' },
}

// What each source provides and how the app gets it (for the Sources view).
export const DATA_TYPES = [
  { id: 'crime', label: 'Crime & safety' },
  { id: 'climate', label: 'Climate & weather' },
  { id: 'air', label: 'Air quality & UV' },
  { id: 'hazards', label: 'Natural hazards' },
  { id: 'society', label: 'Population, economy & services' },
  { id: 'geo', label: 'Maps & geography' },
]

export const ACCESS = {
  live: { label: 'Live API', detail: 'fetched in your browser, cached locally' },
  import: { label: 'Imported file', detail: 'downloaded once, converted offline (npm run snic:import)' },
  snapshot: { label: 'Stored snapshot', detail: 'copied once (npm run numbeo:fetch / hand-entered), not re-fetched' },
  manual: { label: 'Hand-entered', detail: 'approximate values typed from the publication; verify before relying on them' },
  bundled: { label: 'Bundled', detail: 'shipped with the app' },
  tiles: { label: 'Map tiles', detail: 'streamed by the map' },
  once: { label: 'Used once', detail: 'used during data preparation, not at runtime' },
}

export const SOURCE_META = {
  SNIC: { types: ['crime'], access: 'import', cadence: 'Annual (2000–latest year)', scope: 'Argentina · province & department' },
  'SNIC mirror': { types: ['crime'], access: 'once', cadence: 'Copy of the 2000–2025 bases', scope: 'Argentina' },
  Numbeo: { types: ['crime', 'society', 'air'], access: 'snapshot', cadence: 'Crowd-sourced, continuously updated', scope: 'Cities worldwide' },
  'Open-Meteo ERA5 (live)': { types: ['climate'], access: 'live', cadence: 'Daily, ~5-day delay', scope: 'Global grid ≈ 25 km' },
  'Open-Meteo CAMS (live)': { types: ['air'], access: 'live', cadence: 'Hourly', scope: 'Global grid ≈ 10–40 km' },
  'Open-Meteo UV (live)': { types: ['air'], access: 'live', cadence: 'Daily forecast', scope: 'Global grid' },
  'Open-Meteo UV history (live)': { types: ['air', 'climate'], access: 'live', cadence: 'Archived daily forecasts', scope: 'Global grid' },
  'Open-Meteo GloFAS (live)': { types: ['hazards'], access: 'live', cadence: 'Daily, 30-day forecast', scope: 'Global rivers ≈ 5 km' },
  'Open-Meteo DEM (live)': { types: ['geo'], access: 'live', cadence: 'Static', scope: 'Global ≈ 90 m' },
  'USGS (live)': { types: ['hazards'], access: 'live', cadence: 'Real time', scope: 'Global, M5+ since 1980' },
  INPRES: { types: ['hazards'], access: 'manual', cadence: 'Building-code zoning', scope: 'Argentina · province' },
  SNMF: { types: ['hazards'], access: 'manual', cadence: 'MapStats estimate', scope: 'Argentina · province' },
  INA: { types: ['hazards'], access: 'manual', cadence: 'MapStats estimate', scope: 'Argentina · province' },
  INDEC: { types: ['society'], access: 'manual', cadence: 'Projections', scope: 'Argentina · province' },
  EPH: { types: ['society'], access: 'manual', cadence: 'Semi-annual survey', scope: 'Argentina · urban areas' },
  'Censo 2022': { types: ['society'], access: 'manual', cadence: 'Census 2022', scope: 'Argentina · province' },
  'Censo / Natural Earth': { types: ['society'], access: 'manual', cadence: 'Census 2022 / approximate', scope: 'Cities' },
  ENACOM: { types: ['society'], access: 'manual', cadence: 'Quarterly', scope: 'Argentina · province' },
  REFEPS: { types: ['society'], access: 'manual', cadence: 'Registry', scope: 'Argentina · province' },
  DNV: { types: ['society'], access: 'manual', cadence: 'MapStats estimate', scope: 'Argentina · province' },
  PNUD: { types: ['society'], access: 'manual', cadence: 'Periodic reports', scope: 'Argentina · province' },
  'MapStats est.': { types: ['society'], access: 'manual', cadence: 'MapStats estimate', scope: 'Argentina · province' },
  'Natural Earth': { types: ['geo'], access: 'bundled', cadence: 'v5', scope: 'World admin-1 & places' },
  Departments: { types: ['geo', 'crime'], access: 'once', cadence: 'Static', scope: 'Argentina · 527 departments' },
  Terrain: { types: ['geo', 'hazards'], access: 'tiles', cadence: 'Static', scope: 'Global DEM tiles' },
  'Google News RSS': { types: ['crime'], access: 'live', cadence: 'Continuous; cached 24 h per place', scope: 'News in the country’s edition, last 30 days' },
  'Outlet RSS': { types: ['crime'], access: 'live', cadence: 'Each outlet’s latest items; cached 24 h', scope: 'Argentina · by province and city' },
  'News service': { types: ['crime'], access: 'live', cadence: 'First request per place fetches; 24 h cache', scope: 'Netlify Functions + Blobs' },
  CARTO: { types: ['geo'], access: 'tiles', cadence: 'OpenStreetMap updates', scope: 'Global' },
  Geocoding: { types: ['geo'], access: 'live', cadence: 'GeoNames', scope: 'Global places' },
}

export const sourceList = Object.entries(SOURCES).map(([key, s]) => ({ key, ...s }))

const uniq = (keys) => [...new Set(keys)].filter((k) => SOURCES[k])

export const sourcesForIndicators = (ids) => uniq(ids.map((id) => indicatorById[id]?.source))

export const sourcesForCategory = (categoryId) => uniq(INDICATORS.filter((i) => i.category === categoryId).map((i) => i.source))

// Source families for the main-view source selector. Each indicator belongs to exactly one family.
// Hand-entered provincial figures are grouped together: they share the same provenance caveat.
export const SOURCE_FAMILIES = [
  { id: 'combined', label: 'All sources · median', short: 'Median of sources' },
  { id: 'weighted', label: 'All sources · weighted by reliability', short: 'Weighted' },
  { id: 'snic', label: 'SNIC · official crime statistics', short: 'SNIC' },
  { id: 'numbeo', label: 'Numbeo · crowd-sourced indices', short: 'Numbeo' },
  { id: 'openmeteo', label: 'Open-Meteo · live climate & air', short: 'Open-Meteo' },
  { id: 'usgs', label: 'USGS · earthquakes', short: 'USGS' },
  { id: 'provincial', label: 'Provincial statistics · hand-entered', short: 'Provincial stats' },
]
export const familyById = Object.fromEntries(SOURCE_FAMILIES.map((f) => [f.id, f]))

// Modes that integrate every source (vs. a single-source view).
export const isMultiSource = (mode) => mode === 'combined' || mode === 'weighted'

export function familyOf(indicatorId) {
  const s = indicatorById[indicatorId]?.source || ''
  if (s === 'SNIC') return 'snic'
  if (s === 'Numbeo') return 'numbeo'
  if (s.startsWith('Open-Meteo')) return 'openmeteo'
  if (s.startsWith('USGS')) return 'usgs'
  if (s === 'Censo / Natural Earth') return 'base' // population: context, not a scored source
  return 'provincial'
}
