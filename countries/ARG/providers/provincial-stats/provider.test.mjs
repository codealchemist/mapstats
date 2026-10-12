// Offline test (npm test): the INDEC table rules on a few rows shaped like the published sheets, no download.
import { check, done } from '#sdk/test.mjs'
import { provinceMatcher, censusHousing, unemployment, poverty, lifeExpectancy, population, AREAS } from './parse.mjs'

const regions = [{ id: 'AR-C', name: 'Ciudad de Buenos Aires' }, { id: 'AR-V', name: 'Tierra del Fuego' }, { id: 'AR-G', name: 'Santiago del Estero' }]
const regionIds = regions.map((r) => r.id)
const province = provinceMatcher(regions)
const ctx = { province, regionIds }

check('INDEC spellings match', province('Ciudad Autónoma de Buenos Aires ') === 'AR-C' && province('Tierra del Fuego, Antártida e\nIslas del Atlántico Sur (1)') === 'AR-V' && province('Santiago Del Estero') === 'AR-G')
check('subtotals are not provinces', province('24 partidos del Gran Buenos Aires') === null && province('Total') === null)

const census = censusHousing([
  ['Cuadro 1. Total del país'],
  ['Jurisdicción', 'Agua por cañería dentro de la vivienda', 'Agua para beber y cocinar por red pública', 'Desagüe del inodoro del baño a red pública (cloaca)', 'Internet', 'Celular con internet'],
  ['Total', 92.3, 85.4, 62.6, 78, 89.7],
  ['Ciudad Autónoma de Buenos Aires', 98.7, 98.2, 99.2, 90.6, 94],
  ['Santiago del Estero', 69.2, 79.4, 28.7, 49.5, 80.7],
  ['Tierra del Fuego, Antártida e Islas del Atlántico Sur (1)', 96, 94.1, 91.6, 83.9, 95.2],
  [''],
  ['Fuente: INDEC'],
], ctx)
check('census: water from the public network, not piped water', census['AR-G'].water === 79.4, census['AR-G'].water)
check('census: sewer and internet (not mobile internet)', census['AR-V'].sewer === 91.6 && census['AR-V'].internet === 83.9)

let missing = null
try { censusHousing([['Jurisdicción', 'Agua para beber y cocinar por red pública', 'Desagüe del inodoro a red pública', 'Internet'], ['Total', 1, 2, 3]], ctx) } catch (e) { missing = e.message }
check('a missing province fails instead of leaving a gap', /AR-C/.test(missing || ''), missing)

const unemp = unemployment([
  ['Área geográfica', 'Tasas generales de'],
  ['', 'Actividad', 'Empleo', 'Desocupación'],
  [''],
  ['Total nacional urbano', 47.5, 44.5, 6.3],
  ['Total 31 aglomerados urbanos', 48.6, 45.4, 6.6],
  [''],
  ['Ciudad Autónoma de Buenos Aires ', 56.3, 54.1, 3.9],
  ['Santiago Del Estero', 40.9, 39.4, 3.7],
  ['Tierra del Fuego', 49.1, 45.7, 6.8],
  [''],
], ctx)
check('unemployment: the Desocupación column per province', unemp['AR-C'] === 3.9 && unemp['AR-V'] === 6.8)

// Two areas of Buenos Aires province, to check the population weighting; every other area gets 10 %.
const names = Object.values(AREAS).flat()
const rate = { 'Partidos del GBA': 40, 'Mar del Plata': 20 }
const persons = { 'Partidos del GBA': 300, 'Mar del Plata': 100 }
const pov = poverty(
  [['Área geográfica', 'Hogares', '', '', '', 'Personas'], ['', 'Total (en miles)', 'Incidencia', 'CV', '', 'Total (en miles)', 'Incidencia', 'CV'], ['Total 31 aglomerados urbanos ', 1, 99, 1, '', 1, 99, 1],
    ...names.map((n) => [`${n} `, 1, 50, 1, '', 1, rate[n] ?? 10, 1])],
  [['Área geográfica', 'Total'], ['', 'Hogares', 'Personas'], ...names.map((n) => [n, 1, persons[n] ?? 50])],
)
check('poverty: persons incidence, not households', pov['AR-C'] === 10, pov['AR-C'])
// Buenos Aires: 40 % of 300k, 20 % of 100k and 10 % of 3 × 50k → 15,500 / 550 = 28.2 %
check('poverty: population-weighted mean of a province\'s areas', pov['AR-B'] === 28.2, pov['AR-B'])
check('poverty: every province has areas', Object.keys(pov).length === 24)

const life = lifeExpectancy([
  ['Cuadro 3'], ['Jurisdicción', 'Sexo'], ['', 'Varones', '', '', 'Mujeres'], ['', 2025, 2030, '', 2025, 2030],
  ['Ciudad Autónoma de Buenos Aires ', 78, 79, '', 83, 84], ['Santiago del Estero', 74, 75, '', 80, 81], ['Tierra del Fuego, Antártida e Islas del Atlántico Sur', 78, 79, '', 83, 84], [''],
], { ...ctx, year: 2025 })
check('life expectancy: both sexes weighted 105 boys : 100 girls', life['AR-G'] === 76.9, life['AR-G'])

const pop = population([
  { name: 'ÍNDICE', rows: [] },
  { name: '02-CABA', rows: [['Año', 'Ambos sexos'], [2025, 3079674], [2026, 3065991]] },
  { name: '86-SANTIAGO DEL ESTERO', rows: [['Año', 'Ambos sexos'], [2026, 1059927]] },
  { name: '94-TIERRA DEL FUEGO', rows: [['Año', 'Ambos sexos'], [2026, 182744]] },
], { regionIds, codes: { '02': 'AR-C', '86': 'AR-G', '94': 'AR-V' }, year: 2026 })
check('population: the year\'s row of each province sheet', pop['AR-C'] === 3065991 && pop['AR-V'] === 182744)
done()
