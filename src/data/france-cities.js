// The 40 French cities MapStats tracks (the Natural Earth populated places of FRA-cities.json), each
// pinned to its INSEE commune, which is the statistical unit for city-level figures. Commune codes
// were resolved by name and department with the official geo API (geo.api.gouv.fr/communes) and
// checked by hand; coordinates are Natural Earth's label points. Populations come from INSEE
// (src/data/insee-france.json), not from Natural Earth's urban-area figures.
//
// [id, name, map department id, lat, lon, INSEE commune code]
export const CITY_ROWS = [
  ['FRA-paris', 'Paris', 'FR-75', 48.8686, 2.3314, '75056'],
  ['FRA-lyon', 'Lyon', 'FR-69', 45.772, 4.8281, '69123'],
  ['FRA-marseille', 'Marseille', 'FR-13', 43.2919, 5.3731, '13055'],
  ['FRA-lille', 'Lille', 'FR-59', 50.6519, 3.0781, '59350'],
  ['FRA-nice', 'Nice', 'FR-06', 43.717, 7.2631, '06088'],
  ['FRA-toulouse', 'Toulouse', 'FR-31', 43.6219, 1.448, '31555'],
  ['FRA-bordeaux', 'Bordeaux', 'FR-33', 44.852, -0.597, '33063'],
  ['FRA-rouen', 'Rouen', 'FR-76', 49.4304, 1.08, '76540'],
  ['FRA-strasbourg', 'Strasbourg', 'FR-67', 48.58, 7.75, '67482'],
  ['FRA-nantes', 'Nantes', 'FR-44', 47.2104, -1.59, '44109'],
  ['FRA-metz', 'Metz', 'FR-57', 49.1203, 6.18, '57463'],
  ['FRA-grenoble', 'Grenoble', 'FR-38', 45.1804, 5.72, '38185'],
  ['FRA-toulon', 'Toulon', 'FR-83', 43.1342, 5.9188, '83137'],
  ['FRA-montpellier', 'Montpellier', 'FR-34', 43.6104, 3.87, '34172'],
  ['FRA-nancy', 'Nancy', 'FR-54', 48.6837, 6.2, '54395'],
  ['FRA-saint-etienne', 'Saint-Étienne', 'FR-42', 45.4304, 4.38, '42218'],
  ['FRA-fort-de-france', 'Fort-de-France', 'FR-MQ', 14.6104, -61.08, '97209'],
  ['FRA-melun', 'Melun', 'FR-77', 48.5333, 2.6666, '77288'],
  ['FRA-le-havre', 'Le Havre', 'FR-76', 49.505, 0.105, '76351'],
  ['FRA-tours', 'Tours', 'FR-37', 47.3804, 0.6999, '37261'],
  ['FRA-clermont-ferrand', 'Clermont-Ferrand', 'FR-63', 45.78, 3.08, '63113'],
  ['FRA-orleans', 'Orléans', 'FR-45', 47.9004, 1.9, '45234'],
  ['FRA-mulhouse', 'Mulhouse', 'FR-68', 47.7504, 7.35, '68224'],
  ['FRA-rennes', 'Rennes', 'FR-35', 48.1, -1.67, '35238'],
  ['FRA-reims', 'Reims', 'FR-51', 49.2504, 4.03, '51454'],
  ['FRA-caen', 'Caen', 'FR-14', 49.1838, -0.35, '14118'],
  ['FRA-st-denis', 'Saint-Denis', 'FR-RE', -20.8789, 55.4481, '97411'],
  ['FRA-angers', 'Angers', 'FR-49', 47.48, -0.53, '49007'],
  ['FRA-dijon', 'Dijon', 'FR-21', 47.3304, 5.03, '21231'],
  ['FRA-nimes', 'Nîmes', 'FR-30', 43.8304, 4.35, '30189'],
  ['FRA-limoges', 'Limoges', 'FR-87', 45.83, 1.25, '87085'],
  ['FRA-aix-en-provence', 'Aix-en-Provence', 'FR-13', 43.52, 5.45, '13001'],
  ['FRA-perpignan', 'Perpignan', 'FR-66', 42.7, 2.9, '66136'],
  ['FRA-pointe-a-pitre', 'Pointe-à-Pitre', 'FR-GP', 16.2415, -61.533, '97120'],
  ['FRA-biarritz', 'Biarritz', 'FR-64', 43.4733, -1.5616, '64122'],
  ['FRA-brest', 'Brest', 'FR-29', 48.3904, -4.495, '29019'],
  ['FRA-le-mans', 'Le Mans', 'FR-72', 48.0004, 0.1, '72181'],
  ['FRA-amiens', 'Amiens', 'FR-80', 49.9004, 2.3, '80021'],
  ['FRA-besancon', 'Besançon', 'FR-25', 47.23, 6.03, '25056'],
  ['FRA-annecy', 'Annecy', 'FR-74', 45.9, 6.1167, '74010'],
]
