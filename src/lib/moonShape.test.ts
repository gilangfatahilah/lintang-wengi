import { describe, it, expect } from 'vitest'
import { litPath, isWaning } from './moonShape'
import type { MoonPhaseKey } from '@/types'

/**
 * The path is `M cx,top A r r 0 0 <limb> cx,bottom A rx r 0 0 <term> cx,top Z`.
 * These pull the two sweep flags and the terminator half-width back out, because
 * those three numbers are the entire behaviour.
 */
function parse(d: string) {
  const m = d.match(
    /^M12 2A10 10 0 0 (\d) 12 22A([\d.]+) 10 0 0 (\d) 12 2Z$/,
  )
  if (!m) throw new Error(`unexpected path: ${d}`)
  return { limbSweep: Number(m[1]), rx: Number(m[2]), terminatorSweep: Number(m[3]) }
}

const at = (k: number, phase: MoonPhaseKey) => parse(litPath(k, phase)!)

describe('isWaning', () => {
  it('splits the eight phases into the two halves of the cycle', () => {
    expect(isWaning('waxingCrescent')).toBe(false)
    expect(isWaning('firstQuarter')).toBe(false)
    expect(isWaning('full')).toBe(false)
    expect(isWaning('waningGibbous')).toBe(true)
    expect(isWaning('lastQuarter')).toBe(true)
    expect(isWaning('new')).toBe(false)
  })
})

describe('litPath', () => {
  it('draws nothing at new moon', () => {
    expect(litPath(0, 'new')).toBeNull()
    expect(litPath(0.004, 'new')).toBeNull()
  })

  it('lights the right limb while waxing and the left while waning', () => {
    expect(at(0.3, 'waxingCrescent').limbSweep).toBe(1)
    expect(at(0.3, 'waningCrescent').limbSweep).toBe(0)
  })

  /*
   * The bug this file exists for. With the sweep inverted a full moon's two arcs
   * retrace each other and the disc renders black, while a thin crescent renders
   * almost fully lit.
   */
  it('draws a full moon as a whole disc, not an empty one', () => {
    const { limbSweep, terminatorSweep, rx } = at(1, 'full')
    expect(rx).toBeCloseTo(10)
    // Same sweep on both arcs: two opposite semicircles closing into a circle.
    expect(terminatorSweep).toBe(limbSweep)
  })

  it('curves the terminator back across the limb below half phase', () => {
    const { limbSweep, terminatorSweep } = at(0.12, 'waxingCrescent')
    expect(terminatorSweep).toBe(1 - limbSweep)
  })

  it('curves the terminator away from the limb above half phase', () => {
    const { limbSweep, terminatorSweep } = at(0.72, 'waxingGibbous')
    expect(terminatorSweep).toBe(limbSweep)
  })

  it('flattens the terminator to a straight edge at quarter phase', () => {
    expect(at(0.5, 'firstQuarter').rx).toBe(0)
    expect(at(0.5, 'lastQuarter').rx).toBe(0)
  })

  /*
   * Half-width tracks |1 - 2k|, so a crescent and the gibbous that mirrors it share
   * a terminator and differ only in which way it curves.
   */
  it('mirrors the terminator width either side of half phase', () => {
    expect(at(0.2, 'waxingCrescent').rx).toBeCloseTo(at(0.8, 'waxingGibbous').rx)
  })

  it('widens the crescent as illumination grows', () => {
    const widths = [0.1, 0.25, 0.4, 0.49].map((k) => at(k, 'waxingCrescent').rx)
    expect(widths).toEqual([...widths].sort((a, b) => b - a))
  })

  it('clamps values that stray outside 0–1 rather than throwing', () => {
    expect(() => litPath(1.0001, 'full')).not.toThrow()
    expect(at(1.0001, 'full').rx).toBeCloseTo(10)
    expect(litPath(-0.2, 'new')).toBeNull()
  })

  it('gives waxing and waning the same shape mirrored', () => {
    const wax = at(0.3, 'waxingCrescent')
    const wane = at(0.3, 'waningCrescent')
    expect(wane.rx).toBeCloseTo(wax.rx)
    expect(wane.limbSweep).toBe(1 - wax.limbSweep)
    expect(wane.terminatorSweep).toBe(1 - wax.terminatorSweep)
  })
})
