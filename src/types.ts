/** Shared domain types. Kept free of Vue and network concerns on purpose. */

import type { Body } from 'astronomy-engine'
import type { I18nText, Localized } from '@/lib/i18n'

export interface LatLng {
  lat: number
  lon: number
}

/** One kecamatan centroid plus a representative desa code for the BMKG API. */
export interface Kecamatan extends LatLng {
  /** Kecamatan code, e.g. "31.71.03" */
  adm3: string
  /** Representative desa code used to query BMKG, e.g. "31.71.03.1001" */
  adm4: string
  name: string
  kotkab: string
}

/** A single 3-hourly BMKG forecast point, flattened out of the nested day arrays. */
export interface ForecastPoint {
  /**
   * The true instant, parsed from `utc_datetime`.
   *
   * Deliberately not a "local time" Date: BMKG's `local_datetime` is wall-clock at
   * the forecast location with no offset attached, so parsing it directly would
   * silently reinterpret it in the *viewer's* timezone. A user in WIB looking at a
   * spot in Papua would get times shifted by two hours. Compare instants; use
   * `offsetMinutes` only to render wall-clock text.
   */
  time: Date
  /** Location's UTC offset in minutes (WIB 420, WITA 480, WIT 540). */
  offsetMinutes: number
  /** Cloud cover, percent. BMKG field `tcc`. */
  cloudCover: number
  /** Temperature, °C. */
  temp: number
  humidity: number
  /**
   * BMKG's own wording, both languages, because they ship both in the same payload.
   * Translating "Cerah Berawan" ourselves would be inventing a second vocabulary for
   * something the source has already named.
   */
  description: Localized
  /**
   * BMKG's numeric condition code. Kept alongside the text because it is the only
   * part of the condition that is stable enough to key an icon off -- the wording
   * varies, the code does not.
   */
  weatherCode: number
  /**
   * Whether this hour falls after dark, taken from BMKG's own icon slug rather than
   * computed here: they ship `cerah-am.svg` for daylight hours and `cerah-pm.svg`
   * after sunset, so the source has already made the call for its own coordinates.
   *
   * Only the glyph depends on it. The wording stays exactly as BMKG wrote it, which
   * is why a clear night still reads "Sunny" beside a crescent -- their vocabulary,
   * our picture.
   */
  isNight: boolean
}

export interface Forecast {
  location: {
    adm4: string
    desa: string
    kecamatan: string
    kotkab: string
    provinsi: string
    lat: number
    lon: number
    timezone: string
  }
  points: ForecastPoint[]
}

/**
 * The span of true astronomical darkness for one night (sun below -18°).
 * Crosses midnight, so `end` is virtually always on the next calendar day.
 */
export interface NightWindow {
  start: Date
  end: Date
}

export interface MoonConditions {
  /** Illuminated fraction, 0–1, at the darkest point of the night. */
  illumination: number
  /** Fraction of the night window the moon spends above the horizon, 0–1. */
  fractionAboveHorizon: number
  rise: Date | null
  set: Date | null
  /** Which of the eight principal phases, as a message key suffix. */
  phaseKey: MoonPhaseKey
}

export type MoonPhaseKey =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent'

/**
 * Where an object is, in the only two forms that matter here.
 *
 * Planets move fast enough that their position must be recomputed at every sample
 * instant; stars and nebulae do not. Hiding that difference behind one type is what
 * lets a single visibility routine serve the whole catalogue instead of two.
 */
export type SkyTarget =
  | { kind: 'planet'; body: Body }
  /**
   * J2000 right ascension in hours and declination in degrees.
   *
   * Deliberately not precessed to the epoch of observation: the drift from J2000 to
   * the 2020s is about 0.4°, well under the resolution of the questions this answers
   * ("how high", "which way to point"). Adding precession machinery would buy
   * nothing a photographer could act on.
   */
  | { kind: 'fixed'; ra: number; dec: number; magnitude: number | null }

export type SkyCategory = 'core' | 'planet' | 'star' | 'deepsky'

export interface SkyObject {
  id: string
  /**
   * Display name in both languages.
   *
   * Carried inline rather than looked up from the message dictionaries: a name and
   * its coordinates are one fact, and splitting them across files lets an id and a
   * message key drift apart without anything failing. See the locale-parity test in
   * `skyCatalog.test.ts`.
   */
  name: Localized
  category: SkyCategory
  target: SkyTarget
  /** One line on why it is worth pointing a camera at. */
  note?: Localized
}

/** How an object behaves across one night's dark window. */
export interface ObjectVisibility {
  /** Highest altitude reached inside the window, degrees. Negative if never up. */
  maxAltitude: number
  maxAltitudeTime: Date | null
  /** Compass azimuth at the peak, degrees clockwise from north. */
  azimuthAtMax: number
  /** When the object first/last clears the useful altitude. Null if it never does. */
  from: Date | null
  to: Date | null
  /** Fraction of the dark window spent above the useful altitude, 0–1. */
  fractionUseful: number
  /** Apparent magnitude: computed for planets, tabulated for everything else. */
  magnitude: number | null
}

/** A catalogue entry paired with what it does tonight. */
export interface VisibleObject {
  object: SkyObject
  visibility: ObjectVisibility
}

export type SubScoreKey = 'darkness' | 'clouds' | 'moon'

export interface SubScore {
  key: SubScoreKey
  /** Normalised 0–1, where 1 is ideal. */
  value: number
  /** What this factor is doing, as a key the render layer resolves. */
  label: I18nText
}

export interface Score {
  /** Final 1–5 rating. */
  rating: number
  /** Raw combined value, 0–1, before bucketing into stars. */
  raw: number
  subScores: SubScore[]
  /** The sub-score dragging the rating down most, or null if everything is good. */
  limitingFactor: SubScore | null
  /**
   * False when a factor was unavailable (in practice: the BMKG forecast failed).
   *
   * Dropping a factor leaves fewer terms to pull the mean down, so an incomplete
   * score reads *higher* than a complete one. The UI must present these as
   * provisional rather than as a confident rating.
   */
  complete: boolean
}
