// Prefill for UTCI heat and cold stress (Copernicus ERA5-HEAT), for any country:
//   npm run prefill -- <ISO3> --provider copernicus-utci [--year 2025]
//
// Needs a Copernicus token (CDSAPI_KEY in .env, see .env.example) and the "Licence to use Copernicus Products"
// accepted on https://cds.climate.copernicus.eu/datasets/derived-utci-historical?tab=download. Requests one year of
// daily UTCI statistics (highest and lowest per day) per area of the country (utci.mjs requestAreas): each waits a
// few minutes in the Copernicus queue and is kept in raw/ (gitignored), so later runs read the stored zip.
// The default year is the last one with final ("consolidated") data: Copernicus publishes it 2–3 months late.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import h5wasm from 'h5wasm/node'
import { rawStore, cdsRetrieve } from '#sdk'
import { loadCountry } from '../../../tools/cli/context.mjs'
import { requestAreas, sampleGrids, yearAccumulator } from './utci.mjs'

const RAW = path.join(path.dirname(fileURLToPath(import.meta.url)), 'raw')
const DATASET = 'derived-utci-historical'
const PAGE = `https://cds.climate.copernicus.eu/datasets/${DATASET}`
const pad = (n) => String(n).padStart(2, '0')

/** Last year with consolidated data (published 2–3 months after the year ends). */
export const defaultYear = (now = new Date()) => now.getUTCFullYear() - (now.getUTCMonth() < 3 ? 2 : 1)

/** One area's year of daily statistics from its zip: a grid of yearly sums (utci.mjs) and the days read. */
export async function readYear(buffer) {
  await h5wasm.ready
  const entries = Object.entries(unzipSync(new Uint8Array(buffer))).filter(([n]) => n.endsWith('.nc')).sort(([a], [b]) => a.localeCompare(b))
  if (!entries.length) throw new Error('No NetCDF files in the Copernicus zip')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'utci-'))
  let grid = null, acc = null
  const dates = []
  try {
    for (const [name, bytes] of entries) {
      const file = path.join(tmp, 'day.nc')
      fs.writeFileSync(file, bytes)
      const f = new h5wasm.File(file, 'r')
      try {
        const lat = f.get('lat').value, lon = f.get('lon').value
        if (!grid) {
          grid = { lat0: lat[0], lon0: lon[0], step: +(lat[0] - lat[1]).toFixed(4), rows: lat.length, cols: lon.length }
          if (!(grid.step > 0) || Math.abs(lon[1] - lon[0] - grid.step) > 1e-6) throw new Error(`${name}: expected a regular grid, north to south`)
          acc = yearAccumulator(grid.rows * grid.cols)
        } else if (lat.length !== grid.rows || lon.length !== grid.cols || lat[0] !== grid.lat0 || lon[0] !== grid.lon0) {
          throw new Error(`${name}: grid differs from the first day's`)
        }
        const toC = (k) => Float32Array.from(f.get(k).value, (v) => v - 273.15) // kelvin; fill values stay out of range
        acc.add(toC('utci_daily_max'), toC('utci_daily_min'))
      } finally {
        f.close()
      }
      dates.push(name.match(/_(\d{8})_/)?.[1])
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return { ...grid, year: acc.result(), dates: dates.filter(Boolean) }
}

export async function prefill({ country, args, log }) {
  const year = +(args.year || defaultYear())
  const raw = rawStore('GLOBAL', 'copernicus-utci', { dir: RAW, delayMs: 0 })
  const { geo, places } = await loadCountry(country)
  const areas = requestAreas(geo, places.filter((p) => p.lat != null))
  const names = areas.map((area) => `${country.iso3}_${year}_${area.join('_')}.zip`)
  // Areas not stored yet are requested together: each waits minutes in the Copernicus queue.
  await Promise.all(areas.map(async (area, i) => {
    const name = names[i]
    if (raw.manifest.files[name] && fs.existsSync(path.join(raw.dir, name))) return
    log(`requesting ${year} for area N ${area[0]} W ${area[1]} S ${area[2]} E ${area[3]} from Copernicus…`)
    const inputs = {
      variable: ['universal_thermal_climate_index_daily_statistics'], version: '1_1', product_type: 'consolidated_dataset',
      year: [String(year)], month: Array.from({ length: 12 }, (_, m) => pad(m + 1)), day: Array.from({ length: 31 }, (_, d) => pad(d + 1)), area,
    }
    const { buffer } = await cdsRetrieve(DATASET, inputs, { log })
    fs.mkdirSync(raw.dir, { recursive: true })
    fs.writeFileSync(path.join(raw.dir, name), buffer)
    raw.add(name, { url: PAGE, note: `Copernicus ERA5-HEAT v1.1 consolidated, UTCI daily statistics ${year}, area [N, W, S, E] ${JSON.stringify(area)}; Licence to use Copernicus Products` })
  }))
  const grids = []
  for (const name of names) {
    const file = raw.read(name)
    if (file.changed) throw new Error(`${name} no longer matches its manifest entry: delete it to download it again`)
    const grid = await readYear(file.buffer)
    if (grid.dates.length < 365) log(`⚠ ${name}: only ${grid.dates.length} days`)
    grids.push({ ...grid, ref: file.ref })
  }
  const values = sampleGrids(grids, geo, places.filter((p) => p.region))
  log(`${Object.keys(values.region).length} of ${geo.features.length} regions and ${Object.keys(values.city).length} places from ${grids.length} area(s)`)
  return {
    period: { latest: year, aggregation: 'yearly mean of daily UTCI stress scores (UTC days); regions: mean of the 0.25° grid points inside them; places: their nearest grid point' },
    origin: {
      files: grids.map((g) => g.ref),
      notes: `Copernicus Climate Change Service, Thermal comfort indices derived from ERA5 reanalysis (ERA5-HEAT) v1.1, consolidated, ${year} (doi:10.24381/cds.553b7518). Contains modified Copernicus Climate Change Service information ${new Date().getUTCFullYear()}; Licence to use Copernicus Products.`,
    },
    values,
  }
}
