// What each measure is and how to read it, for the "About this measure" dialog (components/MeasureInfo.jsx).
// `read`: which way is better — 'low', 'high', 'mid' (a middle range is best) or 'context' (neither: it describes the
// place). Scored indicators read the way they score (metrics.js `better`); `read` here only covers unscored ones.

export const ABOUT = {
  // Safety
  homicide: { text: 'Intentional homicides recorded by the police and justice system, per 100,000 inhabitants, averaged over the last three years so one bad year doesn’t dominate.' },
  propertyCrime: { text: 'Robberies (with violence or threat) plus thefts recorded by the police, per 100,000 inhabitants, three-year average. Only reported crimes count: places where people report less look safer than they are.' },
  roadDeaths: { text: 'People killed in road crashes per 100,000 inhabitants, three-year average.' },
  // Natural risks
  seismicZone: { read: 'low', text: 'Argentina’s building-code seismic zone (INPRES-CIRSOC 103), 0 (very low) to 4 (very high), for the highest zone in the place’s populated areas. Shown for context: seismic hazard (GEM) scores instead.' },
  pga475: { text: 'Peak ground acceleration on rock with a 10 % chance of being exceeded in 50 years (the usual building-design level), from the GEM Global Seismic Hazard Map, in g (Earth’s gravity). Around 0.1 g damages weak buildings; 0.4 g and above is very high hazard.' },
  pga475Max: { read: 'low', text: 'The highest seismic hazard (GEM, same measure) anywhere in the region, where the scored value is the region’s typical one. Shows when part of a region is much more exposed.' },
  quakes: { read: 'low', text: 'Earthquakes of magnitude 5 or more within 200 km in the USGS catalogue. A count of past events, shown for context; seismic hazard (GEM) is the scored measure.' },
  // Environment: air
  aqi: { text: 'European Air Quality Index (EEA), yearly mean of hourly values. It takes the worst of PM2.5, PM10, NO₂, O₃ and SO₂ against European health thresholds: 0–20 good, 20–40 fair, 40–60 moderate, 60–80 poor, above 80 very poor.' },
  usAqi: { read: 'low', text: 'US EPA Air Quality Index, yearly mean of hourly values. 0–50 good, 51–100 moderate, 101–150 unhealthy for sensitive groups, 151–200 unhealthy, above 200 very unhealthy.' },
  pm25: { read: 'low', text: 'Yearly mean concentration of fine particles (PM2.5), the pollutant most tied to health effects. WHO’s 2021 guideline is 5 µg/m³; its interim targets are 10, 15, 25 and 35.' },
  aqiRecent: { read: 'low', text: 'European Air Quality Index, mean of the last 30 days: how the air has been lately, as opposed to the yearly mean that scores.' },
  pm25WorstDay: { read: 'low', text: 'The highest daily mean PM2.5 of the last year: the worst episode, which a yearly mean hides. WHO’s 24-hour guideline is 15 µg/m³.' },
  aqiPoorDays: { read: 'low', text: 'Days in the last year whose mean European AQI was poor or worse (above 60). EU law tolerates daily limits being exceeded on at most 35 days a year; more raises a warning.' },
  usAqiUnhealthyDays: { read: 'low', text: 'Days in the last year whose mean US AQI was unhealthy for sensitive groups or worse (above 100). The US standard tolerates about 7 a year; more raises a warning.' },
  pm25HighDays: { read: 'low', text: 'Days in the last year whose mean PM2.5 exceeded WHO’s 24-hour guideline (15 µg/m³). WHO tolerates 3–4 a year; more raises a warning.' },
  // Environment: heat and cold
  thermalStress: { text: 'How often the weather puts health at risk from heat or cold, under the standard you select. Each day of the last year scores 0–100 by the worst heat or cold category it reached (100: no stress all day); this is the yearly mean. Cool, still days are not stress: it measures risk, not comfort.' },
  thermalNws: { read: 'high', text: 'The heat and cold stress score under the US National Weather Service heat index (temperature and humidity felt as heat) and the North American wind chill.' },
  thermalEccc: { read: 'high', text: 'The heat and cold stress score under Environment and Climate Change Canada’s humidex and the North American wind chill.' },
  thermalUtci: { read: 'high', text: 'The heat and cold stress score under the Universal Thermal Climate Index, which also counts wind and sun on a person outdoors. From Copernicus ERA5-HEAT, prefilled per country.' },
  heatDangerDays: { read: 'low', text: 'Days in the last year whose hottest hour reached the US heat index “Danger” category (39.4 °C felt or more): heat illness is likely with prolonged exposure or exertion. Any such day raises a warning.' },
  humidexDangerDays: { read: 'low', text: 'Days in the last year with a dangerous humidex (46 or more): possible heat stroke. Any such day raises a warning.' },
  frostbiteDays: { read: 'low', text: 'Days in the last year whose wind chill reached −28 °C or lower, when exposed skin can freeze in 10 to 30 minutes. Any such day raises a warning.' },
  utciHeatDays: { read: 'low', text: 'Days in the last year whose highest UTCI reached 38 °C (very strong heat stress) or more: heat illness likely without shade, water and rest.' },
  utciColdDays: { read: 'low', text: 'Days in the last year whose lowest UTCI reached −27 °C (very strong cold stress) or less: frostbite and hypothermia risk outdoors.' },
  climateComfort: { read: 'high', text: 'MapStats’ own comfort model (mild temperatures, little rain, sunshine). A matter of taste rather than health, so it is shown but not scored.' },
  // Environment: UV
  uvRisk: { text: 'Exposure to ultraviolet radiation under the Global Solar UV Index (WHO, WMO, UNEP, ICNIRP). Each day scores by the category its maximum UV index reached (low, moderate, high, very high, extreme; 100: low all day); this is the yearly mean. Lower scores mean more days needing sun protection.' },
  uvScore: { read: 'high', text: 'The UV exposure score under the Global Solar UV Index.' },
  uvMean: { read: 'low', text: 'Mean of each day’s maximum UV index over the last year. 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme.' },
  uvVeryHighDays: { read: 'low', text: 'Days in the last year whose maximum UV index was 8 or more (very high or extreme): unprotected skin burns quickly around midday.' },
  uvExtremeDays: { read: 'low', text: 'Days in the last year whose maximum UV index was 11 or more (extreme): unprotected skin burns in minutes. Any such day raises a warning.' },
  // Services
  doctors: { text: 'Registered physicians under 65 per 1,000 inhabitants, by province of registration (Argentina: REFEPS, via the Health Ministry and PAHO). Capitals with large hospitals and medical schools register far more than they serve alone.' },
  water: { text: 'Share of households with drinking water from the public network (2022 census). The rest rely on wells, tanks or deliveries.' },
  sewer: { text: 'Share of households whose toilet drains to the public sewer (2022 census). The rest use septic tanks or cesspits.' },
  internet: { text: 'Share of households with internet at home, fixed or mobile (2022 census).' },
  // Economy
  poverty: { text: 'Share of people in households whose income is below the poverty line (the cost of a basic basket of goods and services). Argentina: INDEC’s household survey, urban areas only.' },
  unemployment: { text: 'Share of the labour force (people working or looking for work) who are looking for work and have none. Argentina: INDEC’s household survey, urban areas.' },
  lifeExp: { text: 'Years a newborn would live on average at current death rates, both sexes (INDEC projections).' },
  hdi: { text: 'Human Development Index, 0 to 1: combines life expectancy, education and income (UNDP). Above 0.8 is “very high” development.' },
  pop: { read: 'context', text: 'Number of inhabitants. Context only: larger isn’t better or worse.' },
  // Climate (descriptive)
  meanTemp: { read: 'context', text: 'Mean air temperature over the year (10-year normal, ERA5 reanalysis). Whether warmer or cooler suits you is a matter of taste.' },
  annualPrecip: { read: 'context', text: 'Total rain and snow (as water) in an average year, in mm (10-year normal).' },
  snowfall: { read: 'context', text: 'Total snowfall in an average year, in cm of snow (10-year normal).' },
  sunshine: { read: 'context', text: 'Hours of sunshine in an average year (10-year normal).' },
  tempMaxAnnual: { read: 'mid', text: 'The hottest temperature of the year, averaged over 10 years. Above about 38 °C, heat is a health risk; very low values mean cool summers.' },
  tempMinAnnual: { read: 'mid', text: 'The coldest temperature of the year, averaged over 10 years. Well below 0 °C means harsh winters; very high values mean no real winter.' },
  hotDays: { read: 'low', text: 'Days a year reaching 35 °C or more (10-year mean). Many such days raise a warning.' },
  tropicalNights: { read: 'low', text: 'Nights a year that stay at 20 °C or above (10-year mean): hard for sleeping without cooling.' },
  frostDays: { read: 'low', text: 'Days a year whose minimum drops below 0 °C (10-year mean).' },
  heavyRainDays: { read: 'low', text: 'Days a year with 20 mm of rain or more (10-year mean): a sign of downpours and local flooding.' },
  drySpell: { read: 'low', text: 'The longest run of days with less than 1 mm of rain in a year (10-year mean): drought and wildfire conditions.' },
  floodWatch: { read: 'low', text: 'The nearest river’s highest forecast or recent flow in the last 30 days, divided by its usual high water (GloFAS). Above 1 the river is running above its usual high level; above about 1.5, flooding is possible.' },
  floodPeakPast: { read: 'low', text: 'The nearest river’s highest flow in the last year, divided by its usual high water (GloFAS).' },
  elevation: { read: 'context', text: 'Height above sea level, in metres.' },
}

// Rows of the comparison that aren't a single indicator.
export const ROW_ABOUT = {
  score: { title: 'MapStats score', read: 'high', text: 'Overall 0–100 score: the weighted mean of the category scores, with the weights you set. Places are ranked by it. It compares places MapStats covers; it is not an absolute grade.' },
  category: { read: 'high', text: 'The 0–100 score of this category: each source scores the place from its indicators, then the sources are combined (median, weighted by reliability, or one source, as selected).' },
  categories: { title: 'Score by category', read: 'high', text: 'Each category’s 0–100 score side by side, to see where a place is strong or weak.' },
  warnings: { title: 'Warnings', read: 'low', text: 'Extremes in the last year that a good yearly mean would hide: days over a standard’s daily limit, heat or cold danger days, extreme UV, and climate extremes. They never change scores.' },
  trend: { read: 'low', text: 'The yearly rate published by the source, to see whether things are improving.' },
  last: { read: 'low', text: 'The latest year’s published rate, as opposed to the three-year average that scores.' },
  flood: { title: 'River flood watch', read: 'low', text: ABOUT.floodWatch.text },
  airDaily: { title: 'Daily air quality', read: 'low', text: 'European Air Quality Index, day by day over the last three months: spikes show pollution episodes.' },
  uvDaily: { title: 'Daily UV index', read: 'low', text: 'Each day’s maximum UV index over the last three months and the forecast. 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme.' },
  pollutants: { title: 'Pollutants', read: 'low', text: 'Mean concentration of each pollutant over the last 92 days, in µg/m³. WHO 2021 guidelines (annual means): PM2.5 5, PM10 15, NO₂ 10; ozone and SO₂ have short-term guidelines only.' },
  monthly: { read: 'context', text: 'The 10-year average by month (ERA5 reanalysis), to see the shape of the year.' },
}

/** How to read a measure: 'low' | 'high' | 'mid' | 'context'. */
export const readingOf = (indicator) => indicator?.better || ABOUT[indicator?.id]?.read || 'context'

export const READING = {
  low: 'Lower is better.',
  high: 'Higher is better.',
  mid: 'Neither end is best: a middle range is.',
  context: 'Neither higher nor lower is better: it describes the place.',
}
