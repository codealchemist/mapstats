import { useEffect, useState } from 'react'
import { fetchAirDetail, fetchClimateDetail, fetchUv } from '../lib/live.js'

// Per-location detail for the report panel: 10-year climate normals, 92-day air quality, UV.
export function useEntityDetail(lat, lon) {
  const [d, setD] = useState({ climate: null, air: null, uv: null, status: { climate: 'loading', air: 'loading', uv: 'loading' } })
  useEffect(() => {
    let cancelled = false
    // An empty slot (compare view) passes no coordinates: nothing to load.
    if (lat == null || lon == null) {
      setD({ climate: null, air: null, uv: null, status: { climate: 'idle', air: 'idle', uv: 'idle' } })
      return
    }
    setD({ climate: null, air: null, uv: null, status: { climate: 'loading', air: 'loading', uv: 'loading' } })
    const run = (key, p) =>
      p.then((v) => !cancelled && setD((s) => ({ ...s, [key]: v, status: { ...s.status, [key]: 'ready' } })))
        .catch((e) => {
          console.warn(`[MapStats] ${key} detail failed`, e)
          if (!cancelled) setD((s) => ({ ...s, status: { ...s.status, [key]: 'error' } }))
        })
    run('climate', fetchClimateDetail(lat, lon))
    run('air', fetchAirDetail(lat, lon))
    run('uv', fetchUv(lat, lon))
    return () => { cancelled = true }
  }, [lat, lon])
  return d
}
