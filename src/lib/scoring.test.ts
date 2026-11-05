import { describe, it, expect } from 'vitest'
import {
  computeScore,
  cloudCoverForNight,
  limitingFactorText,
  ratingTone,
  scoreNight,
} from './scoring'
import { translateText, type MessageTree } from './i18n'
import { en } from '@/locales/en'
import { id } from '@/locales/id'
import type { ForecastPoint, MoonConditions, NightWindow } from '@/types'

const NEW_MOON: MoonConditions = {
  illumination: 0.01,
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
const FULL_MOON_ALREADY_SET: MoonConditions = {
  illumination: 1,
  fractionAboveHorizon: 0,
  rise: null,
  set: null,
  phaseKey: 'full',
}

describe('computeScore', () => {
  it('gives 5 for a pristine, clear, moonless night', () => {
    const s = computeScore({ bortle: 1, cloudCover: 0, moon: NEW_MOON })
    expect(s.rating).toBe(5)
    expect(s.limitingFactor).toBeNull()
  })

  it('gives 1 for a city centre under full cloud with a full moon', () => {
    const s = computeScore({ bortle: 9, cloudCover: 100, moon: FULL_MOON_ALL_NIGHT })
    expect(s.rating).toBe(1)
  })

  it('rates a dark but overcast site as unusable, not merely average', () => {
    // The whole reason for a limiting-factor combination. A weighted average would
    // return ~3/5 here by letting a perfect Bortle 1 offset the cloud deck, but a
    // 95% overcast night yields nothing no matter how dark the site is.
    const s = computeScore({ bortle: 1, cloudCover: 95, moon: NEW_MOON })
    expect(s.rating).toBeLessThanOrEqual(2)
    expect(s.limitingFactor?.key).toBe('clouds')
  })

  it('rates a clear city sky as poor, limited by darkness', () => {
    const s = computeScore({ bortle: 9, cloudCover: 0, moon: NEW_MOON })
    expect(s.rating).toBeLessThanOrEqual(2)
    expect(s.limitingFactor?.key).toBe('darkness')
  })

  it('does not penalise a full moon that stays below the horizon', () => {
    const up = computeScore({ bortle: 2, cloudCover: 10, moon: FULL_MOON_ALL_NIGHT })
    const down = computeScore({ bortle: 2, cloudCover: 10, moon: FULL_MOON_ALREADY_SET })
    // Same sky, same clouds; only the moon's presence differs.
    expect(down.rating).toBeGreaterThan(up.rating)
    expect(down.limitingFactor?.key).not.toBe('moon')
  })

  it('names the moon as the limiting factor when it dominates the night', () => {
    const s = computeScore({ bortle: 1, cloudCover: 0, moon: FULL_MOON_ALL_NIGHT })
    expect(s.limitingFactor?.key).toBe('moon')
  })

  it('improves monotonically as cloud cover drops', () => {
    const ratings = [100, 75, 50, 25, 0].map(
      (cloudCover) => computeScore({ bortle: 2, cloudCover, moon: NEW_MOON }).raw,
    )
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i]!).toBeGreaterThan(ratings[i - 1]!)
    }
  })

  it('improves monotonically as the sky gets darker', () => {
    const raws = [9, 7, 5, 3, 1].map(
      (bortle) => computeScore({ bortle, cloudCover: 10, moon: NEW_MOON }).raw,
    )
    for (let i = 1; i < raws.length; i++) {
      expect(raws[i]!).toBeGreaterThan(raws[i - 1]!)
    }
  })

  it('always produces a rating in 1..5 and a raw value in 0..1', () => {
    for (const bortle of [1, 5, 9]) {
      for (const cloudCover of [0, 50, 100]) {
        for (const moon of [NEW_MOON, FULL_MOON_ALL_NIGHT]) {
          const s = computeScore({ bortle, cloudCover, moon })
          expect(s.rating).toBeGreaterThanOrEqual(1)
          expect(s.rating).toBeLessThanOrEqual(5)
          expect(s.raw).toBeGreaterThanOrEqual(0)
          expect(s.raw).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('still scores when the forecast is unavailable, omitting the cloud factor', () => {
    const s = computeScore({ bortle: 2, cloudCover: null, moon: NEW_MOON })
    expect(s.subScores.map((f) => f.key)).toEqual(['darkness', 'moon'])
    expect(s.rating).toBeGreaterThan(1)
  })

  it('flags an incomplete score so a missing forecast cannot read as confidence', () => {
    // Fewer terms means less to drag the mean down, so this scores *higher* than
    // the same site with a known clear sky. Without the flag the UI would show a
    // reassuring 5/5 built on absent data.
    const missing = computeScore({ bortle: 2, cloudCover: null, moon: NEW_MOON })
    const known = computeScore({ bortle: 2, cloudCover: 5, moon: NEW_MOON })
    expect(missing.complete).toBe(false)
    expect(known.complete).toBe(true)
    expect(missing.raw).toBeGreaterThan(known.raw)
  })

  it('rates suburban skies below genuinely dark ones even when perfectly clear', () => {
    // Bortle 5 is where the Milky Way stops being an object you can photograph.
    // A clear, moonless suburban night must not rank alongside a rural one.
    const suburban = computeScore({ bortle: 5, cloudCover: 5, moon: NEW_MOON })
    const rural = computeScore({ bortle: 2, cloudCover: 5, moon: NEW_MOON })
    expect(suburban.rating).toBeLessThan(rural.rating)
    expect(suburban.limitingFactor?.key).toBe('darkness')
  })
})

describe('limitingFactorText, once rendered', () => {
  // The bug this locks was invisible in the source: the sentence names the factor
  // and the detail named it again, so the panel read "Held back by cloud cover --
  // Cloud cover 39%". Only the rendered string shows it, which is why this asserts
  // the whole sentence rather than the params.
  const render = (dict: MessageTree, locale: 'en' | 'id', cloudCover: number) => {
    const score = computeScore({ bortle: 2, cloudCover, moon: NEW_MOON })
    return translateText(dict, limitingFactorText(score)!, locale)
  }

  it('names the factor once', () => {
    expect(render(en as MessageTree, 'en', 39)).toBe('Held back by cloud cover — 39%')
    expect(render(id as MessageTree, 'id', 39)).toBe('Tertahan tutupan awan — 39%')
  })

  it('keeps the detail for factors whose value carries its own unit', () => {
    const score = computeScore({ bortle: 7, cloudCover: 0, moon: NEW_MOON })
    expect(translateText(en as MessageTree, limitingFactorText(score)!)).toBe(
      'Held back by light pollution — Bortle 7',
    )
  })
})

describe('cloudCoverForNight', () => {
  const point = (iso: string, cloudCover: number): ForecastPoint => ({
    time: new Date(iso),
    offsetMinutes: 420,
    cloudCover,
    temp: 25,
    humidity: 80,
    description: { en: '', id: '' },
    weatherCode: 0,
    isNight: false,
  })

  it('averages only the points inside the night window', () => {
    const window = {
      start: new Date('2026-08-05T12:00:00Z'), // 19:00 WIB
      end: new Date('2026-08-05T22:00:00Z'), // 05:00 WIB next day
    }
    const points = [
      point('2026-08-05T06:00:00Z', 0), // daytime, must be ignored
      point('2026-08-05T13:00:00Z', 40), // inside
      point('2026-08-05T19:00:00Z', 60), // inside
      point('2026-08-06T02:00:00Z', 100), // after dawn, must be ignored
    ]
    expect(cloudCoverForNight(points, window)).toBe(50)
  })

  it('includes points crossing midnight UTC', () => {
    const window = {
      start: new Date('2026-08-05T22:00:00Z'),
      end: new Date('2026-08-06T08:00:00Z'),
    }
    const points = [point('2026-08-05T23:00:00Z', 20), point('2026-08-06T03:00:00Z', 40)]
    expect(cloudCoverForNight(points, window)).toBe(30)
  })

  it('returns null when the forecast does not reach the window', () => {
    const window = {
      start: new Date('2026-08-20T12:00:00Z'),
      end: new Date('2026-08-20T22:00:00Z'),
    }
    expect(cloudCoverForNight([point('2026-08-05T13:00:00Z', 40)], window)).toBeNull()
  })

  it('returns null for an empty forecast', () => {
    const window = { start: new Date('2026-08-05T12:00:00Z'), end: new Date('2026-08-05T22:00:00Z') }
    expect(cloudCoverForNight([], window)).toBeNull()
  })
})

describe('scoreNight', () => {
  // 19:00-05:00 WIB. Points every three hours from 20:00, so the last slot is
  // clipped by dawn to 90 minutes.
  const window: NightWindow = {
    start: new Date('2026-08-05T12:00:00Z'),
    end: new Date('2026-08-05T22:00:00Z'),
  }
  const at = (iso: string, cloudCover: number): ForecastPoint => ({
    time: new Date(iso),
    offsetMinutes: 420,
    cloudCover,
    temp: 25,
    humidity: 80,
    description: { en: '', id: '' },
    weatherCode: 0,
    isNight: true,
  })
  const night = (clouds: number[], times = ['13', '16', '19', '22']) =>
    clouds.map((c, i) => at(`2026-08-05T${times[i]}:00:00Z`, c))
  const darkMoon = () => NEW_MOON

  it('rates the clear end of a night that clears late, not its average', () => {
    const score = scoreNight({
      bortle: 1,
      points: night([100, 100, 0, 0]),
      window,
      moon: NEW_MOON,
      moonFor: darkMoon,
    })
    const averaged = computeScore({ bortle: 1, cloudCover: 50, moon: NEW_MOON })
    expect(score.rating).toBe(5)
    expect(score.rating).toBeGreaterThan(averaged.rating)
    expect(score.stretch).toMatchObject({
      start: new Date('2026-08-05T17:30:00Z'),
      end: window.end,
      cloudCover: 0,
      wholeNight: false,
    })
  })

  it('scores a night that is good throughout exactly as the plain average', () => {
    const points = night([10, 0, 20, 0])
    const score = scoreNight({ bortle: 3, points, window, moon: NEW_MOON, moonFor: darkMoon })
    const averaged = computeScore({
      bortle: 3,
      cloudCover: cloudCoverForNight(points, window),
      moon: NEW_MOON,
    })
    expect(score.stretch?.wholeNight).toBe(true)
    expect(score.stretch?.start).toEqual(window.start)
    expect(score.raw).toBeCloseTo(averaged.raw)
  })

  it('prefers the clear stretch the moon has left over the one it lights', () => {
    // Full moon until it sets at 23:00 WIB (16:00Z).
    const moonFor = (w: NightWindow) =>
      w.start.getTime() < Date.parse('2026-08-05T16:00:00Z') ? FULL_MOON_ALL_NIGHT : NEW_MOON
    const score = scoreNight({
      bortle: 1,
      points: night([0, 0, 0, 0]),
      window,
      moon: { ...FULL_MOON_ALL_NIGHT, fractionAboveHorizon: 0.4 },
      moonFor,
    })
    expect(score.rating).toBe(5)
    expect(score.stretch?.start).toEqual(new Date('2026-08-05T17:30:00Z'))
  })

  it('never offers a clipped slot shorter than two hours on its own', () => {
    const score = scoreNight({
      bortle: 1,
      points: night([0, 100, 100, 100], ['12', '15', '18', '21']),
      window,
      moon: NEW_MOON,
      moonFor: darkMoon,
    })
    const { start, end } = score.stretch!
    expect(end.getTime() - start.getTime()).toBeGreaterThanOrEqual(2 * 3600_000)
  })

  it('keeps the whole night when a cloudier slot does not change the rating', () => {
    const score = scoreNight({
      bortle: 1,
      points: night([0, 5, 0, 0]),
      window,
      moon: NEW_MOON,
      moonFor: darkMoon,
    })
    expect(score.stretch?.wholeNight).toBe(true)
  })

  it('falls back to a provisional score with no stretch when the forecast is missing', () => {
    for (const points of [null, [at('2026-08-20T13:00:00Z', 0)]]) {
      const score = scoreNight({ bortle: 2, points, window, moon: NEW_MOON, moonFor: darkMoon })
      expect(score).toEqual(computeScore({ bortle: 2, cloudCover: null, moon: NEW_MOON }))
      expect(score.complete).toBe(false)
      expect(score.stretch).toBeNull()
    }
  })
})

describe('ratingTone', () => {
  it('marks 4 and 5 good, 3 neutral, 1 and 2 a warning', () => {
    expect([1, 2, 3, 4, 5].map((rating) => ratingTone({ rating, complete: true }))).toEqual([
      'warn',
      'warn',
      'neutral',
      'good',
      'good',
    ])
  })

  it('withholds "good" from a provisional score, which can still fall', () => {
    expect(ratingTone({ rating: 5, complete: false })).toBe('neutral')
    expect(ratingTone({ rating: 4, complete: false })).toBe('neutral')
  })

  it('keeps a provisional warning, since cloud can only lower it', () => {
    expect(ratingTone({ rating: 2, complete: false })).toBe('warn')
  })
})
