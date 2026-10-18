// "Values by source": every figure we hold for a place, exactly as each source
// publishes it, with the geographic level and period it refers to. Nothing here
// is averaged across sources or borrowed from another area without saying so.
import { INDICATORS } from '../data/metrics.js'
import { providerById, providerOf, providersFor, localFirst, familyOf, familyBase, isRegionOnly } from '../core/providers.js'

const POLLUTANTS = [['pm2_5', 'PM2.5'], ['pm10', 'PM10'], ['nitrogen_dioxide', 'NO₂'], ['ozone', 'O₃'], ['sulphur_dioxide', 'SO₂']]

const row = (label, value, unit = '') => ({ label, value, unit })
const src = (id) => providerById(id)

/**
 * @returns [{ key, name, url, level, area, period, status, note, rows: [{ label, value, unit }] }]
 */
export function valuesBySource({ entity, model, country, detail, quakes, live = {} }) {
  const isCity = entity.type === 'city'
  const point = `${entity.lat.toFixed(3)}, ${entity.lon.toFixed(3)}`
  const groups = []

  // ---- The country's datasets: each provider describes its own figures ----
  for (const p of localFirst(providersFor(country))) {
    const g = p.provenance?.({ entity, detail: entity.details?.[p.id], meta: model.datasets?.[p.id], country })
    if (g) groups.push({ key: p.short, name: p.name, url: p.url, ...g })
  }

  // ---- Open-Meteo: climate (ERA5) ----
  const clim = detail?.climate
  if (clim) {
    groups.push({
      key: 'Open-Meteo ERA5 (live)', name: src('open-meteo-era5').name, url: src('open-meteo-era5').url,
      level: 'Point (≈ 25 km grid)', area: point, period: clim.period, status: 'Live',
      rows: [
        row('Mean temperature', clim.meanTemp, '°C'), row('Annual precipitation', clim.annualPrecip, 'mm'),
        row('Annual snowfall', clim.snowfall, 'cm'), row('Sunshine', clim.sunshine, 'h/yr'),
        row('Hottest day (mean of annual maxima)', clim.tempMaxAnnual, '°C'), row('Coldest night (mean of annual minima)', clim.tempMinAnnual, '°C'),
        row('Grid elevation', clim.elevation, 'm'), row('Climate comfort (MapStats model on ERA5)', clim.climateComfort, '/100'),
        row('Very hot days (≥ 35 °C), per year', clim.hotDays, 'days'), row('Tropical nights (min ≥ 20 °C), per year', clim.tropicalNights, 'days'),
        row('Frost days (min < 0 °C), per year', clim.frostDays, 'days'), row('Very heavy rain days (≥ 20 mm), per year', clim.heavyRainDays, 'days'),
        row('Longest dry spell (< 1 mm), per year', clim.drySpell, 'days'),
      ].filter((r) => r.value != null),
    })
  }

  // ---- Open-Meteo: air quality (CAMS) + UV ----
  const air = detail?.air
  if (air || entity.values.aqi != null) {
    const cur = air?.current || {}
    groups.push({
      key: 'Open-Meteo CAMS (live)', name: src('open-meteo-cams').name, url: src('open-meteo-cams').url,
      level: 'Point (≈ 10–40 km grid)', area: point, period: cur.time ? `now (${cur.time.replace('T', ' ')}) · last 92 days · last 365 days` : 'last 30–365 days', status: 'Live',
      rows: [
        row('European AQI, now', cur.european_aqi), row('US AQI, now', cur.us_aqi),
        row('European AQI, mean of the last 365 days', entity.values.aqi), row('European AQI, mean of the last 30 days', entity.values.aqiRecent),
        row('US AQI, mean of the last 365 days', entity.values.usAqi), row('PM2.5, mean of the last 365 days', entity.values.pm25, 'µg/m³'),
        row('PM2.5, worst day of the last 365', entity.values.pm25WorstDay, 'µg/m³'),
        row('Days with poor air or worse (European AQI daily mean > 60)', entity.values.aqiPoorDays, 'days'),
        row('Days unhealthy for sensitive groups (US AQI daily mean > 100)', entity.values.usAqiUnhealthyDays, 'days'),
        row('Days above the WHO 24-hour PM2.5 guideline (15 µg/m³)', entity.values.pm25HighDays, 'days'),
        ...POLLUTANTS.map(([k, l]) => row(`${l}, now`, cur[k], 'µg/m³')),
        ...POLLUTANTS.map(([k, l]) => row(`${l}, 92-day mean`, air?.means?.[k], 'µg/m³')),
      ].filter((r) => r.value != null),
    })
  }
  const today = new Date().toISOString().slice(0, 10)
  const uvToday = detail?.uv?.find((d) => d.date === today)?.uv
  if (uvToday != null) {
    groups.push({
      key: 'Open-Meteo UV (live)', name: src('open-meteo-uv').name, url: src('open-meteo-uv').url,
      level: 'Point', area: point, period: today, status: 'Live', rows: [row('Maximum UV index, today', uvToday)],
    })
  }

  const uvy = live.uv?.[entity.id]
  if (uvy?.uvMean != null) {
    const s = src('open-meteo-uv-history')
    groups.push({
      key: 'Open-Meteo UV history (live)', name: s.name, url: s.url, level: 'Point', area: point,
      period: String(new Date().getFullYear() - 1), status: 'Live',
      rows: [row('UV index, mean of daily maxima', uvy.uvMean), row('UV index, highest daily maximum', uvy.uvMax),
        row('Days with very high UV or worse (index ≥ 8)', uvy.uvVeryHighDays, 'days'), row('Days with extreme UV (index ≥ 11)', uvy.uvExtremeDays, 'days')].filter((r) => r.value != null),
    })
  }
  const fl = live.flood?.[entity.id]
  if (fl) {
    const s = src('open-meteo-glofas')
    groups.push({
      key: 'Open-Meteo GloFAS (live)', name: s.name, url: s.url, level: 'Nearest river cell (≈ 5 km)', area: point,
      period: 'past 365 days + 30-day forecast', status: 'Live',
      rows: fl.river
        ? [
            row('Normal flow (median)', fl.normalFlow, 'm³/s'), row('Usual high water (90th percentile)', fl.highWater, 'm³/s'),
            row('Past-year peak', fl.pastPeak, 'm³/s'), row(`Forecast peak${fl.forecastPeakDate ? ` (${fl.forecastPeakDate})` : ''}`, fl.forecastPeak, 'm³/s'),
            row('Flood watch: forecast peak ÷ usual high water', fl.floodWatch, '×'),
          ].filter((r) => r.value != null)
        : [],
      note: fl.river ? null : 'No significant river in this cell (median flow under 1 m³/s).',
    })
  }

  // ---- USGS earthquakes ----
  if (quakes) {
    groups.push({
      key: 'USGS (live)', name: src('usgs').name, url: src('usgs').url,
      level: 'Radius 200 km', area: point, period: `1980–${new Date().getFullYear()}, M5+`, status: 'Live',
      rows: [
        row('Earthquakes M5+', quakes.near.length, 'count'),
        ...(quakes.strongest ? [row(`Strongest (${quakes.strongest.time})`, quakes.strongest.mag, 'M')] : []),
      ],
    })
  }

  // ---- Statistics only available for the whole region (cities) / the region's own figures ----
  const regionWide = INDICATORS.filter((i) => isRegionOnly(familyOf(i.id)))
  const provRows = regionWide
    .filter((i) => (isCity ? entity.inherited?.has(i.id) : entity.values[i.id] != null))
    .map((i) => ({ ...row(i.label, entity.values[i.id], i.unit), source: providerOf(i.id).short }))
  if (provRows.length) {
    const family = familyOf(regionWide[0].id)
    const why = familyBase(family)?.why || ''
    groups.push({
      key: 'province', name: `${country.regionLabel}-level statistics${isCity ? ` (${entity.provinceName})` : ''}`,
      level: country.regionLabel, area: isCity ? entity.provinceName : entity.name, status: why && `${why[0].toUpperCase()}${why.slice(1)}`,
      rows: provRows,
      note: isCity
        ? `Not published for ${entity.name}; shown for transparency because the score uses them. Each row names its reference source.`
        : 'Approximate values entered by hand from each reference source; verify before relying on them.',
    })
  }

  return groups
}

// Up to 4 decimals, no trailing zeros; integers with thousands separators.
export function fmtExact(v) {
  if (v == null) return '—'
  if (typeof v !== 'number') return String(v)
  return Number.isInteger(v) ? v.toLocaleString('en') : (+v.toFixed(4)).toLocaleString('en', { maximumFractionDigits: 4 })
}
