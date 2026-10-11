// Indicator catalogue. Scored indicators are normalised to 0–100 between two fixed values (scoreRange), the
// same for every country, so scores stay comparable and don't shift when one province's data changes:
//  - anchors.json (npm run anchors): the 2nd and 98th percentile of region values across all countries with data
//  - otherwise `domain`, set by hand (live indicators: climate, air, earthquakes)
// The range only turns values into scores: everything that shows or compares an indicator uses real values.
//
import ANCHORS from './anchors.json' with { type: 'json' }

// better: 'high' | 'low' | null (null = descriptive only, not scored)
// The provider behind each indicator is declared by the provider (`provides`), see src/core/providers.js.

export const CATEGORIES = [
  { id: 'safety', label: 'Safety', icon: 'ShieldAlert', weight: 25 },
  { id: 'hazards', label: 'Natural risks', icon: 'Flame', weight: 15 },
  { id: 'environment', label: 'Environment', icon: 'Wind', weight: 15 },
  { id: 'services', label: 'Services', icon: 'HeartPulse', weight: 20 },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'Bus', weight: 10 },
  { id: 'economy', label: 'Economy', icon: 'Wallet', weight: 15 },
]

export const DEFAULT_WEIGHTS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.weight]))

export const INDICATORS = [
  // Safety
  // SNIC rates are 3-year averages; domains span roughly the 5th–95th percentile of departments (2024).
  { id: 'homicide', label: 'Homicide rate (3-yr avg)', unit: '/100k', category: 'safety', better: 'low', domain: [0, 8], digits: 1 },
  { id: 'propertyCrime', label: 'Robberies + thefts (3-yr avg)', unit: '/100k', category: 'safety', better: 'low', domain: [350, 3300], digits: 0 },
  { id: 'roadDeaths', label: 'Road deaths (3-yr avg)', unit: '/100k', category: 'safety', better: 'low', domain: [0, 30], digits: 1 },
  // Natural risks
  { id: 'seismicZone', label: 'Seismic zone', unit: '/4', category: 'hazards', better: null, digits: 0 },
  // GEM seismic hazard (a complete dataset): scored on data anchors like the other statistics.
  { id: 'pga475', label: 'Seismic hazard (PGA, 10 % in 50 years)', unit: 'g', category: 'hazards', better: 'low', domain: [0, 0.5], digits: 2 },
  { id: 'pga475Max', label: 'Seismic hazard, highest in the region (GEM)', unit: 'g', category: 'hazards', better: null, digits: 2, ramp: 'red' },
  { id: 'quakes', label: 'Earthquakes M5+ ≤200 km', unit: '', category: 'hazards', better: null, digits: 0, live: true },
  { id: 'fireRisk', label: 'Wildfire exposure', unit: '/5', category: 'hazards', better: 'low', domain: [1, 5], digits: 0 },
  { id: 'floodRisk', label: 'Flood exposure', unit: '/5', category: 'hazards', better: 'low', domain: [1, 5], digits: 0 },
  // Environment
  { id: 'aqi', label: 'Air quality (EAQI, yearly mean)', unit: '', category: 'environment', better: 'low', domain: [10, 70], digits: 0, live: true },
  // Descriptive: the measures the US EPA and WHO air-quality standards score (src/data/standards.js).
  { id: 'usAqi', label: 'US AQI (yearly mean)', unit: '', category: 'environment', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'pm25', label: 'PM2.5 (yearly mean)', unit: 'µg/m³', category: 'environment', better: null, digits: 1, live: true, ramp: 'red' },
  // Air extremes over the last year (data/standards.js daily limits): warnings use them, scores don't.
  { id: 'aqiRecent', label: 'Air quality (EAQI, last 30 days)', unit: '', category: 'environment', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'pm25WorstDay', label: 'PM2.5, worst day', unit: 'µg/m³', category: 'environment', better: null, digits: 1, live: true, ramp: 'red' },
  { id: 'aqiPoorDays', label: 'Days with poor air (EEA)', unit: 'days', category: 'environment', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'usAqiUnhealthyDays', label: 'Days unhealthy for sensitive groups (US EPA)', unit: 'days', category: 'environment', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'pm25HighDays', label: 'Days over WHO 24-h PM2.5 guideline', unit: 'days', category: 'environment', better: null, digits: 0, live: true, ramp: 'red' },
  // Scored by the selected thermal standard (data/standards.js): the yearly mean of daily heat/cold stress scores.
  { id: 'thermalStress', label: 'Heat and cold stress (yearly)', unit: '/100', category: 'environment', better: 'high', domain: [0, 100], digits: 0, live: true },
  { id: 'thermalNws', label: 'Heat and cold stress (US NWS)', unit: '/100', category: 'environment', better: null, digits: 0, live: true, ramp: 'blue' },
  { id: 'thermalEccc', label: 'Heat and cold stress (Environment Canada)', unit: '/100', category: 'environment', better: null, digits: 0, live: true, ramp: 'blue' },
  { id: 'heatDangerDays', label: 'Days in heat index Danger (US NWS)', unit: 'days', category: 'environment', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'humidexDangerDays', label: 'Days with dangerous humidex (Environment Canada)', unit: 'days', category: 'environment', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'frostbiteDays', label: 'Days with frostbite risk (wind chill ≤ −28 °C)', unit: 'days', category: 'environment', better: null, digits: 0, live: true, ramp: 'blue' },
  // UTCI (Copernicus ERA5-HEAT), prefilled per country: the score under the UTCI standard and its warning counts.
  { id: 'thermalUtci', label: 'Heat and cold stress (UTCI)', unit: '/100', category: 'environment', better: null, digits: 0, ramp: 'blue' },
  { id: 'utciHeatDays', label: 'Days with very strong heat stress (UTCI ≥ 38 °C)', unit: 'days', category: 'environment', better: null, digits: 0, ramp: 'red' },
  { id: 'utciColdDays', label: 'Days with very strong cold stress (UTCI ≤ −27 °C)', unit: 'days', category: 'environment', better: null, digits: 0, ramp: 'blue' },
  // Our own comfort model (16–24 °C ideal…): shown, no longer scored (health standards above score instead).
  { id: 'climateComfort', label: 'Climate comfort (MapStats model)', unit: '/100', category: 'climate', better: null, digits: 0, live: true },
  // Services
  { id: 'doctors', label: 'Physicians', unit: '/1k', category: 'services', better: 'high', domain: [1.5, 6], digits: 1 },
  { id: 'water', label: 'Running water', unit: '%', category: 'services', better: 'high', domain: [70, 100], digits: 0 },
  { id: 'sewer', label: 'Sewer network', unit: '%', category: 'services', better: 'high', domain: [20, 100], digits: 0 },
  { id: 'internet', label: 'Fixed internet', unit: '/100 hh', category: 'services', better: 'high', domain: [25, 100], digits: 0 },
  // Infrastructure & transport
  { id: 'roadPaved', label: 'Paved road network', unit: '%', category: 'infrastructure', better: 'high', domain: [30, 100], digits: 0 },
  { id: 'transit', label: 'Public transport', unit: '/100', category: 'infrastructure', better: 'high', domain: [20, 100], digits: 0 },
  // Economy & wellbeing
  { id: 'poverty', label: 'Poverty', unit: '%', category: 'economy', better: 'low', domain: [15, 60], digits: 0 },
  { id: 'unemployment', label: 'Unemployment', unit: '%', category: 'economy', better: 'low', domain: [2, 10], digits: 1 },
  { id: 'lifeExp', label: 'Life expectancy', unit: 'yrs', category: 'economy', better: 'high', domain: [74, 79], digits: 1 },
  { id: 'hdi', label: 'Human development', unit: '', category: 'economy', better: 'high', domain: [0.75, 0.9], digits: 3 },
  // Descriptive (not scored)
  { id: 'meanTemp', label: 'Mean temperature', unit: '°C', category: 'climate', better: null, digits: 1, live: true },
  { id: 'annualPrecip', label: 'Annual precipitation', unit: 'mm', category: 'climate', better: null, digits: 0, live: true , ramp: 'blue' },
  { id: 'snowfall', label: 'Annual snowfall', unit: 'cm', category: 'climate', better: null, digits: 0, live: true , ramp: 'violet' },
  { id: 'sunshine', label: 'Sunshine', unit: 'h/yr', category: 'climate', better: null, digits: 0, live: true },
  { id: 'tempMaxAnnual', label: 'Hottest day (annual max)', unit: '°C', category: 'climate', better: null, digits: 1, live: true , ramp: 'red' },
  { id: 'tempMinAnnual', label: 'Coldest night (annual min)', unit: '°C', category: 'climate', better: null, digits: 1, live: true , ramp: 'blue-rev' },
  // Climate extremes per year (ERA5, last full year; 10-year means in reports): warnings use them, scores don't.
  { id: 'hotDays', label: 'Very hot days (≥ 35 °C)', unit: 'days', category: 'climate', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'tropicalNights', label: 'Tropical nights (min ≥ 20 °C)', unit: 'days', category: 'climate', better: null, digits: 0, live: true, ramp: 'orange' },
  { id: 'frostDays', label: 'Frost days (min < 0 °C)', unit: 'days', category: 'climate', better: null, digits: 0, live: true, ramp: 'blue' },
  { id: 'heavyRainDays', label: 'Very heavy rain days (≥ 20 mm)', unit: 'days', category: 'climate', better: null, digits: 0, live: true, ramp: 'blue' },
  { id: 'drySpell', label: 'Longest dry spell (< 1 mm)', unit: 'days', category: 'climate', better: null, digits: 0, live: true, ramp: 'orange' },
  { id: 'uvMean', label: 'UV index (mean daily max)', unit: '', category: 'climate', better: null, digits: 1, live: true , ramp: 'orange' },
  // Scored by the Global Solar UV Index (data/standards.js): the yearly mean of daily scores by UV category.
  { id: 'uvRisk', label: 'UV exposure (yearly)', unit: '/100', category: 'environment', better: 'high', domain: [0, 100], digits: 0, live: true },
  { id: 'uvScore', label: 'UV exposure score (WHO)', unit: '/100', category: 'climate', better: null, digits: 0, live: true, ramp: 'orange' },
  { id: 'uvVeryHighDays', label: 'Days with very high UV or worse (index ≥ 8)', unit: 'days', category: 'climate', better: null, digits: 0, live: true, ramp: 'orange' },
  { id: 'uvExtremeDays', label: 'Days with extreme UV (index ≥ 11)', unit: 'days', category: 'climate', better: null, digits: 0, live: true, ramp: 'red' },
  { id: 'floodWatch', label: 'River flood watch (30-day peak ÷ usual high water)', unit: '×', category: 'climate', better: null, digits: 2, live: true , ramp: 'red' },
  { id: 'floodPeakPast', label: 'Past-year river peak ÷ usual high water', unit: '×', category: 'climate', better: null, digits: 2, live: true , ramp: 'red' },
  { id: 'elevation', label: 'Elevation', unit: 'm', category: 'climate', better: null, digits: 0, live: true },
  { id: 'pop', label: 'Population', unit: '', category: 'economy', better: null, digits: 0 },
]

export const indicatorById = Object.fromEntries(INDICATORS.map((i) => [i.id, i]))

/** Values scoring 0 and 100 (in value order: [low, high]) and where they come from. */
export function scoreRange(id) {
  const a = ANCHORS.indicators[id]
  if (a) return { range: [a.lo, a.hi], from: 'anchors', n: a.n }
  const d = indicatorById[id]?.domain
  return d ? { range: d, from: 'domain' } : null
}

export const anchorsInfo = { method: ANCHORS.method, countries: ANCHORS.countries }

// Map layer menu. `score:*` entries are category scores, others are raw indicators.
export const MAP_METRICS = [
  { id: 'score', label: 'MapStats score', group: 'Ranking', icon: 'Trophy', kind: 'score' },
  ...CATEGORIES.map((c) => ({ id: `cat:${c.id}`, label: c.label, group: 'Ranking', icon: c.icon, kind: 'score' })),
  { id: 'homicide', group: 'Safety', icon: 'ShieldAlert' },
  { id: 'propertyCrime', group: 'Safety', icon: 'ShieldAlert' },
  { id: 'roadDeaths', group: 'Safety', icon: 'ShieldAlert' },
  { id: 'aqi', group: 'Environment', icon: 'Wind' },
  { id: 'pm25', group: 'Environment', icon: 'Wind' },
  { id: 'pm25HighDays', group: 'Environment', icon: 'Wind' },
  { id: 'thermalStress', group: 'Environment', icon: 'Thermometer' },
  { id: 'heatDangerDays', group: 'Environment', icon: 'Thermometer' },
  { id: 'frostbiteDays', group: 'Environment', icon: 'Snowflake' },
  { id: 'climateComfort', group: 'Weather', icon: 'Sun' },
  { id: 'meanTemp', group: 'Weather', icon: 'Thermometer' },
  { id: 'annualPrecip', group: 'Weather', icon: 'CloudRain' },
  { id: 'snowfall', group: 'Weather', icon: 'Snowflake' },
  { id: 'sunshine', group: 'Weather', icon: 'Sun' },
  { id: 'tempMaxAnnual', group: 'Weather', icon: 'Thermometer' },
  { id: 'tempMinAnnual', group: 'Weather', icon: 'Thermometer' },
  { id: 'uvMean', group: 'Weather', icon: 'Sun' },
  { id: 'uvRisk', group: 'Environment', icon: 'Sun' },
  { id: 'uvExtremeDays', group: 'Weather', icon: 'Sun' },
  { id: 'hotDays', group: 'Weather', icon: 'Thermometer' },
  { id: 'tropicalNights', group: 'Weather', icon: 'Thermometer' },
  { id: 'frostDays', group: 'Weather', icon: 'Snowflake' },
  { id: 'heavyRainDays', group: 'Terrain & risks', icon: 'CloudRain' },
  { id: 'drySpell', group: 'Terrain & risks', icon: 'Sun' },
  { id: 'elevation', group: 'Terrain & risks', icon: 'Mountain' },
  { id: 'pga475', group: 'Terrain & risks', icon: 'Activity' },
  { id: 'quakes', group: 'Terrain & risks', icon: 'Activity' },
  { id: 'seismicZone', group: 'Terrain & risks', icon: 'Activity' },
  { id: 'fireRisk', group: 'Terrain & risks', icon: 'Flame' },
  { id: 'floodRisk', group: 'Terrain & risks', icon: 'Droplets' },
  { id: 'floodWatch', group: 'Terrain & risks', icon: 'Waves' },
  { id: 'floodPeakPast', group: 'Terrain & risks', icon: 'Waves' },
  { id: 'doctors', group: 'Services', icon: 'HeartPulse' },
  { id: 'internet', group: 'Services', icon: 'Globe' },
  { id: 'sewer', group: 'Services', icon: 'Droplets' },
  { id: 'transit', group: 'Services', icon: 'Bus' },
  { id: 'poverty', group: 'Economy', icon: 'Wallet' },
  { id: 'unemployment', group: 'Economy', icon: 'Wallet' },
  { id: 'pop', group: 'Economy', icon: 'Building2' },
].map((m) => (m.kind ? m : { ...m, label: indicatorById[m.id].label, kind: 'indicator' }))

export const metricById = Object.fromEntries(MAP_METRICS.map((m) => [m.id, m]))
