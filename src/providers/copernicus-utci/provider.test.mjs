// Offline test (npm test): UTCI day scores, yearly sums, sampling and request areas on synthetic grids, and reading
// a synthetic Copernicus zip (NetCDF4 days written with h5wasm), no download.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { zipSync } from 'fflate'
import h5wasm from 'h5wasm/node'
import { check, done } from '#sdk/test.mjs'
import { dayScore, yearAccumulator, sampleGrids, requestAreas } from './utci.mjs'
import { readYear, defaultYear } from './prefill.mjs'

// Days: the worst of the heat side (4 categories from 26 °C) and the cold side (4 categories from 0 °C: slight cold
// stress, 0 to 9 °C, doesn't count).
check('a day without stress scores 100', dayScore(25, 10) === 100)
check('slight cold stress (0 to 9 °C) does not lower the score', dayScore(20, 1) === 100)
check('very strong heat stress (3 of 4 heat categories) scores 25', dayScore(40, 15) === 25)
check('very strong cold stress (3 of 4 cold categories) scores 25', dayScore(5, -30) === 25)
check('the worse side counts: strong heat (50) and very strong cold (25) score 25', dayScore(33, -28) === 25)

// A 2 × 3 grid (0.25°) over 3 days; one point with a missing day. Points: rows −30, −30.25; columns −60, −59.75, −59.5.
const acc = yearAccumulator(6)
const FILL = -9e33
acc.add([20, 40, 46, 20, 20, 20], [10, 10, 10, 10, -30, 10])
acc.add([20, 38, 20, 20, 20, FILL], [10, 10, 10, 10, -27, FILL])
acc.add([20, 20, 20, 20, 20, 20], [10, 10, 10, 10, 10, 10])
const year = acc.result()
check('yearly mean of day scores', year.score[0] === 100 && year.score[1] === (25 + 25 + 100) / 3, [...year.score])
check('days with very strong heat stress or worse (≥ 38)', year.heatDays[1] === 2 && year.heatDays[2] === 1 && year.heatDays[0] === 0)
check('days with very strong cold stress or worse (≤ −27)', year.coldDays[4] === 2)
check('missing values are skipped', year.days[5] === 2 && year.score[5] === 100)

const grid = { lat0: -30, lon0: -60, step: 0.25, rows: 2, cols: 3, year }
const square = (id, x0, y0, x1, y1) => ({ type: 'Feature', properties: { id }, geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } })
const geo = { type: 'FeatureCollection', features: [square('XX-A', -60.1, -30.4, -59.6, -29.9), square('XX-I', -59.6, -30.2, -59.55, -30.15)] }
const places = [{ id: 'XXX-hot', lat: -30.02, lon: -59.76 }, { id: 'XXX-out', lat: -40, lon: -59.5 }]
const { region, city } = sampleGrids([grid], geo, places, { minDays: 2 })
check('region: mean of the grid points inside it', region['XX-A'].thermalUtci === Math.round((100 + 50 + 100 + 50) / 4), region['XX-A'])
check('region without a grid point inside takes the nearest to its label point', region['XX-I'].thermalUtci === 100 && region['XX-I'].utciColdDays === 0, region['XX-I'])
check('place takes its nearest grid point', city['XXX-hot'].thermalUtci === 50 && city['XXX-hot'].utciHeatDays === 2, city['XXX-hot'])
check('places outside every grid are left out', !('XXX-out' in city))
check('points with too few days are left out', sampleGrids([grid], geo, [{ id: 'p', lat: -30.25, lon: -59.5 }], { minDays: 3 }).city.p === undefined)

// Request areas: far-apart parts are separate requests, snapped outward to the grid and padded.
const far = { type: 'FeatureCollection', features: [square('M', -10.1, 40.1, -5.2, 44.9), square('O', 55.3, -21.3, 55.8, -20.9)] }
const areas = requestAreas(far, [{ lat: 42, lon: -8 }])
check('one request per cluster', areas.length === 2, areas)
check('areas are [N, W, S, E] snapped to 0.25° with padding', JSON.stringify(areas[0]) === JSON.stringify([45.5, -10.75, 39.5, -4.5]), areas[0])
check('south of 60° S is outside the dataset', requestAreas({ type: 'FeatureCollection', features: [square('S', 0, -70, 1, -65)] }).length === 0)

check('default year: the previous one from April, two back before', defaultYear(new Date('2026-10-11')) === 2025 && defaultYear(new Date('2026-02-01')) === 2024)

// A Copernicus-like zip: one NetCDF4 file per day with lat (descending), lon and the daily statistics in kelvin.
await h5wasm.ready
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'utci-test-'))
const files = {}
for (const [day, max, min] of [['20250101', [300, 320, 290, 300, 300, 300], [290, 280, 270, 290, 290, FILL]], ['20250102', [290, 290, 290, 290, 290, 290], [290, 290, 290, 290, 290, 290]]]) {
  const file = path.join(tmp, 'day.nc')
  const f = new h5wasm.File(file, 'w')
  f.create_dataset({ name: 'lat', data: new Float64Array([-30, -30.25]) })
  f.create_dataset({ name: 'lon', data: new Float64Array([-60, -59.75, -59.5]) })
  f.create_dataset({ name: 'utci_daily_max', data: new Float32Array(max), shape: [1, 2, 3] })
  f.create_dataset({ name: 'utci_daily_min', data: new Float32Array(min), shape: [1, 2, 3] })
  f.close()
  files[`ECMWF_utci_daily_stats_${day}_v1.1_con.area-subset.nc`] = fs.readFileSync(file)
}
fs.rmSync(tmp, { recursive: true, force: true })
const read = await readYear(Buffer.from(zipSync(files)))
check('zip read: grid from the first day', read.lat0 === -30 && read.lon0 === -60 && read.step === 0.25 && read.rows === 2 && read.cols === 3, read)
check('zip read: every day, in order', read.dates.join() === '20250101,20250102')
check('zip read: kelvin to °C before scoring', read.year.heatDays[1] === 1 && read.year.days[5] === 1 && Math.abs(read.year.score[2] - (75 + 100) / 2) < 1e-9, [...read.year.score])
done()
