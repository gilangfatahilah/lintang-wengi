import { describe, it, expect } from 'vitest'
import {
  sampleMagnitude,
  magnitudeToBortle,
  bortleLabel,
  type LpGrid,
  type LpMeta,
} from './lightPollution'

// A 2x2 grid over a 2x2 degree box. Row 0 is the north row, per the contract.
//   north-west 22.0 (dark)   north-east 16.0 (bright)
//   south-west 22.0 (dark)   south-east 16.0 (bright)
const meta: LpMeta = {
  bbox: [100, -2, 102, 0],
  width: 2,
  height: 2,
  encoding: 'uint8-linear-mag',
  magMin: 16,
  magMax: 22,
}
const grid: LpGrid = {
  meta,
  // 255 decodes to magMax (22.0), 0 decodes to magMin (16.0)
  data: new Uint8Array([255, 0, 255, 0]),
}

describe('sampleMagnitude', () => {
  it('decodes a cell centre back to its magnitude', () => {
    // North-west cell centre sits at lon 100.5, lat -0.5
    expect(sampleMagnitude(grid, { lat: -0.5, lon: 100.5 })).toBeCloseTo(22.0, 5)
    expect(sampleMagnitude(grid, { lat: -0.5, lon: 101.5 })).toBeCloseTo(16.0, 5)
  })

  it('interpolates between cells instead of stepping', () => {
    // Halfway between the dark and bright cell centres.
    const mid = sampleMagnitude(grid, { lat: -0.5, lon: 101.0 })
    expect(mid).toBeCloseTo(19.0, 5)
  })

  it('returns null outside the grid bounds', () => {
    expect(sampleMagnitude(grid, { lat: -0.5, lon: 90 })).toBeNull()
    expect(sampleMagnitude(grid, { lat: 40, lon: 101 })).toBeNull()
  })

  it('clamps at the edges rather than reading out of bounds', () => {
    // A point in the far corner must still return a finite value.
    const corner = sampleMagnitude(grid, { lat: -1.999, lon: 100.001 })
    expect(corner).not.toBeNull()
    expect(Number.isFinite(corner!)).toBe(true)
  })

  it('orients latitude correctly: row 0 is north', () => {
    // This grid is uniform north-to-south, so build one that is not, to prove
    // the row index is not flipped.
    const nsGrid: LpGrid = { meta, data: new Uint8Array([255, 255, 0, 0]) }
    const north = sampleMagnitude(nsGrid, { lat: -0.5, lon: 100.5 })!
    const south = sampleMagnitude(nsGrid, { lat: -1.5, lon: 100.5 })!
    expect(north).toBeGreaterThan(south)
  })
})

describe('magnitudeToBortle', () => {
  it('maps pristine skies to class 1 and inner city to class 9', () => {
    expect(magnitudeToBortle(22.0)).toBe(1)
    expect(magnitudeToBortle(17.0)).toBe(9)
  })

  it('increases monotonically as the sky gets brighter', () => {
    const samples = [22.0, 21.9, 21.8, 21.0, 20.0, 19.2, 18.6, 18.0, 17.0]
    const classes = samples.map(magnitudeToBortle)
    for (let i = 1; i < classes.length; i++) {
      expect(classes[i]!).toBeGreaterThanOrEqual(classes[i - 1]!)
    }
  })

  it('stays within the 1..9 scale for out-of-range input', () => {
    expect(magnitudeToBortle(30)).toBe(1)
    expect(magnitudeToBortle(5)).toBe(9)
  })
})

describe('bortleLabel', () => {
  it('describes each class in Indonesian', () => {
    expect(bortleLabel(1)).toMatch(/langit gelap sempurna/i)
    expect(bortleLabel(9)).toMatch(/pusat kota/i)
  })
})
