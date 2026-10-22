// Offline test (npm test): the workbook rules on rows shaped like the "Densités" sheet, no download.
import { check, done } from '#sdk/test.mjs'
import { depCode, departmentRows, toValues } from './parse.mjs'

check('département labels → INSEE codes', depCode('075-Paris') === '75' && depCode('02A-Corse-du-Sud') === '2A' && depCode('971 -Guadeloupe') === '971' && depCode('001-Ain') === '01')
check('totals and areas off the map are not départements', depCode('000-Ensemble') === null && depCode('975-Saint-Pierre-et-Miquelon') === null)

const total = { specialites_agregees: '0-Ensemble', specialites: '00-Ensemble', exercice: '0-Ensemble', tranche_age: '00-Ensemble', sexe: '0-Ensemble' }
const rows = [
  { ...total, departement: '000-Ensemble', densite_2025: 344.53, densite_2026: 350.58 },
  { ...total, departement: '075-Paris', densite_2025: 934.61, densite_2026: 970.21 },
  { ...total, departement: '048-Lozère', densite_2025: 'ND', densite_2026: 280.5 },
  { ...total, specialites: '01-Médecine générale', departement: '075-Paris', densite_2025: 300, densite_2026: 310 },
  { ...total, departement: '975-Saint-Pierre-et-Miquelon', densite_2025: 1, densite_2026: 2 },
]
const density = departmentRows(rows, /^densite_(\d{4})$/)
check('only the "Ensemble" rows by département, latest year found', density.year === 2026 && density.byRegion['FR-75'][2026] === 970.21 && Object.keys(density.byRegion).length === 2)
check('"ND" (fewer than 10) stays null', density.byRegion['FR-48'][2025] === null && density.byRegion['FR-48'][2026] === 280.5)
check('areas off the map are reported, not guessed', density.unmatched.join() === '975-Saint-Pierre-et-Miquelon')

const physicians = departmentRows([{ ...total, departement: '075-Paris', effectif_2026: 19866 }], /^effectif_(\d{4})$/)
const { values, details, period } = toValues({ density, physicians, year: 2026 }, { names: { 'FR-75': 'Paris' } })
check('doctors per 1,000 = density ÷ 100', values.region['FR-75'].doctors === 9.7 && values.region['FR-48'].doctors === 2.81)
check('details keep the headcount and the year', details.region['FR-75'].physicians === 19866 && details.region['FR-75'].year === 2026 && period.latest === 2026)
check('Paris gets its département figure at city level', values.city['FRA-paris'].doctors === 9.7)
done()
