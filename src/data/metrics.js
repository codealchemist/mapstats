// Indicator catalogue. Every indicator is normalised to 0–100 against a fixed
// domain (not relative to the current country), so scores stay comparable
// across countries and don't shift when one province's data changes.
//
// better: 'high' | 'low' | null (null = descriptive only, not scored)

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
  { id: 'crimeIndex', label: 'Crime index', unit: '', category: 'safety', better: 'low', domain: [20, 80], source: 'Numbeo', digits: 1 },
  // SNIC rates are 3-year averages; domains span roughly the 5th–95th percentile of departments (2024).
  { id: 'homicide', label: 'Homicide rate (3-yr avg)', unit: '/100k', category: 'safety', better: 'low', domain: [0, 8], source: 'SNIC', digits: 1 },
  { id: 'propertyCrime', label: 'Robberies + thefts (3-yr avg)', unit: '/100k', category: 'safety', better: 'low', domain: [350, 3300], source: 'SNIC', digits: 0 },
  { id: 'roadDeaths', label: 'Road deaths (3-yr avg)', unit: '/100k', category: 'safety', better: 'low', domain: [0, 30], source: 'SNIC', digits: 1 },
  // Natural risks
  { id: 'seismicZone', label: 'Seismic zone', unit: '/4', category: 'hazards', better: 'low', domain: [0, 4], source: 'INPRES', digits: 0 },
  { id: 'quakes', label: 'Earthquakes M5+ ≤200 km', unit: '', category: 'hazards', better: 'low', domain: [0, 120], source: 'USGS (live)', digits: 0, live: true },
  { id: 'fireRisk', label: 'Wildfire exposure', unit: '/5', category: 'hazards', better: 'low', domain: [1, 5], source: 'SNMF', digits: 0 },
  { id: 'floodRisk', label: 'Flood exposure', unit: '/5', category: 'hazards', better: 'low', domain: [1, 5], source: 'INA', digits: 0 },
  // Environment
  { id: 'aqi', label: 'Air quality (EAQI, 30-day)', unit: '', category: 'environment', better: 'low', domain: [10, 70], source: 'Open-Meteo CAMS (live)', digits: 0, live: true },
  { id: 'pollutionIndex', label: 'Pollution index', unit: '', category: 'environment', better: 'low', domain: [20, 80], source: 'Numbeo', digits: 1 },
  { id: 'climateComfort', label: 'Climate comfort', unit: '/100', category: 'environment', better: 'high', domain: [20, 90], source: 'Open-Meteo ERA5 (live)', digits: 0, live: true },
  // Services
  { id: 'healthcareIndex', label: 'Healthcare index', unit: '', category: 'services', better: 'high', domain: [40, 80], source: 'Numbeo', digits: 1 },
  { id: 'doctors', label: 'Physicians', unit: '/1k', category: 'services', better: 'high', domain: [1.5, 6], source: 'REFEPS', digits: 1 },
  { id: 'water', label: 'Running water', unit: '%', category: 'services', better: 'high', domain: [70, 100], source: 'Censo 2022', digits: 0 },
  { id: 'sewer', label: 'Sewer network', unit: '%', category: 'services', better: 'high', domain: [20, 100], source: 'Censo 2022', digits: 0 },
  { id: 'internet', label: 'Fixed internet', unit: '/100 hh', category: 'services', better: 'high', domain: [25, 100], source: 'ENACOM', digits: 0 },
  // Infrastructure & transport
  { id: 'roadPaved', label: 'Paved road network', unit: '%', category: 'infrastructure', better: 'high', domain: [30, 100], source: 'DNV', digits: 0 },
  { id: 'transit', label: 'Public transport', unit: '/100', category: 'infrastructure', better: 'high', domain: [20, 100], source: 'MapStats est.', digits: 0 },
  { id: 'trafficIndex', label: 'Commute time index', unit: '', category: 'infrastructure', better: 'low', domain: [20, 50], source: 'Numbeo', digits: 0 },
  // Economy & wellbeing
  { id: 'poverty', label: 'Poverty', unit: '%', category: 'economy', better: 'low', domain: [15, 60], source: 'EPH', digits: 0 },
  { id: 'unemployment', label: 'Unemployment', unit: '%', category: 'economy', better: 'low', domain: [2, 10], source: 'EPH', digits: 1 },
  { id: 'purchasingPower', label: 'Purchasing power', unit: '', category: 'economy', better: 'high', domain: [20, 60], source: 'Numbeo', digits: 0 },
  { id: 'lifeExp', label: 'Life expectancy', unit: 'yrs', category: 'economy', better: 'high', domain: [74, 79], source: 'INDEC', digits: 1 },
  { id: 'hdi', label: 'Human development', unit: '', category: 'economy', better: 'high', domain: [0.75, 0.9], source: 'PNUD', digits: 3 },
  // Descriptive (not scored)
  { id: 'meanTemp', label: 'Mean temperature', unit: '°C', category: 'climate', better: null, source: 'Open-Meteo ERA5 (live)', digits: 1, live: true },
  { id: 'annualPrecip', label: 'Annual precipitation', unit: 'mm', category: 'climate', better: null, source: 'Open-Meteo ERA5 (live)', digits: 0, live: true , ramp: 'blue' },
  { id: 'snowfall', label: 'Annual snowfall', unit: 'cm', category: 'climate', better: null, source: 'Open-Meteo ERA5 (live)', digits: 0, live: true , ramp: 'violet' },
  { id: 'sunshine', label: 'Sunshine', unit: 'h/yr', category: 'climate', better: null, source: 'Open-Meteo ERA5 (live)', digits: 0, live: true },
  { id: 'tempMaxAnnual', label: 'Hottest day (annual max)', unit: '°C', category: 'climate', better: null, source: 'Open-Meteo ERA5 (live)', digits: 1, live: true , ramp: 'red' },
  { id: 'tempMinAnnual', label: 'Coldest night (annual min)', unit: '°C', category: 'climate', better: null, source: 'Open-Meteo ERA5 (live)', digits: 1, live: true , ramp: 'blue-rev' },
  { id: 'uvMean', label: 'UV index (mean daily max)', unit: '', category: 'climate', better: null, source: 'Open-Meteo UV history (live)', digits: 1, live: true , ramp: 'orange' },
  { id: 'floodWatch', label: 'River flood watch (30-day peak ÷ usual high water)', unit: '×', category: 'climate', better: null, source: 'Open-Meteo GloFAS (live)', digits: 2, live: true , ramp: 'red' },
  { id: 'floodPeakPast', label: 'Past-year river peak ÷ usual high water', unit: '×', category: 'climate', better: null, source: 'Open-Meteo GloFAS (live)', digits: 2, live: true , ramp: 'red' },
  { id: 'elevation', label: 'Elevation', unit: 'm', category: 'climate', better: null, source: 'Open-Meteo DEM (live)', digits: 0, live: true },
  { id: 'costOfLiving', label: 'Cost of living', unit: '', category: 'economy', better: null, source: 'Numbeo', digits: 0 },
  { id: 'qualityOfLife', label: 'Numbeo quality of life', unit: '', category: 'economy', better: null, source: 'Numbeo', digits: 0 },
  { id: 'pop', label: 'Population', unit: '', category: 'economy', better: null, source: 'Censo / Natural Earth', digits: 0 },
]

export const indicatorById = Object.fromEntries(INDICATORS.map((i) => [i.id, i]))

// Map layer menu. `score:*` entries are category scores, others are raw indicators.
export const MAP_METRICS = [
  { id: 'score', label: 'MapStats score', group: 'Ranking', icon: 'Trophy', kind: 'score' },
  ...CATEGORIES.map((c) => ({ id: `cat:${c.id}`, label: c.label, group: 'Ranking', icon: c.icon, kind: 'score' })),
  { id: 'crimeIndex', group: 'Safety', icon: 'ShieldAlert' },
  { id: 'homicide', group: 'Safety', icon: 'ShieldAlert' },
  { id: 'propertyCrime', group: 'Safety', icon: 'ShieldAlert' },
  { id: 'roadDeaths', group: 'Safety', icon: 'ShieldAlert' },
  { id: 'aqi', group: 'Environment', icon: 'Wind' },
  { id: 'climateComfort', group: 'Environment', icon: 'Sun' },
  { id: 'meanTemp', group: 'Weather', icon: 'Thermometer' },
  { id: 'annualPrecip', group: 'Weather', icon: 'CloudRain' },
  { id: 'snowfall', group: 'Weather', icon: 'Snowflake' },
  { id: 'sunshine', group: 'Weather', icon: 'Sun' },
  { id: 'tempMaxAnnual', group: 'Weather', icon: 'Thermometer' },
  { id: 'tempMinAnnual', group: 'Weather', icon: 'Thermometer' },
  { id: 'uvMean', group: 'Weather', icon: 'Sun' },
  { id: 'elevation', group: 'Terrain & risks', icon: 'Mountain' },
  { id: 'quakes', group: 'Terrain & risks', icon: 'Activity' },
  { id: 'seismicZone', group: 'Terrain & risks', icon: 'Activity' },
  { id: 'fireRisk', group: 'Terrain & risks', icon: 'Flame' },
  { id: 'floodRisk', group: 'Terrain & risks', icon: 'Droplets' },
  { id: 'floodWatch', group: 'Terrain & risks', icon: 'Waves' },
  { id: 'floodPeakPast', group: 'Terrain & risks', icon: 'Waves' },
  { id: 'healthcareIndex', group: 'Services', icon: 'HeartPulse' },
  { id: 'doctors', group: 'Services', icon: 'HeartPulse' },
  { id: 'internet', group: 'Services', icon: 'Globe' },
  { id: 'sewer', group: 'Services', icon: 'Droplets' },
  { id: 'transit', group: 'Services', icon: 'Bus' },
  { id: 'poverty', group: 'Economy', icon: 'Wallet' },
  { id: 'unemployment', group: 'Economy', icon: 'Wallet' },
  { id: 'costOfLiving', group: 'Economy', icon: 'Wallet' },
  { id: 'pop', group: 'Economy', icon: 'Building2' },
].map((m) => (m.kind ? m : { ...m, label: indicatorById[m.id].label, kind: 'indicator' }))

export const metricById = Object.fromEntries(MAP_METRICS.map((m) => [m.id, m]))
