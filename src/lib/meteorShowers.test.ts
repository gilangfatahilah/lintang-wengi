import { describe, it, expect } from 'vitest'
import { showersNear, METEOR_SHOWERS } from './meteorShowers'

const BANDUNG = { lat: -6.9175, lon: 107.6191 }
const ACEH = { lat: 5.5483, lon: 95.3238 }

describe('showersNear', () => {
  it('finds the Geminids in early December', () => {
    const active = showersNear(BANDUNG, new Date('2026-12-05T12:00:00Z'))
    expect(active.map((a) => a.shower.id)).toContain('geminids')
  })

  it('drops the Ursids in Java but keeps them in Aceh', () => {
    // Radiant declination +75.3°. From Bandung at -6.9° it cannot exceed about 8°
    // and is hopeless; from Aceh at +5.5° it reaches roughly 14° inside the dark
    // window and is weakly observable. This is the case a hardcoded "visible from
    // Indonesia" flag gets wrong: the country spans 17° of latitude and the answer
    // flips inside it.
    const bandung = showersNear(BANDUNG, new Date('2026-12-20T12:00:00Z'))
    const aceh = showersNear(ACEH, new Date('2026-12-20T12:00:00Z'))

    expect(bandung.map((a) => a.shower.id)).not.toContain('ursids')
    const acehUrsids = aceh.find((a) => a.shower.id === 'ursids')
    expect(acehUrsids).toBeDefined()
    expect(acehUrsids!.radiant.maxAltitude).toBeGreaterThan(10)
  })

  it('keeps the Perseids, which are poor from here but genuinely visible', () => {
    const active = showersNear(BANDUNG, new Date('2026-08-05T12:00:00Z'))
    const perseids = active.find((a) => a.shower.id === 'perseids')
    expect(perseids).toBeDefined()
    // Radiant declination +58° from latitude -7° culminates near 25°.
    expect(perseids!.radiant.maxAltitude).toBeGreaterThan(15)
    expect(perseids!.radiant.maxAltitude).toBeLessThan(35)
  })

  it('crosses the year boundary to reach January showers', () => {
    // On 28 December the next thing worth naming is the Quadrantids on 3 January.
    const active = showersNear(BANDUNG, new Date('2026-12-28T12:00:00Z'))
    const quads = active.find((a) => a.shower.id === 'quadrantids')
    expect(quads).toBeDefined()
    expect(quads!.peak.getUTCFullYear()).toBe(2027)
  })

  it('still reports a shower that peaked yesterday', () => {
    const active = showersNear(BANDUNG, new Date('2026-12-15T12:00:00Z'))
    const geminids = active.find((a) => a.shower.id === 'geminids')
    expect(geminids).toBeDefined()
    expect(geminids!.daysAway).toBeLessThan(0)
  })

  it('drops a shower that peaked a week ago', () => {
    const active = showersNear(BANDUNG, new Date('2026-12-22T12:00:00Z'))
    expect(active.map((a) => a.shower.id)).not.toContain('geminids')
  })

  it('reports nothing in a quiet stretch of the year', () => {
    // Early March has no major shower.
    expect(showersNear(BANDUNG, new Date('2026-03-05T12:00:00Z'))).toEqual([])
  })

  it('orders by how soon the peak is', () => {
    const active = showersNear(BANDUNG, new Date('2026-11-01T12:00:00Z'))
    const days = active.map((a) => a.daysAway)
    expect(days).toEqual([...days].sort((a, b) => a - b))
  })

  it('reports moonlight on the peak night', () => {
    const active = showersNear(BANDUNG, new Date('2026-12-05T12:00:00Z'))
    for (const a of active) {
      expect(a.moonInterference).toBeGreaterThanOrEqual(0)
      expect(a.moonInterference).toBeLessThanOrEqual(1)
    }
  })
})

describe('the shower table', () => {
  it('has no duplicate ids', () => {
    const ids = METEOR_SHOWERS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every peak date and radiant in range', () => {
    for (const s of METEOR_SHOWERS) {
      expect(s.peakMonth, s.name).toBeGreaterThanOrEqual(1)
      expect(s.peakMonth, s.name).toBeLessThanOrEqual(12)
      expect(s.peakDay, s.name).toBeGreaterThanOrEqual(1)
      expect(s.peakDay, s.name).toBeLessThanOrEqual(31)
      expect(s.radiantRa, s.name).toBeGreaterThanOrEqual(0)
      expect(s.radiantRa, s.name).toBeLessThan(24)
      expect(Math.abs(s.radiantDec), s.name).toBeLessThanOrEqual(90)
    }
  })
})
