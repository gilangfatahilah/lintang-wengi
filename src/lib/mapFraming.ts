/**
 * Keeping the picked point on screen. The map's container changes size under it
 * (panel resized, switched, or stacked below on a phone) and MapLibre keeps the
 * centre fixed when that happens, so a point near an edge slides out of view while
 * its readout is still on screen. These work in container pixels, as returned by
 * `map.project`.
 */

export interface Px {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Inset {
  top: number
  right: number
  bottom: number
  left: number
}

/** A map collapsed to nothing shows nothing, including the point at its origin. */
export function isInView(p: Px, size: Size): boolean {
  if (size.width <= 0 || size.height <= 0) return false
  return p.x >= 0 && p.x <= size.width && p.y >= 0 && p.y <= size.height
}

/**
 * The `map.panBy` offset that brings `p` inside the viewport shrunk by `inset`, or
 * [0, 0] if it is already there. It moves only as far as the nearest edge: recentring
 * would throw away the framing the user chose. On an axis too small for its insets
 * the bounds would cross, so that axis centres instead.
 */
export function panIntoView(p: Px, size: Size, inset: Inset): [number, number] {
  return [
    axisOffset(p.x, inset.left, size.width - inset.right, size.width),
    axisOffset(p.y, inset.top, size.height - inset.bottom, size.height),
  ]
}

function axisOffset(v: number, lo: number, hi: number, length: number): number {
  if (lo > hi) return v - length / 2
  if (v < lo) return v - lo
  if (v > hi) return v - hi
  return 0
}
