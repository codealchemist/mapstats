// Offline test (npm test): parses the fixture, no network.
import { readFileSync } from 'node:fs'
import { check, done } from '#sdk/test.mjs'
import { toValues } from './prefill.mjs'

const csv = readFileSync(new URL('./fixtures/regions-2025.csv', import.meta.url), 'utf8')
const { values, unmatched } = toValues(csv, { regionCodes: { '01': 'XX-N', '02': 'XX-S' } })
const north = values.region['XX-N'], south = values.region['XX-S']

check('maps both regions by code', !!north && !!south)
check('reports the unspecified row instead of guessing', unmatched.length === 1 && unmatched[0] === '99')
check('internet = connected households ÷ households, as %', north.internet === 62.5 && south.internet === 50)
check('water = households with running water ÷ households, as %', north.water === 95 && south.water === 85)
check('published percentages are kept as they are', north.poverty === 21.4 && north.unemployment === 6.2)
check('a blank cell stays missing, not zero', south.unemployment === null)
done()
