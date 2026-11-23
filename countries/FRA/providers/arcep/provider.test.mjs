// Offline test (npm test): the eligibility shares on rows shaped like ARCEP's files, no download.
import { check, done, fixture } from '#sdk/test.mjs'
import { parseCsv } from '#sdk'
import { coverage, byDepartment, byCommune, toValues } from './parse.mjs'

const techno = parseCsv(fixture(new URL('./fixtures/departement_techno.csv', import.meta.url)))
const debit = parseCsv(fixture(new URL('./fixtures/departement_debit.csv', import.meta.url)))
const { out, date } = coverage(techno, debit, byDepartment)
check('shares = eligible premises ÷ premises, 1 decimal, with the reference date', out['FR-65'].ftth === 93.9 && out['FR-65'].thd30 === 100 && out['FR-65'].premises === 185943 && date === '2026-06-30')
check('areas off the map are left out', !out['975'] && Object.keys(out).length === 2)
check('communes are kept by their code', Object.keys(coverage([{ code_insee: '75056', nbr: '10', elig_ftth: '9', date: 'd' }, { code_insee: '00000', nbr: '10', elig_ftth: '9', date: 'd' }], [], byCommune(new Set(['75056']))).out).join() === '75056')
const { values, details } = toValues({ departments: out, communes: { 75056: { premises: 10, ftth: 90, thd30: 100, date } } }, { communeNames: { 75056: 'Paris' } })
check('fibre coverage per département and commune; Paris at city level', values.region['FR-75'].fibreCoverage === 95.9 && values.subregion['75056'].fibreCoverage === 90 && values.city['FRA-paris'].fibreCoverage === 95.9 && details.subregion['75056'].thd30 === 100)
done()
