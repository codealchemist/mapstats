// TTL cache on top of Netlify Blobs (which has no native expiry): every entry is stored as
// { value, expiresAt } and treated as missing once expired. Expired entries are simply
// overwritten by the next request for the same key (nothing is fetched in advance).
import crypto from 'node:crypto'

export const hashKey = (...parts) => crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)

export function createCache(store, now = Date.now) {
  return {
    async getEntry(key) {
      try {
        const e = await store.get(key, { type: 'json' })
        return e && typeof e === 'object' && 'expiresAt' in e ? { ...e, fresh: e.expiresAt > now() } : null
      } catch {
        return null
      }
    },
    async getFresh(key) {
      const e = await this.getEntry(key)
      return e?.fresh ? e.value : null
    },
    async put(key, value, ttlMs, expiresAt = now() + ttlMs) {
      try { await store.setJSON(key, { value, expiresAt }) } catch { /* cache is best-effort */ }
      return expiresAt
    },
  }
}

/** In-memory store with the Blobs interface subset we use (tests and `news:probe`). */
export function memoryStore() {
  const m = new Map()
  return { async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null }, async setJSON(k, v) { m.set(k, JSON.stringify(v)) }, map: m }
}
