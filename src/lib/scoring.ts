import type { ForecastPoint, MoonConditions, NightWindow, Score, SubScore } from '@/types'

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
    label: `Bortle ${rounded}`,
  }
}

function cloudSubScore(cloudCover: number): SubScore {
  return {
    key: 'clouds',
    value: clamp01(1 - cloudCover / 100),
    label: `Tutupan awan ${Math.round(cloudCover)}%`,
  }
}

function moonSubScore(moon: MoonConditions): SubScore {
  // Illumination alone is misleading: a full moon that has already set costs
  // nothing. Weighting by time spent above the horizon is what makes this useful.
  const interference = clamp01(moon.illumination) * clamp01(moon.fractionAboveHorizon)
  const percent = Math.round(moon.illumination * 100)
  return {
    key: 'moon',
    value: clamp01(1 - MAX_MOON_PENALTY * interference),
    label:
      moon.fractionAboveHorizon < 0.05
        ? `${moon.phaseName} (${percent}%), di bawah horizon`
        : `${moon.phaseName} (${percent}%)`,
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
  }
}

/** Short Indonesian verdict for a rating, shown next to the stars. */
export function ratingLabel(rating: number): string {
  return (
    {
      5: 'Sangat baik',
      4: 'Baik',
      3: 'Cukup',
      2: 'Kurang',
      1: 'Tidak disarankan',
    }[rating] ?? ''
  )
}

/** Why the rating is not higher, phrased for display. */
export function limitingFactorText(score: Score): string | null {
  if (!score.limitingFactor) return null
  const { key, label } = score.limitingFactor
  const reason = {
    darkness: 'polusi cahaya',
    clouds: 'tutupan awan',
    moon: 'cahaya bulan',
  }[key]
  return `Tertahan ${reason} — ${label}`
}
