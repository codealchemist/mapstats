#!/usr/bin/env node
// Downloads Argentina's census tables from censo.gob.ar, whose server doesn't send its intermediate certificate: Node
// and curl reject it (browsers fetch the missing certificate themselves), so the prefill's raw store can't download
// them. This script does what browsers do: it fetches the intermediate from Sectigo and trusts it on top of the usual
// root certificates. Certificates are still verified; nothing is skipped. See README.md for the yearly update.
//
//   node countries/ARG/providers/provincial-stats/censo-download.mjs        (or: npm run censo:download)
//     the tables the prefill reads (census-files.mjs) into raw/, skipping those already there (--refresh: all again);
//     then run the prefill, which registers them with their URLs.
//   node countries/ARG/providers/provincial-stats/censo-download.mjs --all
//     every spreadsheet linked from the definitive-results pages, into raw/censo-download/ (gitignored), with
//     links.tsv (each file's URL, page, link text, size, SHA-256) and pages/ (the HTML read): to find the files of a
//     new publication, or files that moved.
//
// Needs Node 18+ and access to censo.gob.ar and crt.sectigo.com (the dev container's firewall doesn't allow the
// latter: run it on your own machine, in the same checkout). No npm install needed. It honours robots.txt and waits
// 3 s between requests.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import tls from 'node:tls'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CENSUS } from './census-files.mjs'

const RAW = path.join(path.dirname(fileURLToPath(import.meta.url)), 'raw')
const START = 'https://censo.gob.ar/index.php/datos_definitivos_total_pais/'
// The intermediate censo.gob.ar's certificate names as its issuer (its "CA Issuers" address). If the site changes
// certificate, the TLS error names the new issuer: update this address (openssl s_client -connect censo.gob.ar:443).
const INTERMEDIATE = 'http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt'
const UA = 'MapStats data import (+https://github.com/codealchemist/mapstats)'
const FILE = /\.(xlsx|xls|csv|zip)$/i
const MAX_PAGES = 60
const DELAY_MS = 3000

const args = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let agent = null

/** GET with redirects → { status, url, body: Buffer }. */
function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.get(u, { agent: u.protocol === 'https:' ? agent : undefined, headers: { 'User-Agent': UA }, timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume()
        return resolve(get(new URL(res.headers.location, u).href, redirects - 1))
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, url: u.href, body: Buffer.concat(chunks) }))
    })
    req.on('timeout', () => req.destroy(new Error(`timeout: ${url}`)))
    req.on('error', reject)
  })
}

// ---------- robots.txt (User-agent: *, Disallow prefixes) ----------
const robots = new Map()
async function allowed(url) {
  const u = new URL(url)
  if (!robots.has(u.origin)) {
    const res = await get(`${u.origin}/robots.txt`).catch(() => null)
    const rules = []
    let applies = false
    for (const line of (res?.status === 200 ? res.body.toString('utf8') : '').split(/\r?\n/)) {
      const [k, ...v] = line.split(':')
      const key = k.trim().toLowerCase(), value = v.join(':').trim()
      if (key === 'user-agent') applies = value === '*'
      else if (key === 'disallow' && applies && value) rules.push(value)
    }
    robots.set(u.origin, rules)
  }
  return !robots.get(u.origin).some((p) => (u.pathname + u.search).startsWith(p))
}

/** Downloads one file politely; null when refused, missing, or answered with an HTML page instead of the file. */
async function download(url) {
  if (!(await allowed(url))) { console.log(`robots.txt disallows ${url}: skipped`); return null }
  await sleep(DELAY_MS)
  const r = await get(url).catch((e) => ({ status: e.message, body: Buffer.alloc(0) }))
  const head = r.body.subarray(0, 512).toString('latin1').trimStart().toLowerCase()
  if (r.status !== 200 || head.startsWith('<!doctype') || head.startsWith('<html')) { console.log(`✗ ${r.status} ${url}`); return null }
  return r.body
}

/** Links of a page: [{ url, text }], absolute, without fragments. */
function links(html, base) {
  const out = []
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(m[1].replace(/&amp;/g, '&').trim(), base)
      url.hash = ''
      out.push({ url: url.href, text: m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() })
    } catch { /* not a URL */ }
  }
  return out
}

const isFile = (url) => FILE.test(decodeURIComponent(new URL(url).pathname))
const isCensusPage = (url) => {
  const u = new URL(url)
  return /(^|\.)censo\.gob\.ar$/.test(u.hostname) && /definitiv/i.test(u.pathname) && !isFile(url)
}

// The tables the prefill reads, into raw/.
async function needed() {
  fs.mkdirSync(RAW, { recursive: true })
  let saved = 0, kept = 0, failed = 0
  for (const { name, url } of CENSUS) {
    const file = path.join(RAW, name)
    if (fs.existsSync(file) && !args.includes('--refresh')) { kept++; continue }
    const body = await download(url)
    if (!body) { failed++; continue }
    fs.writeFileSync(file, body)
    saved++
    console.log(`✓ ${name} (${(body.length / 1024).toFixed(0)} KB)`)
  }
  console.log(`\n${saved} downloaded, ${kept} already in raw/, ${failed} failed (of ${CENSUS.length}) · ${RAW}`)
  if (failed) {
    console.log('A file that fails may have moved: run with --all to list what the site links now, then update census-files.mjs.')
    process.exitCode = 1
  } else console.log('Next: npm run prefill -- ARG --provider provincial-stats (registers them and rebuilds the dataset).')
}

// Every spreadsheet the definitive-results pages link, into raw/censo-download/.
async function all() {
  const out = path.join(RAW, 'censo-download')
  fs.mkdirSync(path.join(out, 'pages'), { recursive: true })
  const queue = [START], seen = new Set(), files = new Map()
  while (queue.length && seen.size < MAX_PAGES) {
    const page = queue.shift()
    if (seen.has(page)) continue
    seen.add(page)
    if (!(await allowed(page))) { console.log(`robots.txt disallows ${page}: skipped`); continue }
    await sleep(DELAY_MS)
    const r = await get(page)
    console.log(`page ${r.status} ${page}`)
    if (r.status !== 200) continue
    const html = r.body.toString('utf8')
    fs.writeFileSync(path.join(out, 'pages', `${String(seen.size).padStart(2, '0')}-${new URL(page).pathname.replace(/[^a-z0-9]+/gi, '_').slice(0, 80)}.html`), html)
    for (const l of links(html, r.url)) {
      if (isFile(l.url)) { if (!files.has(l.url)) files.set(l.url, { ...l, page }) }
      else if (isCensusPage(l.url) && !seen.has(l.url)) queue.push(l.url)
    }
  }
  console.log(`\n${seen.size} page(s) read, ${files.size} file link(s) found\n`)
  const rows = [['file', 'url', 'page', 'link text', 'bytes', 'sha256'].join('\t')]
  const names = new Set()
  for (const [url, l] of files) {
    const body = await download(url)
    if (!body) continue
    let name = decodeURIComponent(path.basename(new URL(url).pathname))
    while (names.has(name)) name = `_${name}`
    names.add(name)
    fs.writeFileSync(path.join(out, name), body)
    rows.push([name, url, l.page, l.text.replace(/\t/g, ' '), body.length, crypto.createHash('sha256').update(body).digest('hex')].join('\t'))
    console.log(`✓ ${name} (${(body.length / 1024).toFixed(0)} KB)`)
  }
  fs.writeFileSync(path.join(out, 'links.tsv'), rows.join('\n') + '\n')
  console.log(`\nSaved ${rows.length - 1} file(s) and links.tsv in ${out}`)
}

async function main() {
  // The missing intermediate, trusted along with the usual roots (Node's bundle, plus the system's when available).
  const res = await get(INTERMEDIATE)
  if (res.status !== 200) throw new Error(`${INTERMEDIATE}: HTTP ${res.status}`)
  const cert = new crypto.X509Certificate(res.body)
  if (!/R36/.test(cert.subject)) throw new Error(`unexpected certificate: ${cert.subject}`)
  const system = typeof tls.getCACertificates === 'function' ? tls.getCACertificates('system') : []
  agent = new https.Agent({ ca: [...tls.rootCertificates, ...system, cert.toString()] })
  console.log(`Intermediate: ${cert.subject.replace(/\n/g, ', ')} (valid to ${cert.validTo})\n`)
  await (args.includes('--all') ? all() : needed())
}

main().catch((e) => {
  // Connection failures arrive as an AggregateError (one error per address tried) with an empty message.
  const inner = e.errors?.[0] || e.cause || e
  console.error(`✗ ${[inner.code, inner.message || e.message].filter(Boolean).join(' ')}`)
  process.exitCode = 1
})
