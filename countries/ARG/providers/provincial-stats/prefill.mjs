// Prefill for Argentina's provincial statistics: INDEC's published tables → countries/ARG/data/provincial-stats.json.
//
//   npm run prefill -- ARG --provider provincial-stats
//
// Each file is downloaded once into raw/ (its URL, date and SHA-256 in raw/manifest.json); later runs read the stored
// copies. When INDEC publishes a new edition, update its URL (and year) in SOURCES. Values with no official file yet
// come from hand-entered.json, cited to their own hand-entered provider.
//
// censo.gob.ar doesn't send its intermediate certificate, so Node can't download the census files (browsers can).
// Download them by hand into raw/ under the same names (CENSUS lists them): the next run registers them with their URL.
import fs from 'node:fs'
import { rawStore, readWorkbook } from '#sdk'
import { PROV_ISO } from '../snic/parse.mjs'
import { provinceMatcher, provinceSheet, censusHouseholds, unemployment, poverty, lifeExpectancy, population } from './parse.mjs'

const INDEC = 'https://www.indec.gob.ar/ftp/cuadros/'
const POP_YEAR = 2026 // projections' population at 1 July of this year
const LIFE_YEAR = 2025 // the projections publish life expectancy for 2025, 2030, …

// One entry per publication: its file, the sheet(s) read, and what it gives (origin notes).
const SOURCES = {
  unemployment: { url: `${INDEC}sociedad/indicadores_eph_total_urbano_3t_2025.xls`, sheet: 'Cuadro 2.1', year: 2025, note: 'unemployment: % of the labour force, all urban areas of each province (EPH total urbano, 3rd quarter 2025)' },
  poverty: { url: `${INDEC}sociedad/cuadros_informe_pobreza_09_26.xls`, sheet: ['Cuadro 4.1', 'Poblaciones (Ex cuadro 4.2)'], year: 2026, note: 'poverty: % of persons below the poverty line (EPH, 1st half 2026), population-weighted mean of the province\'s surveyed urban areas' },
  life: { url: `${INDEC}poblacion/proyecciones_jurisdicciones_2022_2040_c3_c4.xlsx`, sheet: 'Cuadro 3', year: LIFE_YEAR, note: `lifeExp: years at birth, ${LIFE_YEAR} (INDEC projections 2022–2040), both sexes weighted 105 boys : 100 girls` },
  population: { url: `${INDEC}poblacion/proyecciones_jurisdicciones_2022_2040_c1.xlsx`, year: POP_YEAR, note: `pop: persons at 1 July ${POP_YEAR} (INDEC projections 2022–2040, based on Censo 2022)` },
}

// Censo 2022 definitive results: per province, three household tables (2: procedencia del agua, 3: desagüe del
// inodoro, 7: internet en la vivienda). Files are c2022_<slug>_hogares_c<table>_<n>.xlsx, n being INDEC's 1–24 order.
const CENSO = 'https://censo.gob.ar/wp-content/uploads/2023/11/'
const CENSUS_PROVINCES = [
  ['caba', 'AR-C'], ['bsas', 'AR-B'], ['catamarca', 'AR-K'], ['chaco', 'AR-H'], ['chubut', 'AR-U'], ['cordoba', 'AR-X'],
  ['corrientes', 'AR-W'], ['entrerios', 'AR-E'], ['formosa', 'AR-P'], ['jujuy', 'AR-Y'], ['lapampa', 'AR-L'], ['larioja', 'AR-F'],
  ['mendoza', 'AR-M'], ['misiones', 'AR-N'], ['neuquen', 'AR-Q'], ['rionegro', 'AR-R'], ['salta', 'AR-A'], ['sanjuan', 'AR-J'],
  ['sanluis', 'AR-D'], ['santacruz', 'AR-Z'], ['santafe', 'AR-S'], ['santiago', 'AR-G'], ['tdf', 'AR-V'], ['tucuman', 'AR-T'],
]
const CENSUS_TABLES = { water: 2, sewer: 3, internet: 7 }
const RENAMED = { 'c2022_lapampa_hogares_c3_11.xlsx': 'c2022_lapampa_hogares_c3_11-1.xlsx', 'c2022_larioja_hogares_c3_12.xlsx': 'c2022_larioja_hogares_c3_12-1.xlsx' }
const CENSUS = CENSUS_PROVINCES.flatMap(([slug, iso], i) => Object.entries(CENSUS_TABLES).map(([measure, table]) => {
  const name = `c2022_${slug}_hogares_c${table}_${i + 1}.xlsx`
  return { iso, measure, url: CENSO + (RENAMED[name] || name) }
}))
const CENSUS_NOTE = 'water, sewer, internet: % of households with drinking water from the public network, a toilet draining to the public sewer, internet at home (Censo 2022, definitive results)'

const PROVIDERS = {
  pop: 'ARG/census-population', water: 'ARG/censo-2022', sewer: 'ARG/censo-2022', internet: 'ARG/censo-2022',
  poverty: 'ARG/eph', unemployment: 'ARG/eph', lifeExp: 'ARG/indec',
}

export async function prefill({ args, log }) {
  const raw = rawStore('ARG', 'provincial-stats')
  const regions = JSON.parse(fs.readFileSync(new URL('../../geo/regions.json', import.meta.url), 'utf8')).features.map((f) => f.properties)
  const ctx = { province: provinceMatcher(regions), regionIds: regions.map((r) => r.id), codes: PROV_ISO }

  const files = {}, books = {}
  for (const [key, s] of Object.entries(SOURCES)) {
    const f = await raw.fetchOnce(s.url, { refresh: !!args.refresh })
    if (f.changed) throw new Error(`${f.ref.name} changed since it was downloaded: download it again with --refresh`)
    files[key] = f.ref
    books[key] = await readWorkbook(f.path)
  }
  // Census files: one put in raw/ by hand is registered with its URL; otherwise downloaded (fails on censo.gob.ar's
  // certificate, with what to do).
  const census = {}, censusFiles = []
  for (const { iso, measure, url } of CENSUS) {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop())
    if (!raw.manifest.files[name] && fs.existsSync(`${raw.dir}/${name}`)) raw.add(name, { url, note: 'downloaded by hand: censo.gob.ar omits its intermediate certificate' })
    const f = await raw.fetchOnce(url).catch((e) => {
      throw new Error(`${name}: ${e.cause?.code || e.message}. Download it in a browser from ${url} into ${raw.dir} and run again.`)
    })
    if (f.changed) throw new Error(`${name} changed since it was registered`)
    ;(census[iso] ||= {})[measure] = provinceSheet(await readWorkbook(f.path))
    censusFiles.push(f.ref)
  }
  for (const iso of Object.keys(census)) census[iso] = censusHouseholds(census[iso])

  const sheet = (key, name) => {
    const found = books[key].find((s) => s.name.trim() === name)
    if (!found) throw new Error(`${files[key].name}: no sheet "${name}"`)
    return found.rows
  }

  const unemp = unemployment(sheet('unemployment', SOURCES.unemployment.sheet), ctx)
  const pov = poverty(...SOURCES.poverty.sheet.map((n) => sheet('poverty', n)))
  const life = lifeExpectancy(sheet('life', SOURCES.life.sheet), { ...ctx, year: LIFE_YEAR })
  const pop = population(books.population, { ...ctx, year: POP_YEAR })

  const manual = JSON.parse(fs.readFileSync(new URL('./hand-entered.json', import.meta.url), 'utf8'))
  const values = {}
  for (const iso of ctx.regionIds) {
    values[iso] = { pop: pop[iso], ...census[iso], poverty: pov[iso], unemployment: unemp[iso], lifeExp: life[iso], ...manual.values[iso] }
  }
  log(`${ctx.regionIds.length} provinces from ${Object.keys(files).length + censusFiles.length} INDEC files; hand-entered: ${Object.keys(manual.providers).join(', ')}`)

  return {
    schema: 1,
    country: 'ARG',
    providers: { ...PROVIDERS, ...manual.providers },
    generatedAt: new Date().toISOString(),
    period: { latest: Math.max(...Object.values(SOURCES).map((s) => s.year)) },
    origin: {
      files: [
        ...Object.entries(files).map(([key, ref]) => ({ ...ref, note: SOURCES[key].note })),
        ...censusFiles.map((ref) => ({ ...ref, note: CENSUS_NOTE })),
        { name: 'hand-entered.json', sha256: null, retrievedAt: null, note: manual.note },
      ],
      notes: 'INDEC tables, read by countries/ARG/providers/provincial-stats/prefill.mjs. Each value cites its provider (providers).',
    },
    values: { region: values },
  }
}
