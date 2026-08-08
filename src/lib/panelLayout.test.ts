import { describe, it, expect } from 'vitest'
import {
  BOUNDS,
  clampPanelSize,
  isPanelState,
  nudgePanelSize,
  panelSizeFromPointer,
  resolvePanelSize,
  toggleMaximized,
  toggleMinimized,
  RESIZE_STEP,
} from './panelLayout'

const WIDE = 1280
const TALL = 800

describe('clampPanelSize', () => {
  it('leaves a size that fits alone', () => {
    expect(clampPanelSize(420, WIDE, 'beside')).toBe(420)
  })

  it('never lets the panel go below what its content needs', () => {
    expect(clampPanelSize(50, WIDE, 'beside')).toBe(BOUNDS.beside.minPanel)
    expect(clampPanelSize(0, TALL, 'below')).toBe(BOUNDS.below.minPanel)
  })

  it('never lets the map be squeezed out', () => {
    expect(clampPanelSize(99999, WIDE, 'beside')).toBe(WIDE - BOUNDS.beside.minMap)
  })

  it('uses different bounds for the two placements', () => {
    // Beside the map the constraint is the width of the forecast table; below it,
    // only that a row or two stays visible.
    expect(BOUNDS.beside.minPanel).toBeGreaterThan(BOUNDS.below.minPanel)
    expect(clampPanelSize(220, WIDE, 'beside')).toBe(BOUNDS.beside.minPanel)
    expect(clampPanelSize(220, TALL, 'below')).toBe(220)
  })

  /*
   * With a container too small for both minimums the clamp's bounds cross, and an
   * unguarded Math.min/Math.max returns whichever was applied last. The split is
   * arbitrary but it is defined, which is the point.
   */
  it('splits proportionally when neither minimum can be honoured', () => {
    const container = 300 // beside needs 288 + 240
    const size = clampPanelSize(280, container, 'beside')
    expect(size).toBeGreaterThan(0)
    expect(size).toBeLessThan(container)
    expect(size).toBe(Math.round((300 * 288) / (288 + 240)))
  })

  it('is stable: clamping an already-clamped value changes nothing', () => {
    for (const requested of [0, 120, 300, 640, 5000]) {
      const once = clampPanelSize(requested, WIDE, 'beside')
      expect(clampPanelSize(once, WIDE, 'beside')).toBe(once)
    }
  })

  it('survives a container of zero rather than returning a negative size', () => {
    expect(clampPanelSize(400, 0, 'beside')).toBe(0)
  })

  it('falls back to the preferred size for a value that is not a number', () => {
    expect(clampPanelSize(Number.NaN, WIDE, 'beside')).toBe(BOUNDS.beside.preferred)
  })
})

describe('resolvePanelSize', () => {
  it('uses the stored preference when it still fits', () => {
    expect(resolvePanelSize('460', WIDE, 'beside')).toBe(460)
  })

  it('falls back to the preferred size with nothing stored', () => {
    expect(resolvePanelSize(null, WIDE, 'beside')).toBe(BOUNDS.beside.preferred)
  })

  it('ignores a stored value that is not a number', () => {
    expect(resolvePanelSize('wide please', WIDE, 'beside')).toBe(BOUNDS.beside.preferred)
    expect(resolvePanelSize('', WIDE, 'beside')).toBe(BOUNDS.beside.preferred)
  })

  /*
   * The case a stored fraction would have handled and a stored pixel count must be
   * made to handle: a preference saved on a desktop, reopened on a phone.
   */
  it('shrinks a preference saved on a bigger screen', () => {
    expect(resolvePanelSize('900', 600, 'beside')).toBe(600 - BOUNDS.beside.minMap)
  })
})

describe('panelSizeFromPointer', () => {
  it('measures from the end of the container, where the panel is anchored', () => {
    // Container spans 0..1280; a pointer at 880 leaves 400 for the panel.
    expect(panelSizeFromPointer(880, 0, 1280, 'beside')).toBe(400)
  })

  it('accounts for a container that does not start at zero', () => {
    expect(panelSizeFromPointer(980, 100, 1380, 'beside')).toBe(400)
  })

  it('clamps a pointer dragged past either edge', () => {
    expect(panelSizeFromPointer(-500, 0, 1280, 'beside')).toBe(1280 - BOUNDS.beside.minMap)
    expect(panelSizeFromPointer(5000, 0, 1280, 'beside')).toBe(BOUNDS.beside.minPanel)
  })

  it('uses the same formula stacked, measuring up from the bottom', () => {
    expect(panelSizeFromPointer(420, 0, 800, 'below')).toBe(380)
  })
})

describe('nudgePanelSize', () => {
  it('grows and shrinks by the step', () => {
    expect(nudgePanelSize(400, 1, WIDE, 'beside')).toBe(400 + RESIZE_STEP)
    expect(nudgePanelSize(400, -1, WIDE, 'beside')).toBe(400 - RESIZE_STEP)
  })

  it('stops at the bounds instead of stepping past them', () => {
    expect(nudgePanelSize(BOUNDS.beside.minPanel, -1, WIDE, 'beside')).toBe(
      BOUNDS.beside.minPanel,
    )
    const max = WIDE - BOUNDS.beside.minMap
    expect(nudgePanelSize(max, 1, WIDE, 'beside')).toBe(max)
  })

  it('takes a finer step when asked', () => {
    expect(nudgePanelSize(400, 1, WIDE, 'beside', 8)).toBe(408)
  })
})

describe('state toggles', () => {
  it('minimize returns to normal from minimized', () => {
    expect(toggleMinimized('normal')).toBe('minimized')
    expect(toggleMinimized('minimized')).toBe('normal')
  })

  it('minimize from maximized goes to minimized, not back to maximized', () => {
    expect(toggleMinimized('maximized')).toBe('minimized')
  })

  it('maximize toggles against normal', () => {
    expect(toggleMaximized('normal')).toBe('maximized')
    expect(toggleMaximized('maximized')).toBe('normal')
    expect(toggleMaximized('minimized')).toBe('maximized')
  })

  it('recognises only the three real states', () => {
    expect(isPanelState('normal')).toBe(true)
    expect(isPanelState('minimized')).toBe(true)
    expect(isPanelState('maximized')).toBe(true)
    expect(isPanelState('collapsed')).toBe(false)
    expect(isPanelState(null)).toBe(false)
    expect(isPanelState(undefined)).toBe(false)
  })
})
