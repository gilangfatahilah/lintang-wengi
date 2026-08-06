import { describe, it, expect } from 'vitest'
import * as A from 'astronomy-engine'
import { moonCalendar, bestDarkRun, nextNewMoon } from './moonCalendar'
import { moonInterference } from './scoring'
import { moonConditions, nightWindow } from './astro'

const BANDUNG = { lat: -6.9175, lon: 107.6191 }
const START = new Date('2026-08-05T12:00:00Z')

describe('moonCalendar', () => {
  const nights = moonCalendar(BANDUNG, START, 30)

  it('returns one entry per requested night', () => {
    expect(nights.length).toBe(30)
  })

  it('advances exactly one night at a time, never repeating a window', () => {
    for (let i = 1; i < nights.length; i++) {
      const prev = nights[i - 1]!.window
      const next = nights[i]!.window
      expect(next.start.getTime()).toBeGreaterThan(prev.end.getTime())
      const gapHours = (next.start.getTime() - prev.end.getTime()) / 3600_000
      expect(gapHours).toBeLessThan(20)
    }
  })

  it('covers at least one full lunar cycle', () => {
    // Thirty nights must contain both a near-new and a near-full moon.
    const illuminations = nights.map((n) => n.illumination)
    expect(Math.min(...illuminations)).toBeLessThan(0.1)
    expect(Math.max(...illuminations)).toBeGreaterThan(0.9)
  })

  it('scores interference with the same rule the nightly score uses', () => {
    // The whole reason moonInterference was extracted. If the calendar grew its own
    // copy of the rule, the two views would eventually disagree about one night.
    const night = nights[0]!
    const full = moonConditions(BANDUNG, night.window)
    expect(night.interference).toBeCloseTo(moonInterference(full), 1)
  })

  it('calls a night with a bright moon up all night not dark', () => {
    const full = A.SearchMoonPhase(180, START, 40)!
    const fullNight = nights.find(
      (n) => Math.abs(n.window.start.getTime() - full.date.getTime()) < 12 * 3600_000,
    )
    expect(fullNight).toBeDefined()
    expect(fullNight!.dark).toBe(false)
  })

  it('calls the nights around a new moon dark', () => {
    const newMoon = A.SearchMoonPhase(0, START, 40)!
    const newNight = nights.find(
      (n) => Math.abs(n.window.start.getTime() - newMoon.date.getTime()) < 24 * 3600_000,
    )
    expect(newNight).toBeDefined()
    expect(newNight!.dark).toBe(true)
  })

  it('discounts a moon that is only up for part of the night', () => {
    // The rule the module exists for. A crescent sets in the early evening, so most
    // of the night is unaffected and its cost must come out well below its
    // illumination. A full moon is up end to end and pays the whole price.
    const crescent = nights.find((n) => n.illumination > 0.2 && n.illumination < 0.35)!
    const full = nights.find((n) => n.illumination > 0.98)!

    expect(crescent.interference).toBeLessThan(crescent.illumination * 0.6)
    expect(full.interference).toBeCloseTo(full.illumination, 1)
  })

  it('separates two nights of equal illumination by when the moon is up', () => {
    // Waxing and waning halves of the cycle reach the same illumination but sit on
    // opposite sides of the night. Judging by phase alone would call them identical.
    const similar = (target: number) =>
      nights.filter((n) => Math.abs(n.illumination - target) < 0.04)
    const pair = [0.1, 0.15, 0.2, 0.3].map(similar).find((group) => group.length >= 2)!

    expect(pair).toBeDefined()
    const fractions = pair.map((n) => n.interference / Math.max(n.illumination, 1e-9))
    expect(Math.max(...fractions)).toBeGreaterThan(Math.min(...fractions))
  })

  it('starts from the night containing the reference instant', () => {
    expect(nights[0]!.window.start.getTime()).toBe(nightWindow(BANDUNG, START).start.getTime())
  })
})

describe('bestDarkRun', () => {
  it('finds the longest unbroken stretch, not the first one', () => {
    const night = (dark: boolean) => ({
      window: { start: new Date(0), end: new Date(0) },
      illumination: 0,
      phaseKey: 'new' as const,
      interference: 0,
      dark,
    })
    const run = bestDarkRun([
      night(true),
      night(false),
      night(true),
      night(true),
      night(true),
      night(false),
    ])
    expect(run!.length).toBe(3)
  })

  it('returns null when nothing is dark', () => {
    const night = {
      window: { start: new Date(0), end: new Date(0) },
      illumination: 1,
      phaseKey: 'new' as const,
      interference: 1,
      dark: false,
    }
    expect(bestDarkRun([night, night])).toBeNull()
  })

  it('finds a real dark run in a real month', () => {
    const run = bestDarkRun(moonCalendar(BANDUNG, START, 30))
    // Every lunar month has a usable stretch around new moon.
    expect(run!.length).toBeGreaterThan(3)
  })
})

describe('nextNewMoon', () => {
  it('lands within the next lunar month', () => {
    const next = nextNewMoon(START)!
    const days = (next.getTime() - START.getTime()) / 86400_000
    expect(days).toBeGreaterThanOrEqual(0)
    expect(days).toBeLessThan(30)
  })

  it('agrees with the illumination it predicts', () => {
    const next = nextNewMoon(START)!
    expect(A.Illumination(A.Body.Moon, next).phase_fraction).toBeLessThan(0.01)
  })
})
