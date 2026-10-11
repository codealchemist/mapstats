// Prefill for example-stats: download the yearly regional table once, map it to region ids and indicator
// units. Run with `npm run prefill -- XXX --provider example-stats [--year 2025]`; a stored download is reused.
// The CLI adds the dataset header, checks it and writes data/example-stats.json.
import { rawStore, parseCsv, stats } from '#sdk'
import provider from './provider.js'
import { REGION_CODES } from '../../places.js'

const urlFor = (year) => `https://stats.example.gov/household-survey/${year}/regions.csv`

// Published values can be blank ("not published"): keep them missing, never zero.
const num = (s) => (s == null || String(s).trim() === '' ? null : Number(s))

/**
 * Pure: CSV text → dataset values. Tested offline against fixtures/.
 * @returns {{ values: { region: Record<string, Record<string, number|null>> }, unmatched: string[] }}
 */
export function toValues(csvText, { regionCodes = REGION_CODES } = {}) {
  const region = {}
  const unmatched = []
  for (const r of parseCsv(csvText)) {
    const id = regionCodes[r.region_code]
    if (!id) { unmatched.push(r.region_code); continue }
    const households = num(r.households)
    region[id] = {
      // Indicator units: internet and water are % of households, poverty and unemployment are % as published.
      internet: households && num(r.hh_internet) != null ? stats.round(stats.share(num(r.hh_internet), households), 1) : null,
      water: households && num(r.hh_water) != null ? stats.round(stats.share(num(r.hh_water), households), 1) : null,
      poverty: num(r.poverty_pct),
      unemployment: num(r.unemployment_pct),
    }
  }
  return { values: { region }, unmatched }
}

/** Called by the CLI. --year defaults to last year (released each April). */
export async function prefill({ args, log }) {
  const year = +(args.year || new Date().getFullYear() - 1)
  const raw = rawStore('XXX', provider.id)
  const file = await raw.fetchOnce(urlFor(year), { name: `regions-${year}.csv` })
  const { values, unmatched } = toValues(file.text)
  if (unmatched.length) log.warn(`No region id for codes ${unmatched.join(', ')} (add them to REGION_CODES, or ignore totals/unspecified rows)`)
  return { period: { latest: year }, origin: { files: [file.ref] }, values }
}
