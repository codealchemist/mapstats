// Prefill for the ONISR: the yearly BAAC "caractéristiques" and "usagers" files → countries/FRA/data/onisr.json.
//
//   npm run prefill -- FRA --provider onisr
//
// Each year's two CSVs are downloaded once from their pinned data.gouv.fr resources (the catalogue renames files
// from year to year) into raw/. Population denominators come from the INSEE provider's stored population estimates
// (its raw folder; downloaded there if missing). Add a year to YEARS when the ONISR publishes it.
import { rawStore, parseCsv } from '#sdk'
import { fetchOnceStored, regionNames } from '../../lib/fr.mjs'
import { populationFile, populationByYear } from '../insee/parse.mjs'
import { accidentDepartments, killedByDepartment, toValues } from './parse.mjs'
import { DATASET } from './provider.js'

const R = 'https://static.data.gouv.fr/resources'
export const YEARS = {
  2019: [`${R}/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104400/caracteristiques-2019.csv`, `${R}/base-de-donnees-accidents-corporels-de-la-circulation/20201105-104232/usagers-2019.csv`],
  2020: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111202/caracteristiques-2020.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2019/20211110-111817/usagers-2020.csv`],
  2021: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2022/20231009-140403/carcteristiques-2021.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2022/20231009-140337/usagers-2021.csv`],
  2022: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-093927/carcteristiques-2022.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2021/20231005-094229/usagers-2022.csv`],
  2023: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241028-103125/caract-2023.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2023/20241023-153328/usagers-2023.csv`],
  2024: [`${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251021-115900/caract-2024.csv`, `${R}/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024/20251021-115506/usagers-2024.csv`],
}

export async function prefill({ log }) {
  const raw = rawStore('FRA', 'onisr')
  const pop = await populationFile()
  const population = populationByYear(JSON.parse(pop.text))
  const years = Object.keys(YEARS).map(Number).sort((a, b) => a - b)
  const deaths = {}
  const files = []
  for (const y of years) {
    const [caract, usagers] = YEARS[y]
    const c = await fetchOnceStored(raw, caract, { name: `caract-${y}.csv` })
    const u = await fetchOnceStored(raw, usagers, { name: `usagers-${y}.csv` })
    const departments = accidentDepartments(parseCsv(c.text))
    const { byRegion, killed, outside, unknown } = killedByDepartment(parseCsv(u.text), departments)
    for (const [id, n] of Object.entries(byRegion)) (deaths[id] ||= {})[y] = n
    log(`${y}: ${departments.size} accidents, ${killed} killed (${outside} outside the départements of the map, ${unknown} without a département)`)
    files.push(c.ref, u.ref)
  }
  return {
    ...toValues({ years, deaths, population }, { names: regionNames() }),
    origin: { files: [...files, { ...pop.ref, note: 'denominators: INSEE population estimates at 1 January (providers/insee)' }], notes: `official downloads from data.gouv.fr (Licence Ouverte): ${DATASET}; rates per 100,000 computed by MapStats over INSEE population estimates` },
  }
}
