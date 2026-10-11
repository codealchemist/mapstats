// npm run country:new -- <ISO3> --iso2 <XX> --name "<Name>" --region-label <Province|State|…> [--lang es]
// Starts a country folder: manifest, news settings and README, registered in countries/index.js. The app then
// shows it with live global data (Tier 0) once its boundaries are built: NE_DIR=… npm run geo -- <ISO3>.
// countries/_template/ is the worked example to copy a provider from.
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from './args.mjs'
import { ROOT } from './context.mjs'

const args = parseArgs()
const iso3 = String(args._[0] || '').toUpperCase()
const iso2 = String(args.iso2 || '').toUpperCase()
const { name, lang = 'en' } = args
const regionLabel = args['region-label']
if (!/^[A-Z]{3}$/.test(iso3) || !/^[A-Z]{2}$/.test(iso2) || !name || !regionLabel) {
  console.error('Usage: npm run country:new -- <ISO3> --iso2 <XX> --name "<Name>" --region-label <Province|State|…> [--lang es]')
  process.exit(1)
}
const dir = path.join(ROOT, 'countries', iso3)
if (fs.existsSync(path.join(dir, 'country.config.js'))) {
  console.error(`countries/${iso3} already exists.`)
  process.exit(1)
}
const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`

fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'country.config.js'), `// @ts-check
import { defineCountry } from '#core/define.js'
import news from './news.js'

export default defineCountry({
  iso3: '${iso3}',
  iso2: '${iso2}',
  name: ${q(name)},
  regionLabel: ${q(regionLabel)},
  // subregionLabel: 'Municipality',          // once a provider publishes second-level data
  // bounds: [west, south, east, north],      // only if remote territories zoom the map out too far
  // Global live providers are always on. Add opt-in global ones by id and your own provider definitions
  // (see countries/_template/providers/example-stats/).
  providers: [],
  news,
  maintainers: [],
})
`)
fs.writeFileSync(path.join(dir, 'news.js'), `// News settings for ${name}: shared by the app and the /api/news function (pure data). See docs/country-guide.md §4.6.
export default {
  lang: ${q(lang)},
  countryName: ${q(name)}, // as the local press writes it
  edition: { hl: ${q(lang === 'en' ? 'en-US' : lang)}, gl: '${iso2}' }, // check https://news.google.com/?hl=…&gl=…&ceid=… doesn't redirect
  ambiguousNames: [],
  regions: [],
  outlets: { verified: [], candidates: [] },
}
`)
fs.writeFileSync(path.join(dir, 'README.md'), `# ${name} (${iso3})

| | |
|---|---|
| Tier | 0 · Environment *(npm run country:check -- ${iso3})* |
| Maintainers | |
| Regions | |
| Last prefill | — |

## Sources

| Provider | Indicators | Level | Latest | Next release |
|---|---|---|---|---|
| Open-Meteo, USGS *(global, live)* | climate, air, UV, floods, elevation, earthquakes | point | live | — |

## Known gaps and next steps

- Choose sources for Safety, Services and Economy (docs/country-guide.md §3).
`)

const index = path.join(ROOT, 'countries', 'index.js')
let src = fs.readFileSync(index, 'utf8')
const imports = src.match(/^import .*$/gm)
src = src.replace(imports.at(-1), `${imports.at(-1)}\nimport ${iso3} from './${iso3}/country.config.js'`)
src = src.replace(/export const COUNTRIES = \[(.*)\]/, (_, list) => `export const COUNTRIES = [${list}, ${iso3}]`)
fs.writeFileSync(index, src)

console.log(`Created countries/${iso3}/ and registered it in countries/index.js. Next:
  1. NE_DIR=/path/to/natural-earth npm run geo -- ${iso3}     boundaries and cities (countries/${iso3}/geo/)
  2. npm run dev                                          the country shows with live data (Tier 0)
  3. add yourself to maintainers, fill news.js, then pick sources: docs/country-guide.md
  4. npm run country:check -- ${iso3}`)
