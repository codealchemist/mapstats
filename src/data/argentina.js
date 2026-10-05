// Curated baseline dataset for Argentina.
//
// Values are approximate snapshots compiled from public sources (see data/sources.js) and
// are meant as a reasonable starting point, not an official statistic. Each key in
// PROVINCE_FIELDS documents its source so values can be refreshed in one place.
//
// Live environmental data (climate, air quality, elevation, earthquakes) is NOT
// stored here; it is fetched at runtime from Open-Meteo and USGS.

import NUMBEO from './numbeo-argentina.json' with { type: 'json' }
import SNIC from './snic-argentina.json' with { type: 'json' }

export const PROVINCE_FIELDS = [
  'pop', 'homicide', 'propertyCrime', 'poverty', 'unemployment', 'water', 'sewer',
  'internet', 'doctors', 'roadPaved', 'transit', 'seismicZone', 'fireRisk', 'floodRisk',
  'lifeExp', 'hdi',
]

// pop: thousands (Censo 2022) · homicide / propertyCrime: hand-entered fallbacks, replaced below by the official
// SNIC import (src/data/snic-argentina.json) when present
// poverty: % persons (EPH, main urban areas, 2024) · unemployment: % (EPH 2024)
// water / sewer: % households with network (Censo 2022) · internet: fixed accesses per 100 households (ENACOM 2024)
// doctors: per 1,000 inhabitants (REFEPS) · roadPaved: % of national+provincial network paved (DNV/DPV, approx.)
// transit: public transport coverage score 0–100 (MapStats estimate from SUBE / urban network coverage)
// seismicZone: INPRES-CIRSOC 103 zone 0–4 (max zone present in populated areas)
// fireRisk / floodRisk: 1–5 (Servicio Nacional de Manejo del Fuego / INA historical exposure, MapStats estimate)
// lifeExp: years (INDEC projections) · hdi: provincial HDI (PNUD Argentina)
const P = (pop, homicide, propertyCrime, poverty, unemployment, water, sewer, internet, doctors, roadPaved, transit, seismicZone, fireRisk, floodRisk, lifeExp, hdi) => ({
  pop, homicide, propertyCrime, poverty, unemployment, water, sewer, internet, doctors, roadPaved, transit, seismicZone, fireRisk, floodRisk, lifeExp, hdi,
})

export const PROVINCES = {
  'AR-C': P(3121, 3.0, 5200, 21, 7.0, 99, 98, 100, 10.0, 100, 95, 0, 1, 2, 78.3, 0.882),
  'AR-B': P(17569, 4.5, 3100, 41, 8.0, 75, 60, 78, 3.2, 70, 72, 0, 2, 4, 76.4, 0.827),
  'AR-K': P(429, 2.6, 2300, 37, 6.0, 93, 55, 52, 2.6, 60, 35, 2, 3, 2, 76.1, 0.809),
  'AR-H': P(1142, 3.6, 2500, 55, 5.0, 82, 32, 40, 2.4, 45, 35, 0, 3, 4, 74.9, 0.778),
  'AR-U': P(603, 4.0, 2700, 30, 7.0, 97, 85, 85, 3.0, 55, 40, 1, 3, 2, 76.3, 0.830),
  'AR-X': P(3978, 3.2, 3200, 37, 8.5, 92, 50, 75, 4.0, 72, 60, 1, 4, 2, 77.0, 0.834),
  'AR-W': P(1212, 3.1, 2200, 47, 5.0, 88, 52, 45, 3.0, 55, 38, 0, 3, 4, 75.2, 0.795),
  'AR-E': P(1425, 3.5, 2400, 38, 6.0, 92, 65, 68, 3.3, 65, 42, 0, 2, 4, 76.6, 0.816),
  'AR-P': P(607, 3.2, 1300, 46, 3.0, 80, 35, 30, 2.4, 45, 30, 0, 3, 4, 74.8, 0.773),
  'AR-Y': P(811, 3.0, 2100, 43, 4.0, 95, 72, 45, 2.6, 55, 40, 3, 3, 2, 75.5, 0.799),
  'AR-L': P(361, 2.0, 2600, 30, 5.0, 90, 65, 70, 3.2, 70, 30, 0, 4, 2, 77.1, 0.825),
  'AR-F': P(384, 2.8, 2600, 40, 6.0, 94, 50, 48, 3.8, 60, 30, 3, 3, 1, 76.5, 0.810),
  'AR-M': P(2043, 4.2, 3500, 38, 5.5, 95, 70, 65, 3.7, 70, 60, 4, 3, 2, 77.0, 0.830),
  'AR-N': P(1280, 3.0, 1700, 42, 3.5, 85, 18, 40, 2.4, 60, 38, 0, 3, 2, 75.5, 0.789),
  'AR-Q': P(726, 3.6, 3300, 28, 6.5, 97, 85, 80, 3.6, 60, 45, 2, 3, 1, 77.6, 0.837),
  'AR-R': P(762, 4.5, 3100, 30, 5.5, 94, 75, 72, 3.2, 55, 42, 1, 4, 1, 76.9, 0.823),
  'AR-A': P(1441, 4.6, 2600, 42, 6.0, 92, 70, 48, 2.8, 50, 45, 3, 3, 3, 75.8, 0.807),
  'AR-J': P(822, 3.4, 2800, 38, 4.5, 96, 45, 60, 3.4, 65, 45, 4, 2, 1, 76.6, 0.814),
  'AR-D': P(542, 2.7, 3000, 33, 3.0, 96, 65, 65, 3.0, 80, 40, 2, 4, 1, 77.0, 0.819),
  'AR-Z': P(337, 3.7, 3400, 25, 3.0, 97, 90, 75, 3.0, 50, 35, 1, 2, 1, 77.0, 0.836),
  'AR-S': P(3556, 7.5, 3800, 37, 7.0, 85, 45, 72, 4.2, 70, 58, 0, 3, 4, 76.8, 0.829),
  'AR-G': P(1060, 3.2, 1600, 45, 3.5, 85, 32, 30, 2.6, 45, 32, 1, 4, 3, 75.0, 0.784),
  'AR-V': P(185, 2.1, 2200, 27, 6.0, 98, 95, 95, 3.2, 40, 40, 2, 2, 1, 77.5, 0.838),
  'AR-T': P(1731, 5.0, 3000, 42, 6.0, 93, 50, 55, 3.6, 60, 50, 2, 2, 3, 76.0, 0.812),
}

// Official SNIC crime rates (scripts/snic-import.mjs) replace the hand-entered figures above.
// 3-year averages: single-year rates in small departments swing widely (one homicide can move a rate by 5+).
export const SNIC_KEYS = ['homicide', 'propertyCrime', 'roadDeaths']
export { SNIC }
for (const [iso, p] of Object.entries(PROVINCES)) {
  const s = SNIC.provinces?.[iso]
  if (s) for (const k of SNIC_KEYS) p[k] = s.avg3[k] ?? null
}

// Numbeo city indices (approximate snapshot, 2025). Numbeo does not allow
// cross-origin requests or scraping, so the app links out to the live page instead.
// crimeIndex, healthcareIndex, pollutionIndex, trafficIndex (time index), costOfLiving, purchasingPower, qualityOfLife
const N = (crimeIndex, healthcareIndex, pollutionIndex, trafficIndex, costOfLiving, purchasingPower, qualityOfLife, slug) => ({
  crimeIndex, healthcareIndex, pollutionIndex, trafficIndex, costOfLiving, purchasingPower, qualityOfLife, numbeoSlug: slug,
})

// [id, name, province, lat, lon, population, numbeo?]
// numbeo may be just { numbeoSlug } when the city has a Numbeo page but no snapshot values yet.
const C = [
  ['buenos-aires', 'Buenos Aires', 'AR-C', -34.6037, -58.3816, 3121707, N(63.9, 68.5, 58.6, 44, 37, 34, 115, 'Buenos-Aires')],
  ['la-plata', 'La Plata', 'AR-B', -34.9214, -57.9545, 772618, N(63.0, 66.0, 48.0, 35, 33, 33, 112, 'La-Plata')],
  ['mar-del-plata', 'Mar del Plata', 'AR-B', -38.0055, -57.5426, 682605, N(56.0, 61.0, 41.0, 30, 34, 32, 120, 'Mar-del-Plata')],
  ['bahia-blanca', 'Bahía Blanca', 'AR-B', -38.7196, -62.2724, 336574, N(52.0, 66.0, 45.0, 28, 33, 33, 120, 'Bahia-Blanca')],
  ['la-matanza', 'La Matanza', 'AR-B', -34.6833, -58.5500, 1837774],
  ['quilmes', 'Quilmes', 'AR-B', -34.7206, -58.2546, 636026],
  ['lomas-de-zamora', 'Lomas de Zamora', 'AR-B', -34.7608, -58.4064, 694330, { numbeoSlug: 'Lomas-de-Zamora-Argentina' }],
  ['pilar', 'Pilar', 'AR-B', -34.4587, -58.9142, 407000],
  ['tandil', 'Tandil', 'AR-B', -37.3217, -59.1332, 150162, N(35.0, 65.0, 30.0, 22, 33, 33, 135, 'Tandil')],
  ['olavarria', 'Olavarría', 'AR-B', -36.8927, -60.3225, 117000],
  ['junin', 'Junín', 'AR-B', -34.5838, -60.9433, 100000],
  ['necochea', 'Necochea', 'AR-B', -38.5545, -58.7396, 95000],
  ['san-nicolas', 'San Nicolás de los Arroyos', 'AR-B', -33.3342, -60.2108, 150000],
  ['catamarca', 'San Fernando del Valle de Catamarca', 'AR-K', -28.4696, -65.7795, 230000],
  ['resistencia', 'Resistencia', 'AR-H', -27.4606, -58.9839, 420000, N(58.0, 55.0, 50.0, 30, 30, 28, 95, 'Resistencia')],
  ['saenz-pena', 'Presidencia Roque Sáenz Peña', 'AR-H', -26.7852, -60.4388, 105000],
  ['comodoro-rivadavia', 'Comodoro Rivadavia', 'AR-U', -45.8641, -67.4966, 200000, N(52.0, 58.0, 42.0, 30, 40, 40, 118, 'Comodoro-Rivadavia')],
  ['trelew', 'Trelew', 'AR-U', -43.2489, -65.3051, 110000],
  ['puerto-madryn', 'Puerto Madryn', 'AR-U', -42.7692, -65.0385, 115000],
  ['esquel', 'Esquel', 'AR-U', -42.9115, -71.3195, 40000],
  ['cordoba', 'Córdoba', 'AR-X', -31.4201, -64.1888, 1565112, N(59.5, 70.0, 56.4, 36, 33, 35, 117, 'Cordoba')],
  ['rio-cuarto', 'Río Cuarto', 'AR-X', -33.1232, -64.3493, 175000],
  ['villa-maria', 'Villa María', 'AR-X', -32.4075, -63.2402, 90000],
  ['villa-carlos-paz', 'Villa Carlos Paz', 'AR-X', -31.4241, -64.4978, 90000],
  ['san-francisco', 'San Francisco', 'AR-X', -31.4278, -62.0827, 70000],
  ['corrientes', 'Corrientes', 'AR-W', -27.4692, -58.8306, 400000, N(52.0, 58.0, 48.0, 30, 30, 30, 105, 'Corrientes')],
  ['goya', 'Goya', 'AR-W', -29.1443, -59.2643, 90000],
  ['parana', 'Paraná', 'AR-E', -31.7333, -60.5297, 280000, N(50.0, 62.0, 42.0, 28, 31, 32, 118, 'Parana')],
  ['concordia', 'Concordia', 'AR-E', -31.3929, -58.0209, 170000],
  ['gualeguaychu', 'Gualeguaychú', 'AR-E', -33.0094, -58.5172, 115000],
  ['formosa', 'Formosa', 'AR-P', -26.1775, -58.1781, 250000],
  ['jujuy', 'San Salvador de Jujuy', 'AR-Y', -24.1858, -65.2995, 330000, N(52.0, 55.0, 50.0, 30, 30, 28, 100, 'San-Salvador-de-Jujuy')],
  ['palpala', 'Palpalá', 'AR-Y', -24.2565, -65.2115, 55000],
  ['santa-rosa', 'Santa Rosa', 'AR-L', -36.6167, -64.2833, 130000],
  ['general-pico', 'General Pico', 'AR-L', -35.6566, -63.7568, 60000],
  ['la-rioja', 'La Rioja', 'AR-F', -29.4131, -66.8558, 200000],
  ['chilecito', 'Chilecito', 'AR-F', -29.1619, -67.4974, 50000],
  ['mendoza', 'Mendoza', 'AR-M', -32.8895, -68.8458, 1100000, N(53.8, 64.0, 52.7, 33, 33, 32, 120, 'Mendoza')],
  ['san-rafael', 'San Rafael', 'AR-M', -34.6177, -68.3301, 190000],
  ['malargue', 'Malargüe', 'AR-M', -35.4752, -69.5843, 30000],
  ['posadas', 'Posadas', 'AR-N', -27.3621, -55.9009, 360000, N(48.0, 60.0, 45.0, 30, 31, 30, 112, 'Posadas')],
  ['obera', 'Oberá', 'AR-N', -27.4871, -55.1199, 80000],
  ['puerto-iguazu', 'Puerto Iguazú', 'AR-N', -25.5991, -54.5736, 85000],
  ['neuquen', 'Neuquén', 'AR-Q', -38.9516, -68.0591, 290000, N(51.0, 62.0, 45.0, 32, 36, 38, 125, 'Neuquen')],
  ['san-martin-de-los-andes', 'San Martín de los Andes', 'AR-Q', -40.1579, -71.3534, 40000],
  ['cutral-co', 'Cutral Có', 'AR-Q', -38.9342, -69.2301, 40000],
  ['bariloche', 'San Carlos de Bariloche', 'AR-R', -41.1335, -71.3103, 135000, N(41.0, 58.0, 30.0, 28, 40, 30, 130, 'San-Carlos-de-Bariloche')],
  ['general-roca', 'General Roca', 'AR-R', -39.0333, -67.5833, 100000],
  ['cipolletti', 'Cipolletti', 'AR-R', -38.9339, -67.9903, 100000],
  ['viedma', 'Viedma', 'AR-R', -40.8135, -62.9967, 65000],
  ['salta', 'Salta', 'AR-A', -24.7821, -65.4232, 620000, N(54.5, 58.0, 54.0, 33, 31, 30, 105, 'Salta')],
  ['oran', 'San Ramón de la Nueva Orán', 'AR-A', -23.1322, -64.3266, 85000],
  ['tartagal', 'Tartagal', 'AR-A', -22.5164, -63.8013, 70000],
  ['san-juan', 'San Juan', 'AR-J', -31.5375, -68.5364, 500000, N(50.0, 60.0, 48.0, 30, 30, 31, 112, 'San-Juan')],
  ['caucete', 'Caucete', 'AR-J', -31.6517, -68.2811, 40000],
  ['san-luis', 'San Luis', 'AR-D', -33.2950, -66.3356, 220000, N(42.0, 58.0, 38.0, 26, 30, 32, 120, 'San-Luis')],
  ['villa-mercedes', 'Villa Mercedes', 'AR-D', -33.6757, -65.4578, 130000],
  ['merlo', 'Merlo', 'AR-D', -32.3429, -65.0136, 20000],
  ['rio-gallegos', 'Río Gallegos', 'AR-Z', -51.6230, -69.2168, 100000],
  ['caleta-olivia', 'Caleta Olivia', 'AR-Z', -46.4393, -67.5281, 60000],
  ['el-calafate', 'El Calafate', 'AR-Z', -50.3379, -72.2648, 25000],
  ['rosario', 'Rosario', 'AR-S', -32.9442, -60.6505, 1300000, N(70.4, 69.4, 53.0, 34, 32, 33, 105, 'Rosario')],
  ['santa-fe', 'Santa Fe', 'AR-S', -31.6107, -60.6973, 540000, N(66.0, 64.0, 50.0, 32, 31, 32, 105, 'Santa-Fe')],
  ['rafaela', 'Rafaela', 'AR-S', -31.2503, -61.4867, 110000],
  ['venado-tuerto', 'Venado Tuerto', 'AR-S', -33.7456, -61.9688, 85000],
  ['reconquista', 'Reconquista', 'AR-S', -29.1500, -59.6500, 100000],
  ['santiago-del-estero', 'Santiago del Estero', 'AR-G', -27.7951, -64.2615, 300000],
  ['la-banda', 'La Banda', 'AR-G', -27.7333, -64.2500, 150000],
  ['termas-de-rio-hondo', 'Termas de Río Hondo', 'AR-G', -27.4936, -64.8597, 35000],
  ['ushuaia', 'Ushuaia', 'AR-V', -54.8019, -68.3030, 85000, N(30.0, 57.0, 25.0, 22, 45, 35, 140, 'Ushuaia')],
  ['rio-grande', 'Río Grande', 'AR-V', -53.7877, -67.7095, 100000],
  ['tucuman', 'San Miguel de Tucumán', 'AR-T', -26.8083, -65.2176, 900000, N(62.5, 60.5, 59.0, 35, 30, 32, 100, 'San-Miguel-de-Tucuman')],
  ['yerba-buena', 'Yerba Buena', 'AR-T', -26.8167, -65.3167, 90000],
  ['concepcion', 'Concepción', 'AR-T', -27.3417, -65.5925, 60000],
]

// SNIC department (partido / departamento, INDEC code) each city lies in, from point-in-polygon on
// department boundaries. SNIC publishes crime by department, the finest level available; Buenos Aires
// city uses its jurisdiction-wide (AR-C) figures.
const SNIC_DEPT = {
  'la-plata': '06441', 'mar-del-plata': '06357', 'bahia-blanca': '06056', 'la-matanza': '06427', quilmes: '06058', 'lomas-de-zamora': '06490',
  pilar: '06638', tandil: '06791', olavarria: '06595', junin: '06413', necochea: '06581', 'san-nicolas': '06763',
  catamarca: '10049', resistencia: '22140', 'saenz-pena': '22021', 'comodoro-rivadavia': '26021', trelew: '26077', 'puerto-madryn': '26007',
  esquel: '26035', cordoba: '14014', 'rio-cuarto': '14098', 'villa-maria': '14042', 'villa-carlos-paz': '14091', 'san-francisco': '14140',
  corrientes: '18021', goya: '18070', parana: '30084', concordia: '30015', gualeguaychu: '30056', formosa: '34014',
  jujuy: '38021', palpala: '38042', 'santa-rosa': '42021', 'general-pico': '42105', 'la-rioja': '46014', chilecito: '46042',
  mendoza: '50007', 'san-rafael': '50105', malargue: '50077', posadas: '54028', obera: '54091', 'puerto-iguazu': '54063',
  neuquen: '58035', 'san-martin-de-los-andes': '58056', 'cutral-co': '58035', bariloche: '62021', 'general-roca': '62042', cipolletti: '62042',
  viedma: '62007', salta: '66028', oran: '66126', tartagal: '66056', 'san-juan': '70028', caucete: '70035',
  'san-luis': '74056', 'villa-mercedes': '74035', merlo: '74049', 'rio-gallegos': '78021', 'caleta-olivia': '78014', 'el-calafate': '78028',
  rosario: '82084', 'santa-fe': '82063', rafaela: '82021', 'venado-tuerto': '82042', reconquista: '82049', 'santiago-del-estero': '86049',
  'la-banda': '86035', 'termas-de-rio-hondo': '86147', ushuaia: '94014', 'rio-grande': '94007', tucuman: '90084', 'yerba-buena': '90119',
  concepcion: '90021',
}

function snicFor(id) {
  if (id === 'buenos-aires') return SNIC.provinces?.['AR-C'] && { level: 'city', name: 'Ciudad de Buenos Aires', ...SNIC.provinces['AR-C'] }
  const d = SNIC.departments?.[SNIC_DEPT[id]]
  return d && { level: 'department', code: SNIC_DEPT[id], ...d }
}

// Scraped Numbeo data (scripts/numbeo-fetch.mjs) replaces the approximate snapshot above city by city.
const NUMBEO_KEYS = ['crimeIndex', 'safetyIndex', 'healthcareIndex', 'pollutionIndex', 'trafficIndex', 'costOfLiving', 'purchasingPower', 'qualityOfLife', 'climateIndex']
const scraped = Object.fromEntries(NUMBEO.cities.filter((c) => c.cityId).map((c) => [c.cityId, c]))

export const CITIES = C.map(([id, name, province, lat, lon, pop, numbeo]) => {
  const snic = snicFor(id)
  const city = {
    id: `ARG-${id}`, name, province, lat, lon, pop, capital: id === 'buenos-aires', ...(numbeo || {}),
    snic: snic || null,
    // Values measured for this place (its SNIC department), never inherited from the province.
    ownValues: snic ? Object.fromEntries(SNIC_KEYS.map((k) => [k, snic.avg3[k] ?? null])) : {},
  }
  const s = scraped[city.id]
  if (!s) return { ...city, numbeoSource: numbeo?.crimeIndex != null ? 'snapshot' : null }
  // Drop snapshot indices so only figures Numbeo actually publishes for this city remain.
  for (const k of NUMBEO_KEYS) delete city[k]
  for (const k of NUMBEO_KEYS) if (s[k] != null) city[k] = s[k]
  return {
    ...city, numbeoSlug: s.slug, numbeoSurvey: s.survey || null,
    numbeoSource: s.source, numbeoFetchedAt: s.fetchedAt, numbeoContributors: s.contributors ?? null,
  }
})
