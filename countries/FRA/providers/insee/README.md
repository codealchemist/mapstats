# insee: INSEE's département statistics (population, unemployment, life expectancy, relative poverty, commuting)

A compilation (`data/insee.json` cites a provider per indicator), read from INSEE's open APIs: insee.fr's robots.txt disallows fetching its xlsx/csv files, so api.insee.fr (no key) is the only automated route. Licence: [INSEE Open Licence 2.0](https://www.insee.fr/fr/information/2381863) (attribution and the update date kept in the dataset's origin).

| Provider | Indicator | API dataset | Level | Latest | Next release |
|---|---|---|---|---|---|
| `insee-population` | `pop` (context) | Melodi `DS_ESTIMATION_POPULATION` (1 January), `DS_POPULATIONS_REFERENCE` (communes) | département, commune | 2023 (definitive), 2024–2026 provisional | January each year |
| `insee-unemployment` | `unemployment` | BDM `TCRED-TRAVAIL-EMPLOI-TCHOMA-SA` (annual averages) | département | 2025 | June each year |
| `insee-mortality` | `lifeExp`, `lifeExpWomen`, `lifeExpMen` | Melodi `DS_DECES_MORTALITE_SERIES` (LEXPEC, age 0, by sex) | département | 2025 (provisional) | September each year |
| `insee-filosofi` | `povertyRelative` (context) | Melodi `DS_FILOSOFI_CC` (PR_MD60) | département, commune | 2023 | Summer, two years after the income year |
| `insee-census` | `transitCommute` (context) | Melodi `DS_RP_NAVETTES_PRINC` (TRANS 6 ÷ _T) | département, commune | census 2023 | July each year |

`raw/populations-reference-2023.zip` (the reference populations of every commune) is stored here as well: the Géorisques prefill weights communes by it.

## Definitions vs the MapStats catalogue

- `unemployment`: ILO unemployment rate, annual average. Metropolitan départements have INSEE's localised rates; overseas départements only the Labour Force Survey rate (same concept, different series) and Mayotte none. Argentina's EPH rate is urban-only.
- `lifeExp`: INSEE publishes département life expectancy for women and men separately. The scored value is their mean (within about 0.2 year of a combined life table); both published values are shown. Argentina weights 105 boys to 100 girls.
- `povertyRelative`: share of persons below 60 % of the metropolitan median standard of living. A relative threshold, not comparable with Argentina's basic-basket `poverty`: shown, not scored. Metropolitan France and La Réunion only; the other overseas départements stay `null`.
- `transitCommute`: employed residents aged 15+ whose main mode of transport to work is public transport, census 2023 (France excluding Mayotte). A measure of use, not of network coverage: context only.
- `pop`: population at 1 January 2023 (definitive) for départements; municipal populations 2023 for communes (copied into `places.js`).

## Updating

```bash
npm run prefill -- FRA --provider insee
npm run anchors && npm run golden -- --update && npm test && npm run country:check -- FRA
```

The queries in [`parse.mjs`](parse.mjs) `FILES` pin the years (`POP_YEARS`, `LIFE_YEARS`, the census year). Extend them, delete the file to refresh (`raw/<name>`), and run again. `POP_REFERENCE_YEAR` in [`prefill.mjs`](prefill.mjs) should move to the latest definitive year.

## Quirks

- Melodi pages its answers (`paging.next`); the prefill follows the pages and stores one file per query.
- Mayotte has no unemployment series, no Filosofi and no census commuting figure: those stay `null`.
- Life expectancy for the last three years is provisional (`OBS_STATUS_FR = PROV`); the dataset's period says so.
