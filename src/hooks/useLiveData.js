import { useEffect, useState } from 'react'
import { fetchAqiBatch, fetchClimateBatch, fetchFloodBatch, fetchQuakes, fetchUvBatch } from '../lib/live.js'
import { PRIORITY, isAbort } from '../lib/meteoQueue.js'
import { gapGrid } from '../lib/geo.js'
import { livePoints } from '../lib/scoring.js'

const KEYS = ['climate', 'aqi', 'quakes', 'uv', 'flood']
const each = (v) => Object.fromEntries(KEYS.map((k) => [k, v]))

// status per source: idle | loading | ready | partial (some points failed) | error (none loaded)
const EMPTY = { climate: null, aqi: null, quakes: null, uv: null, flood: null, grid: [], status: each('idle'), progress: {}, errors: {} }

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
    setLive({ ...EMPTY, grid, status: each('loading') })

    const update = (fn) => !signal.aborted && setLive(fn)
    const finish = (key, status, error = null) =>
      update((l) => ({ ...l, status: { ...l.status, [key]: status }, errors: { ...l.errors, [key]: error?.message || null } }))
    const fail = (key) => (err) => {
      if (isAbort(err)) return
      console.warn(`[MapStats] ${key} failed`, err)
      finish(key, 'error', err)
    }
    const run = (key, fetchBatch, pts, priority) =>
      fetchBatch(pts, { signal, priority, onProgress: (p) => update((l) => ({ ...l, [key]: p.data, progress: { ...l.progress, [key]: p } })) })
        .then((p) => {
          if (p.failed) console.warn(`[MapStats] ${key}: ${p.failed} of ${p.total} points failed`, p.error)
          finish(key, !p.failed ? 'ready' : p.loaded ? 'partial' : 'error', p.error)
        })
        .catch(fail(key))

    fetchQuakes(bbox, { signal })
      .then((quakes) => update((l) => ({ ...l, quakes, status: { ...l.status, quakes: 'ready' } })))
      .catch(fail('quakes'))
    // Scored layers first; UV and river flow are descriptive and wait for them.
    run('aqi', fetchAqiBatch, points, PRIORITY.map)
    run('climate', fetchClimateBatch, [...points, ...grid], PRIORITY.map)
    run('uv', fetchUvBatch, [...points, ...grid], PRIORITY.extra)
    run('flood', fetchFloodBatch, points, PRIORITY.extra)
    return () => ctrl.abort()
  }, [iso3, geo, cities, bbox])

  return live
}
