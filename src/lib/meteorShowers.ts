import type { LatLng, ObjectVisibility, SkyObject } from '@/types'
import { nightWindow, moonConditions } from './astro'
import { visibilityDuring } from './visibility'
import { moonInterference } from './scoring'

export interface MeteorShower {
  id: string
  name: string
  /**
   * Peak date as month (1–12) and day.
   *
   * Stored as a calendar date rather than a solar longitude, which is what actually
   * fixes a shower's peak. The two disagree by up to a day between years -- fine
   * here, because a shower is worth watching for several nights either side and this
   * only decides whether to mention it at all.
   */
  peakMonth: number
  peakDay: number
  /** J2000 radiant: right ascension in hours, declination in degrees. */
  radiantRa: number
  radiantDec: number
  /** Zenithal hourly rate at peak under a perfect sky -- an upper bound, not a promise. */
  zhr: number
}

export interface ActiveShower {
  shower: MeteorShower
  /** The peak, resolved to an actual date. */
  peak: Date
  /** Nights until the peak. Negative means it has just passed and is still active. */
  daysAway: number
  /** How the radiant behaves during the peak night's dark window at this location. */
  radiant: ObjectVisibility
  /** Moonlight on the peak night, 0–1. A Geminid peak under a full moon is a washout. */
  moonInterference: number
}

/**
 * A radiant this low still produces meteors -- they appear across the whole sky, not
 * at the radiant -- but below it the shower is effectively over the horizon's edge.
 * Deliberately far below the 20° used for pointing a lens at something.
 */
const RADIANT_ALTITUDE = 10

/** Showers are worth mentioning for a couple of nights after the peak, too. */
const DAYS_AFTER_PEAK = 2

/** The annual showers, by peak date. */
export const METEOR_SHOWERS: readonly MeteorShower[] = [
  { id: 'quadrantids', name: 'Quadrantid', peakMonth: 1, peakDay: 3, radiantRa: 15.33, radiantDec: 49.5, zhr: 110 },
  { id: 'lyrids', name: 'Lyrid', peakMonth: 4, peakDay: 22, radiantRa: 18.17, radiantDec: 33.3, zhr: 18 },
  { id: 'eta-aquariids', name: 'Eta Aquariid', peakMonth: 5, peakDay: 6, radiantRa: 22.53, radiantDec: -1.0, zhr: 50 },
  { id: 'delta-aquariids', name: 'Delta Aquariid', peakMonth: 7, peakDay: 30, radiantRa: 22.67, radiantDec: -16.4, zhr: 25 },
  { id: 'capricornids', name: 'Alfa Capricornid', peakMonth: 7, peakDay: 31, radiantRa: 20.47, radiantDec: -10.2, zhr: 5 },
  { id: 'perseids', name: 'Perseid', peakMonth: 8, peakDay: 12, radiantRa: 3.22, radiantDec: 58.0, zhr: 100 },
  { id: 'orionids', name: 'Orionid', peakMonth: 10, peakDay: 21, radiantRa: 6.35, radiantDec: 15.6, zhr: 20 },
  { id: 'taurids-s', name: 'Southern Taurid', peakMonth: 11, peakDay: 5, radiantRa: 3.53, radiantDec: 14.0, zhr: 5 },
  { id: 'taurids-n', name: 'Northern Taurid', peakMonth: 11, peakDay: 12, radiantRa: 3.87, radiantDec: 22.0, zhr: 5 },
  { id: 'leonids', name: 'Leonid', peakMonth: 11, peakDay: 17, radiantRa: 10.28, radiantDec: 21.6, zhr: 15 },
  { id: 'geminids', name: 'Geminid', peakMonth: 12, peakDay: 14, radiantRa: 7.55, radiantDec: 32.4, zhr: 150 },
  { id: 'ursids', name: 'Ursid', peakMonth: 12, peakDay: 22, radiantRa: 14.6, radiantDec: 75.3, zhr: 10 },
]

function radiantObject(shower: MeteorShower): SkyObject {
  return {
    id: `radiant-${shower.id}`,
    name: { en: shower.name, id: shower.name },
    category: 'star',
    target: { kind: 'fixed', ra: shower.radiantRa, dec: shower.radiantDec, magnitude: null },
  }
}

const DAY_MS = 86400_000

/** Local midnight-ish UTC instant for a peak date, good enough to seed a night search. */
function peakDate(year: number, shower: MeteorShower): Date {
  return new Date(Date.UTC(year, shower.peakMonth - 1, shower.peakDay, 12))
}

/**
 * Showers peaking soon whose radiant actually rises where you are standing.
 *
 * The radiant altitude is computed, never tabulated. That is what filters the Ursids
 * out at Indonesian latitudes -- declination +75° never gets more than about 8° above
 * a Javanese horizon -- while keeping the Perseids, which are poor from here but real.
 * A hardcoded "visible from Indonesia" flag would have to be re-derived for every
 * latitude in the country, and would be wrong in Aceh or Merauke.
 */
export function showersNear(
  loc: LatLng,
  reference: Date,
  withinDays = 14,
): ActiveShower[] {
  const year = reference.getUTCFullYear()
  const active: ActiveShower[] = []

  // Neighbouring years too: on 28 December the next shower worth naming is in January.
  for (const y of [year - 1, year, year + 1]) {
    for (const shower of METEOR_SHOWERS) {
      const peak = peakDate(y, shower)
      const daysAway = Math.round((peak.getTime() - reference.getTime()) / DAY_MS)
      if (daysAway > withinDays || daysAway < -DAYS_AFTER_PEAK) continue

      let window
      try {
        window = nightWindow(loc, peak)
      } catch {
        continue
      }

      const radiant = visibilityDuring(radiantObject(shower), loc, window, {
        usefulAltitude: RADIANT_ALTITUDE,
      })
      if (radiant.fractionUseful === 0) continue

      active.push({
        shower,
        peak,
        daysAway,
        radiant,
        moonInterference: moonInterference(moonConditions(loc, window, 12)),
      })
    }
  }

  return active.sort((a, b) => a.daysAway - b.daysAway)
}
