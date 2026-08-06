import type { LatLng, MoonConditions, NightWindow, ObjectVisibility } from '@/types'
import { MILKY_WAY_CORE } from './skyCatalog'
import { visibilityDuring } from './visibility'
import { moonInterference } from './scoring'
import type { I18nText } from './i18n'

export type MilkyWayVerdict = 'good' | 'limited' | 'no'

export interface MilkyWayNight {
  visibility: ObjectVisibility
  verdict: MilkyWayVerdict
  /** Why the verdict is what it is, in one sentence. */
  reason: I18nText
}

/**
 * Below this the core is up, but not for long enough to be worth the drive.
 * Roughly two hours of a nine-hour night.
 */
const SHORT_WINDOW = 0.22

/**
 * Moon interference above which the core is washed out rather than merely dimmed.
 *
 * The core is a low-contrast target -- it is the first thing moonlight takes and the
 * last thing to come back. A quarter moon up all night already costs most of it.
 */
const MOON_WASHOUT = 0.35

/**
 * How the galactic core behaves tonight, and whether tonight is the night.
 *
 * Kept out of the 1–5 score on purpose. The score answers "is this a good night for
 * astrophotography"; folding a fourth term in would change what its numbers mean and
 * would punish a perfect night for planets or nebulae merely because the core is
 * below the horizon in February. This is a separate verdict, stated separately.
 */
export function milkyWayNight(
  loc: LatLng,
  window: NightWindow,
  moon: MoonConditions,
): MilkyWayNight {
  const visibility = visibilityDuring(MILKY_WAY_CORE, loc, window)

  if (visibility.fractionUseful === 0) {
    return {
      visibility,
      verdict: 'no',
      reason:
        visibility.maxAltitude < 0
          ? { key: 'milkyWay.reason.belowHorizon' }
          : {
              key: 'milkyWay.reason.tooLow',
              params: { degrees: Math.round(visibility.maxAltitude) },
            },
    }
  }

  const interference = moonInterference(moon)

  if (interference >= MOON_WASHOUT) {
    return {
      visibility,
      verdict: 'limited',
      reason: {
        key: 'milkyWay.reason.moonWashout',
        params: { percent: Math.round(moon.illumination * 100) },
      },
    }
  }

  if (visibility.fractionUseful < SHORT_WINDOW) {
    return { visibility, verdict: 'limited', reason: { key: 'milkyWay.reason.shortWindow' } }
  }

  return {
    visibility,
    verdict: 'good',
    reason: {
      key: 'milkyWay.reason.good',
      params: { degrees: Math.round(visibility.maxAltitude) },
    },
  }
}

/** Headline for the verdict. */
export function verdictText(verdict: MilkyWayVerdict): I18nText {
  return { key: `milkyWay.verdict.${verdict}` }
}
