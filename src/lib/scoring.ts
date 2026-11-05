import type { ForecastPoint, MoonConditions, NightWindow, Score, SubScore } from '@/types'
import type { I18nText } from './i18n'

/**
 * Below this, a sub-score is called out to the user as the reason the night is not
 * better. Above it the factor is good enough to be uninteresting.
 */
const LIMITING_THRESHOLD = 0.7

/** Keeps a zeroed factor from producing a division by zero in the harmonic mean. */
const EPSILON = 0.02

/**
 * How much a bright moon can cost you, at most.
 *
 * Not 1.0: a full moon kills the Milky Way but leaves planets, the moon itself, and
 * bright deep-sky targets perfectly workable, so it should never drive the score to
 * absolute zero the way total overcast does.
 */
const MAX_MOON_PENALTY = 0.9

const RATING_THRESHOLDS: ReadonlyArray<readonly [number, number]> = [
  [0.85, 5],
  [0.65, 4],
  [0.45, 3],
  [0.25, 2],
]

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1)
}

/**
 * Mean cloud cover across the forecast points that fall inside the dark window.
 *
 * Both are absolute instants, so this comparison needs no timezone handling -- which
 * is exactly why ForecastPoint stores UTC rather than a local-looking Date. Returns
 * null when the 3-day forecast does not cover the window at all.
 */
export function cloudCoverForNight(
  points: readonly ForecastPoint[],
  window: NightWindow,
): number | null {
  const start = window.start.getTime()
  const end = window.end.getTime()
  const inWindow = points.filter((p) => {
    const t = p.time.getTime()
    return t >= start && t <= end
  })
  if (inWindow.length === 0) return null
  return inWindow.reduce((sum, p) => sum + p.cloudCover, 0) / inWindow.length
}

/**
 * Bortle class -> darkness sub-score.
 *
 * Explicitly tabulated rather than linear, because the Bortle scale is not linear in
 * what it costs you. The steep drop between classes 4 and 6 is where naked-eye Milky
 * Way structure disappears, which for this app's purpose is the difference that
 * matters; a straight (9-b)/8 ramp rates suburban skies far too kindly.
 */
const DARKNESS_BY_BORTLE: Record<number, number> = {
  1: 1.0,
  2: 0.92,
  3: 0.8,
  4: 0.62,
  5: 0.42,
  6: 0.28,
  7: 0.17,
  8: 0.08,
  9: 0.02,
}

function darknessSubScore(bortle: number): SubScore {
  const rounded = Math.min(Math.max(Math.round(bortle), 1), 9)
  return {
    key: 'darkness',
    value: DARKNESS_BY_BORTLE[rounded] ?? 0.02,
    label: { key: 'score.factor.darkness', params: { bortle: rounded } },
  }
}

function cloudSubScore(cloudCover: number): SubScore {
  return {
    key: 'clouds',
    value: clamp01(1 - cloudCover / 100),
    label: { key: 'score.factor.clouds', params: { percent: Math.round(cloudCover) } },
  }
}

/**
 * How much moonlight actually lands on the night, 0–1.
 *
 * Illumination alone is misleading: a full moon that has already set costs nothing.
 * Weighting by time spent above the horizon is what makes the number useful.
 *
 * Exported because the 30-day planning calendar has to rank nights by exactly this
 * rule. A second copy of it there would be free to drift, and the two views would
 * eventually disagree about the same night.
 */
export function moonInterference(moon: MoonConditions): number {
  return clamp01(moon.illumination) * clamp01(moon.fractionAboveHorizon)
}

function moonSubScore(moon: MoonConditions): SubScore {
  const interference = moonInterference(moon)
  return {
    key: 'moon',
    value: clamp01(1 - MAX_MOON_PENALTY * interference),
    label: {
      key: moon.fractionAboveHorizon < 0.05 ? 'score.factor.moonDown' : 'score.factor.moon',
      params: {
        phase: { key: `moon.phase.${moon.phaseKey}` },
        percent: Math.round(moon.illumination * 100),
      },
    },
  }
}

/**
 * Combines sub-scores so the worst one dominates.
 *
 * The harmonic mean is the point of this function. An arithmetic or weighted mean
 * lets a strong factor mask a fatal one -- a Bortle 1 site under a 95% cloud deck
 * would score "about average" despite yielding nothing. The harmonic mean is pulled
 * down hard by any single small term, which matches how these conditions actually
 * combine: they gate each other rather than adding up.
 */
function harmonicMean(values: readonly number[]): number {
  const denominator = values.reduce((sum, v) => sum + 1 / Math.max(v, EPSILON), 0)
  return values.length / denominator
}

export function computeScore(input: {
  bortle: number
  /** Mean cloud cover for the night, or null if the forecast is unavailable. */
  cloudCover: number | null
  moon: MoonConditions
}): Score {
  const subScores: SubScore[] = [darknessSubScore(input.bortle)]
  if (input.cloudCover !== null) subScores.push(cloudSubScore(input.cloudCover))
  subScores.push(moonSubScore(input.moon))

  const raw = harmonicMean(subScores.map((f) => f.value))
  const rating = RATING_THRESHOLDS.find(([limit]) => raw >= limit)?.[1] ?? 1
  const worst = subScores.reduce((a, b) => (b.value < a.value ? b : a))

  return {
    rating,
    raw: clamp01(raw),
    subScores,
    limitingFactor: worst.value < LIMITING_THRESHOLD ? worst : null,
    complete: input.cloudCover !== null,
    stretch: null,
  }
}

/**
 * Half the span one forecast point stands for. BMKG publishes every three hours, so
 * a point at 01:00 speaks for 23:30-02:30.
 */
const SLOT_HALF_MS = 90 * 60_000

/** Shorter than this is not a session worth driving out for. */
const MIN_STRETCH_MS = 2 * 3600_000

/**
 * How much worse than the best run a longer run may score and still be preferred.
 *
 * Matching the rating alone is too loose: buckets are wide, so "100, 0, 0" averages
 * to 33% and still rates 5, and the reported hours would include a fully overcast
 * slot. Small enough to exclude that, large enough that a 5% blip does not split a
 * clear night in two.
 */
const STRETCH_TOLERANCE = 0.03

/**
 * Scores the best part of the night rather than its average.
 *
 * Averaging cloud over the dark window turns "overcast until 01:00, clear after" into
 * a lukewarm 50%, when the useful answer is "go at 01:00". So every contiguous run of
 * forecast slots at least MIN_STRETCH_MS long is scored with the full formula --
 * including the moon *during that run*, or the named hours could fall under a bright
 * moon. The longest run that is nearly as good as the best one wins: preferring
 * length is what keeps a clear night from being reported as one arbitrary slot.
 *
 * `moonFor` is the caller's `moonConditions` bound to a location, passed in so this
 * file needs no ephemeris.
 */
export function scoreNight(input: {
  bortle: number
  /** Null when the forecast is unavailable. */
  points: readonly ForecastPoint[] | null
  window: NightWindow
  /** The moon over the whole window. */
  moon: MoonConditions
  moonFor: (window: NightWindow) => MoonConditions
}): Score {
  const { bortle, window, moon } = input
  const start = window.start.getTime()
  const end = window.end.getTime()
  const slots = (input.points ?? [])
    .filter((p) => p.time.getTime() >= start && p.time.getTime() <= end)
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .map((p) => ({
      start: Math.max(p.time.getTime() - SLOT_HALF_MS, start),
      end: Math.min(p.time.getTime() + SLOT_HALF_MS, end),
      cloudCover: p.cloudCover,
    }))

  if (slots.length === 0) return computeScore({ bortle, cloudCover: null, moon })

  const candidates: Array<{ score: Score; length: number }> = []
  for (let i = 0; i < slots.length; i++) {
    for (let j = i; j < slots.length; j++) {
      const first = slots[i]!
      const last = slots[j]!
      const wholeNight = i === 0 && j === slots.length - 1
      const length = last.end - first.start
      // The whole night is always a candidate, so a forecast too thin to offer a
      // two-hour run still gets scored.
      if (length < MIN_STRETCH_MS && !wholeNight) continue

      const run = slots.slice(i, j + 1)
      const cloudCover = run.reduce((sum, s) => sum + s.cloudCover, 0) / run.length
      const span: NightWindow = wholeNight
        ? window
        : { start: new Date(first.start), end: new Date(last.end) }
      // The whole-night candidate uses the night's own moon, so a night that is good
      // throughout scores exactly as the plain average would.
      const score = computeScore({
        bortle,
        cloudCover,
        moon: wholeNight ? moon : input.moonFor(span),
      })
      score.stretch = { start: span.start, end: span.end, cloudCover, wholeNight }
      candidates.push({ score, length })
    }
  }

  const top = candidates.reduce((a, b) => (b.score.raw > a.score.raw ? b : a))
  return candidates
    .filter(
      (c) =>
        c.score.rating === top.score.rating && top.score.raw - c.score.raw <= STRETCH_TOLERANCE,
    )
    .reduce((a, b) => (b.length > a.length ? b : a)).score
}

/** One-word verdict for a rating, shown next to the number. */
export function ratingText(rating: number): I18nText {
  return { key: `score.rating.${Math.min(Math.max(Math.round(rating), 1), 5)}` }
}

/** Why the rating is not higher. Null when nothing is holding it back. */
export function limitingFactorText(score: Score): I18nText | null {
  if (!score.limitingFactor) return null
  const { key, label } = score.limitingFactor
  return {
    key: 'score.limitedBy',
    params: { reason: { key: `score.reason.${key}` }, detail: label },
  }
}
