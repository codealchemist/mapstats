// Polite, download-once access to a source's files: countries/<ISO3>/providers/<provider>/raw/ (gitignored) plus
// a committed manifest.json recording each file's URL, date and SHA-256, so anyone can fetch the same files and
// verify them.
//   - each URL is downloaded once; later runs read the stored copy (refresh: true to download again)
//   - robots.txt is honoured, requests are spaced (5 s by default) and identify MapStats
//   - the first 403 / 429 stops the run: the site does not want automated requests
//   - a server that sends nothing for 60 s fails the download instead of hanging the run
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { robotsAllows } from '../../netlify/news/robots.mjs'

const COUNTRIES = fileURLToPath(new URL('../../countries/', import.meta.url))

const UA = process.env.MAPSTATS_USER_AGENT || 'MapStats data import (+https://github.com/codealchemist/mapstats)'
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = () => new Date().toISOString().slice(0, 10)
const nameOf = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'index.html'

// Runs fn holding a lock (a directory: mkdir is atomic) shared by every process; a lock older than 30 s is stale.
function withLock(lock, fn) {
  const wait = new Int32Array(new SharedArrayBuffer(4))
  for (let tries = 0; ; tries++) {
    try {
      fs.mkdirSync(lock)
      break
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      if (Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now()) > 30000) fs.rmSync(lock, { recursive: true, force: true })
      else if (tries > 1000) throw new Error(`${lock}: still locked after 20 s`)
      Atomics.wait(wait, 0, 0, 20)
    }
  }
  try {
    return fn()
  } finally {
    fs.rmSync(lock, { recursive: true, force: true })
  }
}

let lastRequest = 0
const robotsCache = new Map()

async function allowed(url, timeoutMs) {
  const u = new URL(url)
  if (!robotsCache.has(u.origin)) {
    const res = await fetch(`${u.origin}/robots.txt`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) }).catch(() => null)
    robotsCache.set(u.origin, res?.ok ? await res.text().catch(() => '') : '')
  }
  return robotsAllows(robotsCache.get(u.origin), u.pathname + u.search)
}

/** One request under the store's rules: robots.txt, spacing, 403/429 stop, and a timeout on silence (not on size). */
async function get(url, { delayMs, timeoutMs, headers = {} }) {
  if (!(await allowed(url, timeoutMs))) throw new Error(`robots.txt disallows ${url}: download it by hand into raw/, then pass byHand: true (or register it with add())`)
  const wait = lastRequest + delayMs - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()
  const ctl = new AbortController()
  let timer
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => ctl.abort(new Error(`${url}: nothing received for ${timeoutMs / 1000} s, giving up`)), timeoutMs) }
  arm()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctl.signal })
    if (res.status === 403 || res.status === 429) throw new Error(`${new URL(url).host} answered ${res.status}: stopping (it does not want automated requests)`)
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    const chunks = []
    for await (const chunk of res.body) { chunks.push(chunk); arm() }
    return Buffer.concat(chunks)
  } finally {
    clearTimeout(timer)
    ctl.abort()
  }
}

/**
 * @param iso3      country
 * @param provider  provider id (without the country prefix)
 * @param opts.delayMs    pause between requests
 * @param opts.timeoutMs  how long a server may send nothing (no answer, or a stalled body) before the download fails
 * @param opts.dir        use this folder instead of the provider's raw/ (e.g. tests)
 */
export function rawStore(iso3, provider, { delayMs = 5000, timeoutMs = 60000, dir: custom } = {}) {
  const dir = path.resolve(custom || path.join(COUNTRIES, iso3, 'providers', provider, 'raw'))
  const manifestFile = path.join(dir, 'manifest.json')
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { files: {} }
  // Saves one entry into the manifest as it is on disk now (several prefills may share a folder, e.g. a global
  // provider's run for many countries at once), written whole through a rename so readers never see half a file.
  const save = (name) => {
    fs.mkdirSync(dir, { recursive: true })
    withLock(`${manifestFile}.lock`, () => {
      const disk = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { files: {} }
      disk.files[name] = manifest.files[name]
      Object.assign(manifest.files, disk.files)
      const tmp = `${manifestFile}.${process.pid}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(disk, null, 2) + '\n')
      fs.renameSync(tmp, manifestFile)
    })
  }
  const ref = (name) => ({ name, ...(manifest.files[name].url && { url: manifest.files[name].url }), sha256: manifest.files[name].sha256, retrievedAt: manifest.files[name].retrievedAt })
  // `changed`: the file on disk is no longer the one the manifest describes (replaced by hand under the same name).
  const read = (name) => {
    const buf = fs.readFileSync(path.join(dir, name))
    const changed = !!manifest.files[name] && manifest.files[name].sha256 !== sha256(buf)
    return { path: path.join(dir, name), buffer: buf, changed, get text() { return buf.toString('utf8') }, ref: ref(name) }
  }
  /**
   * Registers a file put in `dir` by hand (e.g. downloaded in a browser); `note` says from where. Its date is the
   * file's. Re-registering a file whose contents changed records its new hash and date.
   */
  const add = (name, { url = null, note = null } = {}) => {
    const file = path.join(dir, name)
    const buf = fs.readFileSync(file)
    const prev = manifest.files[name]
    const same = prev?.sha256 === sha256(buf)
    const saved = fs.statSync(file).mtime.toISOString().slice(0, 10)
    manifest.files[name] = { ...(url && { url }), ...(note && { note }), retrievedAt: (same && prev.retrievedAt) || saved, sha256: sha256(buf), bytes: buf.length }
    save(name)
    return read(name)
  }
  // Whether `name` is stored: listed in the manifest, or put in raw/ by hand and registered now with `url` (byHand).
  const stored = (name, { url, byHand, note }) => {
    if (!fs.existsSync(path.join(dir, name))) return false
    if (!manifest.files[name] && byHand) add(name, { url, note })
    return !!manifest.files[name]
  }
  const keep = (name, url, buf) => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, name), buf)
    manifest.files[name] = { url, retrievedAt: today(), sha256: sha256(buf), bytes: buf.length }
    save(name)
    return read(name)
  }

  return {
    dir,
    manifest,
    /**
     * Downloads `url` unless it was stored before; returns { path, buffer, text, ref } (ref: for the dataset's origin).
     * @param opts.byHand  a file already in raw/ under `name` that the manifest doesn't list (downloaded by hand, e.g.
     *                     from a site scripts can't reach) is registered with `url` and `note` instead of downloaded
     */
    async fetchOnce(url, { name = nameOf(url), refresh = false, byHand = false, note = null } = {}) {
      if (!refresh && stored(name, { url, byHand, note })) return read(name)
      return keep(name, url, await get(url, { delayMs, timeoutMs }))
    },
    /**
     * A paged JSON API answer, downloaded once under the same rules as fetchOnce (each page is one request) and stored
     * as one file: the first page, with the `items` arrays of every page joined in order. `url` is the first page's,
     * each following one coming from `next(page)` (null at the end), or the list of every page's URL. The manifest
     * records the first URL. Options and result as fetchOnce's.
     */
    async fetchPagesOnce(url, { name = nameOf([].concat(url)[0]), items, next = () => null, refresh = false, byHand = false, note = null } = {}) {
      if (!items) throw new Error('fetchPagesOnce: name the field that holds each page\'s items ({ items })')
      const urls = [].concat(url), start = urls[0], seen = new Set(), all = []
      if (!refresh && stored(name, { url: start, byHand, note })) return read(name)
      let first = null
      for (let u = urls.shift(); u; u = urls.shift()) {
        if (seen.has(u)) throw new Error(`${u}: requested twice, the paging loops`)
        seen.add(u)
        const page = JSON.parse(await get(u, { delayMs, timeoutMs, headers: { Accept: 'application/json' } }))
        first ||= page
        all.push(...(page[items] || []))
        const following = Array.isArray(url) ? null : next(page)
        if (following) urls.push(following)
      }
      return keep(name, start, Buffer.from(JSON.stringify({ ...first, [items]: all })))
    },
    add,
    /** Stored files (names), optionally filtered by extension: list(/\.xlsx$/i). */
    list: (re = /./) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== 'manifest.json' && re.test(f)) : []),
    read,
  }
}
