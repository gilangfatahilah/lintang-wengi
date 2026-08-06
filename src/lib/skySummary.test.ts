import { describe, it, expect } from 'vitest'
import type { MoonConditions, VisibleObject } from '@/types'
import { nightWindow } from './astro'
import { milkyWayNight } from './milkyWay'
import { rankVisible } from './visibility'
import { SKY_CATALOG } from './skyCatalog'
import { translateText, type MessageTree } from './i18n'
import { en } from '@/locales/en'
import { id } from '@/locales/id'
import { skySummary, type SkySummaryInput } from './skySummary'

const BANDUNG = { lat: -6.9175, lon: 107.6191 }
const WIB = 420
const AUGUST = new Date('2026-08-05T12:00:00Z')
const DECEMBER = new Date('2026-12-15T12:00:00Z')

const NO_MOON: MoonConditions = {
  illumination: 0.02,
  fractionAboveHorizon: 0,
  rise: null,
  set: null,
  phaseKey: 'new',
}

const FULL_MOON: MoonConditions = {
  illumination: 0.99,
  fractionAboveHorizon: 1,
  rise: null,
  set: null,
  phaseKey: 'full',
}

function inputFor(reference: Date, moon: MoonConditions, cloudCover: number | null = null) {
  const window = nightWindow(BANDUNG, reference)
  const objects = rankVisible(SKY_CATALOG, BANDUNG, window)
  return {
    window,
    moon,
    cloudCover,
    milkyWay: milkyWayNight(BANDUNG, window, moon),
    objects,
    offsetMinutes: WIB,
  } satisfies SkySummaryInput
}

const keysOf = (input: SkySummaryInput) => skySummary(input).map((line) => line.key)

describe('skySummary', () => {
  it('opens with the dark window and its length', () => {
    const [first] = skySummary(inputFor(AUGUST, NO_MOON))
    expect(first!.key).toBe('summary.darkSpan')
    expect(first!.params!.tz).toBe('WIB')
    // The duration is a nested phrase, so the sentence stays translatable whole.
    expect(first!.params!.duration).toMatchObject({ key: expect.stringMatching(/^units\./) })
  })

  it('says a moon below the horizon costs nothing', () => {
    expect(keysOf(inputFor(AUGUST, NO_MOON))).toContain('summary.moonDown')
  })

  it('warns when moonlight dominates the night', () => {
    const moonLine = skySummary(inputFor(AUGUST, FULL_MOON)).find((l) =>
      l.key.startsWith('summary.moon'),
    )
    expect(moonLine!.key).toBe('summary.moonDominates')
    expect(moonLine!.params!.phase).toMatchObject({ key: 'moon.phase.full' })
  })

  it('leads with the galactic core when it is up', () => {
    expect(keysOf(inputFor(AUGUST, NO_MOON))).toContain('summary.coreWindow')
  })

  it('falls back to the best-placed object when the core is absent', () => {
    // December: the core never enters the dark window, so the summary must still
    // name something worth pointing at rather than going quiet.
    const input = inputFor(DECEMBER, NO_MOON)
    expect(input.milkyWay.visibility.fractionUseful).toBe(0)

    const keys = keysOf(input)
    expect(keys).not.toContain('summary.coreWindow')
    expect(keys).toContain('summary.bestObject')
  })

  it('omits the weather sentence entirely when the forecast failed', () => {
    expect(keysOf(inputFor(AUGUST, NO_MOON, null)).some((k) => k.startsWith('summary.cloud'))).toBe(
      false,
    )
  })

  it('states cloud cover when the forecast is present', () => {
    const cloud = skySummary(inputFor(AUGUST, NO_MOON, 42)).find((l) =>
      l.key.startsWith('summary.cloud'),
    )
    expect(cloud).toBeDefined()
    expect(cloud!.params!.percent).toBe(42)
  })

  it('phrases a heavy cloud deck differently from a clear one', () => {
    const heavy = keysOf(inputFor(AUGUST, NO_MOON, 95)).find((k) => k.startsWith('summary.cloud'))
    const light = keysOf(inputFor(AUGUST, NO_MOON, 10)).find((k) => k.startsWith('summary.cloud'))
    expect(heavy).toBe('summary.cloudHeavy')
    expect(light).toBe('summary.cloudLight')
  })

  it('says nothing about objects when none are visible', () => {
    // A location and window with an empty catalogue result must not invent one.
    const input: SkySummaryInput = {
      ...inputFor(AUGUST, NO_MOON),
      objects: [] as VisibleObject[],
      milkyWay: null,
    }
    const keys = keysOf(input)
    expect(keys).not.toContain('summary.bestObject')
    expect(keys).toContain('summary.darkSpan')
  })

  it('renders in both languages with no key left unresolved', () => {
    // The guarantee the key-based assertions above cannot give: every sentence the
    // summary can produce actually exists in both dictionaries. A missing key would
    // surface here as the key itself leaking into the output.
    for (const [locale, dict] of [
      ['en', en],
      ['id', id],
    ] as const) {
      for (const moon of [NO_MOON, FULL_MOON]) {
        for (const clouds of [null, 10, 95]) {
          for (const line of skySummary(inputFor(AUGUST, moon, clouds))) {
            const rendered = translateText(dict as unknown as MessageTree, line, locale)
            expect(rendered, `${locale}: ${line.key}`).not.toBe(line.key)
            expect(rendered).not.toMatch(/\{\w+\}/) // no placeholder left behind
            expect(rendered.trim().length).toBeGreaterThan(0)
          }
        }
      }
    }
  })
})
