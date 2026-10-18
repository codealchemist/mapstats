import { useEffect, useState } from 'react'
import { fetchAqiBatch, fetchClimateBatch, fetchFloodBatch, fetchQuakes, fetchThermalBatch, fetchUvBatch } from '../lib/live.js'
import { PRIORITY, isAbort } from '../lib/meteoQueue.js'
import { gapGrid } from '../lib/geo.js'
import { livePoints } from '../lib/scoring.js'

const KEYS = ['climate', 'aqi', 'thermal', 'quakes', 'uv', 'flood']
const each = (v) => Object.fromEntries(KEYS.map((k) => [k, v]))

// status per source: idle | loading | ready | partial (some points failed) | error (none loaded)
// progress per source: { loaded, failed, total, at (time of its last update) }; startedAt: when loading began. The status
// panel estimates time left from them.
const EMPTY = { climate: null, aqi: null, thermal: null, quakes: null, uv: null, flood: null, grid: [], status: each('idle'), progress: {}, errors: {}, startedAt: null }

// Fetches live layers for every city (and city-less province) of the loaded country.
// Each source resolves independently so the map fills in progressively.
export function useLiveData({ iso3, geo, cities, bbox }) {
  const [live, setLive] = useState(EMPTY)

  useEffect(() => {
    if (!geo) return
    const ctrl = new AbortController()
    const { signal } = ctrl
    const points = livePoints(geo, cities)
    // Extra grid points fill gaps between cities for the interpolated climate surfaces.
    const grid = gapGrid(geo, points, bbox)
    // Totals are known up front, so the status panel can show what's left before the first chunk arrives.
    const startedAt = Date.now()
    const total = (n) => ({ loaded: 0, failed: 0, total: n, at: startedAt })
    const sizes = { aqi: points.length, climate: points.length + grid.length, thermal: points.length, uv: points.length + grid.length, flood: points.length, quakes: 1 }
    setLive({ ...EMPTY, grid, status: each('loading'), progress: Object.fromEntries(KEYS.map((k) => [k, total(sizes[k])])), startedAt })

    const update = (fn) => !signal.aborted && setLive(fn)
    const finish = (key, status, error = null) =>
      update((l) => ({ ...l, status: { ...l.status, [key]: status }, errors: { ...l.errors, [key]: error?.message || null } }))
    const fail = (key) => (err) => {
      if (isAbort(err)) return
      console.warn(`[MapStats] ${key} failed`, err)
      finish(key, 'error', err)
    }
    const run = (key, fetchBatch, pts, priority) =>
      fetchBatch(pts, {
        signal, priority,
        onProgress: ({ data, error, ...counts }) => update((l) => ({ ...l, [key]: data, progress: { ...l.progress, [key]: { ...counts, at: Date.now() } } })),
      })
        .then((p) => {
          if (p.failed) console.warn(`[MapStats] ${key}: ${p.failed} of ${p.total} points failed`, p.error)
          finish(key, !p.failed ? 'ready' : p.loaded ? 'partial' : 'error', p.error)
        })
        .catch(fail(key))

    fetchQuakes(bbox, { signal })
      .then((quakes) => update((l) => ({ ...l, quakes, status: { ...l.status, quakes: 'ready' }, progress: { ...l.progress, quakes: { loaded: 1, failed: 0, total: 1, at: Date.now() } } })))
      .catch(fail('quakes'))
    // Layers that feed scores (air, heat and cold, UV) and the map's climate layers first; river flow is descriptive
    // and waits for them.
    run('aqi', fetchAqiBatch, points, PRIORITY.map)
    run('climate', fetchClimateBatch, [...points, ...grid], PRIORITY.map)
    run('thermal', fetchThermalBatch, points, PRIORITY.map)
    run('uv', fetchUvBatch, [...points, ...grid], PRIORITY.map)
    run('flood', fetchFloodBatch, points, PRIORITY.extra)
    return () => ctrl.abort()
  }, [iso3, geo, cities, bbox])

  return live
}
