// Numbeo crime survey questions: [key, label, match patterns (accent-folded, lowercase, es + en)].
// Shared by the scraper (scripts/numbeo/parse.mjs) and the city report.
export const SURVEY = [
  ['level', 'Level of crime', ['nivel de criminalidad', 'level of crime']],
  ['increasing', 'Crime increasing (past 3 years)', ['ultimos 3 anos', 'past 3 years']],
  ['homeBrokenIn', 'Worries: home broken into', ['en el domicilio', 'home broken']],
  ['thingsFromCar', 'Worries: things stolen from car', ['interior del coche', 'things from car']],
  ['carStolen', 'Worries: car stolen', ['robo del coche', 'car stolen']],
  ['mugged', 'Worries: mugged or robbed', ['hurtos o robos', 'mugged or robbed']],
  ['bias', 'Worries: attack for skin colour, ethnicity, gender or religion', ['color de piel', 'skin color']],
  ['attacked', 'Worries: being attacked', ['ser agredido', 'worries attacked']],
  ['insulted', 'Worries: being insulted', ['insultado', 'insulted']],
  ['drugs', 'Problem: drug use or dealing', ['drogas', 'drugs']],
  ['propertyCrimes', 'Problem: property crime, vandalism', ['contra la propiedad', 'property crimes']],
  ['violentCrimes', 'Problem: violent crime, armed robbery', ['crimenes violentos', 'violent crimes']],
  ['corruption', 'Problem: corruption and bribery', ['corrupcion', 'corruption']],
  ['safetyDay', 'Safety walking alone by day', ['durante el dia', 'daylight']],
  ['safetyNight', 'Safety walking alone at night', ['durante la noche', 'during night']],
]

// Questions where a high value means safer (all others: higher = worse).
export const SURVEY_SAFER_HIGH = new Set(['safetyDay', 'safetyNight'])
