// Offline test (npm test): the zoning and GASPAR rules on inline records, no download.
import { check, done } from '#sdk/test.mjs'
import { zonesFrom, floodEventsFrom, ddrmFireFrom, pprFrom, classes, aggregate, floodClass, fireClass, toValues } from './parse.mjs'
import { dbfRows, looseCsv } from '../../lib/fr.mjs'

check('flood classes by distinct events', [0, 1, 3, 4, 7, 8, 12, 13].map(floodClass).join() === '1,2,2,3,3,4,4,5')
check('fire classes: DDRM 3, PPRif prescribed 4, approved 5', fireClass(undefined, false) === 1 && fireClass(undefined, true) === 3 && fireClass(1, false) === 4 && fireClass(2, true) === 5)

const zone = zonesFrom([{ insee: '06088', Sismicite: '4 - Moyenne' }, { insee: '75056', Sismicite: '1 - Très faible' }, { insee: '00000', Sismicite: '' }])
check('zones from the table’s "Sismicite" label', zone.get('06088') === 4 && zone.get('75056') === 1 && !zone.has('00000'))

const { events } = floodEventsFrom([
  { code_commune: '06088', lib_risque_jo: 'Inondations et coulées de boue', date_debut: '2019-11-23 00:00:00' },
  { code_commune: '06088', lib_risque_jo: 'Inondations et coulées de boue', date_debut: '2019-11-23 00:00:00' }, // same event, second arrêté
  { code_commune: '06088', lib_risque_jo: 'Inondations et coulées de boue', date_debut: '2020-10-02 00:00:00' },
  { code_commune: '06088', lib_risque_jo: 'Inondations et coulées de boue', date_debut: '1999-12-25 00:00:00' }, // before 2000
  { code_commune: '06088', lib_risque_jo: 'Sécheresse', date_debut: '2022-07-01 00:00:00' },
  { code_commune: '75116', lib_risque_jo: 'Inondations par remontée de nappe', date_debut: '2016-06-01 00:00:00' }, // Paris arrondissement → 75056
])
check('distinct flood events since 2000, arrondissements folded into their commune', events.get('06088').size === 2 && events.get('75056').size === 1)

const ddrmFire = ddrmFireFrom([{ cod_commune: '06088', lib_risque: 'Feu de forêt' }, { cod_commune: '75056', lib_risque: 'Inondation' }])
const { ppri, pprif } = pprFrom([
  { 'CODE MODELE': 'PPRN-I', 'LIBELLE ETAT': 'Opposable', 'CODE INSEE COMMUNE': '06088', 'LIBELLE RISQUE 1': 'Inondation' },
  { 'CODE MODELE': 'PPRN-IF', 'LIBELLE ETAT': 'Prescrit', 'CODE INSEE COMMUNE': '06088', 'LIBELLE RISQUE 1': 'Feu de forêt' },
  { 'CODE MODELE': 'PPRN-IF', 'LIBELLE ETAT': 'Opposable', 'CODE INSEE COMMUNE': '06088', 'LIBELLE RISQUE 1': 'Feu de forêt' },
  { 'CODE MODELE': 'PPRN-I', 'LIBELLE ETAT': 'Prescrit', 'CODE INSEE COMMUNE': '75056', 'LIBELLE RISQUE 1': 'Inondation' },
])
const lookups = { zone, floodEvents: events, ppri, ddrmFire, pprif }
const nice = classes('06088', lookups), paris = classes('75056', lookups)
check('a commune’s classes: Nice (zone 4, 2 events but an approved PPRi → 3, PPRif approved → 5)', nice.zone === 4 && nice.flood === 3 && nice.pprif === 'approved' && nice.fire === 5)
check('a prescribed PPRi does not raise the flood class', paris.flood === 2 && paris.fire === 1 && paris.fireListed === false)

const pop = new Map([['06088', 300000], ['06004', 100000], ['75056', 2000000]])
const dep = aggregate(pop, lookups)
check('départements: population-weighted zones and classes', dep['FR-06'].seismicZone === 4 && dep['FR-06'].zoningCoverage === 0.75 && dep['FR-06'].floodExposure === 2.5 && dep['FR-06'].fireExposure === 4 && dep['FR-06'].floodExposedShare === 75)
const { values, details } = toValues({ departments: dep, communes: { '06088': nice } }, { communeNames: { '06088': 'Nice' } })
check('the indicator shows zone − 1 on the 0–4 scale; unzoned départements stay null', values.region['FR-06'].seismicZone === 3 && values.subregion['06088'].seismicZone === 3 && values.region['FR-YT'].seismicZone === null && details.subregion['06088'].floodEvents === 2)

const dbf = Buffer.alloc(32 + 32 + 1 + 2 * 12)
dbf.writeUInt32LE(2, 4); dbf.writeUInt16LE(65, 8); dbf.writeUInt16LE(12, 10)
dbf.write('insee', 32, 'ascii'); dbf[32 + 11] = 'C'.charCodeAt(0); dbf[32 + 16] = 11; dbf[64] = 0x0d
dbf.write(' 06088      ', 65, 'ascii'); dbf.write('*75056      ', 77, 'ascii')
check('dbf: fields from the header, deleted records skipped', JSON.stringify(dbfRows(dbf)) === '[{"insee":"06088"}]')
check('GASPAR rows with a stray separator in a text field still align', looseCsv('a;b;c;d\n1;x;y;z\n2;x;y;with;semicolon;z\n3;x\n').rows.map((r) => r.d).join() === 'z,z')
done()
