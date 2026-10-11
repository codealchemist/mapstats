// npm test — the committed score anchors (src/data/anchors.json) match the datasets. Datasets changed? Run
// npm run anchors and commit the file (scores change with it).
import fs from 'node:fs'
import { check, done } from '../tools/sdk/test.mjs'
import { quantile } from '../tools/sdk/anchors.mjs'
import { currentAnchors, ANCHORS_FILE } from '../tools/cli/anchors.mjs'

check('quantile interpolates', quantile([0, 10], 0.25) === 2.5 && quantile([1, 2, 3, 4, 5], 0.5) === 3)
const committed = JSON.parse(fs.readFileSync(ANCHORS_FILE, 'utf8'))
const current = await currentAnchors()
check('src/data/anchors.json is up to date with the datasets (npm run anchors)', JSON.stringify(committed) === JSON.stringify(current))
done()
