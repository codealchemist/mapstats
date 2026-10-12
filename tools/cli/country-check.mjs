// npm run country:check -- <ISO3> [--quiet]
// Checks a country folder the way a reviewer would: config, geo, places, every dataset against the catalogue,
// the country's providers, its regions and places (tools/sdk/dataset.mjs), then runs its provider tests and
// reports coverage and the tier it reaches (docs/country-guide.md §2). Exits with 1 on errors.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseArgs } from './args.mjs'
import { countryOrExit, loadCountry, countryDir, providerTests, ROOT } from './context.mjs'
import { providersFor, providerById } from '../../src/core/providers.js'
import { CATEGORIES, indicatorById } from '../../src/data/metrics.js'
import { checkDataset } from '../sdk/dataset.mjs'

const args = parseArgs()
const country = countryOrExit(args._[0])
const dir = countryDir(country.iso3)
const errors = [], warnings = []
const line = (label, text) => console.log(`  ${label.padEnd(22, '.')} ${text}`)

console.log(`${country.iso3} · ${country.name}`)
line('config', `${country.regionLabel}${country.subregionLabel ? ` / ${country.subregionLabel}` : ''} · ${providersFor(country).length} providers · maintainers ${country.maintainers.join(', ') || '— (add yours)'}`)
if (!country.maintainers.length) warnings.push('config: no maintainers listed')

// ---------- geo and places ----------
const { geo, regionIds, places, curated, datasets } = await loadCountry(country)
if (!geo) errors.push('geo/regions.json missing: npm run geo -- ' + country.iso3)
const dupRegions = regionIds.filter((id, i) => regionIds.indexOf(id) !== i)
if (dupRegions.length) errors.push(`geo: duplicate region ids ${dupRegions.join(', ')}`)
const regions = new Set(regionIds)
const placeIds = new Set()
for (const p of places) {
  if (placeIds.has(p.id)) errors.push(`places: duplicate id ${p.id}`)
  placeIds.add(p.id)
  if (!p.id.startsWith(`${country.iso3}-`)) errors.push(`places: ${p.id} must start with ${country.iso3}-`)
  if (!regions.has(p.region)) (p.region ? errors : warnings).push(`places: ${p.id} region ${p.region ?? '(none)'} is not in geo/regions.json${p.region ? '' : ' (not shown)'}`)
  if (![p.lat, p.lon].every(Number.isFinite)) errors.push(`places: ${p.id} needs numeric lat / lon`)
}
line('geo', `${regionIds.length} regions · ${places.length} ${curated ? 'curated places (places.js)' : 'Natural Earth cities'}`)

// ---------- datasets ----------
const published = {} // indicator → { provider, level counts }
for (const ds of datasets) {
  const r = checkDataset(ds, { country, regionIds, places })
  errors.push(...r.errors)
  warnings.push(...r.warnings)
  const levels = Object.entries(ds.values || {}).map(([l, v]) => `${l} ${Object.keys(v).length}`).join(' · ')
  line(ds.provider || 'compilation', `${ds.period?.latest} · ${levels}${ds.series ? ` · series ${ds.series.years[0]}–${ds.series.years.at(-1)}` : ''}`)
  if (!args.quiet) {
    for (const [k, s] of Object.entries(r.indicators)) {
      const region = s.levels.region || 0
      const range = Number.isFinite(s.min) ? `${+s.min.toFixed(2)}–${+s.max.toFixed(2)}` : '—'
      const sr = s.range ? `${s.range.from === 'anchors' ? 'scored' : 'domain'} [${s.range.range.join(', ')}]` : 'descriptive'
      console.log(`     ${k.padEnd(18)} ${String(region).padStart(3)}/${regionIds.length} regions  range ${range.padEnd(14)} ${sr}${s.outside ? `  · ${s.outside} beyond${s.range.from === 'domain' ? ' ⚠' : ''}` : ''}`)
    }
  }
  for (const [k, s] of Object.entries(r.indicators)) {
    const prev = published[k]
    published[k] = { provider: s.provider, region: (prev?.region || 0) + (s.levels.region || 0), subregion: s.levels.subregion || 0, city: s.levels.city || 0, series: !!ds.series?.years }
  }
}
if (!datasets.length) line('datasets', 'none yet: live global data only')

// ---------- provider tests ----------
const tests = providerTests(country.iso3)
for (const t of tests) {
  const r = spawnSync(process.execPath, [t], { cwd: ROOT, encoding: 'utf8' })
  const name = path.relative(dir, t)
  line('test', `${name} ${r.status === 0 ? 'passed' : 'FAILED'}`)
  if (r.status !== 0) errors.push(`${name} failed:\n${(r.stdout + r.stderr).split('\n').filter((l) => l.startsWith('✗') || /Error/.test(l)).join('\n')}`)
}
for (const p of providersFor(country).filter((x) => x.country)) {
  const id = p.id.split('/')[1]
  if (fs.existsSync(path.join(dir, 'providers', id, 'prefill.mjs')) && !fs.existsSync(path.join(dir, 'providers', id, 'provider.test.mjs'))) {
    warnings.push(`providers/${id}: has a prefill but no provider.test.mjs`)
  }
}

// ---------- tier (docs/country-guide.md §2) ----------
const news = country.news
const covered = (cat) => Object.entries(published).some(([k, s]) => indicatorById[k].category === cat && indicatorById[k].better && s.region >= 0.9 * regionIds.length)
const register = (k) => providerById(published[k]?.provider)?.kind === 'register'
const crimeLocal = Object.keys(published).filter((k) => indicatorById[k].category === 'safety' && register(k))
const ownCrime = places.filter((p) => crimeLocal.some((k) => (published[k].subregion && p.codes?.subregion) || published[k].city)).length
const tiers = [
  ['Environment', regionIds.length > 0, 'config + geo (npm run geo)'],
  ['News', news.lang && news.edition && (news.outlets.verified.length >= Math.max(1, regionIds.length / 3) || news.outletsNote), `language, edition and verified outlets for ≥ 1/3 of regions (${news.outlets.verified.length}/${regionIds.length}), or outletsNote saying why there are none`],
  ['Curated', ['safety', 'services', 'economy'].every(covered), `≥ 90 % of regions in Safety, Services and Economy (${['safety', 'services', 'economy'].filter(covered).map((c) => CATEGORIES.find((x) => x.id === c).label).join(', ') || 'none'})`],
  ['Local', curated && ownCrime >= 0.75 * places.length && crimeLocal.some((k) => published[k].series), `curated places, official crime data for ≥ 75 % of them (${ownCrime}/${places.length}), yearly series`],
]
const reached = tiers.findIndex((t) => !t[1])
const tier = reached === -1 ? tiers.length - 1 : reached - 1
console.log(`\n  ${tier < 0 ? 'No tier yet' : `Tier ${tier} · ${tiers[tier][0]}`}`)
if (tiers[tier + 1]) console.log(`  next: Tier ${tier + 1} · ${tiers[tier + 1][0]} needs ${tiers[tier + 1][2]}`)

if (warnings.length) console.log(`\n${warnings.length} warning(s)\n  ⚠ ${warnings.join('\n  ⚠ ')}`)
if (errors.length) {
  console.log(`\n${errors.length} error(s)\n  ✗ ${errors.join('\n  ✗ ')}`)
  process.exitCode = 1
} else console.log('\nNo errors.')
