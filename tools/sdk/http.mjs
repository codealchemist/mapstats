// Polite, download-once access to a source's files: data/raw/<ISO3>/<provider>/ (gitignored) plus a committed
// manifest.json recording each file's URL, date and SHA-256, so anyone can fetch the same files and verify them.
//   - each URL is downloaded once; later runs read the stored copy (refresh: true to download again)
//   - robots.txt is honoured, requests are spaced (5 s by default) and identify MapStats
//   - the first 403 / 429 stops the run: the site does not want automated requests
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { robotsAllows } from '../../netlify/news/robots.mjs'

const UA = process.env.MAPSTATS_USER_AGENT || 'MapStats data import (+https://github.com/codealchemist/mapstats)'
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = () => new Date().toISOString().slice(0, 10)

let lastRequest = 0
const robotsCache = new Map()

async function allowed(url) {
  const u = new URL(url)
  if (!robotsCache.has(u.origin)) {
    const res = await fetch(`${u.origin}/robots.txt`, { headers: { 'User-Agent': UA } }).catch(() => null)
    robotsCache.set(u.origin, res?.ok ? await res.text() : '')
  }
  return robotsAllows(robotsCache.get(u.origin), u.pathname + u.search)
}

/**
 * @param iso3      country
 * @param provider  provider id (without the country prefix)
 * @param opts.root      base folder (default data/raw, or $MAPSTATS_RAW)
 * @param opts.delayMs   pause between requests
 * @param opts.dir       use this folder instead of <root>/<ISO3>/<provider> (e.g. files stored before the migration)
 */
export function rawStore(iso3, provider, { root = process.env.MAPSTATS_RAW || 'data/raw', delayMs = 5000, dir: custom } = {}) {
  const dir = path.resolve(custom || path.join(root, iso3, provider))
  const manifestFile = path.join(dir, 'manifest.json')
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { files: {} }
  const save = () => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n') }
  const ref = (name) => ({ name, ...(manifest.files[name].url && { url: manifest.files[name].url }), sha256: manifest.files[name].sha256, retrievedAt: manifest.files[name].retrievedAt })
  const read = (name) => {
    const buf = fs.readFileSync(path.join(dir, name))
    return { path: path.join(dir, name), buffer: buf, get text() { return buf.toString('utf8') }, ref: ref(name) }
  }

  return {
    dir,
    manifest,
    /** Downloads `url` unless it was stored before; returns { path, buffer, text, ref } (ref: for the dataset's origin). */
    async fetchOnce(url, { name = decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'index.html', refresh = false } = {}) {
      if (!refresh && manifest.files[name] && fs.existsSync(path.join(dir, name))) return read(name)
      if (!(await allowed(url))) throw new Error(`robots.txt disallows ${url}: download it by hand and register it with add()`)
      const wait = lastRequest + delayMs - Date.now()
      if (wait > 0) await sleep(wait)
      lastRequest = Date.now()
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.status === 403 || res.status === 429) throw new Error(`${new URL(url).host} answered ${res.status}: stopping (it does not want automated requests)`)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      const buf = Buffer.from(await res.arrayBuffer())
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, name), buf)
      manifest.files[name] = { url, retrievedAt: today(), sha256: sha256(buf), bytes: buf.length }
      save()
      return read(name)
    },
    /** Registers a file put in `dir` by hand (e.g. downloaded in a browser); `note` says from where. Its date is the file's. */
    add(name, { url = null, note = null } = {}) {
      const file = path.join(dir, name)
      const buf = fs.readFileSync(file)
      const saved = fs.statSync(file).mtime.toISOString().slice(0, 10)
      manifest.files[name] = { ...(url && { url }), ...(note && { note }), retrievedAt: manifest.files[name]?.retrievedAt || saved, sha256: sha256(buf), bytes: buf.length }
      save()
      return read(name)
    },
    /** Stored files (names), optionally filtered by extension: list(/\.xlsx$/i). */
    list: (re = /./) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== 'manifest.json' && re.test(f)) : []),
    read,
  }
}
