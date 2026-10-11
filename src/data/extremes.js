// Climate extremes that deserve a warning, so they aren't lost in yearly means: living, crops, water. The measures
// follow the WMO climate-extremes indices (ETCCDI); the counts that trigger a warning are MapStats' own rules,
// to be reviewed, not standards. Air warnings come from each air standard's daily limit (standards.js).
export const ETCCDI_URL = 'https://etccdi.pacificclimate.org/list_27_indices.shtml'

export const CLIMATE_WARNINGS = [
  { indicator: 'hotDays', warnAt: 10, text: (n) => `${n} very hot days a year (≥ 35 °C)`, why: 'heat stress, crop damage' },
  { indicator: 'tropicalNights', warnAt: 30, text: (n) => `${n} tropical nights a year (min ≥ 20 °C)`, why: 'no relief from heat at night' },
  { indicator: 'frostDays', warnAt: 30, text: (n) => `${n} frost days a year (min < 0 °C)`, why: 'frost risk for crops' },
  { indicator: 'heavyRainDays', warnAt: 10, text: (n) => `${n} very heavy rain days a year (≥ 20 mm)`, why: 'flooding, erosion' },
  { indicator: 'drySpell', warnAt: 60, text: (n) => `a ${n}-day dry spell (< 1 mm a day)`, why: 'drought, irrigation needs' },
]
