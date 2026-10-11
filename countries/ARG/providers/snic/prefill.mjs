// Prefill for SNIC: the provincial and departmental bases (xlsx or csv) → countries/ARG/data/snic.json.
//
//   npm run snic:import                                   offline, from the stored files
//   npm run snic:import -- --download <url> [--download <url>]   store a base first (once)
//   npm run snic:import -- --origin "where the files came from"  required the first time files are used
//
// Download the bases from https://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos
// ("hechos y víctimas", provincial and departmental) into data/raw/ARG/snic/ (data/snic/raw/ from before the
// migration still works), or with --download.
import fs from 'node:fs'
import { rawStore, readXlsx, parseCsv } from '#sdk'
import { createState, ingest, summary } from './parse.mjs'
import { toDataset } from './dataset.mjs'

const LEGACY = 'data/snic/raw'

export async function prefill({ args, log }) {
  const dir = !fs.existsSync('data/raw/ARG/snic') && fs.existsSync(LEGACY) ? LEGACY : undefined
  const raw = rawStore('ARG', 'snic', { dir })
  for (const url of [].concat(args.download || [])) await raw.fetchOnce(url)
  const names = raw.list(/\.(xlsx|csv)$/i)
  if (!names.length) throw new Error(`No SNIC files in ${raw.dir}. Download the provincial and departmental bases from\nhttps://www.argentina.gob.ar/seguridad/estadisticascriminales/bases-de-datos`)

  // Files put in the folder by hand are registered once, with where they came from.
  const unregistered = names.filter((n) => !raw.manifest.files[n])
  if (unregistered.length && !args.origin) throw new Error(`Say where ${unregistered.join(', ')} came from: --origin "…" (stored with the dataset)`)
  for (const n of unregistered) raw.add(n, { note: args.origin })
  // A base replaced by hand under the same name: record the new file (same origin unless --origin says otherwise).
  for (const n of names.filter((x) => raw.read(x).changed)) {
    log(`${n} changed since it was registered: recording its new hash and date`)
    raw.add(n, { note: args.origin || raw.manifest.files[n].note })
  }

  const state = createState()
  const files = []
  for (const name of names) {
    const f = raw.read(name)
    const t = Date.now()
    const rows = /\.xlsx$/i.test(name) ? readXlsx(f.path) : parseCsv(f.text, { lowercase: true })
    const r = await ingest(state, rows, name)
    log(`${name}: ${r.kind}, ${r.rows} rows used (${((Date.now() - t) / 1000).toFixed(1)}s)`)
    files.push({ file: name, kind: r.kind, sha256: f.ref.sha256, retrievedAt: f.ref.retrievedAt })
  }
  const notes = [...new Set(names.map((n) => raw.manifest.files[n].note).filter(Boolean))]
  return toDataset(summary(state, { files, origin: args.origin || notes.join('; ') || 'official download' }))
}
