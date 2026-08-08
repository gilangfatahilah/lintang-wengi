/**
 * How much room the readout panel gets, and the rules that keep both halves usable.
 *
 * Sizes are stored in pixels and clamped against the live container every time they
 * are read, rather than stored as a fraction. A fraction survives a change of
 * monitor but not the thing that actually matters here: the panel has a real
 * minimum below which its content stops laying out, and the map has one below which
 * it stops being a map. Those are absolute, so the clamp is absolute too.
 */

/** Whether the panel sits beside the map or below it. Follows the CSS breakpoint. */
export type PanelPlacement = 'beside' | 'below'

export type PanelState = 'minimized' | 'normal' | 'maximized'

const STATES: readonly PanelState[] = ['minimized', 'normal', 'maximized']

export function isPanelState(value: unknown): value is PanelState {
  return typeof value === 'string' && (STATES as readonly string[]).includes(value)
}

export interface PanelBounds {
  /** Below this the readout rows and the forecast table stop laying out. */
  minPanel: number
  /** Below this the map is too small to pick a point on. */
  minMap: number
  /** Size before the user has expressed a preference. */
  preferred: number
}

/*
 * The two placements need different numbers, not one shared pair. Beside the map the
 * panel's constraint is the width of the 5-column forecast table; below it, the
 * constraint is only that a couple of rows stay visible, and the map needs less
 * height than it needs width to stay pannable.
 */
export const BOUNDS: Record<PanelPlacement, PanelBounds> = {
  beside: { minPanel: 288, minMap: 240, preferred: 400 },
  below: { minPanel: 200, minMap: 200, preferred: 380 },
}

/**
 * The panel size, honouring both minimums.
 *
 * When the container cannot fit both — a very short window in `below` placement —
 * neither minimum can win, so the space is split in proportion to them. That is an
 * arbitrary rule, but it is a defined one: the alternative is a clamp whose lower
 * and upper bounds cross, which silently returns whichever the implementation
 * happened to apply last.
 */
export function clampPanelSize(
  requested: number,
  container: number,
  placement: PanelPlacement,
): number {
  const { minPanel, minMap } = BOUNDS[placement]
  if (!Number.isFinite(requested)) return clampPanelSize(BOUNDS[placement].preferred, container, placement)
  if (container <= 0) return 0
  if (container < minPanel + minMap) {
    return Math.round((container * minPanel) / (minPanel + minMap))
  }
  return Math.round(Math.min(Math.max(requested, minPanel), container - minMap))
}

/**
 * The stored preference, or the default, clamped to what currently fits.
 *
 * Mirrors `resolveInitialLocale`: all the "what did we remember, and is it still
 * valid" reasoning lives in one pure function so it can be tested without a DOM.
 */
export function resolvePanelSize(
  stored: string | null,
  container: number,
  placement: PanelPlacement,
): number {
  // `Number('')` is 0, not NaN, so an empty entry has to be rejected before parsing
  // or it reads as a request for a zero-width panel and clamps to the minimum.
  const trimmed = stored?.trim()
  const parsed = trimmed ? Number(trimmed) : Number.NaN
  const requested = Number.isFinite(parsed) ? parsed : BOUNDS[placement].preferred
  return clampPanelSize(requested, container, placement)
}

/**
 * Panel size implied by a pointer at `pointer` along the resize axis.
 *
 * The panel is anchored to the end of the container in both placements — right in
 * `beside`, bottom in `below` — so the size is always the distance from the pointer
 * to that end, and one formula covers both.
 */
export function panelSizeFromPointer(
  pointer: number,
  containerStart: number,
  containerEnd: number,
  placement: PanelPlacement,
): number {
  return clampPanelSize(containerEnd - pointer, containerEnd - containerStart, placement)
}

/** Coarse step for a keyboard nudge; `Shift` uses the fine one. */
export const RESIZE_STEP = 32
export const RESIZE_STEP_FINE = 8

/**
 * Keyboard resize. `direction` is +1 to grow the panel, -1 to shrink it.
 *
 * A drag is unusable in the dark with cold hands, so the separator is operable from
 * the keyboard too — and that path needs the same clamp, not an approximation of it.
 */
export function nudgePanelSize(
  current: number,
  direction: -1 | 1,
  container: number,
  placement: PanelPlacement,
  step: number = RESIZE_STEP,
): number {
  return clampPanelSize(current + direction * step, container, placement)
}

/** What a click on the minimize control should produce, given where things stand. */
export function toggleMinimized(state: PanelState): PanelState {
  return state === 'minimized' ? 'normal' : 'minimized'
}

/** What a click on the maximize control should produce. */
export function toggleMaximized(state: PanelState): PanelState {
  return state === 'maximized' ? 'normal' : 'maximized'
}
