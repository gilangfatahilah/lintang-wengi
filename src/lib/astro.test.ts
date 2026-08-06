import { describe, it, expect } from 'vitest'
import * as A from 'astronomy-engine'
import { nightWindow, moonConditions, phaseKeyOf } from './astro'

// Bandung-ish: equatorial, WIB. Used for most cases.
const BANDUNG = { lat: -6.9175, lon: 107.6191 }
// Near the eastern edge of Indonesia, WIT, to catch offset assumptions.
const MERAUKE = { lat: -8.4932, lon: 140.4018 }

function sunAltitude(at: Date, loc: { lat: number; lon: number }): number {
  const observer = new A.Observer(loc.lat, loc.lon, 0)
  const eq = A.Equator(A.Body.Sun, at, observer, true, true)
  return A.Horizon(at, observer, eq.ra, eq.dec, 'normal').altitude
}

describe('nightWindow', () => {
  it('returns a window that ends after it starts', () => {
    const w = nightWindow(BANDUNG, new Date('2026-08-05T07:00:00Z'))
    expect(w.end.getTime()).toBeGreaterThan(w.start.getTime())
  })

  it('is a plausible length for equatorial latitudes', () => {
    const w = nightWindow(BANDUNG, new Date('2026-08-05T07:00:00Z'))
    const hours = (w.end.getTime() - w.start.getTime()) / 3600000
    expect(hours).toBeGreaterThan(8)
    expect(hours).toBeLessThan(13)
  })

  it('genuinely contains astronomical darkness', () => {
    // The real correctness check: at the midpoint the sun must be below -18°.
    // A window computed off by a day, or off by the UTC offset, fails this.
    const w = nightWindow(BANDUNG, new Date('2026-08-05T07:00:00Z'))
    const mid = new Date((w.start.getTime() + w.end.getTime()) / 2)
    expect(sunAltitude(mid, BANDUNG)).toBeLessThan(-18)
  })

  it('starts and ends at the boundary of darkness, not inside it', () => {
    const w = nightWindow(BANDUNG, new Date('2026-08-05T07:00:00Z'))
    // Just outside the window the sun must be higher than -18°.
    expect(sunAltitude(new Date(w.start.getTime() - 15 * 60000), BANDUNG)).toBeGreaterThan(-18)
    expect(sunAltitude(new Date(w.end.getTime() + 15 * 60000), BANDUNG)).toBeGreaterThan(-18)
  })

  it('returns the night in progress when called after midnight', () => {
    // 02:00 WIB = 19:00 UTC previous day. The user is already out shooting;
    // "tonight" must mean the window they are standing in, not tomorrow's.
    const duringNight = new Date('2026-08-04T19:00:00Z')
    const w = nightWindow(BANDUNG, duringNight)
    expect(w.start.getTime()).toBeLessThanOrEqual(duringNight.getTime())
    expect(w.end.getTime()).toBeGreaterThan(duringNight.getTime())
  })

  it('moves to the next night when called in the morning after dawn', () => {
    // 09:00 WIB = 02:00 UTC. Last night is over; the next window is ahead.
    const morning = new Date('2026-08-05T02:00:00Z')
    const w = nightWindow(BANDUNG, morning)
    expect(w.start.getTime()).toBeGreaterThan(morning.getTime())
  })

  it('works at the eastern extreme of Indonesia', () => {
    const w = nightWindow(MERAUKE, new Date('2026-08-05T07:00:00Z'))
    const mid = new Date((w.start.getTime() + w.end.getTime()) / 2)
    expect(sunAltitude(mid, MERAUKE)).toBeLessThan(-18)
  })
})

describe('moonConditions', () => {
  it('reports near-zero illumination at a new moon', () => {
    const newMoon = A.SearchMoonPhase(0, new Date('2026-08-01T00:00:00Z'), 40)
    expect(newMoon).not.toBeNull()
    const w = nightWindow(BANDUNG, newMoon!.date)
    const m = moonConditions(BANDUNG, w)
    expect(m.illumination).toBeLessThan(0.1)
  })

  it('reports near-full illumination at a full moon', () => {
    const fullMoon = A.SearchMoonPhase(180, new Date('2026-08-01T00:00:00Z'), 40)
    expect(fullMoon).not.toBeNull()
    const w = nightWindow(BANDUNG, fullMoon!.date)
    const m = moonConditions(BANDUNG, w)
    expect(m.illumination).toBeGreaterThan(0.9)
  })

  it('keeps both fractions within 0..1', () => {
    const w = nightWindow(BANDUNG, new Date('2026-08-05T07:00:00Z'))
    const m = moonConditions(BANDUNG, w)
    expect(m.illumination).toBeGreaterThanOrEqual(0)
    expect(m.illumination).toBeLessThanOrEqual(1)
    expect(m.fractionAboveHorizon).toBeGreaterThanOrEqual(0)
    expect(m.fractionAboveHorizon).toBeLessThanOrEqual(1)
  })

  it('has the full moon above the horizon for most of the night', () => {
    // A full moon is opposite the sun, so it rises around sunset and sets around
    // sunrise -- it should dominate essentially the whole dark window.
    const fullMoon = A.SearchMoonPhase(180, new Date('2026-08-01T00:00:00Z'), 40)
    const w = nightWindow(BANDUNG, fullMoon!.date)
    const m = moonConditions(BANDUNG, w)
    expect(m.fractionAboveHorizon).toBeGreaterThan(0.8)
  })

  it('has the new moon absent for most of the night', () => {
    // A new moon sits with the sun, so it is below the horizon while it is dark.
    const newMoon = A.SearchMoonPhase(0, new Date('2026-08-01T00:00:00Z'), 40)
    const w = nightWindow(BANDUNG, newMoon!.date)
    const m = moonConditions(BANDUNG, w)
    expect(m.fractionAboveHorizon).toBeLessThan(0.2)
  })
})

describe('phaseKeyOf', () => {
  it('identifies the four principal phases', () => {
    expect(phaseKeyOf(0)).toBe('new')
    expect(phaseKeyOf(90)).toBe('firstQuarter')
    expect(phaseKeyOf(180)).toBe('full')
    expect(phaseKeyOf(270)).toBe('lastQuarter')
  })

  it('wraps 360 back to new moon', () => {
    expect(phaseKeyOf(359.9)).toBe('new')
  })
})
