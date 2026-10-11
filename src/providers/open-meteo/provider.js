// Open-Meteo APIs (free, keyless, CORS): fetched live in the browser through src/lib/live.js.
import { defineProvider } from '#core/define.js'

const family = { id: 'openmeteo', label: 'Open-Meteo · live climate & air', short: 'Open-Meteo' }
const live = { kind: 'measurement', access: 'live', levels: ['point'] }

export default [
  defineProvider({
    ...live, id: 'open-meteo-era5', short: 'Open-Meteo ERA5 (live)', name: 'Open-Meteo · ERA5', family,
    url: 'https://open-meteo.com/en/docs/historical-weather-api', covers: 'Historical weather: temperature, rain, snow, sunshine, wind',
    provides: ['climateComfort', 'meanTemp', 'annualPrecip', 'snowfall', 'sunshine', 'tempMaxAnnual', 'tempMinAnnual', 'hotDays', 'tropicalNights', 'frostDays', 'heavyRainDays', 'drySpell'],
    cadence: 'Daily, ~5-day delay', scope: 'Global grid ≈ 25 km', types: ['climate'], usedFor: 'Climate charts, comfort model, climate surfaces',
  }),
  defineProvider({
    ...live, id: 'open-meteo-cams', short: 'Open-Meteo CAMS (live)', name: 'Open-Meteo · CAMS', family: family.id,
    url: 'https://open-meteo.com/en/docs/air-quality-api', covers: 'Air quality (European AQI, pollutants)',
    provides: ['aqi', 'usAqi', 'pm25', 'aqiRecent', 'pm25WorstDay', 'aqiPoorDays', 'usAqiUnhealthyDays', 'pm25HighDays'], cadence: 'Hourly, last 365 days', scope: 'Global grid ≈ 10–40 km', types: ['air'], usedFor: 'Air-quality charts in reports',
  }),
  defineProvider({
    ...live, id: 'open-meteo-dem', short: 'Open-Meteo DEM (live)', name: 'Open-Meteo · Elevation', family: family.id,
    url: 'https://open-meteo.com/en/docs/elevation-api', covers: 'Elevation',
    provides: ['elevation'], cadence: 'Static', scope: 'Global ≈ 90 m', types: ['geo'],
  }),
  defineProvider({
    ...live, id: 'open-meteo-uv', short: 'Open-Meteo UV (live)', name: 'Open-Meteo · Forecast', family: family.id,
    url: 'https://open-meteo.com/en/docs', covers: 'Daily maximum UV index',
    cadence: 'Daily forecast', scope: 'Global grid', types: ['air'], usedFor: 'UV today and the 3-month UV chart in reports',
  }),
  defineProvider({
    ...live, id: 'open-meteo-uv-history', short: 'Open-Meteo UV history (live)', name: 'Open-Meteo · Historical forecast', family: family.id,
    url: 'https://open-meteo.com/en/docs/historical-forecast-api', covers: 'Daily maximum UV index over the last full year',
    provides: ['uvMean'], cadence: 'Archived daily forecasts', scope: 'Global grid', types: ['air', 'climate'], usedFor: 'UV climate surface',
  }),
  defineProvider({
    ...live, id: 'open-meteo-glofas', short: 'Open-Meteo GloFAS (live)', name: 'Open-Meteo · Flood (GloFAS)', family: family.id,
    url: 'https://open-meteo.com/en/docs/flood-api', covers: 'Copernicus GloFAS river discharge: past year and 30-day forecast',
    provides: ['floodWatch', 'floodPeakPast'], cadence: 'Daily, 30-day forecast', scope: 'Global rivers ≈ 5 km', types: ['hazards'], usedFor: 'River flood watch overlay',
  }),
  defineProvider({
    id: 'open-meteo-geocoding', short: 'Geocoding', name: 'Open-Meteo · Geocoding', access: 'live',
    url: 'https://open-meteo.com/en/docs/geocoding-api', covers: 'Worldwide place search (GeoNames)',
    cadence: 'GeoNames', scope: 'Global places', types: ['geo'], usedFor: 'Search for places outside the city list',
  }),
]
