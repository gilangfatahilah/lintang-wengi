import * as A from 'astronomy-engine'
import type { LatLng, MoonPhaseKey, NightWindow } from '@/types'
import { nightWindow, moonConditions } from './astro'
import { moonInterference } from './scoring'

export interface MoonNight {
  window: NightWindow
  /** Illuminated fraction at the darkest point of that night, 0–1. */
  illumination: number
  phaseKey: MoonPhaseKey
  /** Illumination weighted by time above the horizon, 0–1. Lower is better. */
  interference: number
  /** True when moonlight is low enough to attempt faint, low-contrast targets. */
  dark: boolean
}

/**
 * Interference below which the night counts as dark enough for deep-sky work.
 *
 * 0.15 is roughly a half moon that sets before midnight, or a thin crescent up all
 * night -- the level at which the Milky Way core is still readable. Deliberately not
 * a phase cutoff: "within five days of new moon" is the rule of thumb this replaces,
 * and it is wrong about half the time because it ignores when the moon is actually up.
 */
const DARK_THRESHOLD = 0.15

/**
 * Moonlight over the coming nights, so "when should I go" has an answer too.
 *
 * Each night is evaluated the same way the score evaluates tonight -- via
 * `moonInterference`, not raw illumination. A 90% moon that sets at 21:00 leaves a
 * perfectly usable night, and a calendar built on phase alone would tell you to stay
 * home. That is exactly the mistake this app exists to stop making.
 */
export function moonCalendar(loc: LatLng, from: Date, days = 30): MoonNight[] {
  const nights: MoonNight[] = []
  let reference = from

  for (let i = 0; i < days; i++) {
    let window: NightWindow
    try {
      window = nightWindow(loc, reference)
    } catch {
      break
    }

    const moon = moonConditions(loc, window, CALENDAR_SAMPLES)
    const interference = moonInterference(moon)

    nights.push({
      window,
      illumination: moon.illumination,
      phaseKey: moon.phaseKey,
      interference,
      dark: interference <= DARK_THRESHOLD,
    })

    // Step past this night's dawn so the next search cannot return the same window.
    reference = new Date(window.end.getTime() + 12 * 3600_000)
  }

  return nights
}

/**
 * Coarser than the 32 samples used for tonight: at ~50 minutes apart this still
 * resolves moonrise well enough to rank one night against another, and it is the
 * difference between a calendar that computes instantly and one that stutters.
 */
const CALENDAR_SAMPLES = 12

/** The next new moon at or after `from` -- the centre of the next dark run. */
export function nextNewMoon(from: Date): Date | null {
  return A.SearchMoonPhase(0, from, 40)?.date ?? null
}

/**
 * The longest unbroken run of dark nights in the calendar, or null if there is none.
 * This is the trip to plan around.
 */
export function bestDarkRun(nights: readonly MoonNight[]): MoonNight[] | null {
  let best: MoonNight[] = []
  let current: MoonNight[] = []

  for (const night of nights) {
    if (night.dark) {
      current.push(night)
      // Copy rather than alias: `current` keeps growing after this comparison.
      if (current.length > best.length) best = [...current]
    } else {
      current = []
    }
  }

  return best.length > 0 ? best : null
}
