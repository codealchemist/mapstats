// Local, permanent store of every Numbeo page we have requested.
//
//   data/numbeo/pages/*.html   raw HTML, kept indefinitely
//   data/numbeo/manifest.json  one entry per URL ever requested (hits AND misses),
//                              so no URL is requested twice unless explicitly refreshed
import fs from 'node:fs'
import path from 'node:path'

export const STORE = path.resolve(process.env.NUMBEO_STORE || 'data/numbeo')
const PAGES = path.join(STORE, 'pages')
const MANIFEST = path.join(STORE, 'manifest.json')

export function loadManifest() {
  return fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { lastFetchRun: null, pages: {} }
}

export function saveManifest(m) {
  fs.mkdirSync(STORE, { recursive: true })
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n')
}

const fileFor = (urlPath) => urlPath.replace(/^\//, '').replace(/[^\w.-]+/g, '_') + '.html'

// status: 'ok' | 'http-<code>' | 'robots'
export function record(m, urlPath, status, html) {
  const entry = { status, fetchedAt: new Date().toISOString() }
  if (html != null) {
    fs.mkdirSync(PAGES, { recursive: true })
    entry.file = fileFor(urlPath)
    fs.writeFileSync(path.join(PAGES, entry.file), html)
  }
  m.pages[urlPath] = entry
  return entry
}

export function readPage(m, urlPath) {
  const e = m.pages[urlPath]
  if (!e?.file) return null
  const f = path.join(PAGES, e.file)
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null
}
