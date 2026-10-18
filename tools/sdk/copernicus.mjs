// Copernicus Climate Data Store (CDS) retrievals for prefills: submit a request, wait for it in the CDS queue,
// download the result. Needs a CDS personal access token (https://cds.climate.copernicus.eu/profile) in CDSAPI_KEY
// (.env, see .env.example) or ~/.cdsapirc, and the dataset's licence accepted on its Download tab.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const api = () => (process.env.CDSAPI_URL || 'https://cds.climate.copernicus.eu/api').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The CDS token: CDSAPI_KEY, else the `key:` line of ~/.cdsapirc. */
function cdsKey() {
  if (process.env.CDSAPI_KEY) return process.env.CDSAPI_KEY.trim()
  const rc = path.join(os.homedir(), '.cdsapirc')
  const key = fs.existsSync(rc) && fs.readFileSync(rc, 'utf8').match(/^key:\s*(\S+)/m)?.[1]
  if (!key) throw new Error('No Copernicus token: set CDSAPI_KEY in .env (see .env.example) or write ~/.cdsapirc')
  return key
}

async function call(url, key, init = {}) {
  const res = await fetch(url, { ...init, headers: { 'PRIVATE-TOKEN': key, 'Content-Type': 'application/json', ...init.headers } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`CDS ${res.status}: ${body.title || ''}${body.detail ? ` (${body.detail})` : ''}`)
  return body
}

/**
 * Retrieves `inputs` from a CDS dataset; returns { buffer, href, jobId }. Requests wait in the CDS queue
 * (minutes): `log` reports status changes. Throws on a failed or rejected job.
 */
export async function cdsRetrieve(dataset, inputs, { log = () => {}, pollMs = 15000, timeoutMs = 3 * 3600_000 } = {}) {
  const key = cdsKey(), API = api()
  const job = await call(`${API}/retrieve/v1/processes/${dataset}/execution`, key, { method: 'POST', body: JSON.stringify({ inputs }) })
  const started = Date.now()
  let status = job.status
  log(`CDS job ${job.jobID}: ${status}`)
  while (!['successful', 'failed', 'rejected', 'dismissed'].includes(status)) {
    if (Date.now() - started > timeoutMs) throw new Error(`CDS job ${job.jobID} still ${status} after ${Math.round(timeoutMs / 60000)} min`)
    await sleep(pollMs)
    const next = (await call(`${API}/retrieve/v1/jobs/${job.jobID}`, key)).status
    if (next !== status) log(`CDS job ${job.jobID}: ${next} (${Math.round((Date.now() - started) / 1000)} s)`)
    status = next
  }
  if (status !== 'successful') {
    const info = await call(`${API}/retrieve/v1/jobs/${job.jobID}?log=true`, key).catch(() => ({}))
    throw new Error(`CDS job ${job.jobID} ${status}${info.metadata?.results?.detail ? `: ${info.metadata.results.detail}` : ''}`)
  }
  const { asset } = await call(`${API}/retrieve/v1/jobs/${job.jobID}/results`, key)
  const res = await fetch(asset.value.href)
  if (!res.ok) throw new Error(`CDS download ${res.status} ${asset.value.href}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (asset.value['file:size'] && buffer.length !== asset.value['file:size']) throw new Error(`CDS download incomplete: ${buffer.length} of ${asset.value['file:size']} bytes`)
  return { buffer, href: asset.value.href, jobId: job.jobID }
}
