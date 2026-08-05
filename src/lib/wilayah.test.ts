import { describe, it, expect } from 'vitest'
import { parseIndex, findNearest, haversineKm, type RawIndex } from './wilayah'

const raw: RawIndex = {
  generatedAt: '2026-08-05',
  fields: ['adm3', 'desaSuffix', 'name', 'kotkabIndex', 'lat', 'lon'],
  kotkabNames: ['Kota Adm. Jakarta Pusat', 'Kabupaten Bandung'],
  rows: [
    ['31.71.03', '1001', 'Kemayoran', 0, -6.1647, 106.8454],
    ['32.04.01', '2001', 'Cileunyi', 1, -6.9333, 107.7],
    ['32.04.02', '2005', 'Cimenyan', 1, -6.8667, 107.65],
  ],
}

describe('parseIndex', () => {
  it('reassembles the full adm4 code from adm3 plus the desa suffix', () => {
    const [first] = parseIndex(raw)
    expect(first!.adm4).toBe('31.71.03.1001')
  })

  it('resolves the kotkab name from its index', () => {
    const parsed = parseIndex(raw)
    expect(parsed[0]!.kotkab).toBe('Kota Adm. Jakarta Pusat')
    expect(parsed[1]!.kotkab).toBe('Kabupaten Bandung')
  })
})

describe('findNearest', () => {
  const index = parseIndex(raw)

  it('returns the closest kecamatan to a point', () => {
    // A little north of Kemayoran
    const found = findNearest(index, { lat: -6.15, lon: 106.85 })
    expect(found?.name).toBe('Kemayoran')
  })

  it('discriminates between two nearby kecamatan', () => {
    const found = findNearest(index, { lat: -6.87, lon: 107.66 })
    expect(found?.name).toBe('Cimenyan')
  })

  it('returns null for an empty index rather than throwing', () => {
    expect(findNearest([], { lat: 0, lon: 0 })).toBeNull()
  })

  it('still resolves a point far outside Indonesia to the nearest entry', () => {
    // Clicking the ocean should degrade gracefully, not crash.
    const found = findNearest(index, { lat: -20, lon: 110 })
    expect(found).not.toBeNull()
  })

  it('applies longitude convergence so east-west distance is not overstated', () => {
    // Two candidates equidistant in raw degrees. At 60° latitude a degree of
    // longitude is half a degree of latitude on the ground, so the eastward
    // candidate is physically closer and must win.
    const polar = parseIndex({
      ...raw,
      rows: [
        ['11.11.11', '0001', 'East', 0, 60, 62],
        ['22.22.22', '0001', 'North', 0, 62, 60],
      ],
    })
    expect(findNearest(polar, { lat: 60, lon: 60 })?.name).toBe('East')
  })
})

describe('haversineKm', () => {
  it('measures a known distance', () => {
    // Jakarta (Monas) to Bandung is ~120 km
    const d = haversineKm({ lat: -6.1754, lon: 106.8272 }, { lat: -6.9175, lon: 107.6191 })
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(130)
  })

  it('is zero for identical points', () => {
    expect(haversineKm({ lat: -6, lon: 106 }, { lat: -6, lon: 106 })).toBeCloseTo(0, 6)
  })
})
