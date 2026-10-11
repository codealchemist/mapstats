// Standards that define how good or bad a value is for people, per indicator. The user picks one per indicator
// (Weights panel); it scores every place the same way. An indicator with standards scores with them instead of
// its data anchors or domain (metrics.js scoreRange).
//
// Each standard scores a measure (`input`, an indicator id) through its band edges: `points` are [value, score]
// pairs, interpolated linearly and clamped at the ends. Bands are mapped to equal score steps, so each band
// boundary moves a place by the same amount.
//
// Scores use yearly means (last 365 days of hourly values). A mean says how a place usually is, not how bad its
// worst days are, so each air standard also has a daily limit (`daily`): the days whose daily mean exceeds it are
// counted, and a warning shows when they exceed what that standard itself allows in a year.

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
        // EU air-quality law allows a daily limit (PM10) to be exceeded at most 35 times a year (Directive 2008/50/EC).
        daily: { indicator: 'aqiPoorDays', limit: 60, allowed: 35, text: 'with poor air or worse (EEA index above 60)', basis: 'EU daily limits may be exceeded at most 35 days a year' },
      },
      {
        id: 'epa', short: 'US EPA', name: 'US Environmental Protection Agency · Air Quality Index',
        url: 'https://www.airnow.gov/aqi/aqi-basics/',
        input: 'usAqi', unit: 'US AQI',
        bands: [[50, 'Good'], [100, 'Moderate'], [150, 'Unhealthy for sensitive groups'], [200, 'Unhealthy'], [300, 'Very unhealthy'], [Infinity, 'Hazardous']],
        points: [[0, 100], [50, 80], [100, 60], [150, 40], [200, 20], [300, 0]],
        // The US 24-hour PM2.5 standard is met at the 98th percentile of daily values: about 7 days a year.
        daily: { indicator: 'usAqiUnhealthyDays', limit: 100, allowed: 7, text: 'unhealthy for sensitive groups or worse (US AQI above 100)', basis: 'the US 24-hour standard tolerates about 7 days a year (98th percentile)' },
      },
      {
        id: 'who', short: 'WHO', name: 'World Health Organization · Air quality guidelines 2021 (PM2.5)',
        url: 'https://www.who.int/publications/i/item/9789240034228',
        input: 'pm25', unit: 'µg/m³ PM2.5',
        // Guideline level, then interim targets 4 → 1 (annual means).
        bands: [[5, 'Meets the guideline'], [10, 'Interim target 4'], [15, 'Interim target 3'], [25, 'Interim target 2'], [35, 'Interim target 1'], [Infinity, 'Above all targets']],
        points: [[5, 100], [10, 75], [15, 50], [25, 25], [35, 0]],
        // WHO's 24-hour guideline (15 µg/m³) is the 99th percentile of daily means: 3–4 days a year above it.
        daily: { indicator: 'pm25HighDays', limit: 15, allowed: 3, text: 'above the WHO 24-hour PM2.5 guideline (15 µg/m³)', basis: 'the WHO 24-hour guideline tolerates 3–4 days a year (99th percentile)' },
      },
    ],
  },
  // Heat and cold stress: each day scores by the worst category it reached (its hottest hour's heat index, its
  // coldest hour's wind chill: src/lib/thermal.js), and the yearly mean of those day scores is the indicator's
  // value. These standards measure risk to health, not comfort preferences: a cool, still day is "no stress".
  // An option whose input is not a live indicator (metrics.js `live`) comes from a prefilled country dataset (UTCI:
  // src/providers/copernicus-utci), so places of countries without it have no value under that option.
  thermalStress: {
    default: 'nws',
    valueFromInput: true, // the indicator shows the selected standard's yearly score
    options: [
      {
        id: 'nws', short: 'US NWS', name: 'US National Weather Service · Heat Index and Wind Chill',
        url: 'https://www.weather.gov/safety/heat-index',
        input: 'thermalNws', unit: 'heat index (°C felt)',
        heat: { index: 'heatIndex', categories: [[26.7, 'Caution'], [32.2, 'Extreme caution'], [39.4, 'Danger'], [51.7, 'Extreme danger']] },
        bands: [[26.7, 'No caution'], [32.2, 'Caution'], [39.4, 'Extreme caution'], [51.7, 'Danger'], [Infinity, 'Extreme danger']],
        points: [[0, 0], [100, 100]],
        daily: [
          { indicator: 'heatDangerDays', limit: 39.4, allowed: 0, text: 'reaching the heat index "Danger" category (≥ 39.4 °C felt)', basis: 'heat illness likely with prolonged exposure or exertion' },
          { indicator: 'frostbiteDays', limit: -28, allowed: 0, text: 'with frostbite risk (wind chill ≤ −28 °C)', basis: 'exposed skin can freeze in 10–30 minutes' },
        ],
      },
      {
        id: 'eccc', short: 'Environment Canada', name: 'Environment and Climate Change Canada · Humidex and Wind Chill',
        url: 'https://www.canada.ca/en/environment-climate-change/services/climate-change/canadian-centre-climate-services/display-download/technical-documentation-humidex.html',
        input: 'thermalEccc', unit: 'humidex',
        heat: { index: 'humidex', categories: [[30, 'Some discomfort'], [40, 'Great discomfort'], [46, 'Dangerous']] },
        bands: [[29, 'Little or no discomfort'], [39, 'Some discomfort'], [45, 'Great discomfort, avoid exertion'], [Infinity, 'Dangerous']],
        points: [[0, 0], [100, 100]],
        daily: [
          { indicator: 'humidexDangerDays', limit: 46, allowed: 0, text: 'with a dangerous humidex (above 45)', basis: 'possible heat stroke' },
          { indicator: 'frostbiteDays', limit: -28, allowed: 0, text: 'with frostbite risk (wind chill ≤ −28 °C)', basis: 'exposed skin can freeze in 10–30 minutes' },
        ],
      },
      {
        // One index for heat and cold, from air temperature, humidity, wind and sun (mean radiant temperature, for a
        // person outdoors in the open). Copernicus publishes each day's highest and lowest UTCI (ERA5-HEAT), prefilled
        // yearly per country; the day scores by the stress categories those two reach. The cold side starts at
        // moderate cold stress: "slight cold stress" (0 to 9 °C) is reached on most cool nights and is discomfort,
        // not health risk, as for the other two standards (MapStats' choice, October 2026).
        id: 'utci', short: 'UTCI', name: 'Universal Thermal Climate Index (ISB) · Copernicus ERA5-HEAT',
        url: 'https://cds.climate.copernicus.eu/datasets/derived-utci-historical',
        input: 'thermalUtci', unit: 'UTCI (°C felt, outdoors in the sun)',
        heat: { categories: [[26, 'Moderate heat stress'], [32, 'Strong heat stress'], [38, 'Very strong heat stress'], [46, 'Extreme heat stress']] },
        cold: { categories: [[0, 'Moderate cold stress'], [-13, 'Strong cold stress'], [-27, 'Very strong cold stress'], [-40, 'Extreme cold stress']] },
        bands: [[-40, 'Extreme cold stress'], [-27, 'Very strong cold stress'], [-13, 'Strong cold stress'], [0, 'Moderate cold stress'], [9, 'Slight cold stress'], [26, 'No thermal stress'], [32, 'Moderate heat stress'], [38, 'Strong heat stress'], [46, 'Very strong heat stress'], [Infinity, 'Extreme heat stress']],
        points: [[0, 0], [100, 100]],
        note: 'Heat and cold from one index: no separate wind chill. Slight cold stress (0 to 9) doesn’t lower the score; the cold side starts at moderate. Days are UTC days. Prefilled yearly from Copernicus; countries without that data show no value under UTCI.',
        daily: [
          { indicator: 'utciHeatDays', limit: 38, allowed: 0, text: 'with very strong heat stress or worse (UTCI ≥ 38 °C)', basis: 'very strong heat stress: heat illness likely without shade, water and rest' },
          { indicator: 'utciColdDays', limit: -27, allowed: 0, text: 'with very strong cold stress or worse (UTCI ≤ −27 °C)', basis: 'very strong cold stress: frostbite and hypothermia risk outdoors' },
        ],
      },
    ],
    // Cold side of US NWS and Environment Canada: the 2001 North American wind chill index with Environment Canada's
    // risk categories (upper bounds; NWS publishes no general cold categories). UTCI has its own (`cold` on it).
    cold: { categories: [[-10, 'Moderate risk'], [-28, 'High risk (frostbite in 10–30 min)'], [-40, 'Very high risk'], [-48, 'Severe risk']] },
    note: 'Cold side for both: wind chill, with Environment Canada’s risk categories (moderate below −10, frostbite risk at −28, very high at −40, severe at −48).',
  },
  // UV exposure: one scale worldwide, the Global Solar UV Index (WHO, WMO, UNEP, ICNIRP), also used by the US EPA
  // and Australia's ARPANSA. Each day scores by the category its maximum UV index reaches; the yearly mean of day
  // scores is the value.
  uvRisk: {
    default: 'who',
    valueFromInput: true,
    options: [
      {
        id: 'who', short: 'WHO', name: 'WHO / WMO / UNEP / ICNIRP · Global Solar UV Index',
        url: 'https://www.who.int/publications/i/item/9241590076',
        input: 'uvScore', unit: 'daily maximum UV index',
        uv: { categories: [[3, 'Moderate'], [6, 'High'], [8, 'Very high'], [11, 'Extreme']] },
        bands: [[2, 'Low'], [5, 'Moderate'], [7, 'High'], [10, 'Very high'], [Infinity, 'Extreme']],
        points: [[0, 0], [100, 100]],
        daily: [
          { indicator: 'uvExtremeDays', limit: 11, allowed: 0, text: 'with extreme UV (index 11 or more)', basis: 'unprotected skin burns in minutes; avoid the midday sun' },
        ],
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
