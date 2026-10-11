// Standards that define how good or bad a value is for people, per indicator. The user picks one per indicator
// (Weights panel); it scores every place the same way. An indicator with standards scores with them instead of
// its data anchors or domain (metrics.js scoreRange).
//
// Each standard scores a measure (`input`, an indicator id) through its band edges: `points` are [value, score]
// pairs, interpolated linearly and clamped at the ends. Bands are mapped to equal score steps, so each band
// boundary moves a place by the same amount.
//
// Our air values are 30-day means of hourly values, while the standards' bands are defined for hourly to annual
// averages: a mean says how a place usually is, not how bad its worst days are.

export const STANDARDS = {
  aqi: {
    default: 'eea',
    options: [
      {
        id: 'eea', short: 'EEA', name: 'European Environment Agency · European Air Quality Index',
        url: 'https://airindex.eea.europa.eu/AQI/index.html',
        input: 'aqi', unit: 'EAQI',
        bands: [[20, 'Good'], [40, 'Fair'], [60, 'Moderate'], [80, 'Poor'], [100, 'Very poor'], [Infinity, 'Extremely poor']],
        points: [[0, 100], [20, 80], [40, 60], [60, 40], [80, 20], [100, 0]],
      },
      {
        id: 'epa', short: 'US EPA', name: 'US Environmental Protection Agency · Air Quality Index',
        url: 'https://www.airnow.gov/aqi/aqi-basics/',
        input: 'usAqi', unit: 'US AQI',
        bands: [[50, 'Good'], [100, 'Moderate'], [150, 'Unhealthy for sensitive groups'], [200, 'Unhealthy'], [300, 'Very unhealthy'], [Infinity, 'Hazardous']],
        points: [[0, 100], [50, 80], [100, 60], [150, 40], [200, 20], [300, 0]],
      },
      {
        id: 'who', short: 'WHO', name: 'World Health Organization · Air quality guidelines 2021 (PM2.5)',
        url: 'https://www.who.int/publications/i/item/9789240034228',
        input: 'pm25', unit: 'µg/m³ PM2.5',
        // Guideline level, then interim targets 4 → 1 (annual means).
        bands: [[5, 'Meets the guideline'], [10, 'Interim target 4'], [15, 'Interim target 3'], [25, 'Interim target 2'], [35, 'Interim target 1'], [Infinity, 'Above all targets']],
        points: [[5, 100], [10, 75], [15, 50], [25, 25], [35, 0]],
      },
    ],
  },
}

/** Every indicator's default standard: { indicatorId: standardId }. */
export const DEFAULT_STANDARDS = Object.fromEntries(Object.entries(STANDARDS).map(([id, s]) => [id, s.default]))

/** The standard scoring an indicator under a selection (falls back to the default), or null when it has none. */
export function standardFor(indicatorId, selection = DEFAULT_STANDARDS) {
  const s = STANDARDS[indicatorId]
  if (!s) return null
  return s.options.find((o) => o.id === selection?.[indicatorId]) || s.options.find((o) => o.id === s.default)
}

/** 0–100 score of a value under a standard (piecewise linear on its points, clamped). */
export function standardScore(std, v) {
  if (v == null) return null
  const p = std.points
  if (v <= p[0][0]) return p[0][1]
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i]
    if (v <= x1) return y0 + ((v - x0) / (x1 - x0)) * (y1 - y0)
  }
  return p.at(-1)[1]
}

/** The band a value falls in under a standard ("Fair", "Interim target 2"…). */
export const bandOf = (std, v) => (v == null ? null : std.bands.find(([max]) => v <= max)?.[1] ?? null)
