/**
 * ISO 3166-1 alpha-2 to the continent the atlas rolls a country up under.
 *
 * The atlas summary groups `visited_countries.continent` in SQL, so whatever a
 * write puts in that column *is* the roll-up's vocabulary. The column is free
 * text and nullable, which leaves three ways to break the panel and only one
 * way to be right:
 *
 * - `''` - an empty string is a group. `AtlasPanel` folds the six canonical
 *   continents case-insensitively and appends anything else it finds, so a blank
 *   continent renders as an unnamed seventh cell with a real count in it.
 * - `'europe'`, `'EUROPE'`, `'Europe '` - three spellings of one continent are
 *   three rows out of `GROUP BY`, and the panel's fold is the only thing
 *   stopping them from printing three times.
 * - a name the panel has never heard of - legitimate, and deliberately kept
 *   (a row that says "Antarctica" is data), but it must be spelled the same way
 *   every time or it splits.
 *
 * So the answer is a frozen table rather than a guess at the call site: one
 * spelling per continent, exactly the six `AtlasPanel` prints plus Antarctica,
 * and a lookup that returns `null` rather than `''` when it has nothing to say -
 * because the summary's `GROUP BY` skips nulls, and skipping is honest where
 * inventing a group is not.
 *
 * **Where the assignments come from.** The UN M49 macro-region each country sits
 * in, folded to six continents: M49's "Northern America", "Central America" and
 * "Caribbean" become North America, and its "Latin America" split by hemisphere.
 * That is what puts Türkiye, Cyprus, Georgia, Armenia and Azerbaijan in Asia and
 * Russia in Europe, and it is a published standard rather than an argument we
 * have to win.
 *
 * **The one deliberate departure.** M49 files the uninhabited polar dependencies
 * with their sovereign's region, which would print "Bouvet Island, Africa" and
 * "South Georgia, South America". The five of them - `AQ`, `BV`, `GS`, `HM` and
 * `TF` - are Antarctica here, because that is where they are.
 *
 * **Scope.** Every code in `./country-names`, and a test asserts that, so the two
 * tables cannot drift: a country the atlas can name is a country the atlas can
 * file.
 */

/**
 * The continents the atlas knows, in the order a reader scans them.
 *
 * The first six are the ones `AtlasPanel` prints whether or not the traveller
 * has been; Antarctica is appended by the panel's own "anything else is data"
 * branch, and appears here so the table has one spelling for it too.
 */
export const CONTINENTS = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const

/** One of the seven names {@link CONTINENTS} lists - never a free-text string. */
export type Continent = (typeof CONTINENTS)[number]

/**
 * ISO 3166-1 alpha-2 to continent. Uppercase keys, sorted by code, so this file
 * diffs line-for-line against `COUNTRY_NAMES` in `./country-names`.
 */
export const COUNTRY_CONTINENTS: Readonly<
  Record<string, Continent | undefined>
> = Object.freeze({
  AD: 'Europe',
  AE: 'Asia',
  AF: 'Asia',
  AG: 'North America',
  AI: 'North America',
  AL: 'Europe',
  AM: 'Asia',
  AO: 'Africa',
  AQ: 'Antarctica',
  AR: 'South America',
  AS: 'Oceania',
  AT: 'Europe',
  AU: 'Oceania',
  AW: 'North America',
  AX: 'Europe',
  AZ: 'Asia',
  BA: 'Europe',
  BB: 'North America',
  BD: 'Asia',
  BE: 'Europe',
  BF: 'Africa',
  BG: 'Europe',
  BH: 'Asia',
  BI: 'Africa',
  BJ: 'Africa',
  BL: 'North America',
  BM: 'North America',
  BN: 'Asia',
  BO: 'South America',
  BQ: 'North America',
  BR: 'South America',
  BS: 'North America',
  BT: 'Asia',
  BV: 'Antarctica',
  BW: 'Africa',
  BY: 'Europe',
  BZ: 'North America',
  CA: 'North America',
  CC: 'Oceania',
  CD: 'Africa',
  CF: 'Africa',
  CG: 'Africa',
  CH: 'Europe',
  CI: 'Africa',
  CK: 'Oceania',
  CL: 'South America',
  CM: 'Africa',
  CN: 'Asia',
  CO: 'South America',
  CR: 'North America',
  CU: 'North America',
  CV: 'Africa',
  CW: 'North America',
  CX: 'Oceania',
  CY: 'Asia',
  CZ: 'Europe',
  DE: 'Europe',
  DJ: 'Africa',
  DK: 'Europe',
  DM: 'North America',
  DO: 'North America',
  DZ: 'Africa',
  EC: 'South America',
  EE: 'Europe',
  EG: 'Africa',
  EH: 'Africa',
  ER: 'Africa',
  ES: 'Europe',
  ET: 'Africa',
  FI: 'Europe',
  FJ: 'Oceania',
  FK: 'South America',
  FM: 'Oceania',
  FO: 'Europe',
  FR: 'Europe',
  GA: 'Africa',
  GB: 'Europe',
  GD: 'North America',
  GE: 'Asia',
  GF: 'South America',
  GG: 'Europe',
  GH: 'Africa',
  GI: 'Europe',
  GL: 'North America',
  GM: 'Africa',
  GN: 'Africa',
  GP: 'North America',
  GQ: 'Africa',
  GR: 'Europe',
  GS: 'Antarctica',
  GT: 'North America',
  GU: 'Oceania',
  GW: 'Africa',
  GY: 'South America',
  HK: 'Asia',
  HM: 'Antarctica',
  HN: 'North America',
  HR: 'Europe',
  HT: 'North America',
  HU: 'Europe',
  ID: 'Asia',
  IE: 'Europe',
  IL: 'Asia',
  IM: 'Europe',
  IN: 'Asia',
  IO: 'Africa',
  IQ: 'Asia',
  IR: 'Asia',
  IS: 'Europe',
  IT: 'Europe',
  JE: 'Europe',
  JM: 'North America',
  JO: 'Asia',
  JP: 'Asia',
  KE: 'Africa',
  KG: 'Asia',
  KH: 'Asia',
  KI: 'Oceania',
  KM: 'Africa',
  KN: 'North America',
  KP: 'Asia',
  KR: 'Asia',
  KW: 'Asia',
  KY: 'North America',
  KZ: 'Asia',
  LA: 'Asia',
  LB: 'Asia',
  LC: 'North America',
  LI: 'Europe',
  LK: 'Asia',
  LR: 'Africa',
  LS: 'Africa',
  LT: 'Europe',
  LU: 'Europe',
  LV: 'Europe',
  LY: 'Africa',
  MA: 'Africa',
  MC: 'Europe',
  MD: 'Europe',
  ME: 'Europe',
  MF: 'North America',
  MG: 'Africa',
  MH: 'Oceania',
  MK: 'Europe',
  ML: 'Africa',
  MM: 'Asia',
  MN: 'Asia',
  MO: 'Asia',
  MP: 'Oceania',
  MQ: 'North America',
  MR: 'Africa',
  MS: 'North America',
  MT: 'Europe',
  MU: 'Africa',
  MV: 'Asia',
  MW: 'Africa',
  MX: 'North America',
  MY: 'Asia',
  MZ: 'Africa',
  NA: 'Africa',
  NC: 'Oceania',
  NE: 'Africa',
  NF: 'Oceania',
  NG: 'Africa',
  NI: 'North America',
  NL: 'Europe',
  NO: 'Europe',
  NP: 'Asia',
  NR: 'Oceania',
  NU: 'Oceania',
  NZ: 'Oceania',
  OM: 'Asia',
  PA: 'North America',
  PE: 'South America',
  PF: 'Oceania',
  PG: 'Oceania',
  PH: 'Asia',
  PK: 'Asia',
  PL: 'Europe',
  PM: 'North America',
  PN: 'Oceania',
  PR: 'North America',
  PS: 'Asia',
  PT: 'Europe',
  PW: 'Oceania',
  PY: 'South America',
  QA: 'Asia',
  RE: 'Africa',
  RO: 'Europe',
  RS: 'Europe',
  RU: 'Europe',
  RW: 'Africa',
  SA: 'Asia',
  SB: 'Oceania',
  SC: 'Africa',
  SD: 'Africa',
  SE: 'Europe',
  SG: 'Asia',
  SH: 'Africa',
  SI: 'Europe',
  SJ: 'Europe',
  SK: 'Europe',
  SL: 'Africa',
  SM: 'Europe',
  SN: 'Africa',
  SO: 'Africa',
  SR: 'South America',
  SS: 'Africa',
  ST: 'Africa',
  SV: 'North America',
  SX: 'North America',
  SY: 'Asia',
  SZ: 'Africa',
  TC: 'North America',
  TD: 'Africa',
  TF: 'Antarctica',
  TG: 'Africa',
  TH: 'Asia',
  TJ: 'Asia',
  TK: 'Oceania',
  TL: 'Asia',
  TM: 'Asia',
  TN: 'Africa',
  TO: 'Oceania',
  TR: 'Asia',
  TT: 'North America',
  TV: 'Oceania',
  TW: 'Asia',
  TZ: 'Africa',
  UA: 'Europe',
  UG: 'Africa',
  UM: 'Oceania',
  US: 'North America',
  UY: 'South America',
  UZ: 'Asia',
  VA: 'Europe',
  VC: 'North America',
  VE: 'South America',
  VG: 'North America',
  VI: 'North America',
  VN: 'Asia',
  VU: 'Oceania',
  WF: 'Oceania',
  WS: 'Oceania',
  XK: 'Europe',
  YE: 'Asia',
  YT: 'Africa',
  ZA: 'Africa',
  ZM: 'Africa',
  ZW: 'Africa',
})

/**
 * `JP` to `Asia`.
 *
 * Returns `null` - never `''` - for anything the table does not know, which is
 * the whole point of the module: a mutation that cannot name a country's
 * continent must write `NULL` and drop out of the roll-up, not invent a nameless
 * group for the panel to render. Input is trimmed and upper-cased, so a code
 * arriving from a form or a map feature works whatever its case.
 */
export function continentOf(code: string): Continent | null {
  return COUNTRY_CONTINENTS[code.trim().toUpperCase()] ?? null
}
