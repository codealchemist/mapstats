// Prefill for Argentina's provincial statistics: INDEC's published tables → countries/ARG/data/provincial-stats.json.
//
//   npm run prefill -- ARG --provider provincial-stats
//
// Each file is downloaded once into raw/ (its URL, date and SHA-256 in raw/manifest.json); later runs read the stored
// copies. When INDEC publishes a new edition, update its URL (and year) in SOURCES. Values with no official file yet
// come from hand-entered.json, cited to their own hand-entered provider.
import fs from 'node:fs'
import { rawStore, readWorkbook } from '#sdk'
import { PROV_ISO } from '../snic/parse.mjs'
import { provinceMatcher, censusHousing, unemployment, poverty, lifeExpectancy, population } from './parse.mjs'

const INDEC = 'https://www.indec.gob.ar/ftp/cuadros/'
const POP_YEAR = 2026 // projections' population at 1 July of this year
const LIFE_YEAR = 2025 // the projections publish life expectancy for 2025, 2030, …

// One entry per publication: its file, the sheet(s) read, and what it gives (origin notes).
const SOURCES = {
  census: { url: `${INDEC}poblacion/cnphv2022_condiciones_habitacionales.xlsx`, sheet: 'Cuadro 1', year: 2022, note: 'water, sewer, internet: % of occupied private dwellings with drinking water from the public network, a toilet draining to the public sewer, internet (Censo 2022, provisional results)' },
  unemployment: { url: `${INDEC}sociedad/indicadores_eph_total_urbano_3t_2025.xls`, sheet: 'Cuadro 2.1', year: 2025, note: 'unemployment: % of the labour force, all urban areas of each province (EPH total urbano, 3rd quarter 2025)' },
  poverty: { url: `${INDEC}sociedad/cuadros_informe_pobreza_09_26.xls`, sheet: ['Cuadro 4.1', 'Poblaciones (Ex cuadro 4.2)'], year: 2026, note: 'poverty: % of persons below the poverty line (EPH, 1st half 2026), population-weighted mean of the province\'s surveyed urban areas' },
  life: { url: `${INDEC}poblacion/proyecciones_jurisdicciones_2022_2040_c3_c4.xlsx`, sheet: 'Cuadro 3', year: LIFE_YEAR, note: `lifeExp: years at birth, ${LIFE_YEAR} (INDEC projections 2022–2040), both sexes weighted 105 boys : 100 girls` },
  population: { url: `${INDEC}poblacion/proyecciones_jurisdicciones_2022_2040_c1.xlsx`, year: POP_YEAR, note: `pop: persons at 1 July ${POP_YEAR} (INDEC projections 2022–2040, based on Censo 2022)` },
}

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
  const sheet = (key, name) => {
    const found = books[key].find((s) => s.name.trim() === name)
    if (!found) throw new Error(`${files[key].name}: no sheet "${name}"`)
    return found.rows
  }

  const census = censusHousing(sheet('census', SOURCES.census.sheet), ctx)
  const unemp = unemployment(sheet('unemployment', SOURCES.unemployment.sheet), ctx)
  const pov = poverty(...SOURCES.poverty.sheet.map((n) => sheet('poverty', n)))
  const life = lifeExpectancy(sheet('life', SOURCES.life.sheet), { ...ctx, year: LIFE_YEAR })
  const pop = population(books.population, { ...ctx, year: POP_YEAR })

  const manual = JSON.parse(fs.readFileSync(new URL('./hand-entered.json', import.meta.url), 'utf8'))
  const values = {}
  for (const iso of ctx.regionIds) {
    values[iso] = { pop: pop[iso], ...census[iso], poverty: pov[iso], unemployment: unemp[iso], lifeExp: life[iso], ...manual.values[iso] }
  }
  log(`${ctx.regionIds.length} provinces from ${Object.keys(files).length} INDEC files; hand-entered: ${Object.keys(manual.providers).join(', ')}`)

  return {
    schema: 1,
    country: 'ARG',
    providers: { ...PROVIDERS, ...manual.providers },
    generatedAt: new Date().toISOString(),
    period: { latest: Math.max(...Object.values(SOURCES).map((s) => s.year)) },
    origin: {
      files: [
        ...Object.entries(files).map(([key, ref]) => ({ ...ref, note: SOURCES[key].note })),
        { name: 'hand-entered.json', sha256: null, retrievedAt: null, note: manual.note },
      ],
      notes: 'INDEC tables, read by countries/ARG/providers/provincial-stats/prefill.mjs. Each value cites its provider (providers).',
    },
    values: { region: values },
  }
}
