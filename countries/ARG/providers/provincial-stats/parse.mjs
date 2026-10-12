// INDEC tables (sheets as rows of cells, from readWorkbook) → values per province (ISO 3166-2). Pure: no I/O, so
// the offline test runs the same rules on a few rows. Every reader finds its columns by header text, not position,
// and fails when a province is missing rather than leaving a gap.
import { fold, num } from '#sdk'

const clean = (s) => fold(String(s ?? '').replace(/\(\d+\)/g, ''))

/** Province name → ISO 3166-2, from geo/regions.json names plus INDEC's spellings. */
export function provinceMatcher(regions) {
  const index = new Map()
  const strip = (s) => clean(s).replace(/^provincia (de |del )?/, '')
  for (const { id, name } of regions) index.set(strip(name), id)
  index.set(strip('Ciudad Autónoma de Buenos Aires'), 'AR-C')
  index.set(strip('Tierra del Fuego, Antártida e Islas del Atlántico Sur'), 'AR-V')
  index.set(strip('T. del Fuego'), 'AR-V')
  index.set(strip('Sgo. del Estero'), 'AR-G')
  index.set(strip('CABA'), 'AR-C')
  return (name) => index.get(strip(name)) ?? null
}

/** Rows below `from` whose first cell is a province, until the first blank first cell: { iso: row }. */
function provinceRows(rows, from, province) {
  const out = {}
  for (const r of rows.slice(from)) {
    if (clean(r[0]) === '') break
    const iso = province(r[0])
    if (iso) out[iso] = r
  }
  return out
}

function complete(values, regionIds, what) {
  const missing = regionIds.filter((id) => !(id in values))
  if (missing.length) throw new Error(`${what}: no value for ${missing.join(', ')}`)
  return values
}

// ---------- Census 2022, definitive results: one workbook per province and table ----------

/** A province's own sheet in a census workbook ("Cuadro 2.11"; the "Cuadro 2.11.1"… sheets are its departments). */
export function provinceSheet(sheets) {
  const found = sheets.find((s) => /^cuadro\s*\d+\.\d+$/i.test(s.name.trim()))
  if (!found) throw new Error(`no province sheet among ${sheets.map((s) => s.name).join(', ')}`)
  return found.rows
}

const pct = (part, whole) => Math.round((part / whole) * 1000) / 10

/** Share of all households in the row whose first cell starts with `label`, or in the column headed `column`. */
function share(rows, { label, column }) {
  const header = rows.findIndex((r) => r.some((h) => clean(h).startsWith('total de hogares')))
  if (header < 0) throw new Error('no "Total de hogares" column')
  const all = rows[header].findIndex((h) => clean(h).startsWith('total de hogares'))
  const total = rows.find((r, i) => i > header && clean(r[0]) === 'total')
  if (!total) throw new Error('no "Total" row')
  if (column) {
    const col = rows[header].findIndex((h) => clean(h) === column)
    if (col < 0) throw new Error(`no "${column}" column`)
    return pct(total[col], total[all])
  }
  const row = rows.find((r, i) => i > header && clean(r[0]).startsWith(label))
  if (!row) throw new Error(`no "${label}" row`)
  return pct(row[all], total[all])
}

/**
 * One province's census tables (households: procedencia del agua, desagüe del inodoro, internet en la vivienda) →
 * % of households with drinking water from the public network, a toilet draining to the public sewer, internet at home.
 */
export const censusHouseholds = ({ water, sewer, internet }) => ({
  water: share(water, { label: 'red publica' }),
  sewer: share(sewer, { label: 'a red publica' }),
  internet: share(internet, { column: 'tiene internet en la vivienda' }),
})

/** EPH total urbano ("Cuadro 2.1"): unemployment rate (%) per province. */
export function unemployment(rows, { province, regionIds }) {
  const header = rows.findIndex((r) => r.some((h) => clean(h) === 'desocupacion'))
  if (header < 0) throw new Error('EPH: no "Desocupación" column')
  const col = rows[header].findIndex((h) => clean(h) === 'desocupacion')
  const byIso = provinceRows(rows, rows.findIndex((r, i) => i > header && clean(r[0]).startsWith('total 31')) + 2, province)
  return complete(Object.fromEntries(Object.entries(byIso).map(([iso, r]) => [iso, r[col]])), regionIds, 'unemployment')
}

// The 31 EPH urban areas (aglomerados) by province, as INDEC assigns them. Areas spanning two provinces belong to
// their main city's: San Nicolás – Villa Constitución to Buenos Aires, Viedma – Carmen de Patagones to Río Negro.
export const AREAS = {
  'AR-C': ['Ciudad Autónoma de Buenos Aires'],
  'AR-B': ['Partidos del GBA', 'Bahía Blanca - Cerri', 'Gran La Plata', 'Mar del Plata', 'San Nicolás - Villa Constitución'],
  'AR-K': ['Gran Catamarca'],
  'AR-H': ['Gran Resistencia'],
  'AR-U': ['Comodoro Rivadavia - Rada Tilly', 'Rawson - Trelew'],
  'AR-X': ['Gran Córdoba', 'Río Cuarto'],
  'AR-W': ['Corrientes'],
  'AR-E': ['Concordia', 'Gran Paraná'],
  'AR-P': ['Formosa'],
  'AR-Y': ['Jujuy - Palpalá'],
  'AR-L': ['Santa Rosa - Toay'],
  'AR-F': ['La Rioja'],
  'AR-M': ['Gran Mendoza'],
  'AR-N': ['Posadas'],
  'AR-Q': ['Neuquén - Plottier'],
  'AR-R': ['Viedma - Carmen de Patagones'],
  'AR-A': ['Salta'],
  'AR-J': ['Gran San Juan'],
  'AR-D': ['Gran San Luis'],
  'AR-Z': ['Río Gallegos'],
  'AR-S': ['Gran Rosario', 'Gran Santa Fe'],
  'AR-G': ['Santiago del Estero - La Banda'],
  'AR-V': ['Ushuaia - Río Grande'],
  'AR-T': ['Gran Tucumán - Tafí Viejo'],
}

/**
 * EPH poverty: % of persons below the poverty line per province, the population-weighted mean of its urban areas.
 * @param incidence  "Cuadro 4.1": per area, households then persons (total in thousands, incidence %, CV)
 * @param population "Poblaciones": per area, total households and persons (thousands)
 * @returns { iso: % }
 */
export function poverty(incidence, population) {
  // Area name → its row (region subtotals and totals are rows too; only the areas are read).
  const byArea = (rows) => new Map(rows.filter((r) => typeof r[1] === 'number').map((r) => [clean(r[0]), r]))
  const inc = byArea(incidence), pop = byArea(population)
  const personsCol = incidence.find((r) => r.some((h) => clean(h) === 'personas')).findIndex((h) => clean(h) === 'personas')
  const rateCol = incidence.slice(0, 8).find((r) => r.some((h) => clean(h) === 'incidencia')).findIndex((h, i) => i >= personsCol && clean(h) === 'incidencia')
  const totalCol = population.find((r) => r.some((h) => clean(h) === 'personas')).findIndex((h) => clean(h) === 'personas')
  const values = {}
  for (const [iso, names] of Object.entries(AREAS)) {
    const areas = names.map((name) => {
      const i = inc.get(clean(name)), p = pop.get(clean(name))
      if (!i || !p) throw new Error(`poverty: no row for ${name}`)
      return { name, persons: p[totalCol] * 1000, poverty: i[rateCol] }
    })
    const n = areas.reduce((s, a) => s + a.persons, 0)
    values[iso] = Math.round((areas.reduce((s, a) => s + a.poverty * a.persons, 0) / n) * 10) / 10
  }
  return values
}

// Births per girl in Argentina's vital statistics (about 105 boys per 100 girls): weights the men's and women's life
// expectancy into one for both sexes, which INDEC's projections don't publish.
const BOYS_PER_GIRL = 1.05

/** INDEC projections, "Cuadro 3": life expectancy at birth per province in `year`, both sexes. */
export function lifeExpectancy(rows, { province, regionIds, year }) {
  const sexRow = rows.findIndex((r) => r.some((h) => clean(h) === 'varones'))
  const men = rows[sexRow].findIndex((h) => clean(h) === 'varones'), women = rows[sexRow].findIndex((h) => clean(h) === 'mujeres')
  const years = rows[sexRow + 1]
  const col = (from, to) => years.findIndex((y, i) => i >= from && (to < 0 || i < to) && y === year)
  const m = col(men, women), w = col(women, -1)
  if (m < 0 || w < 0) throw new Error(`life expectancy: no ${year} column`)
  const byIso = provinceRows(rows, sexRow + 2, province)
  return complete(Object.fromEntries(Object.entries(byIso).map(([iso, r]) => [iso, Math.round(((BOYS_PER_GIRL * r[m] + r[w]) / (1 + BOYS_PER_GIRL)) * 10) / 10])), regionIds, 'life expectancy')
}

/** INDEC projections, one sheet per province named "<INDEC code>-<NAME>": population at 1 July of `year`. */
export function population(sheets, { codes, regionIds, year }) {
  const values = {}
  for (const { name, rows } of sheets) {
    const iso = codes[name.split('-')[0]]
    if (!iso) continue
    const row = rows.find((r) => r[0] === year)
    if (!row) throw new Error(`population: no ${year} row in sheet ${name}`)
    values[iso] = row[1]
  }
  return complete(values, regionIds, 'population')
}

// ---------- Indicadores Básicos (Ministerio de Salud and PAHO), a PDF ----------

const NUMBER = /^[\d.,]+$/
// Where a table ends: its notes ("Notas:", or numbered "1." / "1. Número…").
const NOTES = /^(notas|\d+\.( |$))/

/**
 * One column of a numbered table in a PDF (pages of lines of cells, from readPdf): the table under the line starting
 * with `title`, whose header line numbers its columns 1…n. Rows run until the notes. A province name that wraps
 * ("Buenos" / "Aires") lands on the lines above and below its numbers; cells merged by the PDF ("17,3 0,90") are split.
 * @returns { iso: number }
 */
export function pdfTableColumn(pages, { title, column, province, regionIds }) {
  for (const lines of pages) {
    // Titles may come out letter-spaced ("In di ca do res"): compare without spaces.
    const at = lines.findIndex((l) => clean(l[0]).replace(/ /g, '').startsWith(clean(title).replace(/ /g, '')))
    // The column numbers, right under the title (elsewhere, e.g. in the contents, the title is just text).
    const head = lines.findIndex((l, i) => i > at && i <= at + 3 && l[0] === '1' && l.length > 2 && l.every((c) => /^\d+[a-z]?$/.test(c)))
    if (at < 0 || head < 0) continue
    const col = lines[head].indexOf(String(column))
    if (col < 0) throw new Error(`${title}: no column ${column}`)
    const values = {}
    let pending = ''
    for (let i = head + 1; i < lines.length && !NOTES.test(clean(lines[i][0])); i++) {
      const cells = lines[i].flatMap((c) => (c.split(' ').every((x) => NUMBER.test(x)) ? c.split(' ') : [c]))
      const numbers = cells.filter((c) => NUMBER.test(c))
      if (!numbers.length) { pending = `${pending} ${cells.join(' ')}`.trim(); continue }
      let name = cells.filter((c) => !NUMBER.test(c)).join(' ')
      if (!name) {
        const next = lines[i + 1]
        const wraps = next && !next.some((c) => NUMBER.test(c)) && !NOTES.test(clean(next[0]))
        name = `${pending} ${wraps ? next.join(' ') : ''}`.trim()
        if (wraps) i++
      }
      pending = ''
      if (numbers.length !== lines[head].length) throw new Error(`${title}: ${name} has ${numbers.length} numbers for ${lines[head].length} columns`)
      const iso = province(name)
      if (iso) values[iso] = num(numbers[col], { decimal: ',' })
    }
    return complete(values, regionIds, title)
  }
  throw new Error(`no table "${title}"`)
}
