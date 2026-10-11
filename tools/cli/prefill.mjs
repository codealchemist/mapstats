// npm run prefill -- <ISO3> [--provider <id>] [--out <file>] [provider options…]
// Runs each provider's prefill (countries/<ISO3>/providers/<id>/prefill.mjs), checks the dataset against the
// country (tools/sdk/dataset.mjs) and writes countries/<ISO3>/data/<id>.json. Nothing is written when the
// check finds errors. --out writes elsewhere (e.g. to compare with the committed dataset).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from './args.mjs'
import { countryOrExit, loadCountry, countryDir, ROOT } from './context.mjs'
import { providerById } from '../../src/core/providers.js'
import { writeDataset } from '../sdk/dataset.mjs'

/** Provider folders of a country that have a prefill. */
export const prefillIds = (country) => {
  const dir = path.join(countryDir(country.iso3), 'providers')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'prefill.mjs'))) : []
}

export async function runPrefill(country, id, args = {}) {
  // A folder named after a global provider prepares that provider's data for this country.
  const provider = providerById(`${country.iso3}/${id}`) || providerById(id)
  if (!provider) throw new Error(`providers/${id}: no provider "${country.iso3}/${id}" or "${id}" (country.config.js)`)
  const mod = await import(pathToFileURL(path.join(countryDir(country.iso3), 'providers', id, 'prefill.mjs')))
  const parts = await mod.prefill({ country, args, log: (...a) => console.log(`  ${a.join(' ')}`) })
  const { regionIds, places } = await loadCountry(country)
  const file = path.resolve(args.out || path.join(countryDir(country.iso3), 'data', `${id}.json`))
  const { dataset, warnings } = writeDataset(parts, { country, provider: provider.id, regionIds, places, out: file })
  for (const w of warnings) console.log(`  ⚠ ${w}`)
  const counts = Object.entries(dataset.values).map(([l, v]) => `${Object.keys(v).length} ${l}`).join(' · ')
  console.log(`✓ ${path.relative(ROOT, file)}: ${counts} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`)
  return { file, dataset }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs()
  const country = countryOrExit(args._[0])
  const ids = args.provider ? [args.provider] : prefillIds(country)
  if (!ids.length) console.log(`${country.iso3} has no provider with a prefill.mjs yet.`)
  for (const id of ids) {
    console.log(`${country.iso3} · ${id}`)
    try {
      await runPrefill(country, id, args)
    } catch (e) {
      console.error(`✗ ${e.message}`)
      process.exitCode = 1
    }
  }
}
