import { describe, it, expect } from 'vitest'
import { ICONS, LANDMARK_ICONS, CATEGORY_ICONS, FACTOR_ICONS, type IconName } from './icons'
import { LANDMARKS } from './landmarks'

/*
 * Exhaustiveness of the three mapping tables is already a compile error, since each
 * is typed as a full Record over its union. What the type system cannot check is
 * that the markup is actually drawable, which is what these cover.
 */
describe('ICONS', () => {
  const entries = Object.entries(ICONS) as [IconName, string][]

  it('has markup for every declared name', () => {
    for (const [name, markup] of entries) {
      expect(markup.trim(), name).not.toBe('')
    }
  })

  it('draws only shapes, never a nested svg or a script', () => {
    for (const [name, markup] of entries) {
      expect(markup, name).toMatch(/^<(circle|rect|path|ellipse|g)\b/)
      expect(markup.toLowerCase(), name).not.toContain('<script')
      expect(markup.toLowerCase(), name).not.toContain('<svg')
      // An external reference would break the strict-CSP case and stop being
      // themeable by currentColor.
      expect(markup.toLowerCase(), name).not.toContain('http')
    }
  })

  it('never hardcodes a colour, so field mode can recolour everything', () => {
    for (const [name, markup] of entries) {
      expect(markup, name).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(markup, name).not.toMatch(/\b(?:rgb|hsl)a?\(/i)
      // `fill`/`stroke` may only ever be `none` or `currentColor`.
      for (const [, value] of markup.matchAll(/(?:fill|stroke)="([^"]*)"/g)) {
        expect(['none', 'currentColor'], `${name}: ${value}`).toContain(value)
      }
    }
  })

  it('has balanced tags', () => {
    for (const [name, markup] of entries) {
      const opened = (markup.match(/<g\b/g) ?? []).length
      const closed = (markup.match(/<\/g>/g) ?? []).length
      expect(closed, name).toBe(opened)
    }
  })
})

describe('mapping tables', () => {
  it('gives every landmark kind in use a glyph', () => {
    for (const landmark of LANDMARKS) {
      expect(ICONS[LANDMARK_ICONS[landmark.kind]], landmark.id).toBeTruthy()
    }
  })

  it('resolves every sky category and limiting factor', () => {
    for (const name of [...Object.values(CATEGORY_ICONS), ...Object.values(FACTOR_ICONS)]) {
      expect(ICONS[name], name).toBeTruthy()
    }
  })

  /*
   * A volcano that looked like a mountain would be worse than no icon: the list is
   * meant to be told apart at a glance, and two identical glyphs quietly assert the
   * places are the same kind of thing.
   */
  it('does not give two landmark kinds the same glyph', () => {
    const used = Object.values(LANDMARK_ICONS)
    expect(new Set(used).size).toBe(used.length)
  })
})
