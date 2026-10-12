// npm test — each measure shows once, as the selected standard measures it (data/standards.js hiddenMeasures), and
// every indicator has an explanation for the "About this measure" dialog (data/about.js).
import { check, done } from '../tools/sdk/test.mjs'
import { INDICATORS } from '../src/data/metrics.js'
import { STANDARDS, DEFAULT_STANDARDS, hiddenMeasures, standardOfMeasure, measureBand, scoresFor } from '../src/data/standards.js'
import { ABOUT } from '../src/data/about.js'

const under = (sel) => hiddenMeasures({ ...DEFAULT_STANDARDS, ...sel })
const shown = (sel, ids) => ids.filter((id) => !under(sel).has(id))

check('every indicator has an explanation', INDICATORS.every((i) => ABOUT[i.id]?.text), INDICATORS.filter((i) => !ABOUT[i.id]?.text).map((i) => i.id).join(', '))

// Heat and cold stress: one score row (the selected standard's), its own warning counts, nothing from the others.
const thermal = ['thermalStress', 'thermalNws', 'thermalEccc', 'thermalUtci', 'heatDangerDays', 'humidexDangerDays', 'frostbiteDays', 'utciHeatDays', 'utciColdDays']
check('US NWS: the score, Danger days and frostbite days', shown({ thermalStress: 'nws' }, thermal).join() === 'thermalStress,heatDangerDays,frostbiteDays', shown({ thermalStress: 'nws' }, thermal).join())
check('Environment Canada: humidex days replace heat index days; frostbite stays', shown({ thermalStress: 'eccc' }, thermal).join() === 'thermalStress,humidexDangerDays,frostbiteDays')
check('UTCI: its own heat and cold days, no wind chill', shown({ thermalStress: 'utci' }, thermal).join() === 'thermalStress,utciHeatDays,utciColdDays')

// Air quality: the selected standard's own measure in its own units, and its warning count.
const air = ['aqi', 'usAqi', 'pm25', 'aqiRecent', 'aqiPoorDays', 'usAqiUnhealthyDays', 'pm25HighDays', 'pm25WorstDay']
check('EEA: the European index, recent and poor-air days', shown({ aqi: 'eea' }, air).join() === 'aqi,aqiRecent,aqiPoorDays,pm25WorstDay', shown({ aqi: 'eea' }, air).join())
check('US EPA: US AQI replaces the European index', shown({ aqi: 'epa' }, air).join() === 'usAqi,usAqiUnhealthyDays,pm25WorstDay', shown({ aqi: 'epa' }, air).join())
check('WHO: PM2.5 and days over its 24-hour guideline', shown({ aqi: 'who' }, air).join() === 'pm25,pm25HighDays,pm25WorstDay')
check('UV: the yearly score, not its duplicate', under({}).has('uvScore') && !under({}).has('uvRisk'))

check('a standard’s own measure scores the indicator', scoresFor('usAqi', { aqi: 'epa' }) === 'aqi' && scoresFor('usAqi', { aqi: 'eea' }) === null && scoresFor('thermalNws', {}) === null)
check('the measure names its standard', standardOfMeasure('frostbiteDays', { thermalStress: 'eccc' })?.id === 'eccc' && standardOfMeasure('homicide') === null)
check('categories in the standard’s own units only', measureBand('usAqi', 120, { aqi: 'epa' }) === 'Unhealthy for sensitive groups' && measureBand('thermalStress', 90, {}) === null)
check('every standard family has a default option', Object.values(STANDARDS).every((s) => s.options.some((o) => o.id === s.default)))
done()
