/**
 * The moon, before a point has been picked.
 *
 * Phase and illumination are geocentric: at a given instant they are the same number
 * for every observer on Earth, which is exactly why they can be stated before the app
 * knows where the user is. Moonrise, moonset and the fraction of the night the moon
 * spends above the horizon are not -- those need a location, they vary by tens of
 * minutes across the archipelago, and `app.intro` already promises them once a point
 * is picked. This module exposes only the two that travel; do not add the others.
 */
import * as A from 'astronomy-engine'
import { phaseKeyOf } from './astro'
import type { MoonPhaseKey } from '@/types'

export interface MoonTonight {
  /** Illuminated fraction, 0-1. */
  illumination: number
  /** Which of the eight principal phases, as a message key suffix. */
  phaseKey: MoonPhaseKey
}

/**
 * The instant "tonight" is evaluated at: the midnight belonging to the night the
 * viewer is either standing in or about to have.
 *
 * Illumination moves by up to seven points a day, so evaluating at "now" would print
 * a breakfast number under the word "tonight". Local noon is the pivot -- before it,
 * the night in question is the one that began at the midnight just passed; after it,
 * the one starting at the coming midnight.
 *
 * `offsetMinutes` is the viewer's own UTC offset, not a location's. It only decides
 * which midnight is meant, and that choice is insensitive to being an hour or two out.
 */
export function tonightMidnight(now: Date, offsetMinutes: number): Date {
  const local = new Date(now.getTime() + offsetMinutes * 60_000)
  const localDayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const localMidnight = local.getUTCHours() >= 12 ? localDayStart + 86_400_000 : localDayStart
  return new Date(localMidnight - offsetMinutes * 60_000)
}

/** Tonight's moon, for a viewer whose only known coordinate is their clock. */
export function moonTonight(now: Date, offsetMinutes: number): MoonTonight {
  const at = tonightMidnight(now, offsetMinutes)
  return {
    illumination: A.Illumination(A.Body.Moon, at).phase_fraction,
    phaseKey: phaseKeyOf(A.MoonPhase(at)),
  }
}

/**
 * What this much moon costs you, as a message key.
 *
 * Four bands rather than eight: the principal phase name is already printed beside
 * this line, so an eight-way second vocabulary would only repeat it. What changes the
 * decision is roughly none / a little / a lot / forget the faint things.
 *
 * Says nothing about when the moon is up, which is the half that needs a location.
 */
export function moonBrightnessKey(illumination: number): string {
  if (illumination < 0.15) return 'moonTonight.dark'
  if (illumination < 0.45) return 'moonTonight.thin'
  if (illumination < 0.75) return 'moonTonight.half'
  return 'moonTonight.bright'
}
