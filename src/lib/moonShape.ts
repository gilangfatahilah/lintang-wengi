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

/** An ellipse on the unit disc: centre and radii in units of the moon's radius. */
export interface Mare {
  cx: number
  cy: number
  rx: number
  ry: number
  /** Degrees, clockwise. */
  rotate: number
}

/**
 * The large maria of the near side, x right and y down, north up -- the same
 * northern-hemisphere orientation the lit side follows, so Crisium sits on the limb
 * a waxing crescent lights first, as it does in the sky.
 *
 * Positions are traced by eye from a full-moon photograph, not from selenographic
 * coordinates; at the sizes this is drawn the brightest map is a few pixels, and what
 * matters is that the familiar face is recognisable, not that a crater lines up.
 * Only seas large enough to survive the 2.75em empty-state glyph are listed.
 */
export const MARIA: readonly Mare[] = [
  // The western chain, one dark mass in a photograph: Procellarum, Imbrium, Frigoris
  // across the north, Insularum, Nubium and Humorum to the south.
  { cx: -0.55, cy: 0.0, rx: 0.27, ry: 0.45, rotate: 15 }, // Oceanus Procellarum
  { cx: -0.3, cy: -0.4, rx: 0.3, ry: 0.22, rotate: -10 }, // Imbrium
  { cx: -0.05, cy: -0.64, rx: 0.34, ry: 0.08, rotate: -4 }, // Frigoris
  { cx: -0.25, cy: 0.08, rx: 0.14, ry: 0.11, rotate: 0 }, // Insularum
  { cx: -0.18, cy: 0.38, rx: 0.22, ry: 0.16, rotate: 10 }, // Nubium
  { cx: -0.47, cy: 0.45, rx: 0.11, ry: 0.11, rotate: 0 }, // Humorum
  // The eastern chain: Serenitatis into Tranquillitatis, down to Fecunditatis and
  // Nectaris. Crisium stands apart on the limb, as it does in the sky.
  { cx: 0.12, cy: -0.36, rx: 0.18, ry: 0.17, rotate: 0 }, // Serenitatis
  { cx: 0.3, cy: -0.06, rx: 0.23, ry: 0.18, rotate: 15 }, // Tranquillitatis
  { cx: 0.52, cy: 0.2, rx: 0.13, ry: 0.2, rotate: -10 }, // Fecunditatis
  { cx: 0.32, cy: 0.3, rx: 0.1, ry: 0.12, rotate: 0 }, // Nectaris
  { cx: 0.66, cy: -0.3, rx: 0.13, ry: 0.15, rotate: 0 }, // Crisium
]
