// Curated city list for France (replaces the Natural Earth list): the 40 Natural Earth populated places, each
// pinned to its INSEE commune, the statistical unit of every commune-level figure. Commune codes were resolved by
// name and département with the official geo API (geo.api.gouv.fr/communes) and checked by hand; coordinates are
// Natural Earth's label points; populations are INSEE's 2023 municipal populations (populations légales, in force
// since 1 January 2026), not Natural Earth's urban-area figures.
//   codes.subregion  the INSEE commune code: datasets publish commune values under it (src/core/resolve.js)
// Paris is its own département: its département figures come at city level (lib/fr.mjs CITY_JURISDICTIONS).
// City ids are permanent: saved comparisons and links use them.

// [slug, name, département (region id), lat, lon, municipal population 2023, INSEE commune code]
const C = [
  ['paris', 'Paris', 'FR-75', 48.8686, 2.3314, 2103778, '75056'],
  ['lyon', 'Lyon', 'FR-69', 45.772, 4.8281, 519127, '69123'],
  ['marseille', 'Marseille', 'FR-13', 43.2919, 5.3731, 886040, '13055'],
  ['lille', 'Lille', 'FR-59', 50.6519, 3.0781, 238246, '59350'],
  ['nice', 'Nice', 'FR-06', 43.717, 7.2631, 357737, '06088'],
  ['toulouse', 'Toulouse', 'FR-31', 43.6219, 1.448, 514819, '31555'],
  ['bordeaux', 'Bordeaux', 'FR-33', 44.852, -0.597, 267991, '33063'],
  ['rouen', 'Rouen', 'FR-76', 49.4304, 1.08, 117662, '76540'],
  ['strasbourg', 'Strasbourg', 'FR-67', 48.58, 7.75, 293771, '67482'],
  ['nantes', 'Nantes', 'FR-44', 47.2104, -1.59, 327734, '44109'],
  ['metz', 'Metz', 'FR-57', 49.1203, 6.18, 122572, '57463'],
  ['grenoble', 'Grenoble', 'FR-38', 45.1804, 5.72, 156140, '38185'],
  ['toulon', 'Toulon', 'FR-83', 43.1342, 5.9188, 179116, '83137'],
  ['montpellier', 'Montpellier', 'FR-34', 43.6104, 3.87, 310240, '34172'],
  ['nancy', 'Nancy', 'FR-54', 48.6837, 6.2, 103671, '54395'],
  ['saint-etienne', 'Saint-Étienne', 'FR-42', 45.4304, 4.38, 173136, '42218'],
  ['fort-de-france', 'Fort-de-France', 'FR-MQ', 14.6104, -61.08, 75506, '97209'],
  ['melun', 'Melun', 'FR-77', 48.5333, 2.6666, 45995, '77288'],
  ['le-havre', 'Le Havre', 'FR-76', 49.505, 0.105, 166687, '76351'],
  ['tours', 'Tours', 'FR-37', 47.3804, 0.6999, 139259, '37261'],
  ['clermont-ferrand', 'Clermont-Ferrand', 'FR-63', 45.78, 3.08, 146351, '63113'],
  ['orleans', 'Orléans', 'FR-45', 47.9004, 1.9, 116357, '45234'],
  ['mulhouse', 'Mulhouse', 'FR-68', 47.7504, 7.35, 104978, '68224'],
  ['rennes', 'Rennes', 'FR-35', 48.1, -1.67, 230890, '35238'],
  ['reims', 'Reims', 'FR-51', 49.2504, 4.03, 177674, '51454'],
  ['caen', 'Caen', 'FR-14', 49.1838, -0.35, 109400, '14118'],
  ['st-denis', 'Saint-Denis', 'FR-RE', -20.8789, 55.4481, 155634, '97411'],
  ['angers', 'Angers', 'FR-49', 47.48, -0.53, 159022, '49007'],
  ['dijon', 'Dijon', 'FR-21', 47.3304, 5.03, 161830, '21231'],
  ['nimes', 'Nîmes', 'FR-30', 43.8304, 4.35, 151839, '30189'],
  ['limoges', 'Limoges', 'FR-87', 45.83, 1.25, 129937, '87085'],
  ['aix-en-provence', 'Aix-en-Provence', 'FR-13', 43.52, 5.45, 149695, '13001'],
  ['perpignan', 'Perpignan', 'FR-66', 42.7, 2.9, 121616, '66136'],
  ['pointe-a-pitre', 'Pointe-à-Pitre', 'FR-GP', 16.2415, -61.533, 15040, '97120'],
  ['biarritz', 'Biarritz', 'FR-64', 43.4733, -1.5616, 26206, '64122'],
  ['brest', 'Brest', 'FR-29', 48.3904, -4.495, 142346, '29019'],
  ['le-mans', 'Le Mans', 'FR-72', 48.0004, 0.1, 146249, '72181'],
  ['amiens', 'Amiens', 'FR-80', 49.9004, 2.3, 136449, '80021'],
  ['besancon', 'Besançon', 'FR-25', 47.23, 6.03, 118489, '25056'],
  ['annecy', 'Annecy', 'FR-74', 45.9, 6.1167, 132117, '74010'],
]

export const CITIES = C.map(([slug, name, region, lat, lon, pop, commune]) => ({
  id: `FRA-${slug}`, name, region, lat, lon, pop, capital: slug === 'paris', codes: { subregion: commune },
}))

/** INSEE commune code → name, for the datasets' `names.subregion`. */
export const COMMUNE_NAMES = Object.fromEntries(C.map(([, name, , , , , commune]) => [commune, name]))
