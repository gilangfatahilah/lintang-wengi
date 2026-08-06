import type { MoonConditions, NightWindow, VisibleObject } from '@/types'
import type { MilkyWayNight } from './milkyWay'
import type { I18nText } from './i18n'
import { moonInterference } from './scoring'
import { compassNameKey } from './visibility'
import { formatAtOffset, durationText, timezoneLabel } from './time'

export interface SkySummaryInput {
  window: NightWindow
  moon: MoonConditions
  /** Mean cloud cover across the dark window, or null when BMKG failed. */
  cloudCover: number | null
  milkyWay: MilkyWayNight | null
  /** Ranked visible objects, highest first. */
  objects: readonly VisibleObject[]
  offsetMinutes: number
}

/** Above this, moonlight is the story of the night rather than a footnote. */
const MOON_DOMINATES = 0.4

/**
 * The night in a few sentences, before any table.
 *
 * A pure function so the wording is testable and lives in one place. It states
 * things in the order someone actually asks them: how long is it dark, what is the
 * moon doing, what is up, and what will the weather do to it. Every clause is
 * derived -- nothing here is a template with a number dropped in that could contradict
 * the readouts below it.
 */
export function skySummary(input: SkySummaryInput): I18nText[] {
  const { window, moon, offsetMinutes } = input
  const sentences: I18nText[] = []

  sentences.push({
    key: 'summary.darkSpan',
    params: {
      start: formatAtOffset(window.start, offsetMinutes),
      end: formatAtOffset(window.end, offsetMinutes),
      tz: timezoneLabel(offsetMinutes),
      // Nested, because "9 hours 46 minutes" is itself a translated phrase.
      duration: durationText(window.end.getTime() - window.start.getTime()),
    },
  })

  sentences.push(moonSentence(moon))

  const highlight = highlightSentence(input)
  if (highlight) sentences.push(highlight)

  if (input.cloudCover !== null) sentences.push(cloudSentence(input.cloudCover))

  return sentences
}

function moonSentence(moon: MoonConditions): I18nText {
  const params = {
    phase: { key: `moon.phase.${moon.phaseKey}` },
    percent: Math.round(moon.illumination * 100),
    share: Math.round(moon.fractionAboveHorizon * 100),
  }

  if (moon.fractionAboveHorizon < 0.05) return { key: 'summary.moonDown', params }
  if (moonInterference(moon) >= MOON_DOMINATES) {
    return { key: 'summary.moonDominates', params }
  }
  return { key: 'summary.moonMinor', params }
}

/**
 * The core if it is up, otherwise the best-placed thing that is.
 *
 * Never both: two sentences competing for the headline is how a summary stops being
 * read at 2 AM.
 */
function highlightSentence(input: SkySummaryInput): I18nText | null {
  const mw = input.milkyWay
  if (mw && mw.visibility.fractionUseful > 0 && mw.visibility.from && mw.visibility.to) {
    const { from, to, maxAltitude, azimuthAtMax } = mw.visibility
    return {
      key: 'summary.coreWindow',
      params: {
        from: formatAtOffset(from, input.offsetMinutes),
        to: formatAtOffset(to, input.offsetMinutes),
        degrees: Math.round(maxAltitude),
        direction: { key: compassNameKey(azimuthAtMax) },
      },
    }
  }

  const best = input.objects[0]
  if (!best) return null
  return {
    key: 'summary.bestObject',
    params: {
      // The catalogue carries both languages, so the name goes in as data and
      // `translate` picks the side matching the active locale.
      name: best.object.name,
      degrees: Math.round(best.visibility.maxAltitude),
      direction: { key: compassNameKey(best.visibility.azimuthAtMax) },
    },
  }
}

function cloudSentence(cloudCover: number): I18nText {
  const params = { percent: Math.round(cloudCover) }
  if (params.percent >= 80) return { key: 'summary.cloudHeavy', params }
  if (params.percent >= 50) return { key: 'summary.cloudMixed', params }
  return { key: 'summary.cloudLight', params }
}
