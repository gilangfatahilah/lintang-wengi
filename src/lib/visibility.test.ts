import { describe, it, expect } from 'vitest'
import type { SkyObject } from '@/types'
import { nightWindow } from './astro'
import {
  visibilityDuring,
  rankVisible,
  groupByCategory,
  compassPoint,
  compassNameKey,
  USEFUL_ALTITUDE_DEG,
} from './visibility'
import { MILKY_WAY_CORE, SKY_CATALOG } from './skyCatalog'
import { Body } from 'astronomy-engine'

const BANDUNG = { lat: -6.9175, lon: 107.6191 }

// Declination +89°, so from 7° south of the equator it can never rise: the highest
// it ever gets is about -6°. The clearest test that "never visible" is not fudged.
const POLARIS: SkyObject = {
  id: 'polaris',
  name: { en: 'Polaris', id: 'Polaris' },
  category: 'star',
  target: { kind: 'fixed', ra: 2.5303, dec: 89.2641, magnitude: 1.98 },
}

// Declination -60°: from latitude -7° it culminates around 36°, so it clears the
// threshold for part of the night and not the rest. Nothing is both circumpolar and
// useful from Java -- circumpolar there means within 7° of the south pole, which
// never gets above 8°.
const ALPHA_CENTAURI: SkyObject = {
  id: 'alpha-centauri',
  name: { en: 'Alpha Centauri', id: 'Alfa Centauri' },
  category: 'star',
  target: { kind: 'fixed', ra: 14.66, dec: -60.8339, magnitude: -0.27 },
}

const JUPITER: SkyObject = {
  id: 'jupiter',
  name: { en: 'Jupiter', id: 'Jupiter' },
  category: 'planet',
  target: { kind: 'planet', body: Body.Jupiter },
}

/** August: the galactic core is well placed on Indonesian evenings. */
const AUGUST_NIGHT = new Date('2026-08-05T12:00:00Z')
/** December: the core is behind the sun and absent from the dark window. */
const DECEMBER_NIGHT = new Date('2026-12-15T12:00:00Z')

describe('visibilityDuring', () => {
  it('reports an object that never rises as never useful', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const v = visibilityDuring(POLARIS, BANDUNG, w)

    expect(v.maxAltitude).toBeLessThan(0)
    expect(v.fractionUseful).toBe(0)
    expect(v.from).toBeNull()
    expect(v.to).toBeNull()
  })

  it('reports the window edges for an object already up when it gets dark', () => {
    // A short window centred on the core's culmination, so it is above the threshold
    // at every sample. Reporting a sample instant here would put "from" six minutes
    // after dusk for an object that was plainly already up.
    const night = nightWindow(BANDUNG, AUGUST_NIGHT)
    const peak = visibilityDuring(MILKY_WAY_CORE, BANDUNG, night).maxAltitudeTime!
    const w = {
      start: new Date(peak.getTime() - 3600_000),
      end: new Date(peak.getTime() + 3600_000),
    }

    const v = visibilityDuring(MILKY_WAY_CORE, BANDUNG, w)
    expect(v.fractionUseful).toBe(1)
    expect(v.from!.getTime()).toBe(w.start.getTime())
    expect(v.to!.getTime()).toBe(w.end.getTime())
  })

  it('reports an interior end for an object that sinks away before dawn', () => {
    // Alpha Centauri is already up at dusk in August and drops below 20° partway
    // through: usable early, gone later. Reporting the dawn edge would send someone
    // out at 3 AM for a target that set at 1.
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const v = visibilityDuring(ALPHA_CENTAURI, BANDUNG, w)

    expect(v.from!.getTime()).toBe(w.start.getTime())
    expect(v.to!.getTime()).toBeLessThan(w.end.getTime())
  })

  it('reports an interior start for an object that climbs into view mid-night', () => {
    // The Pleiades rise around local midnight in August -- the opposite case, and
    // the one where a naive rise-time lookup would report dusk.
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const pleiades = SKY_CATALOG.find((o) => o.id === 'm45')!
    const v = visibilityDuring(pleiades, BANDUNG, w)

    expect(v.from!.getTime()).toBeGreaterThan(w.start.getTime())
    expect(v.fractionUseful).toBeGreaterThan(0)
  })

  it('never reports a from/to outside the dark window', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    for (const object of SKY_CATALOG) {
      const v = visibilityDuring(object, BANDUNG, w)
      if (!v.from) continue
      expect(v.from.getTime()).toBeGreaterThanOrEqual(w.start.getTime())
      expect(v.to!.getTime()).toBeLessThanOrEqual(w.end.getTime())
      expect(v.to!.getTime()).toBeGreaterThanOrEqual(v.from.getTime())
    }
  })

  it('peaks at an altitude actually reached during the window', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const v = visibilityDuring(MILKY_WAY_CORE, BANDUNG, w)

    expect(v.maxAltitudeTime!.getTime()).toBeGreaterThanOrEqual(w.start.getTime())
    expect(v.maxAltitudeTime!.getTime()).toBeLessThanOrEqual(w.end.getTime())
    // Declination -29° from latitude -7° culminates around 68°.
    expect(v.maxAltitude).toBeGreaterThan(50)
  })

  it('agrees with fractionUseful about whether the threshold was crossed', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    for (const object of SKY_CATALOG) {
      const v = visibilityDuring(object, BANDUNG, w)
      if (v.fractionUseful > 0) {
        expect(v.maxAltitude).toBeGreaterThanOrEqual(USEFUL_ALTITUDE_DEG)
        expect(v.from).not.toBeNull()
      } else {
        expect(v.from).toBeNull()
      }
    }
  })

  it('computes a planet magnitude rather than tabulating one', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const v = visibilityDuring(JUPITER, BANDUNG, w)

    // Jupiter never leaves roughly -2.9..-1.6 as seen from Earth.
    expect(v.magnitude).toBeLessThan(-1)
    expect(v.magnitude).toBeGreaterThan(-3.5)
  })

  it('carries a catalogued magnitude straight through for fixed objects', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    expect(visibilityDuring(ALPHA_CENTAURI, BANDUNG, w).magnitude).toBe(-0.27)
  })

  it('leaves magnitude null for an object that has none', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    expect(visibilityDuring(MILKY_WAY_CORE, BANDUNG, w).magnitude).toBeNull()
  })
})

describe('the galactic core through the year', () => {
  it('is high over Java on an August night', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const v = visibilityDuring(MILKY_WAY_CORE, BANDUNG, w)
    expect(v.fractionUseful).toBeGreaterThan(0.3)
  })

  it('is absent from the dark window in December', () => {
    // The core sits near the sun in December, so it is up only in daylight.
    const w = nightWindow(BANDUNG, DECEMBER_NIGHT)
    const v = visibilityDuring(MILKY_WAY_CORE, BANDUNG, w)
    expect(v.fractionUseful).toBe(0)
  })
})

describe('rankVisible', () => {
  it('drops everything that never clears the useful altitude', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const ranked = rankVisible([...SKY_CATALOG, POLARIS], BANDUNG, w)
    expect(ranked.map((r) => r.object.id)).not.toContain('polaris')
  })

  it('orders by peak altitude, highest first', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    const altitudes = rankVisible(SKY_CATALOG, BANDUNG, w).map((r) => r.visibility.maxAltitude)
    const sorted = [...altitudes].sort((a, b) => b - a)
    expect(altitudes).toEqual(sorted)
  })

  it('finds a usable number of targets on a real Indonesian night', () => {
    const w = nightWindow(BANDUNG, AUGUST_NIGHT)
    expect(rankVisible(SKY_CATALOG, BANDUNG, w).length).toBeGreaterThan(8)
  })
})

describe('compass', () => {
  it('names the cardinal points in Indonesian', () => {
    expect(compassPoint(0)).toBe('n')
    expect(compassPoint(90)).toBe('e')
    expect(compassPoint(180)).toBe('s')
    expect(compassPoint(270)).toBe('w')
  })

  it('wraps past north', () => {
    expect(compassPoint(359)).toBe('n')
    expect(compassPoint(-90)).toBe('w')
  })

  it('spells the intercardinals out for prose', () => {
    expect(compassNameKey(135)).toBe('compass.long.se')
    expect(compassNameKey(225)).toBe('compass.long.sw')
  })
})

describe('the catalogue itself', () => {
  it('has no duplicate ids', () => {
    const ids = SKY_CATALOG.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every fixed coordinate in range', () => {
    for (const o of SKY_CATALOG) {
      if (o.target.kind !== 'fixed') continue
      expect(o.target.ra, o.id).toBeGreaterThanOrEqual(0)
      expect(o.target.ra, o.id).toBeLessThan(24)
      expect(Math.abs(o.target.dec), o.id).toBeLessThanOrEqual(90)
    }
  })
})

describe('groupByCategory', () => {
  const w = nightWindow(BANDUNG, AUGUST_NIGHT)
  const groups = groupByCategory(rankVisible(SKY_CATALOG, BANDUNG, w))

  it('puts the galactic core first when it is up', () => {
    expect(groups[0]!.category).toBe('core')
  })

  it('drops empty categories rather than showing bare headings', () => {
    for (const g of groups) expect(g.entries.length).toBeGreaterThan(0)
  })

  it('keeps the altitude ranking within each group', () => {
    for (const g of groups) {
      const alts = g.entries.map((e) => e.visibility.maxAltitude)
      expect(alts).toEqual([...alts].sort((a, b) => b - a))
    }
  })

  it('accounts for every ranked object exactly once', () => {
    const ranked = rankVisible(SKY_CATALOG, BANDUNG, w)
    const grouped = groups.flatMap((g) => g.entries.map((e) => e.object.id))
    expect(grouped.sort()).toEqual(ranked.map((e) => e.object.id).sort())
  })
})
