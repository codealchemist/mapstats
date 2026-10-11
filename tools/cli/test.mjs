// npm test — every offline test: news pipeline, live-data queue, golden scoring snapshot, score anchors, each provider's
// provider.test.mjs (countries/*/providers/*/, the template included) and the template's manifest.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT } from './context.mjs'

const countries = path.join(ROOT, 'countries')
const providerTests = fs.readdirSync(countries, { withFileTypes: true }).filter((d) => d.isDirectory())
  .flatMap((d) => {
    const dir = path.join(countries, d.name, 'providers')
    return fs.existsSync(dir) ? fs.readdirSync(dir).map((p) => path.join(dir, p, 'provider.test.mjs')).filter((f) => fs.existsSync(f)) : []
  })
const suites = [
  'netlify/news/test/run.mjs',
  'src/lib/test/live.mjs',
  'tests/golden.mjs',
  'tests/anchors.mjs',
  ...providerTests.map((f) => path.relative(ROOT, f)),
]

let failed = 0
for (const s of suites) {
  console.log(`\n━━ ${s}`)
  const r = spawnSync(process.execPath, [s], { cwd: ROOT, stdio: 'inherit' })
  if (r.status !== 0) failed++
}
console.log(`\n━━ countries/_template/country.config.js`)
try {
  const t = (await import(path.join(countries, '_template', 'country.config.js'))).default
  console.log(`✓ the template's manifest and provider are valid (${t.providers.map((p) => p.id).join(', ')})`)
} catch (e) {
  console.log(`✗ the template's manifest is invalid — ${e.message}`)
  failed++
}
console.log(failed ? `\n✗ ${failed} suite(s) failed` : `\n✓ ${suites.length + 1} suites passed`)
process.exitCode = failed ? 1 : 0
