// Offline test (npm test) of the raw store's download rules, against a local server: robots.txt, 403/429 stop,
// timeouts, spacing, paged answers, files put in raw/ by hand, and later runs reading the stored files.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { check, section, done } from './test.mjs'
import { rawStore } from './http.mjs'

const hits = []
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  hits.push({ path: u.pathname + u.search, at: Date.now(), agent: req.headers['user-agent'], accept: req.headers.accept })
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)) }
  if (u.pathname === '/robots.txt') return res.end('User-agent: *\nDisallow: /private/\n')
  if (u.pathname === '/file.csv' || u.pathname === '/private/secret.csv' || u.pathname === '/hand.csv') return res.end('a,b\n1,2\n')
  if (u.pathname === '/forbidden') { res.writeHead(403); return res.end() }
  if (u.pathname === '/busy') { res.writeHead(429); return res.end() }
  if (u.pathname === '/missing') { res.writeHead(404); return res.end() }
  if (u.pathname === '/silent') return // never answers
  if (u.pathname === '/stall') { res.writeHead(200); return res.write('a,b\n') } // the body stops half-way
  if (u.pathname === '/pages') {
    const page = +u.searchParams.get('page') || 1
    const next = page < 3 ? `${base}/pages?page=${page + 1}` : null
    return json({ title: 'Paged', items: [page * 10, page * 10 + 1], paging: { next } })
  }
  if (u.pathname === '/list') return json({ data: [`list ${u.searchParams.get('n')}`] })
  if (u.pathname === '/loop') return json({ items: [1], paging: { next: `${base}/loop` } })
  if (u.pathname === '/pages-busy') return +u.searchParams.get('page') === 2 ? (res.writeHead(429), res.end()) : json({ items: [1], paging: { next: `${base}/pages-busy?page=2` } })
  res.writeHead(404)
  res.end()
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapstats-raw-'))
const raw = rawStore('TST', 'http', { dir, delayMs: 0, timeoutMs: 300 })
const failure = (p) => p.then(() => null, (e) => e.message)
const requested = (p) => hits.filter((h) => h.path === p).length
const manifestOnDisk = () => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))

section('fetchOnce')
const file = await raw.fetchOnce(`${base}/file.csv`)
const entry = manifestOnDisk().files['file.csv']
check('downloads into the folder and returns the file', file.text === 'a,b\n1,2\n' && fs.readFileSync(path.join(dir, 'file.csv'), 'utf8') === file.text)
check('the manifest records URL, date, SHA-256 and size', entry.url === `${base}/file.csv` && /^\d{4}-\d\d-\d\d$/.test(entry.retrievedAt) && /^[0-9a-f]{64}$/.test(entry.sha256) && entry.bytes === 8 && file.ref.sha256 === entry.sha256)
check('identifies MapStats', /^MapStats/.test(hits.find((h) => h.path === '/file.csv').agent))
await raw.fetchOnce(`${base}/file.csv`)
check('a stored file is not downloaded again', requested('/file.csv') === 1)
check('robots.txt is read once per site', requested('/robots.txt') === 1)

section('Stops')
const refused = await failure(raw.fetchOnce(`${base}/private/secret.csv`))
check('robots.txt refusal: no request, and says what to do', /robots\.txt disallows .*byHand: true/.test(refused) && requested('/private/secret.csv') === 0, refused)
check('403 stops the run', /answered 403: stopping/.test(await failure(raw.fetchOnce(`${base}/forbidden`))))
check('429 stops the run', /answered 429: stopping/.test(await failure(raw.fetchOnce(`${base}/busy`))))
check('another error status fails the download without the stop message', /^404 /.test(await failure(raw.fetchOnce(`${base}/missing`))))
let t0 = Date.now()
const silent = await failure(raw.fetchOnce(`${base}/silent`))
check('a server that never answers times out', /nothing received for 0\.3 s/.test(silent) && Date.now() - t0 < 2000, silent)
t0 = Date.now()
const stalled = await failure(raw.fetchOnce(`${base}/stall`))
check('a body that stalls half-way times out', /nothing received for 0\.3 s/.test(stalled) && Date.now() - t0 < 2000, stalled)
check('failed downloads leave no file and no manifest entry', ['forbidden', 'busy', 'missing', 'silent', 'stall'].every((n) => !fs.existsSync(path.join(dir, n)) && !manifestOnDisk().files[n]))

section('Spacing')
const paced = rawStore('TST', 'http', { dir, delayMs: 300, timeoutMs: 300 })
await paced.fetchOnce(`${base}/file.csv`, { name: 'paced-1.csv' })
await paced.fetchOnce(`${base}/file.csv`, { name: 'paced-2.csv' })
const [a, b] = hits.filter((h) => h.path === '/file.csv').slice(-2)
check('requests are spaced by delayMs', b.at - a.at >= 290, `${b.at - a.at} ms`)

section('By hand')
fs.writeFileSync(path.join(dir, 'hand.csv'), 'from a browser\n')
const hand = await raw.fetchOnce(`${base}/hand.csv`, { byHand: true, note: 'downloaded in a browser' })
const handEntry = manifestOnDisk().files['hand.csv']
check('byHand: a file put in raw/ is registered with its URL and note, not downloaded', hand.text === 'from a browser\n' && requested('/hand.csv') === 0 && handEntry.url === `${base}/hand.csv` && handEntry.note === 'downloaded in a browser')
fs.writeFileSync(path.join(dir, 'unlisted.csv'), 'stale\n')
const unlisted = await raw.fetchOnce(`${base}/file.csv`, { name: 'unlisted.csv' })
check('without byHand, a file the manifest does not list is downloaded again', unlisted.text === 'a,b\n1,2\n')

section('fetchPagesOnce')
const before = hits.length
const pages = await rawStore('TST', 'http', { dir, delayMs: 200, timeoutMs: 300 }).fetchPagesOnce(`${base}/pages?page=1`, { name: 'pages.json', items: 'items', next: (p) => p.paging.next })
const pageHits = hits.slice(before).filter((h) => h.path.startsWith('/pages'))
const stored = JSON.parse(pages.text)
check('follows next() to the last page, one request each', pageHits.map((h) => h.path).join(' ') === '/pages?page=1 /pages?page=2 /pages?page=3')
check('stores the first page with every page\'s items in order', stored.title === 'Paged' && stored.items.join() === '10,11,20,21,30,31')
check('pages are spaced by delayMs and ask for JSON', pageHits.slice(1).every((h, i) => h.at - pageHits[i].at >= 190) && pageHits.every((h) => h.accept === 'application/json'), pageHits.slice(1).map((h, i) => `${h.at - pageHits[i].at} ms`).join(', '))
check('one manifest entry, with the first page\'s URL', manifestOnDisk().files['pages.json'].url === `${base}/pages?page=1` && manifestOnDisk().files['pages.json'].sha256 === pages.ref.sha256)
const list = await raw.fetchPagesOnce([`${base}/list?n=1`, `${base}/list?n=2`], { name: 'list.json', items: 'data' })
check('or fetches a list of URLs', JSON.parse(list.text).data.join() === 'list 1,list 2')
check('robots.txt refusal on a page', /robots\.txt disallows/.test(await failure(raw.fetchPagesOnce(`${base}/private/p`, { name: 'private.json', items: 'items' }))))
check('a 429 on a later page stops the run and stores nothing', /answered 429: stopping/.test(await failure(raw.fetchPagesOnce(`${base}/pages-busy?page=1`, { name: 'busy.json', items: 'items', next: (p) => p.paging.next }))) && !fs.existsSync(path.join(dir, 'busy.json')) && !manifestOnDisk().files['busy.json'])
check('a page that never answers times out', /nothing received/.test(await failure(raw.fetchPagesOnce([`${base}/list?n=1`, `${base}/silent`], { name: 'silent.json', items: 'data' }))) && !fs.existsSync(path.join(dir, 'silent.json')))
check('paging that loops fails', /requested twice/.test(await failure(raw.fetchPagesOnce(`${base}/loop`, { name: 'loop.json', items: 'items', next: (p) => p.paging.next }))))
check('items is required', /\{ items \}/.test(await failure(raw.fetchPagesOnce(`${base}/list?n=1`, { name: 'x.json' }))))

section('Later runs')
server.closeAllConnections()
await new Promise((r) => server.close(r))
const again = rawStore('TST', 'http', { dir, delayMs: 0, timeoutMs: 300 })
const offline = [await again.fetchOnce(`${base}/file.csv`), await again.fetchPagesOnce(`${base}/pages?page=1`, { name: 'pages.json', items: 'items', next: (p) => p.paging.next }), await again.fetchOnce(`${base}/hand.csv`)]
check('a new store reads the stored files with the server gone', offline[0].text === file.text && offline[1].text === pages.text && offline[2].text === hand.text && offline.every((f) => !f.changed))

fs.rmSync(dir, { recursive: true, force: true })
done()
