import type { IconName } from './icons'

/**
 * BMKG's condition codes, and the glyph each one gets.
 *
 * The codes are the reason this can be a lookup rather than string matching:
 * `weather_desc` is prose that already varies ("Cerah" arrives for both 0 and 1),
 * while the number beside it does not. Matching on the words would also have to be
 * done twice, once per language.
 *
 * THE PUBLISHED CODE TABLE IS WRONG. The list circulated for this API says 10 is
 * "Asap", 45 is "Kabut", 60/61 are "Hujan Ringan"/"Hujan Sedang", and has no 17 at
 * all. Sampling 984 forecast points across 52 kecamatan says otherwise, and each
 * response carries BMKG's own icon slug, which settles it:
 *
 *     code  weather_desc_en    BMKG icon slug
 *        0  Sunny              cerah
 *        1  Sunny              cerah
 *        2  Partly Cloudy      cerah berawan
 *        3  Mostly Cloudy      berawan
 *       10  Mist/Haze          udara kabur      <- not "asap"
 *       17  Thunder            hujan petir      <- absent from the published list
 *       45  Fog/Smoke          kabut
 *       61  Light Rain         hujan ringan     <- not "hujan sedang"
 *
 * So the observed rows below are authoritative. The rest are documented codes that
 * a dry-season sample simply could not produce; they are marked, and they only
 * cover conditions with no observed code competing for them.
 */
const BY_CODE: Readonly<Record<number, IconName>> = {
  // --- Observed against the live API ---
  0: 'sun', // Cerah / Sunny
  1: 'sun', // Cerah / Sunny
  2: 'sun-cloud', // Cerah Berawan / Partly Cloudy
  3: 'cloud', // Berawan / Mostly Cloudy
  10: 'haze', // Udara Kabur / Mist/Haze
  17: 'storm', // Petir / Thunder
  45: 'fog', // Kabut/Asap / Fog/Smoke
  61: 'drizzle', // Hujan Ringan / Light Rain

  // --- Documented, not seen in an August sample ---
  4: 'overcast', // Berawan Tebal / Overcast
  5: 'haze', // Udara Kabur — the code the published list gives for what 10 does
  60: 'drizzle', // Hujan Ringan
  62: 'rain', // Hujan Sedang — 61 is confirmed "ringan", so this follows the WMO run
  63: 'downpour', // Hujan Lebat / Heavy Rain
  80: 'shower', // Hujan Lokal / Isolated Shower
  95: 'storm', // Hujan Petir / Severe Thunderstorm
  97: 'storm', // Hujan Petir / Severe Thunderstorm
}

/** The subset above that was confirmed against live responses. */
export const OBSERVED_WEATHER_CODES = [0, 1, 2, 3, 10, 17, 45, 61] as const

/**
 * The glyph for a BMKG condition code.
 *
 * Unknown codes fall back to `cloud` rather than to a question mark or to nothing.
 * The table above is the second time this API has disagreed with its own
 * documentation, so a plausible neutral glyph is the right failure: the wording
 * beside it comes from the response, and the row stays truthful either way.
 */
export function weatherIcon(code: number): IconName {
  return BY_CODE[code] ?? 'cloud'
}

/** Exposed so the test can walk the whole table. */
export const KNOWN_WEATHER_CODES = Object.keys(BY_CODE).map(Number)
