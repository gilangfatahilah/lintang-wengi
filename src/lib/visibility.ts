import * as A from 'astronomy-engine'
import type {
  LatLng,
  NightWindow,
  ObjectVisibility,
  SkyCategory,
  SkyObject,
  VisibleObject,
} from '@/types'
import { categoryKey } from './skyCatalog'

/**
 * Altitude at which an object becomes worth travelling for.
 *
 * Not 0°. Near the horizon you are shooting through several airmasses of haze, and
 * in practice through trees and ridgelines as well -- a target at 8° is on the wrong
 * side of a hill. Reporting it as "visible" is the expensive kind of wrong here,
 * because acting on it costs someone a night's drive.
 */
export const USEFUL_ALTITUDE_DEG = 20

/**
 * Samples across the dark window. ~12 minutes apart for a typical equatorial night,
 * which is finer than the 3-hourly weather it will be read alongside.
 */
const SAMPLES = 48

export type CompassKey = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

/** Compass points, in the order azimuth sweeps through them from north. */
const COMPASS: readonly CompassKey[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

/**
 * Which compass point an azimuth falls in, as a key.
 *
 * The abbreviations differ per language -- north is "N" but utara is "U" -- so the
 * direction is identified here and named at render time.
 */
export function compassPoint(azimuth: number): CompassKey {
  const normalised = ((azimuth % 360) + 360) % 360
  return COMPASS[Math.round(normalised / 45) % 8]!
}

/** Message key for the abbreviated form, used in tables. */
export function compassShortKey(azimuth: number): string {
  return `compass.short.${compassPoint(azimuth)}`
}

/** Message key for the spelled-out form, used in prose. */
export function compassNameKey(azimuth: number): string {
  return `compass.long.${compassPoint(azimuth)}`
}

/**
 * Where an object sits in the sky at one instant.
 *
 * The one place the planet/fixed distinction is handled. Planets need a fresh
 * ephemeris lookup per instant; a fixed target's J2000 coordinates go straight into
 * the horizontal transform.
 */
function horizontalAt(
  object: SkyObject,
  at: Date,
  observer: A.Observer,
): A.HorizontalCoordinates {
  if (object.target.kind === 'planet') {
    const eq = A.Equator(object.target.body, at, observer, true, true)
    return A.Horizon(at, observer, eq.ra, eq.dec, 'normal')
  }
  return A.Horizon(at, observer, object.target.ra, object.target.dec, 'normal')
}

/**
 * What an object does across one night's dark window.
 *
 * Sampled rather than solved from rise/set times, for the same reason
 * `moonConditions` samples: a window can contain zero, one or two rise/set events,
 * and an object may clear the useful altitude long after it technically rises.
 * Sampling answers every case with the same code path.
 */
export interface VisibilityOptions {
  samples?: number
  /**
   * Overrides `USEFUL_ALTITUDE_DEG`. Meteor radiants are the reason this exists: a
   * radiant at 12° still throws meteors across the whole sky, so judging it by the
   * bar set for pointing a lens at something would discard real showers.
   */
  usefulAltitude?: number
}

export function visibilityDuring(
  object: SkyObject,
  loc: LatLng,
  window: NightWindow,
  options: VisibilityOptions = {},
): ObjectVisibility {
  const samples = options.samples ?? SAMPLES
  const usefulAltitude = options.usefulAltitude ?? USEFUL_ALTITUDE_DEG
  const observer = new A.Observer(loc.lat, loc.lon, 0)
  const startMs = window.start.getTime()
  const spanMs = window.end.getTime() - startMs

  // Cell centres, so neither endpoint is double-weighted in the fraction.
  const sampleTime = (i: number) => new Date(startMs + ((i + 0.5) / samples) * spanMs)

  let maxAltitude = -90
  let maxIndex = -1
  let azimuthAtMax = 0
  let firstUseful = -1
  let lastUseful = -1
  let usefulCount = 0

  for (let i = 0; i < samples; i++) {
    const at = sampleTime(i)
    const { altitude, azimuth } = horizontalAt(object, at, observer)

    if (altitude > maxAltitude) {
      maxAltitude = altitude
      maxIndex = i
      azimuthAtMax = azimuth
    }
    if (altitude >= usefulAltitude) {
      usefulCount++
      if (firstUseful < 0) firstUseful = i
      lastUseful = i
    }
  }

  const maxAltitudeTime = maxIndex < 0 ? null : sampleTime(maxIndex)

  // An object already up at the first sample was up at dusk too, so report the
  // window edge rather than a sample instant six minutes inside it.
  const from =
    firstUseful < 0 ? null : firstUseful === 0 ? window.start : sampleTime(firstUseful)
  const to =
    lastUseful < 0 ? null : lastUseful === samples - 1 ? window.end : sampleTime(lastUseful)

  return {
    maxAltitude,
    maxAltitudeTime,
    azimuthAtMax,
    from,
    to,
    fractionUseful: usefulCount / samples,
    magnitude: magnitudeOf(object, maxAltitudeTime ?? window.start),
  }
}

/**
 * Apparent magnitude. Planets swing by whole magnitudes as their distance and phase
 * change -- Mars alone ranges from -2.9 to +1.8 -- so theirs is computed at the
 * instant they are best placed rather than tabulated.
 */
function magnitudeOf(object: SkyObject, at: Date): number | null {
  if (object.target.kind !== 'planet') return object.target.magnitude
  try {
    return A.Illumination(object.target.body, at).mag
  } catch {
    return null
  }
}

/**
 * Every catalogue object that clears the useful altitude tonight, best-placed first.
 *
 * Sorted by peak altitude alone rather than by some blend of altitude and brightness:
 * the two have no common unit, and any weighting between them would be invented. The
 * UI groups by category, where brightness is already legible as a column.
 */
export function rankVisible(
  catalog: readonly SkyObject[],
  loc: LatLng,
  window: NightWindow,
): VisibleObject[] {
  return catalog
    .map((object) => ({ object, visibility: visibilityDuring(object, loc, window) }))
    .filter((entry) => entry.visibility.fractionUseful > 0)
    .sort((a, b) => b.visibility.maxAltitude - a.visibility.maxAltitude)
}

/**
 * Category order as displayed: the headline first, then what is easiest to find and
 * shoot, and single stars last -- they are context for aiming rather than targets.
 */
const CATEGORY_ORDER: readonly SkyCategory[] = ['core', 'planet', 'deepsky', 'star']

export interface CategoryGroup {
  category: SkyCategory
  /** Message key for the group heading. */
  labelKey: string
  entries: VisibleObject[]
}

/** Splits ranked objects into display groups, preserving the rank order within each. */
export function groupByCategory(entries: readonly VisibleObject[]): CategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    labelKey: categoryKey(category),
    entries: entries.filter((e) => e.object.category === category),
  })).filter((group) => group.entries.length > 0)
}
