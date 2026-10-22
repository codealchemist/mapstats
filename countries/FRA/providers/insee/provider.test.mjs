// Offline test (npm test): the API readers on observations shaped like Melodi's and BDM's answers, no download.
import { check, done } from '#sdk/test.mjs'
import { populationByYear, communePopulations, filosofi, lifeExpectancy, commuting, unemployment } from './parse.mjs'

const obs = (GEO, dims, value, attrs) => ({ dimensions: { GEO, ...dims }, measures: { OBS_VALUE_NIVEAU: { value } }, attributes: attrs })

const pop = populationByYear({ observations: [obs('2026-DEP-75', { TIME_PERIOD: '2023' }, 2103778, { OBS_STATUS_FR: 'D' }), obs('2026-DEP-75', { TIME_PERIOD: '2026' }, 2090000, { OBS_STATUS_FR: 'PROV' }), obs('2026-REG-11', { TIME_PERIOD: '2023' }, 1)] })
check('population by département and year, with each year’s status', pop['FR-75'][2023] === 2103778 && pop['FR-75'][2026] === 2090000 && pop.status[2026] === 'PROV' && !pop['REG-11'])
check('municipal populations by commune code', communePopulations({ observations: [obs('2025-COM-06088', { TIME_PERIOD: '2023' }, 357737)] })['06088'].pop === 357737)

const pov = filosofi({ observations: [obs('2026-DEP-82', { TIME_PERIOD: '2023', FILOSOFI_MEASURE: 'PR_MD60' }, 17), obs('2026-COM-06088', { TIME_PERIOD: '2023', FILOSOFI_MEASURE: 'PR_MD60' }, 23.4), obs('2026-COM-06088', { TIME_PERIOD: '2023', FILOSOFI_MEASURE: 'MED_SL' }, 22000)] })
check('Filosofi: départements and communes apart, uncovered areas absent (not filled)', pov.region['FR-82'].povertyRelative === 17 && pov.subregion['06088'].povertyRelative === 23.4 && pov.subregion['06088'].medianIncome === 22000 && !pov.region['FR-GP'] && pov.year === 2023)

const life = lifeExpectancy({ observations: [
  obs('2025-DEP-48', { TIME_PERIOD: '2025', SEX: 'F' }, 84.2, { OBS_STATUS_FR: 'PROV' }), obs('2025-DEP-48', { TIME_PERIOD: '2025', SEX: 'M' }, 81.2, { OBS_STATUS_FR: 'PROV' }),
  obs('2025-DEP-48', { TIME_PERIOD: '2024', SEX: 'F' }, 84, { OBS_STATUS_FR: 'PROV' }),
  obs('2025-DEP-13', { TIME_PERIOD: '2025', SEX: 'M' }, 81), obs('2025-DEP-13', { TIME_PERIOD: '2024', SEX: 'F' }, 85.7), obs('2025-DEP-13', { TIME_PERIOD: '2024', SEX: 'M' }, 80.3),
] })
check('life expectancy: the latest year both sexes are published, and their mean', life.region['FR-48'].year === 2025 && life.region['FR-48'].lifeExp === 82.7 && life.region['FR-13'].year === 2024 && life.region['FR-13'].lifeExp === 83 && life.status[2025] === 'PROV')

const com = commuting({ observations: [obs('2026-DEP-974', { TIME_PERIOD: '2023', TRANS: '_T' }, 297250.7), obs('2026-DEP-974', { TIME_PERIOD: '2023', TRANS: '6' }, 14862.5), obs('2026-COM-06088', { TIME_PERIOD: '2023', TRANS: '_T' }, 100000)] })
check('commuting: public-transport share of commuters, 1 decimal; a commune without the mode is left out', com.region['FR-RE'].transitCommute === 5 && com.region['FR-RE'].workers === 297251 && !com.subregion['06088'] && com.year === 2023)

const xml = `<?xml version='1.0' encoding='UTF-8'?><message:StructureSpecificData><message:DataSet>
<Series AGE="00-" FREQ="A" REF_AREA="D75" SEXE="0" IDBANK="001515842" TITLE_FR="Taux de chômage localisé - Paris"><Obs TIME_PERIOD="2024" OBS_VALUE="6.1"/><Obs TIME_PERIOD="2025" OBS_VALUE="6.3"/></Series>
<Series AGE="50-" FREQ="A" REF_AREA="D75" SEXE="0" IDBANK="x"><Obs TIME_PERIOD="2025" OBS_VALUE="4.0"/></Series>
<Series AGE="00-" FREQ="T" REF_AREA="D75" SEXE="0" IDBANK="y"><Obs TIME_PERIOD="2025-Q2" OBS_VALUE="6.5"/></Series>
<Series AGE="00-" FREQ="A" REF_AREA="FM" SEXE="0" IDBANK="001787711" TITLE_FR="France métropolitaine"><Obs TIME_PERIOD="2025" OBS_VALUE="7.5"/></Series>
</message:DataSet></message:StructureSpecificData>`
const unemp = await unemployment(xml)
check('unemployment: the annual all-ages series per département, latest year, with its idbank', unemp.region['FR-75'].unemployment === 6.3 && unemp.region['FR-75'].year === 2025 && unemp.region['FR-75'].idbank === '001515842' && unemp.region['FR-75'].series[2024] === 6.1)
check('unemployment: quarterly and age-band series skipped; the metropolitan total kept apart', unemp.national.metropolitan.unemployment === 7.5 && unemp.year === 2025)
done()
