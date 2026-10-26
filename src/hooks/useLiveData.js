import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAqiBatch, fetchClimateBatch, fetchFloodBatch, fetchQuakes, fetchThermalBatch, fetchUvBatch } from '../lib/live.js'
import { PRIORITY, isAbort, describeError } from '../lib/meteoQueue.js'
import { gapGrid } from '../lib/geo.js'
import { livePoints } from '../lib/scoring.js'

// Point layers, in queue order. The layers that feed scores (UV, air, heat and cold) go first; climate is descriptive
// and waits for them. `demand` layers load only once something asks for them (an overlay, a map metric, a report
// section): river flow, and the grid points that fill the gaps between cities on the climate surfaces. Grid layers keep
// their data apart (`<layer>Grid`): only the surfaces read it, so their chunks don't rescore the places.
// Priorities: the grids fill in around their layer's city points, so they wait with climate (extra, first come first
// served) rather than delay the scores. River flow keeps the scored layers' priority: it loads only when asked for (a
// report's "Load" button, the overlay), and its one-variable requests are light, so the user doesn't wait behind the
// climate archive.
const LAYERS = [
  { key: 'uv', fetch: fetchUvBatch },
  { key: 'aqi', fetch: fetchAqiBatch },
  { key: 'thermal', fetch: fetchThermalBatch },
  { key: 'climate', fetch: fetchClimateBatch, priority: PRIORITY.extra },
  { key: 'flood', fetch: fetchFloodBatch, demand: true },
  { key: 'climateGrid', fetch: fetchClimateBatch, grid: true, demand: true, priority: PRIORITY.extra },
  { key: 'uvGrid', fetch: fetchUvBatch, grid: true, demand: true, priority: PRIORITY.extra },
]

// status per layer: off (on demand, not requested) | loading | ready | partial (some points failed) | error (none loaded)
// errors per layer: the first failure in plain words (lib/meteoQueue.js describeError), set as soon as a chunk fails.
// progress per layer: { loaded, failed, total, since (when it started), at (time of its last update) }; startedAt: when
// the current round of loading began. The status panel estimates time left from them.
const EMPTY = { iso3: null, climate: null, aqi: null, thermal: null, quakes: null, uv: null, flood: null, climateGrid: null, uvGrid: null, grid: [], status: {}, progress: {}, errors: {}, startedAt: null }

/**
 * Fetches live layers for every city (and city-less province) of the loaded country. Each layer resolves
 * independently so the map fills in progressively. On-demand layers start when they appear in `wanted` (overlays,
 * the map metric) or through `live.load(key)` (a button); once started, a layer keeps loading and keeps its data
 * until the country changes. `live.retry(key)` runs a failed layer again: chunks that loaded come from the cache, so
 * only the failed ones are requested, and what arrives is merged into the data already there.
 */
export function useLiveData({ iso3, geo, cities, bbox }, wanted = []) {
  const [live, setLive] = useState(EMPTY)
  const start = useRef(null)
  const quakes = useRef(null)

  useEffect(() => {
    if (!geo) return
    const ctrl = new AbortController()
    const { signal } = ctrl
    const points = livePoints(geo, cities)
    // Extra grid points fill gaps between cities for the interpolated climate surfaces.
    const grid = gapGrid(geo, points, bbox)
    const layers = LAYERS.filter((l) => (l.grid ? grid : points).length)
    // started: asked for at least once (on-demand layers start once); running: in flight, so a second Retry or Load
    // while it loads does nothing instead of starting a second, interleaved fetch.
    const started = new Set(), running = new Set()
    const now = Date.now()
    setLive({
      ...EMPTY, iso3, grid, startedAt: now,
      status: Object.fromEntries(layers.map((l) => [l.key, l.demand ? 'off' : 'loading'])),
    })

    const update = (fn) => !signal.aborted && setLive(fn)
    const finish = (key, status, error = null) =>
      update((l) => ({ ...l, status: { ...l.status, [key]: status }, errors: { ...l.errors, [key]: error ? describeError(error) : null } }))
    const fail = (key) => (err) => {
      if (isAbort(err)) return
      console.warn(`[MapStats] ${key} failed`, err)
      finish(key, 'error', err)
    }

    start.current = (key, { retry = false } = {}) => {
      const layer = layers.find((l) => l.key === key)
      if (!layer || running.has(key) || (started.has(key) && !retry)) return
      started.add(key)
      running.add(key)
      const pts = layer.grid ? grid : points, since = Date.now()
      // Totals are known up front, so the status panel can show what's left before the first chunk arrives. A layer
      // asked for once everything else has finished starts a new round, so its time left isn't averaged with the last.
      update((l) => ({
        ...l,
        startedAt: Object.values(l.status).includes('loading') ? l.startedAt : since,
        status: { ...l.status, [key]: 'loading' },
        progress: { ...l.progress, [key]: { loaded: 0, failed: 0, total: pts.length, since, at: since } },
        errors: { ...l.errors, [key]: null },
      }))
      layer.fetch(pts, {
        signal, priority: layer.priority ?? PRIORITY.map,
        onProgress: ({ data, error, ...counts }) => update((l) => ({
          ...l,
          [key]: retry ? { ...l[key], ...data } : data,
          progress: { ...l.progress, [key]: { ...counts, since, at: Date.now() } },
          // Shown while the rest keeps loading, not only once the layer ends.
          ...(error && !l.errors[key] && { errors: { ...l.errors, [key]: describeError(error) } }),
        })),
      })
        .then((p) => {
          if (p.failed) console.warn(`[MapStats] ${key}: ${p.failed} of ${p.total} points failed`, p.error)
          finish(key, !p.failed ? 'ready' : p.loaded ? 'partial' : 'error', p.error)
        })
        .catch(fail(key))
        .finally(() => running.delete(key))
    }

    // One USGS request, outside the Open-Meteo queue.
    quakes.current = () => {
      if (running.has('quakes')) return
      running.add('quakes')
      const since = Date.now()
      update((l) => ({
        ...l,
        startedAt: Object.values(l.status).includes('loading') ? l.startedAt ?? since : since,
        status: { ...l.status, quakes: 'loading' },
        progress: { ...l.progress, quakes: { loaded: 0, failed: 0, total: 1, since, at: since } },
        errors: { ...l.errors, quakes: null },
      }))
      fetchQuakes(bbox, { signal })
        .then((list) => update((l) => ({ ...l, quakes: list, status: { ...l.status, quakes: 'ready' }, progress: { ...l.progress, quakes: { ...l.progress.quakes, loaded: 1, at: Date.now() } } })))
        .catch((err) => { if (!isAbort(err)) update((l) => ({ ...l, progress: { ...l.progress, quakes: { ...l.progress.quakes, failed: 1, at: Date.now() } } })); fail('quakes')(err) })
        .finally(() => running.delete('quakes'))
    }
    quakes.current()
    for (const l of layers) if (!l.demand) start.current(l.key)
    return () => { ctrl.abort(); start.current = null; quakes.current = null }
  }, [iso3, geo, cities, bbox])

  // Runs after the effect above on the same commit, so a new country's on-demand layers start as soon as it loads.
  const keys = wanted.filter(Boolean)
  const want = keys.join(',')
  useEffect(() => {
    keys.forEach((key) => start.current?.(key))
  }, [want, geo]) // eslint-disable-line react-hooks/exhaustive-deps -- `want` stands for `keys`

  const load = useCallback((key) => start.current?.(key), [])
  const retry = useCallback((key) => (key === 'quakes' ? quakes.current?.() : start.current?.(key, { retry: true })), [])
  // While a country switch is under way (its boundaries not loaded yet), the previous country's state would show
  // progress and buttons whose loaders are gone: show nothing until the new country starts.
  const current = geo && live.iso3 === iso3 ? live : EMPTY
  return useMemo(() => ({ ...current, load, retry }), [current, load, retry])
}
