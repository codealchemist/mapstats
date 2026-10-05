// "Values by source": every figure we hold for a place, exactly as each source
// publishes it, with the geographic level and period it refers to. Nothing here
// is averaged across sources or borrowed from another area without saying so.
import { INDICATORS } from '../data/metrics.js'
import { SURVEY } from '../data/numbeoSurvey.js'
import { SOURCES } from '../data/sources.js'
import { isOwnValue } from './scoring.js'

const NUMBEO_INDICES = [
  ['crimeIndex', 'Crime index'], ['healthcareIndex', 'Health care index'], ['pollutionIndex', 'Pollution index'],
  ['trafficIndex', 'Traffic commute time index'], ['costOfLiving', 'Cost of living index'],
  ['purchasingPower', 'Purchasing power index'], ['qualityOfLife', 'Quality of life index'],
]

const SNIC_ROWS = [
  ['homicide', 'Intentional homicide victims'], ['robbery', 'Robberies'], ['theft', 'Thefts'],
  ['propertyCrime', 'Robberies + thefts'], ['injuries', 'Intentional injuries'], ['threats', 'Threats'],
  ['sexualAssault', 'Rapes'], ['drugs', 'Drug law offences'], ['roadDeaths', 'Road traffic death victims'],
]

const POLLUTANTS = [['pm2_5', 'PM2.5'], ['pm10', 'PM10'], ['nitrogen_dioxide', 'NO₂'], ['ozone', 'O₃'], ['sulphur_dioxide', 'SO₂']]

const row = (label, value, unit = '') => ({ label, value, unit })

/**
 * @returns [{ key, name, url, level, area, period, status, note, rows: [{ label, value, unit }] }]
 */
export function valuesBySource({ entity, model, detail, quakes, live = {} }) {
  const isCity = entity.type === 'city'
  const point = `${entity.lat.toFixed(3)}, ${entity.lon.toFixed(3)}`
  const groups = []

  // ---- SNIC (official crime statistics) ----
  const snic = entity.snic
  if (snic) {
    const y = snic.latestYear
    const span = `${y - 2}–${String(y).slice(2)}`
    groups.push({
      key: 'SNIC', name: SOURCES.SNIC.name, url: SOURCES.SNIC.url,
      level: snic.level === 'department' ? 'Department (partido)' : snic.level === 'city' ? 'City' : 'Province',
      area: snic.level === 'department' ? `${snic.name} (INDEC ${snic.code})` : snic.name,
      period: `${y} (+ ${span} average)`,
      status: /mirror/i.test(model.snicOrigin || '') ? 'Unofficial mirror copy' : 'Official download',
      rows: SNIC_ROWS.flatMap(([k, label]) => [
        row(`${label}, ${y}`, snic.counts?.[k], 'count'),
        row(`${label}, ${y}`, snic.latest[k], 'per 100k'),
        row(`${label}, ${span} average`, snic.avg3[k], 'per 100k'),
      ]).filter((r) => r.value != null),
      note: `Rates as published by SNIC, rounded to 2 decimals. Counts are exact.${model.snicOrigin ? ` Files: ${model.snicOrigin}.` : ''}`,
    })
  } else if (isCity) {
    groups.push({ key: 'SNIC', name: SOURCES.SNIC.name, url: SOURCES.SNIC.url, rows: [], note: `No SNIC department matched to ${entity.name}.` })
  }

  // ---- Numbeo (crowd-sourced) ----
  const nb = entity.numbeo
  if (isCity) {
    const rows = nb
      ? [
          ...NUMBEO_INDICES.filter(([k]) => isOwnValue(entity, k)).map(([k, label]) => row(label, entity.values[k])),
          ...(nb.safetyIndex != null ? [row('Safety index', nb.safetyIndex)] : []),
          ...SURVEY.filter(([k]) => nb.survey?.[k] != null).map(([k, label]) => row(label, nb.survey[k], '0–100')),
          ...(nb.contributors != null ? [row('Contributors', nb.contributors)] : []),
        ]
      : []
    groups.push({
      key: 'Numbeo', name: 'Numbeo', url: SOURCES.Numbeo.urlFor(entity, 'safety') || SOURCES.Numbeo.url,
      level: 'City', area: entity.name, period: nb?.fetchedAt || null,
      status: !nb ? null : nb.source === 'scraped' ? 'Downloaded from numbeo.com' : nb.source === 'snapshot' ? 'Approximate snapshot, not verified' : nb.source,
      rows,
      note: rows.length ? null : `No Numbeo data stored for ${entity.name}.`,
    })
  }

  // ---- Open-Meteo: climate (ERA5) ----
  const clim = detail?.climate
  if (clim) {
    groups.push({
      key: 'Open-Meteo ERA5 (live)', name: SOURCES['Open-Meteo ERA5 (live)'].name, url: SOURCES['Open-Meteo ERA5 (live)'].url,
      level: 'Point (≈ 25 km grid)', area: point, period: clim.period, status: 'Live',
      rows: [
        row('Mean temperature', clim.meanTemp, '°C'), row('Annual precipitation', clim.annualPrecip, 'mm'),
        row('Annual snowfall', clim.snowfall, 'cm'), row('Sunshine', clim.sunshine, 'h/yr'),
        row('Hottest day (mean of annual maxima)', clim.tempMaxAnnual, '°C'), row('Coldest night (mean of annual minima)', clim.tempMinAnnual, '°C'),
        row('Grid elevation', clim.elevation, 'm'), row('Climate comfort (MapStats model on ERA5)', clim.climateComfort, '/100'),
      ].filter((r) => r.value != null),
    })
  }

  // ---- Open-Meteo: air quality (CAMS) + UV ----
  const air = detail?.air
  if (air || entity.values.aqi != null) {
    const cur = air?.current || {}
    groups.push({
      key: 'Open-Meteo CAMS (live)', name: SOURCES['Open-Meteo CAMS (live)'].name, url: SOURCES['Open-Meteo CAMS (live)'].url,
      level: 'Point (≈ 10–40 km grid)', area: point, period: cur.time ? `now (${cur.time.replace('T', ' ')}) · last 92 days` : 'last 30–92 days', status: 'Live',
      rows: [
        row('European AQI, now', cur.european_aqi), row('US AQI, now', cur.us_aqi),
        row('European AQI, 30-day mean', entity.values.aqi),
        ...POLLUTANTS.map(([k, l]) => row(`${l}, now`, cur[k], 'µg/m³')),
        ...POLLUTANTS.map(([k, l]) => row(`${l}, 92-day mean`, air?.means?.[k], 'µg/m³')),
      ].filter((r) => r.value != null),
    })
  }
  const today = new Date().toISOString().slice(0, 10)
  const uvToday = detail?.uv?.find((d) => d.date === today)?.uv
  if (uvToday != null) {
    groups.push({
      key: 'Open-Meteo UV (live)', name: SOURCES['Open-Meteo UV (live)'].name, url: SOURCES['Open-Meteo UV (live)'].url,
      level: 'Point', area: point, period: today, status: 'Live', rows: [row('Maximum UV index, today', uvToday)],
    })
  }

  const uvy = live.uv?.[entity.id]
  if (uvy?.uvMean != null) {
    const s = SOURCES['Open-Meteo UV history (live)']
    groups.push({
      key: 'Open-Meteo UV history (live)', name: s.name, url: s.url, level: 'Point', area: point,
      period: String(new Date().getFullYear() - 1), status: 'Live',
      rows: [row('UV index, mean of daily maxima', uvy.uvMean), row('UV index, highest daily maximum', uvy.uvMax)].filter((r) => r.value != null),
    })
  }
  const fl = live.flood?.[entity.id]
  if (fl) {
    const s = SOURCES['Open-Meteo GloFAS (live)']
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
      key: 'USGS (live)', name: SOURCES['USGS (live)'].name, url: SOURCES['USGS (live)'].url,
      level: 'Radius 200 km', area: point, period: `1980–${new Date().getFullYear()}, M5+`, status: 'Live',
      rows: [
        row('Earthquakes M5+', quakes.near.length, 'count'),
        ...(quakes.strongest ? [row(`Strongest (${quakes.strongest.time})`, quakes.strongest.mag, 'M')] : []),
      ],
    })
  }

  // ---- Statistics only available for the whole province (cities) / the province's own figures ----
  const provRows = INDICATORS.filter((i) => i.source !== 'Numbeo' && i.source !== 'SNIC' && !i.live && i.id !== 'pop')
    .filter((i) => (isCity ? entity.inherited?.has(i.id) : entity.values[i.id] != null))
    .map((i) => ({ ...row(i.label, entity.values[i.id], i.unit), source: i.source }))
  if (provRows.length) {
    groups.push({
      key: 'province', name: isCity ? `Province-level statistics (${entity.provinceName})` : 'Provincial statistics',
      level: 'Province', area: isCity ? entity.provinceName : entity.name, status: 'Hand-entered approximations',
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
