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

// Where each number comes from: [kind, how]. Kinds:
//   'score'     a MapStats score: calculated by this app, published by no source (how it is built: `how`)
//   'derived'   calculated by MapStats from a source's data (what was calculated: `how`)
//   'published' the source's own figure, as published (`how`: any note)
const SCORE = 'score', DERIVED = 'derived', PUBLISHED = 'published'
export const ORIGIN = {
  homicide: [DERIVED, 'the mean of the last three yearly rates the official crime statistics publish.'],
  propertyCrime: [DERIVED, 'robberies plus thefts, each a yearly rate the official crime statistics publish, averaged over the last three years.'],
  roadDeaths: [DERIVED, 'the mean of the last three yearly rates the official crime statistics publish.'],
  seismicZone: [PUBLISHED, 'copied by hand from INPRES’s official zoning map (the highest zone in the populated areas).'],
  pga475: [DERIVED, 'read from the GEM hazard map: the map cell at a city’s point; for a region, the mean of the cells inside it.'],
  pga475Max: [DERIVED, 'the highest GEM map cell inside the region.'],
  quakes: [DERIVED, 'counted from the USGS earthquake catalogue: events of magnitude 5 or more within 200 km.'],
  aqi: [DERIVED, 'the mean of the last 365 days of hourly European AQI values from Open-Meteo (CAMS air-quality model).'],
  usAqi: [DERIVED, 'the mean of the last 365 days of hourly US AQI values from Open-Meteo (CAMS air-quality model).'],
  pm25: [DERIVED, 'the mean of the last 365 days of hourly PM2.5 concentrations from Open-Meteo (CAMS air-quality model).'],
  aqiRecent: [DERIVED, 'the mean of the last 30 days of hourly European AQI values from Open-Meteo.'],
  pm25WorstDay: [DERIVED, 'daily means of Open-Meteo’s hourly PM2.5; the highest of the last 365 days.'],
  aqiPoorDays: [DERIVED, 'daily means of Open-Meteo’s hourly European AQI; the days above 60 are counted.'],
  usAqiUnhealthyDays: [DERIVED, 'daily means of Open-Meteo’s hourly US AQI; the days above 100 are counted.'],
  pm25HighDays: [DERIVED, 'daily means of Open-Meteo’s hourly PM2.5; the days above 15 µg/m³ are counted.'],
  thermalStress: [SCORE, 'from a year of hourly weather (Open-Meteo ERA5; UTCI: Copernicus daily values), each day is placed in the selected standard’s heat and cold categories and scored; the yearly mean of those day scores is the value. The categories are the standard’s; turning them into a 0–100 score is MapStats’.'],
  thermalNws: [SCORE, 'MapStats computes the heat index and wind chill from Open-Meteo’s hourly ERA5 temperature, humidity and wind, places each day in the US NWS categories and scores it; this is the yearly mean.'],
  thermalEccc: [SCORE, 'MapStats computes the humidex and wind chill from Open-Meteo’s hourly ERA5 temperature, humidity and wind, places each day in Environment Canada’s categories and scores it; this is the yearly mean.'],
  thermalUtci: [SCORE, 'Copernicus publishes each day’s highest and lowest UTCI; MapStats places each day in the UTCI stress categories and scores it; this is the yearly mean.'],
  heatDangerDays: [DERIVED, 'MapStats computes the heat index from Open-Meteo’s hourly ERA5 temperature and humidity (US NWS formula) and counts the days reaching 39.4 °C felt.'],
  humidexDangerDays: [DERIVED, 'MapStats computes the humidex from Open-Meteo’s hourly ERA5 temperature and humidity (Environment Canada’s formula) and counts the days reaching 46.'],
  frostbiteDays: [DERIVED, 'MapStats computes the wind chill from Open-Meteo’s hourly ERA5 temperature and wind (North American formula) and counts the days reaching −28 °C.'],
  utciHeatDays: [DERIVED, 'counted from the daily highest UTCI Copernicus publishes (ERA5-HEAT).'],
  utciColdDays: [DERIVED, 'counted from the daily lowest UTCI Copernicus publishes (ERA5-HEAT).'],
  climateComfort: [SCORE, 'MapStats’ own model: monthly temperature, rain and sunshine (ERA5 normals) scored against what MapStats considers comfortable. No standard behind it.'],
  uvRisk: [SCORE, 'each day’s maximum UV index (Open-Meteo) is placed in the Global Solar UV Index categories and scored; the yearly mean of those day scores is the value. The categories are WHO’s; the 0–100 score is MapStats’.'],
  uvScore: [SCORE, 'each day’s maximum UV index (Open-Meteo) is placed in the Global Solar UV Index categories and scored; this is the yearly mean.'],
  uvMean: [DERIVED, 'the mean of the last year’s daily maximum UV index from Open-Meteo.'],
  uvVeryHighDays: [DERIVED, 'counted from Open-Meteo’s daily maximum UV index over the last year.'],
  uvExtremeDays: [DERIVED, 'counted from Open-Meteo’s daily maximum UV index over the last year.'],
  doctors: [DERIVED, 'the number of registered physicians the Health Ministry and PAHO publish, divided by INDEC’s population projection for the same year.'],
  water: [DERIVED, 'households on the public water network divided by all households, from the census’s published counts.'],
  sewer: [DERIVED, 'households whose toilet drains to the public sewer divided by all households, from the census’s published counts.'],
  internet: [DERIVED, 'households with internet at home divided by all households, from the census’s published counts.'],
  poverty: [DERIVED, 'INDEC publishes poverty for 31 urban areas, not provinces: a province’s value is the mean of its areas’ published rates, weighted by their population.'],
  unemployment: [PUBLISHED, 'INDEC’s rate for all urban areas of each province.'],
  lifeExp: [DERIVED, 'INDEC publishes men’s and women’s life expectancy; MapStats combines them, weighting 105 boys to 100 girls at birth.'],
  hdi: [PUBLISHED, 'UNDP’s provincial index, as reprinted by the Health Ministry and PAHO.'],
  pop: [PUBLISHED, 'INDEC’s projection for provinces; Natural Earth’s approximate figure for cities.'],
  meanTemp: [DERIVED, 'averaged by MapStats from 10 years of Open-Meteo’s daily ERA5 data.'],
  annualPrecip: [DERIVED, 'summed per year and averaged by MapStats over 10 years of Open-Meteo’s daily ERA5 data.'],
  snowfall: [DERIVED, 'summed per year and averaged by MapStats over 10 years of Open-Meteo’s daily ERA5 data.'],
  sunshine: [DERIVED, 'summed per year and averaged by MapStats over 10 years of Open-Meteo’s daily ERA5 data.'],
  tempMaxAnnual: [DERIVED, 'each year’s highest daily maximum in Open-Meteo’s ERA5 data, averaged over 10 years.'],
  tempMinAnnual: [DERIVED, 'each year’s lowest daily minimum in Open-Meteo’s ERA5 data, averaged over 10 years.'],
  hotDays: [DERIVED, 'counted per year in Open-Meteo’s daily ERA5 data and averaged over 10 years.'],
  tropicalNights: [DERIVED, 'counted per year in Open-Meteo’s daily ERA5 data and averaged over 10 years.'],
  frostDays: [DERIVED, 'counted per year in Open-Meteo’s daily ERA5 data and averaged over 10 years.'],
  heavyRainDays: [DERIVED, 'counted per year in Open-Meteo’s daily ERA5 data and averaged over 10 years.'],
  drySpell: [DERIVED, 'the longest dry run of each year in Open-Meteo’s daily ERA5 data, averaged over 10 years.'],
  floodWatch: [DERIVED, 'the highest river discharge in the last 30 days and the forecast (GloFAS, via Open-Meteo), divided by the river’s usual high water from its own record.'],
  floodPeakPast: [DERIVED, 'the highest river discharge of the last year (GloFAS, via Open-Meteo), divided by the river’s usual high water.'],
  elevation: [PUBLISHED, 'Open-Meteo’s elevation model at the place’s point.'],
}

/** Plain-language lead for each kind of origin. */
export const ORIGIN_KIND = {
  score: 'MapStats score: calculated by this app, not published by any source. It’s MapStats’ way of comparing places, built from the sources’ data.',
  derived: 'Calculated by MapStats from the source’s data.',
  published: 'The source’s own figure, as published.',
}

// Rows of the comparison that aren't a single indicator.
export const ROW_ABOUT = {
  score: { title: 'MapStats score', read: 'high', origin: [SCORE, 'each category score is weighted by the weights you set (Weights tab) and averaged; categories without data for the place are left out.'], text: 'Overall 0–100 score: the weighted mean of the category scores, with the weights you set. Places are ranked by it. It compares places MapStats covers; it is not an absolute grade.' },
  category: { read: 'high', origin: [SCORE, 'each indicator is turned into 0–100, either by a health standard (air, heat and cold, UV) or between two values from the data (the 2nd and 98th percentile of regions across every country). Each source’s indicators are averaged, then the sources are combined: their median, a mean weighted by reliability, or one source, as selected in the source selector.'], text: 'How the place does in this category, from 0 to 100, relative to the places MapStats covers. Open an indicator below it to see what goes in.' },
  categories: { title: 'Score by category', read: 'high', origin: [SCORE, 'each bar is a category score (see a category’s own row).'], text: 'Each category’s 0–100 score side by side, to see where a place is strong or weak.' },
  warnings: { title: 'Warnings', read: 'low', origin: [DERIVED, 'MapStats counts the days over each standard’s limits, and climate extremes against its own thresholds (src/data/extremes.js), from the sources’ data.'], text: 'Extremes in the last year that a good yearly mean would hide: days over a standard’s daily limit, heat or cold danger days, extreme UV, and climate extremes. They never change scores.' },
  trend: { read: 'low', origin: [PUBLISHED, 'the yearly rates the source publishes.'], text: 'The yearly rate published by the source, to see whether things are improving.' },
  last: { read: 'low', origin: [PUBLISHED, 'the latest yearly rate the source publishes.'], text: 'The latest year’s published rate, as opposed to the three-year average that scores.' },
  flood: { title: 'River flood watch', read: 'low', origin: ORIGIN.floodWatch, text: ABOUT.floodWatch.text },
  airDaily: { title: 'Daily air quality', read: 'low', origin: [DERIVED, 'daily means of Open-Meteo’s hourly European AQI.'], text: 'European Air Quality Index, day by day over the last three months: spikes show pollution episodes.' },
  uvDaily: { title: 'Daily UV index', read: 'low', origin: [PUBLISHED, 'Open-Meteo’s daily maximum UV index (archive and forecast).'], text: 'Each day’s maximum UV index over the last three months and the forecast. 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme.' },
  pollutants: { title: 'Pollutants', read: 'low', origin: [DERIVED, '92-day means of Open-Meteo’s hourly concentrations (CAMS model).'], text: 'Mean concentration of each pollutant over the last 92 days, in µg/m³. WHO 2021 guidelines (annual means): PM2.5 5, PM10 15, NO₂ 10; ozone and SO₂ have short-term guidelines only.' },
  monthly: { read: 'context', origin: [DERIVED, 'monthly averages over 10 years of Open-Meteo’s daily ERA5 data.'], text: 'The 10-year average by month (ERA5 reanalysis), to see the shape of the year.' },
}

/** How to read a measure: 'low' | 'high' | 'mid' | 'context'. */
export const readingOf = (indicator) => indicator?.better || ABOUT[indicator?.id]?.read || 'context'

export const READING = {
  low: 'Lower is better.',
  high: 'Higher is better.',
  mid: 'Neither end is best: a middle range is.',
  context: 'Neither higher nor lower is better: it describes the place.',
}
