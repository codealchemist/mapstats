import { useEffect, useState } from 'react'
import { fetchAqiBatch, fetchClimateBatch, fetchFloodBatch, fetchQuakes, fetchUvBatch } from '../lib/live.js'
import { gapGrid } from '../lib/geo.js'
import { livePoints } from '../lib/scoring.js'

const EMPTY = { climate: null, aqi: null, quakes: null, uv: null, flood: null, grid: [], status: { climate: 'idle', aqi: 'idle', quakes: 'idle', uv: 'idle', flood: 'idle' } }

// Fetches live layers for every city (and city-less province) of the loaded country.
// Each source resolves independently so the map fills in progressively.
export function useLiveData({ iso3, geo, cities, bbox }) {
  const [live, setLive] = useState(EMPTY)

  useEffect(() => {
    if (!geo) return
    let cancelled = false
    const points = livePoints(geo, cities)
    // Extra grid points fill gaps between cities for the interpolated climate surfaces.
    const grid = gapGrid(geo, points, bbox)
    setLive({ ...EMPTY, grid, status: { climate: 'loading', aqi: 'loading', quakes: 'loading', uv: 'loading', flood: 'loading' } })

    const run = (key, promise) =>
      promise
        .then((data) => !cancelled && setLive((l) => ({ ...l, [key]: data, status: { ...l.status, [key]: 'ready' } })))
        .catch((err) => {
          console.warn(`[MapStats] ${key} failed`, err)
          if (!cancelled) setLive((l) => ({ ...l, status: { ...l.status, [key]: 'error' } }))
        })

    run('quakes', fetchQuakes(bbox))
    run('aqi', fetchAqiBatch(points))
    run('climate', fetchClimateBatch([...points, ...grid]))
    run('uv', fetchUvBatch([...points, ...grid]))
    run('flood', fetchFloodBatch(points))
    return () => { cancelled = true }
  }, [iso3, geo, cities, bbox])

  return live
}
