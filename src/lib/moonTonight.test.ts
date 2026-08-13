import { describe, it, expect } from 'vitest'
import { tonightMidnight, moonTonight, moonBrightnessKey } from './moonTonight'

const WIB = 420

describe('tonightMidnight', () => {
  it('takes the coming midnight when the viewer is in the afternoon or evening', () => {
    // 2026-08-13 10:00Z is 17:00 WIB. The night being asked about starts tonight,
    // so the anchor is 2026-08-14 00:00 WIB = 2026-08-13 17:00Z.
    expect(tonightMidnight(new Date('2026-08-13T10:00:00Z'), WIB).toISOString()).toBe(
      '2026-08-13T17:00:00.000Z',
    )
  })

  it('keeps the night already underway when the viewer is past midnight', () => {
    // 2026-08-13 19:00Z is 02:00 WIB on the 14th -- standing inside that night, so
    // the anchor is the midnight just passed, not the next one.
    expect(tonightMidnight(new Date('2026-08-13T19:00:00Z'), WIB).toISOString()).toBe(
      '2026-08-13T17:00:00.000Z',
    )
  })

  it('pivots at local noon', () => {
    const before = tonightMidnight(new Date('2026-08-13T04:59:00Z'), WIB) // 11:59 WIB
    const after = tonightMidnight(new Date('2026-08-13T05:01:00Z'), WIB) // 12:01 WIB
    expect(after.getTime() - before.getTime()).toBe(86_400_000)
  })

  it('works for a negative offset without landing on the wrong day', () => {
    // 2026-08-13 02:00Z is 2026-08-12 21:00 at -05:00, an evening, so the anchor is
    // 2026-08-13 00:00 local = 2026-08-13 05:00Z.
    expect(tonightMidnight(new Date('2026-08-13T02:00:00Z'), -300).toISOString()).toBe(
      '2026-08-13T05:00:00.000Z',
    )
  })
})

describe('moonTonight', () => {
  // Anchored to numbers this app already prints for these dates, so the test fails
  // if the ephemeris call or the instant it is made at ever changes.
  it('reads the new moon of 2026-08-13', () => {
    const m = moonTonight(new Date('2026-08-13T10:00:00Z'), WIB)
    expect(m.phaseKey).toBe('new')
    expect(m.illumination).toBeLessThan(0.05)
  })

  it('reads the waning crescent of 2026-08-08', () => {
    const m = moonTonight(new Date('2026-08-08T10:00:00Z'), WIB)
    expect(m.phaseKey).toBe('waningCrescent')
    expect(m.illumination).toBeGreaterThan(0.18)
    expect(m.illumination).toBeLessThan(0.27)
  })

  it('always returns a fraction, never a percentage', () => {
    for (const day of ['2026-08-01', '2026-08-09', '2026-08-17', '2026-08-25']) {
      const m = moonTonight(new Date(`${day}T10:00:00Z`), WIB)
      expect(m.illumination).toBeGreaterThanOrEqual(0)
      expect(m.illumination).toBeLessThanOrEqual(1)
    }
  })
})

describe('moonBrightnessKey', () => {
  it('maps each band to its own key', () => {
    expect(moonBrightnessKey(0)).toBe('moonTonight.dark')
    expect(moonBrightnessKey(0.14)).toBe('moonTonight.dark')
    expect(moonBrightnessKey(0.15)).toBe('moonTonight.thin')
    expect(moonBrightnessKey(0.44)).toBe('moonTonight.thin')
    expect(moonBrightnessKey(0.45)).toBe('moonTonight.half')
    expect(moonBrightnessKey(0.74)).toBe('moonTonight.half')
    expect(moonBrightnessKey(0.75)).toBe('moonTonight.bright')
    expect(moonBrightnessKey(1)).toBe('moonTonight.bright')
  })

  it('returns a key, never a sentence', () => {
    for (const v of [0, 0.3, 0.6, 0.9]) {
      expect(moonBrightnessKey(v)).toMatch(/^moonTonight\.[a-z]+$/)
    }
  })
})
