// npm run prefill:due [-- --markdown]
// Datasets older than their providers' refresh period (provider `refresh`: year | quarter | month), across all
// countries: the yearly prefill calendar. --markdown prints an issue body (used by .github/workflows/data-refresh.yml).
import { COUNTRIES } from '../../src/core/countries.js'
import { providerById } from '../../src/core/providers.js'
import { loadCountry } from './context.mjs'
import { parseArgs } from './args.mjs'

const DAYS = { year: 365, quarter: 92, month: 31 }
const args = parseArgs()
const due = []
for (const country of COUNTRIES) {
  const { datasets } = await loadCountry(country)
  for (const ds of datasets) {
    const ids = [...new Set([ds.provider, ...Object.values(ds.providers || {})].filter(Boolean))]
    const periods = ids.map((id) => DAYS[providerById(id)?.refresh]).filter(Boolean)
    if (!periods.length) continue
    const age = Math.floor((Date.now() - Date.parse(ds.generatedAt)) / 86_400_000)
    const limit = Math.min(...periods)
    if (age > limit) due.push({ country, name: ds.provider || `${country.iso3} compilation (${ids.length} references)`, age, limit, latest: ds.period?.latest })
  }
}
if (args.markdown) {
  if (due.length) {
    console.log('These datasets are older than their refresh period. Run their prefill (`npm run prefill -- <ISO3> --provider <id>`), check (`npm run country:check -- <ISO3>`) and open a PR.\n')
    for (const d of due) console.log(`- [ ] **${d.country.iso3}** \`${d.name}\`: data to ${d.latest}, generated ${d.age} days ago (refresh every ${d.limit} days)${d.country.maintainers.length ? ` · ${d.country.maintainers.join(' ')}` : ''}`)
  }
} else {
  if (!due.length) console.log('No dataset is due for a refresh.')
  for (const d of due) console.log(`${d.country.iso3}  ${d.name.padEnd(36)} data to ${d.latest}, generated ${d.age} days ago (refresh every ${d.limit} days)`)
}
