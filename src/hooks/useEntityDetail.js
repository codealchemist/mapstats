import { useEffect, useState } from 'react'
import { fetchAirDetail, fetchClimateDetail, fetchUv } from '../lib/live.js'
import { isAbort } from '../lib/meteoQueue.js'

// Per-location detail for the report panel: 10-year climate normals, 92-day air quality, UV.
export function useEntityDetail(lat, lon) {
  const [d, setD] = useState({ climate: null, air: null, uv: null, status: { climate: 'loading', air: 'loading', uv: 'loading' } })
  useEffect(() => {
    // An empty slot (compare view) passes no coordinates: nothing to load.
    if (lat == null || lon == null) {
      setD({ climate: null, air: null, uv: null, status: { climate: 'idle', air: 'idle', uv: 'idle' } })
      return
    }
    const ctrl = new AbortController()
    const { signal } = ctrl
    setD({ climate: null, air: null, uv: null, status: { climate: 'loading', air: 'loading', uv: 'loading' } })
    const run = (key, p) =>
      p.then((v) => !signal.aborted && setD((s) => ({ ...s, [key]: v, status: { ...s.status, [key]: 'ready' } })))
        .catch((e) => {
          if (isAbort(e)) return
          console.warn(`[MapStats] ${key} detail failed`, e)
          if (!signal.aborted) setD((s) => ({ ...s, status: { ...s.status, [key]: 'error' } }))
        })
    run('climate', fetchClimateDetail(lat, lon, { signal }))
    run('air', fetchAirDetail(lat, lon, { signal }))
    run('uv', fetchUv(lat, lon, { signal }))
    return () => ctrl.abort()
  }, [lat, lon])
  return d
}
