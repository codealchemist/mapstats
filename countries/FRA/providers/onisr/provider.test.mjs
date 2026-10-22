// Offline test (npm test): the BAAC counting rules on a few rows shaped like the yearly files, no download.
import { check, done, fixture } from '#sdk/test.mjs'
import { parseCsv } from '#sdk'
import { accidentDepartments, killedByDepartment, toValues } from './parse.mjs'

const caract = parseCsv(fixture(new URL('./fixtures/caract-2023.csv', import.meta.url)))
const usagers = parseCsv(fixture(new URL('./fixtures/usagers-2023.csv', import.meta.url)))
const departments = accidentDepartments(caract)
check('départements are zero-padded (the 2019 file writes "1")', departments.get('202300000001') === '01' && departments.get('202300000002') === '75')
check('the 2022 file names the accident "Accident_Id"', accidentDepartments([{ Accident_Id: 'x', dep: '2A' }]).get('x') === '2A')

const { byRegion, killed, outside, unknown } = killedByDepartment(usagers, departments)
check('only grav = 2 counts, one per user', killed === 5 && byRegion['FR-01'] === 1 && byRegion['FR-75'] === 2)
check('deaths outside the map and without an accident are counted but dropped', outside === 1 && unknown === 1)

const population = { 'FR-01': { 2022: 650000, 2023: 660000 }, 'FR-75': { 2022: 2100000, 2023: 2100000 } }
const { values, series, details, period } = toValues({ years: [2022, 2023], deaths: { 'FR-01': { 2023: 1 }, 'FR-75': { 2022: 42, 2023: 2 } }, population }, { deps: ['01', '75'] })
check('rates per 100,000 over the same year’s population, 2 decimals', details.region['FR-75'].latest.roadDeaths === 0.1 && series.region['FR-75'].roadDeaths.join() === '2,0.1')
check('a region with no row had 0 deaths, not a gap', series.region['FR-01'].roadDeaths[0] === 0)
check('3-year averages need three years', values.region['FR-75'].roadDeaths === null && period.latest === 2023)
check('national = Σ deaths / Σ population', details.national.FRA.latest.roadDeaths === 0.11 && details.national.FRA.counts.roadDeaths === 3)
check('Paris gets its département figures at city level', details.city?.['FRA-paris']?.counts.roadDeaths === 2)
done()
