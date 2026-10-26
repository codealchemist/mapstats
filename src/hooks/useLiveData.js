import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAqiBatch, fetchClimateBatch, fetchFloodBatch, fetchQuakes, fetchThermalBatch, fetchUvBatch, HOST } from '../lib/live.js'
import { PRIORITY, isAbort, describeError } from '../lib/meteoQueue.js'
import { gapGrid } from '../lib/geo.js'
import { livePoints } from '../lib/scoring.js'

// Earthquakes: one USGS request for the whole country, outside the Open-Meteo queue, loaded as a one-point layer so it
// shares the others' status, progress, errors and retry. Resolves like the batch loaders ({ data, loaded, failed,
// total, error }) and rejects only when aborted.
async function fetchQuakesLayer(_points, { bbox, signal, onProgress }) {
  let result
  try {
    result = { data: await fetchQuakes(bbox, { signal }), loaded: 1, failed: 0, total: 1, error: null }
  } catch (error) {
    if (isAbort(error)) throw error
    result = { data: null, loaded: 0, failed: 1, total: 1, error }
  }
  onProgress?.(result)
  return result
}

/**
 * The live layers, in queue order: what each loads, from which service, and when. The status panel reads it too
 * (components/LiveStatus.jsx), so it shows what's queued and which layers a service's limit holds back.
 *  - `host`: the service it calls (lib/live.js HOST); an hourly or daily limit blocks one service, not the others.
 *  - `priority`: the layers that feed scores (UV, air, heat and cold) go first; climate is descriptive and waits for
 *    them (extra). The grids fill in around their layer's city points, so they wait with climate rather than delay
 *    the scores. River flow keeps the scored layers' priority: it loads only when asked for, and its one-variable
 *    requests are light, so a report's "Load" doesn't wait behind the climate archive.
 *  - `demand`: loads only once something asks for it (an overlay, the map metric, a report section, the comparison).
 *  - `grid`: the points that fill the gaps between cities on the climate surfaces, kept apart (`<layer>Grid`) so
 *    their chunks don't rescore the places. `single`: one request for the whole country.
 */
export const LIVE_LAYERS = [
  { key: 'uv', fetch: fetchUvBatch, host: HOST.historicalForecast },
  { key: 'aqi', fetch: fetchAqiBatch, host: HOST.airQuality },
  { key: 'thermal', fetch: fetchThermalBatch, host: HOST.archive },
  { key: 'climate', fetch: fetchClimateBatch, host: HOST.archive, priority: PRIORITY.extra },
  { key: 'quakes', fetch: fetchQuakesLayer, host: HOST.usgs, single: true },
  { key: 'flood', fetch: fetchFloodBatch, host: HOST.flood, demand: true },
  { key: 'climateGrid', fetch: fetchClimateBatch, host: HOST.archive, grid: true, demand: true, priority: PRIORITY.extra },
  { key: 'uvGrid', fetch: fetchUvBatch, host: HOST.historicalForecast, grid: true, demand: true, priority: PRIORITY.extra },
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
 * until the country changes. `live.retry(key)` runs a failed layer again for the places it's still missing, and
 * merges what arrives into the data already there.
 */
export function useLiveData({ iso3, geo, cities, bbox }, wanted = []) {
  const [live, setLive] = useState(EMPTY)
  const start = useRef(null)

  useEffect(() => {
    if (!geo) return
    const ctrl = new AbortController()
    const { signal } = ctrl
    const points = livePoints(geo, cities)
    // Extra grid points fill gaps between cities for the interpolated climate surfaces.
    const grid = gapGrid(geo, points, bbox)
    const pointsOf = (l) => (l.single ? [null] : l.grid ? grid : points)
    const layers = LIVE_LAYERS.filter((l) => pointsOf(l).length)
    // started: asked for at least once (on-demand layers start once); running: in flight, so a second Retry or Load
    // while it loads does nothing instead of starting a second, interleaved fetch; got: the places each layer has data
    // for, so a retry asks only for the rest.
    const started = new Set(), running = new Set(), got = {}
    const now = Date.now()
    setLive({
      ...EMPTY, iso3, grid, startedAt: now,
      status: Object.fromEntries(layers.map((l) => [l.key, l.demand ? 'off' : 'loading'])),
    })

    const update = (fn) => !signal.aborted && setLive(fn)

    start.current = (key, { retry = false } = {}) => {
      const layer = layers.find((l) => l.key === key)
      if (!layer || running.has(key) || (started.has(key) && !retry)) return
      started.add(key)
      running.add(key)
      const all = pointsOf(layer), have = got[key] ||= new Set()
      const pts = retry && !layer.single ? all.filter((p) => !have.has(String(p.id))) : all
      const merge = retry && !layer.single, offset = all.length - pts.length, since = Date.now()
      // Totals are known up front, so the status panel can show what's left before the first chunk arrives; a retry
      // counts what already loaded. A layer asked for once everything else has finished starts a new round, so its
      // time left isn't averaged with the last.
      update((l) => ({
        ...l,
        startedAt: Object.values(l.status).includes('loading') && l.startedAt ? l.startedAt : since,
        status: { ...l.status, [key]: 'loading' },
        progress: { ...l.progress, [key]: { loaded: offset, failed: 0, total: all.length, since, at: since } },
        errors: { ...l.errors, [key]: null },
      }))
      layer.fetch(pts, {
        signal, bbox, priority: layer.priority ?? PRIORITY.map,
        onProgress: ({ data, error, loaded, failed }) => {
          if (!layer.single) for (const id in data) have.add(id)
          update((l) => ({
            ...l,
            [key]: merge ? { ...l[key], ...data } : data,
            progress: { ...l.progress, [key]: { loaded: offset + loaded, failed, total: all.length, since, at: Date.now() } },
            // Shown while the rest keeps loading, not only once the layer ends.
            ...(error && !l.errors[key] && { errors: { ...l.errors, [key]: describeError(error) } }),
          }))
        },
      })
        .then((p) => {
          if (p.failed) console.warn(`[MapStats] ${key}: ${p.failed} of ${p.total} points failed`, p.error)
          const status = !p.failed ? 'ready' : p.loaded || offset ? 'partial' : 'error'
          update((l) => ({ ...l, status: { ...l.status, [key]: status }, errors: { ...l.errors, [key]: p.error ? describeError(p.error) : null } }))
        })
        .catch((err) => {
          if (isAbort(err)) return
          console.warn(`[MapStats] ${key} failed`, err)
          update((l) => ({ ...l, status: { ...l.status, [key]: 'error' }, errors: { ...l.errors, [key]: describeError(err) } }))
        })
        .finally(() => running.delete(key))
    }

    for (const l of layers) if (!l.demand) start.current(l.key)
    return () => { ctrl.abort(); start.current = null }
  }, [iso3, geo, cities, bbox])

  // Runs after the effect above on the same commit, so a new country's on-demand layers start as soon as it loads.
  const keys = wanted.filter(Boolean)
  const want = keys.join(',')
  useEffect(() => {
    keys.forEach((key) => start.current?.(key))
  }, [want, geo]) // eslint-disable-line react-hooks/exhaustive-deps -- `want` stands for `keys`

  const load = useCallback((key) => start.current?.(key), [])
  const retry = useCallback((key) => start.current?.(key, { retry: true }), [])
  // While a country switch is under way (its boundaries not loaded yet), the previous country's state would show
  // progress and buttons whose loaders are gone: show nothing until the new country starts.
  const current = geo && live.iso3 === iso3 ? live : EMPTY
  return useMemo(() => ({ ...current, load, retry }), [current, load, retry])
}
