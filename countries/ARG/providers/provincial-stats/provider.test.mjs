// Offline test (npm test): the INDEC table rules on a few rows shaped like the published sheets, no download.
import { check, done } from '#sdk/test.mjs'
import { provinceMatcher, provinceSheet, censusHouseholds, unemployment, poverty, lifeExpectancy, population, pdfTableColumn, AREAS } from './parse.mjs'

const regions = [{ id: 'AR-C', name: 'Ciudad de Buenos Aires' }, { id: 'AR-V', name: 'Tierra del Fuego' }, { id: 'AR-G', name: 'Santiago del Estero' }]
const regionIds = regions.map((r) => r.id)
const province = provinceMatcher(regions)
const ctx = { province, regionIds }

check('INDEC spellings match', province('Ciudad Autónoma de Buenos Aires ') === 'AR-C' && province('Tierra del Fuego, Antártida e\nIslas del Atlántico Sur (1)') === 'AR-V' && province('Santiago Del Estero') === 'AR-G')
check('subtotals are not provinces', province('24 partidos del Gran Buenos Aires') === null && province('Total') === null)

// Rows shaped like La Pampa's definitive tables (households; the province's own sheet, then a department's).
const T = 'Total de hogares(¹)'
const sheets = (rows) => [{ name: 'Índice', rows: [] }, { name: 'Cuadro 2.11', rows }, { name: 'Cuadro 2.11.1', rows: [] }]
const census = censusHouseholds({
  water: provinceSheet(sheets([['Censo Nacional'], ['Cuadro 2.11. Provincia de La Pampa'], ['Procedencia del agua', T, 'Provisión del agua'], ['', '', 'Por cañería dentro de la vivienda'],
    ['Total', 141573, 140268], ['Red pública (agua corriente)', 120039, 119239], ['Perforación con bomba a motor', 10921, 10771]])),
  sewer: [['Desagüe y descarga de agua del inodoro', '', T, 'Ubicación del baño o letrina'], ['', '', '', 'Dentro de la vivienda'],
    ['Total', '', 141573, 140325], ['A red pública (cloaca)', 'Total', 95466, 95204], ['', 'Inodoro con botón, mochila o cadena', 94453, 94238], ['A cámara séptica y pozo ciego', 'Total', 31301, 31140]],
  internet: [['Tenencia de celular con internet', T, 'Tiene internet en la vivienda', '', '', 'No tiene internet en la vivienda'], ['', '', 'Total', 'Tiene computadora', 'No tiene computadora', 'Total'],
    ['Total', 141573, 121210, 86221, 34989, 20363], ['Tiene celular con internet', 128233, 117949, 84897, 33052, 10284]],
})
check('census: the province sheet, not a department\'s', census.water === 84.8, census.water)
check('census: sewer counts every household draining to the public network', census.sewer === 67.4, census.sewer)
check('census: internet at home from its column total', census.internet === 85.6, census.internet)

let missing = null
try { unemployment([['', 'Desocupación'], ['Total 31 aglomerados urbanos', 6.6], [''], ['Ciudad Autónoma de Buenos Aires', 3.9], ['']], ctx) } catch (e) { missing = e.message }
check('a missing province fails instead of leaving a gap', /AR-V, AR-G/.test(missing || ''), missing)

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

// Lines as readPdf gives them for Indicadores Básicos' demographic table: a letter-spaced title, a wrapped name around
// its numbers, cells merged by the PDF, and the notes below.
const pages = [
  [['Contenido'], ['Indicadores demográficos', '4'], ['1', '2']],
  [['In di ca do res demográficos'], ['(*)'], ['1', '2', '3', '4', '5'], ['República'], ['46.654.581', '22,0', '11,8 1,40', '0,847'], ['Argentina'],
    ['CABA', '3.083.770', '14,8', '17,3 0,90', '0,882'], ['Sgo. del'], ['1.007.830', '25,4', '9,0 1,70', '0,833'], ['Estero'],
    ['Tierra del'], ['186.285', '23,2', '6,6', '1,3', '0,856'], ['Fuego'], ['Notas: (*)'], ['1.', 'Población total, 2023.'], ['Santa Fe', '1', '2', '3', '4', '9']],
]
const hdi = pdfTableColumn(pages, { ...ctx, title: 'Indicadores demográficos', column: 5 })
check('PDF table: the table under its title, not the contents entry', Object.keys(hdi).length === 3)
check('PDF table: wrapped names and merged cells', hdi['AR-G'] === 0.833 && hdi['AR-V'] === 0.856 && hdi['AR-C'] === 0.882, JSON.stringify(hdi))
check('PDF table: thousands separators and decimal commas', pdfTableColumn(pages, { ...ctx, title: 'Indicadores demográficos', column: 1 })['AR-C'] === 3083770)
done()
