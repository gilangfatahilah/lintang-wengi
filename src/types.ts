/** Shared domain types. Kept free of Vue and network concerns on purpose. */

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
  description: string
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
  /** Human-readable phase name in Indonesian. */
  phaseName: string
}

export type SubScoreKey = 'darkness' | 'clouds' | 'moon'

export interface SubScore {
  key: SubScoreKey
  /** Normalised 0–1, where 1 is ideal. */
  value: number
  /** Short Indonesian explanation shown in the UI. */
  label: string
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
