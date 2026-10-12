// npm run anchors — recompute the score anchors (tools/sdk/anchors.mjs) from every country's datasets and write
// src/data/anchors.json. Run it when datasets change; npm test fails while the file is out of date. Scores
// change when anchors do: say so in the PR.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { COUNTRIES } from '../../src/core/countries.js'
import { computeAnchors } from '../sdk/anchors.mjs'
import { loadCountry, ROOT } from './context.mjs'

export const ANCHORS_FILE = path.join(ROOT, 'src/data/anchors.json')

export async function currentAnchors() {
  const countries = await Promise.all(COUNTRIES.map(async (c) => ({ iso3: c.iso3, ...(await loadCountry(c)) })))
  return computeAnchors(countries)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const anchors = await currentAnchors()
  const before = fs.existsSync(ANCHORS_FILE) ? JSON.parse(fs.readFileSync(ANCHORS_FILE, 'utf8')) : { indicators: {} }
  fs.writeFileSync(ANCHORS_FILE, JSON.stringify(anchors, null, 1) + '\n')
  console.log(`Wrote src/data/anchors.json from ${anchors.countries.join(', ') || 'no country'} (${anchors.method}):`)
  for (const [id, a] of Object.entries(anchors.indicators)) {
    const b = before.indicators[id]
    const changed = !b || b.lo !== a.lo || b.hi !== a.hi
    console.log(`  ${id.padEnd(16)} ${String(a.lo).padStart(8)} – ${String(a.hi).padEnd(8)} n=${a.n}${changed ? (b ? `   (was ${b.lo} – ${b.hi})` : '   (new)') : ''}`)
  }
}
