import type { MoonPhaseKey } from '@/types'

/**
 * The outline of the lit part of the moon, as an SVG path.
 *
 * This is pure geometry and it lives here rather than in the component for the
 * reason the rest of `src/lib` does: it got the terminator's curvature backwards
 * once, which rendered a full moon as a black disc and a 12% crescent as almost
 * fully lit. A component cannot be unit-tested into admitting that; this can.
 *
 * The lit region is bounded by two arcs. One is the lit limb, a true semicircle.
 * The other is the terminator, which projects to a half-ellipse of half-width
 * |1 - 2k| * r -- zero at quarter phase, where it is a straight edge, and a full
 * semicircle at new and full.
 */

const WANING: ReadonlySet<MoonPhaseKey> = new Set([
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
])

export function isWaning(phaseKey: MoonPhaseKey): boolean {
  return WANING.has(phaseKey)
}

/** Below this the crescent is thinner than a stroke and there is nothing to draw. */
const DARK_THRESHOLD = 0.005

/**
 * Path for the illuminated region, or null when the moon is effectively new.
 *
 * `illumination` is clamped rather than validated: it arrives from an ephemeris and
 * a value a hair outside 0–1 should draw a full or new moon, not throw at 3 AM.
 */
export function litPath(
  illumination: number,
  phaseKey: MoonPhaseKey,
  cx = 12,
  cy = 12,
  r = 10,
): string | null {
  const k = Math.min(Math.max(illumination, 0), 1)
  if (k <= DARK_THRESHOLD) return null

  // 1 draws the right half, 0 the left. Waxing lights the right limb.
  const limbSweep = isWaning(phaseKey) ? 0 : 1
  /*
   * Below half the terminator curves back across the lit limb and cuts the
   * semicircle down to a crescent; above half it curves the other way and adds to
   * it. This is the line that was wrong.
   */
  const terminatorSweep = k < 0.5 ? 1 - limbSweep : limbSweep
  const rx = Math.abs(1 - 2 * k) * r

  return (
    `M${cx} ${cy - r}` +
    `A${r} ${r} 0 0 ${limbSweep} ${cx} ${cy + r}` +
    `A${rx.toFixed(3)} ${r} 0 0 ${terminatorSweep} ${cx} ${cy - r}` +
    'Z'
  )
}
