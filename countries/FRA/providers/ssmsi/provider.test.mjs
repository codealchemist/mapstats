// Offline test (npm test): the SSMSI rules on a fixture shaped like the département base, no download.
import { check, done, fixture } from '#sdk/test.mjs'
import { parseCsv } from '#sdk'
import { toValues, ingest } from './parse.mjs'

const rows = parseCsv(fixture(new URL('./fixtures/donnee-dep.csv', import.meta.url)))
const deps = ['01', '75']
const { values, series, details, period, used, skipped } = toValues(rows, { deps, names: { 'FR-01': 'Ain' } })
const ain = details.region['FR-01'], paris = details.region['FR-75']

check('rows of other areas and of the AFD sub-split are skipped', skipped === 4 && used === rows.length - 4, `${used} used, ${skipped} skipped`)
check('published per-mille rates × 100, 2 decimals', ain.latest.homicide === 0.92 && ain.latest.sexualViolence === 15.38, JSON.stringify(ain.latest))
check('3-year average of the rounded yearly rates', values.region['FR-01'].homicide === 0.92 && series.region['FR-01'].homicide.join() === '0.77,1.08,0.92')
check('a window with a gap stays null (Paris has two years)', values.region['FR-75'].homicide === null && paris.latest.homicide === 0.48)
check('the theft composite adds the 7 categories over the population', ain.counts.propertyCrime === 6200 && ain.latest.propertyCrime === 953.85 && values.region['FR-01'].propertyCrime === 953.85)
check('burglaries stay per 100,000 dwellings', ain.latest.burglary === 500)
check('counts of the latest year are exact', ain.counts.homicide === 6 && paris.counts.homicide === 10)
check('national = Σ facts / Σ denominators, only when every département has the year', details.national.FRA.latest.homicide === 0.58 && series.national.FRA.homicide[0] === null)
check('Paris gets its département figures at city level', details.city?.['FRA-paris']?.latestYear === 2025 && values.city['FRA-paris'].propertyCrime === values.region['FR-75'].propertyCrime)
check('period: the latest year and the averaged window', period.latest === 2025 && /2023–2025/.test(period.aggregation))
check('ingest keeps the published denominators', ingest(rows, { deps }).data['01'][2025].burglary.log === 300000)
done()
