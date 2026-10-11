// Matching a source's place names and points to MapStats places.
import { pointInFeature } from '../../src/lib/geo.js'

/** Accent-insensitive, lowercase, trimmed name. */
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Name → id matcher that reports what it could not match, instead of guessing.
 * @param entries  [{ id, name, aliases?: string[] }]
 * @param opts.strip  prefixes to drop before matching ("provincia de ")
 */
export function matcher(entries, { strip = [] } = {}) {
  const clean = (s) => strip.reduce((x, p) => (x.startsWith(p) ? x.slice(p.length) : x), fold(s))
  const index = new Map()
  for (const e of entries) for (const n of [e.name, ...(e.aliases || [])]) index.set(clean(n), e.id)
  const unmatched = new Set()
  return {
    match(name) {
      const id = index.get(clean(name)) ?? null
      if (!id && name) unmatched.add(String(name))
      return id
    },
    unmatched: () => [...unmatched].sort(),
  }
}

/** Id of the feature containing a point: e.g. the region (geo/regions.json) or subregion a city lies in. */
export function featureAt(lat, lon, featureCollection) {
  return featureCollection.features.find((f) => pointInFeature([lon, lat], f))?.properties.id ?? null
}
