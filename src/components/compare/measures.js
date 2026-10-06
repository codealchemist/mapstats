// Measures available in the comparison's focus chart. Each builds a Chart.js config for all
// selected places at once; colour always follows the place's slot.
// places: [{ e: entity, i: slot index, d: detail { climate, air, uv }, flood }]
import { CATEGORIES, INDICATORS } from '../../data/metrics.js'
import { SURVEY } from '../../data/numbeoSurvey.js'
import { baseOptions, barStyle, lineStyle } from '../charts/theme.js'
import { MONTHS } from '../../lib/format.js'
import { isOwnValue } from '../../lib/scoring.js'

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
const placeLabel = (e) => e.name

// One bar per place (+ country average in the de-emphasis gray). Province fallbacks are labelled.
// Horizontal, so place names sit on the category axis at full length, even on phones.
function barPerPlace({ places, tk, national, value, unit, nationalValue, inheritedKey }) {
  const labels = [...places.map(({ e }) => placeLabel(e) + (inheritedKey && !isOwnValue(e, inheritedKey) && e.values[inheritedKey] != null ? ' (prov.)' : '')), 'Country average']
  const data = [...places.map(({ e, d, flood }) => r1(value(e, d, flood))), r1(nationalValue ? nationalValue(national) : null)]
  const colors = [...places.map(({ i }) => tk.series[i]), tk.de]
  return {
    type: 'bar',
    data: { labels, datasets: [{ label: unit || 'value', data, ...barStyle(colors[0]), backgroundColor: colors, maxBarThickness: 64 }] },
    options: baseOptions(tk, { yTitle: unit, horizontal: true }),
  }
}

function linePerPlace({ places, tk, labels, series, yTitle, zero = false, pointRadius = 0 }) {
  const opts = baseOptions(tk, { legend: true, yTitle })
  if (!zero) opts.scales.y.beginAtZero = false
  return {
    type: 'line',
    data: { labels, datasets: places.map((p) => { const s = series(p); return s && { label: placeLabel(p.e), data: s, ...lineStyle(tk.series[p.i]), pointRadius } }).filter(Boolean) },
    options: opts,
  }
}

function groupedBars({ places, tk, labels, series, yTitle, horizontal = false, max }) {
  return {
    type: 'bar',
    data: { labels, datasets: places.map((p) => { const s = series(p); return s && { label: placeLabel(p.e), data: s, ...barStyle(tk.series[p.i]) } }).filter(Boolean) },
    options: baseOptions(tk, { legend: true, yTitle, horizontal, suggestedMax: max }),
  }
}

const monthly = (field, label, unit, kind = 'line') => ({
  id: `m:${field}`, group: 'Climate by month (10-year normals)', label, unit,
  available: (ps) => ps.some((p) => p.d.climate),
  build: ({ places, tk }) => (kind === 'line'
    ? linePerPlace({ places, tk, labels: MONTHS, yTitle: unit, series: (p) => p.d.climate?.monthly.map((m) => m[field]) })
    : groupedBars({ places, tk, labels: MONTHS, yTitle: unit, series: (p) => p.d.climate?.monthly.map((m) => m[field]) })),
})

const snicTrend = (metric, label) => ({
  id: `snic:${metric}`, group: 'Crime trends (SNIC)', label, unit: 'per 100,000',
  available: (ps) => ps.some((p) => p.e.snic),
  build: ({ places, tk, national }) => linePerPlace({
    places, tk, labels: national.snic?.years || [], yTitle: 'per 100,000', zero: true, pointRadius: 3,
    series: (p) => p.e.snic?.series[metric],
  }),
})

export function buildMeasures() {
  const list = [
    {
      id: 'score', group: 'Scores', label: 'MapStats score', unit: '/100',
      available: () => true,
      build: ({ places, tk, national }) => barPerPlace({ places, tk, national, value: (e) => e.score, nationalValue: (n) => n.score, unit: '0–100' }),
    },
    {
      id: 'categories', group: 'Scores', label: 'Score by category', unit: '/100',
      available: () => true,
      build: ({ places, tk }) => groupedBars({ places, tk, labels: CATEGORIES.map((c) => c.label), series: (p) => CATEGORIES.map((c) => r1(p.e.categories[c.id])), horizontal: true, max: 100 }),
    },
    snicTrend('homicide', 'Homicide rate by year'),
    snicTrend('propertyCrime', 'Robberies + thefts by year'),
    snicTrend('roadDeaths', 'Road deaths by year'),
    {
      id: 'survey', group: 'Crime survey (Numbeo)', label: 'Crime perception survey', unit: '0–100',
      available: (ps) => ps.some((p) => p.e.numbeo?.survey),
      build: ({ places, tk }) => {
        const keys = SURVEY.filter(([k]) => places.some((p) => p.e.numbeo?.survey?.[k] != null))
        return groupedBars({ places, tk, labels: keys.map(([, l]) => l), horizontal: true, max: 100, series: (p) => p.e.numbeo?.survey && keys.map(([k]) => p.e.numbeo.survey[k] ?? null) })
      },
    },
    monthly('tmax', 'Average daily maximum', '°C'),
    monthly('tmin', 'Average daily minimum', '°C'),
    monthly('precip', 'Precipitation', 'mm', 'bar'),
    monthly('snow', 'Snowfall', 'cm', 'bar'),
    monthly('sunHours', 'Sunshine', 'hours / day', 'bar'),
    monthly('wetDays', 'Rainy days (≥ 1 mm)', 'days', 'bar'),
    monthly('comfort', 'Climate comfort', '0–100'),
    {
      id: 'aqi', group: 'Daily series', label: 'Air quality, last 3 months', unit: 'EAQI',
      available: (ps) => ps.some((p) => p.d.air),
      build: ({ places, tk }) => {
        const dates = [...new Set(places.flatMap((p) => p.d.air?.daily.map((x) => x.date) || []))].sort()
        return linePerPlace({ places, tk, labels: dates.map((x) => x.slice(5)), yTitle: 'EAQI (lower is better)', zero: true, series: (p) => p.d.air && dates.map((dt) => p.d.air.daily.find((x) => x.date === dt)?.aqi ?? null) })
      },
    },
    {
      id: 'uv', group: 'Daily series', label: 'UV index, last 3 months + forecast', unit: 'UV',
      available: (ps) => ps.some((p) => p.d.uv),
      build: ({ places, tk }) => {
        const dates = [...new Set(places.flatMap((p) => p.d.uv?.map((x) => x.date) || []))].sort()
        return linePerPlace({ places, tk, labels: dates.map((x) => x.slice(5)), yTitle: 'Max UV index', zero: true, series: (p) => p.d.uv && dates.map((dt) => p.d.uv.find((x) => x.date === dt)?.uv ?? null) })
      },
    },
    {
      id: 'pollutants', group: 'Daily series', label: 'Pollutants (92-day mean)', unit: 'µg/m³',
      available: (ps) => ps.some((p) => p.d.air),
      build: ({ places, tk }) => {
        const keys = [['pm2_5', 'PM2.5'], ['pm10', 'PM10'], ['nitrogen_dioxide', 'NO₂'], ['ozone', 'O₃'], ['sulphur_dioxide', 'SO₂']]
        return groupedBars({ places, tk, labels: keys.map(([, l]) => l), yTitle: 'µg/m³', series: (p) => p.d.air && keys.map(([k]) => p.d.air.means[k]) })
      },
    },
    {
      id: 'flood', group: 'Natural risks', label: 'River flood watch', unit: '× usual high water',
      available: (ps) => ps.some((p) => p.flood?.river),
      build: ({ places, tk, national }) => barPerPlace({ places, tk, national, value: (e, d, f) => (f?.river ? f.floodWatch : null), unit: '× usual high water' }),
    },
  ]
  // Every indicator as a one-bar-per-place chart (province fallbacks labelled "prov.").
  for (const ind of INDICATORS) {
    list.push({
      id: `ind:${ind.id}`, group: `Indicators · ${CATEGORIES.find((c) => c.id === ind.category)?.label || 'Climate & context'}`,
      label: ind.label, unit: ind.unit, indicator: ind,
      available: (ps) => ps.some((p) => p.e.values[ind.id] != null),
      build: ({ places, tk, national }) => barPerPlace({ places, tk, national, value: (e) => e.values[ind.id], nationalValue: (n) => n.values[ind.id], unit: ind.unit || ind.label, inheritedKey: ind.id }),
    })
  }
  return list
}
