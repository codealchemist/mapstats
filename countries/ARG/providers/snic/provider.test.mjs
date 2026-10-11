// Offline test (npm test): the SNIC import rules on a few fixture rows, no download.
import { check, done, fixture } from '#sdk/test.mjs'
import { parseCsv } from '#sdk'
import { createState, ingest, summary } from './parse.mjs'
import { toDataset } from './dataset.mjs'

const state = createState()
await ingest(state, parseCsv(fixture(new URL('./fixtures/provincias.csv', import.meta.url)), { lowercase: true }), 'provincias.csv')
await ingest(state, parseCsv(fixture(new URL('./fixtures/departamentos.csv', import.meta.url)), { lowercase: true }), 'departamentos.csv')
const s = summary(state, { files: [], origin: 'fixture', importedAt: '2026-01-01' })
const ba = s.provinces['AR-B']

check('provinces keyed by ISO 3166-2', Object.keys(s.provinces).sort().join() === 'AR-B,AR-C')
check('3-year average of published rates', s.provinces['AR-C'].avg3.homicide === 4, s.provinces['AR-C'].avg3.homicide)
check('decimal commas read', s.provinces['AR-C'].latest.homicide === 5)
check('robberies + thefts add parent codes only (15_1 ignored)', ba.latest.propertyCrime === 350 && ba.latest.robbery === 150, ba.latest.propertyCrime)
check('a sum with an unpublished part is missing, not partial', ba.series.propertyCrime.at(-2) === null)
check('national rate = total count ÷ implied population', s.national.latest.homicide === 5.85, s.national.latest.homicide)
check('"sin determinar" department skipped', !s.departments['06999'] && !!s.departments['06441'])
check('department average', s.departments['06441'].avg3.homicide === 3)

const ds = toDataset(s)
check('dataset: region, subregion and national values', ds.values.region['AR-B'].homicide === 6 && ds.values.subregion['06441'].homicide === 3 && ds.values.national.ARG.homicide != null)
check('dataset: Buenos Aires city gets its jurisdiction at city level', ds.values.city['ARG-buenos-aires'].homicide === 4 && ds.names.city['ARG-buenos-aires'] === 'Ciudad Autónoma de Buenos Aires')
check('dataset: only scored indicators in values, the rest in details', !('robbery' in ds.values.region['AR-B']) && ds.details.region['AR-B'].latest.robbery === 150)
done()
