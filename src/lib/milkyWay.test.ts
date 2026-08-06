import { describe, it, expect } from 'vitest'
import * as A from 'astronomy-engine'
import type { MoonConditions } from '@/types'
import { nightWindow, moonConditions } from './astro'
import { milkyWayNight, verdictText } from './milkyWay'

const BANDUNG = { lat: -6.9175, lon: 107.6191 }

/** August: the core rides high over Indonesia all evening. */
const AUGUST = new Date('2026-08-05T12:00:00Z')
/** December: the core sits with the sun and never enters the dark window. */
const DECEMBER = new Date('2026-12-15T12:00:00Z')

const NO_MOON: MoonConditions = {
  illumination: 0,
  fractionAboveHorizon: 0,
  rise: null,
  set: null,
  phaseKey: 'new',
}

const FULL_MOON_ALL_NIGHT: MoonConditions = {
  illumination: 1,
  fractionAboveHorizon: 1,
  rise: null,
  set: null,
  phaseKey: 'full',
}

describe('milkyWayNight', () => {
  it('calls a dark August night good', () => {
    const w = nightWindow(BANDUNG, AUGUST)
    const night = milkyWayNight(BANDUNG, w, NO_MOON)

    expect(night.verdict).toBe('good')
    expect(night.visibility.maxAltitude).toBeGreaterThan(50)
  })

  it('rules December out entirely', () => {
    const w = nightWindow(BANDUNG, DECEMBER)
    const night = milkyWayNight(BANDUNG, w, NO_MOON)

    expect(night.verdict).toBe('no')
    expect(night.visibility.fractionUseful).toBe(0)
  })

  it('downgrades a well-placed core under a full moon', () => {
    // The same night that scores "baik" without a moon. Only the moon changed, so
    // only the moon can explain the difference.
    const w = nightWindow(BANDUNG, AUGUST)
    const night = milkyWayNight(BANDUNG, w, FULL_MOON_ALL_NIGHT)

    expect(night.verdict).toBe('limited')
    expect(night.reason.key).toBe('milkyWay.reason.moonWashout')
  })

  it('ignores a full moon that has already set', () => {
    // The rule this locks: interference is illumination x time above the horizon.
    // A bright moon below the horizon costs nothing, here as in the score.
    const w = nightWindow(BANDUNG, AUGUST)
    const setMoon: MoonConditions = { ...FULL_MOON_ALL_NIGHT, fractionAboveHorizon: 0 }

    expect(milkyWayNight(BANDUNG, w, setMoon).verdict).toBe('good')
  })

  it('gives a reason on every verdict', () => {
    const w = nightWindow(BANDUNG, AUGUST)
    for (const moon of [NO_MOON, FULL_MOON_ALL_NIGHT]) {
      expect(milkyWayNight(BANDUNG, w, moon).reason.key.length).toBeGreaterThan(0)
    }
  })

  it('works with a real moon rather than a hand-built one', () => {
    const newMoon = A.SearchMoonPhase(0, new Date('2026-08-01T00:00:00Z'), 40)!
    const w = nightWindow(BANDUNG, newMoon.date)
    const night = milkyWayNight(BANDUNG, w, moonConditions(BANDUNG, w))

    // A new moon in August is the best case there is from Indonesia.
    expect(night.verdict).toBe('good')
  })
})

describe('verdictText', () => {
  it('returns a distinct message key for each verdict', () => {
    expect(verdictText('good').key).toBe('milkyWay.verdict.good')
    expect(verdictText('limited').key).toBe('milkyWay.verdict.limited')
    expect(verdictText('no').key).toBe('milkyWay.verdict.no')
  })
})
