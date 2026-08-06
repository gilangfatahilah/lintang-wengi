import { describe, it, expect } from 'vitest'
import { translate, resolveInitialLocale, type MessageTree } from './i18n'

const dict: MessageTree = {
  app: { title: 'Lintang Wengi' },
  score: {
    limiting: 'Held back by {reason} — {detail}',
    hours_one: '{count} hour',
    hours_other: '{count} hours',
  },
}

describe('translate', () => {
  it('resolves a dotted path', () => {
    expect(translate(dict, 'app.title')).toBe('Lintang Wengi')
  })

  it('interpolates every named parameter', () => {
    expect(translate(dict, 'score.limiting', { reason: 'cloud cover', detail: '88%' })).toBe(
      'Held back by cloud cover — 88%',
    )
  })

  it('interpolates a parameter used more than once', () => {
    const d: MessageTree = { echo: '{x} and {x}' }
    expect(translate(d, 'echo', { x: 'a' })).toBe('a and a')
  })

  it('returns the key itself when the path is missing', () => {
    // Loud but harmless: a missing string shows up in the UI as "some.key" rather
    // than as an empty space that nobody notices.
    expect(translate(dict, 'nope.missing')).toBe('nope.missing')
  })

  it('returns the key when the path resolves to a subtree rather than a string', () => {
    expect(translate(dict, 'app')).toBe('app')
  })

  it('leaves an unknown placeholder untouched rather than printing undefined', () => {
    expect(translate(dict, 'score.limiting', { reason: 'moonlight' })).toBe(
      'Held back by moonlight — {detail}',
    )
  })

  it('accepts numbers as parameters', () => {
    const d: MessageTree = { alt: 'reaches {deg}°' }
    expect(translate(d, 'alt', { deg: 34 })).toBe('reaches 34°')
  })

  describe('pluralisation', () => {
    it('picks the singular form when count is 1', () => {
      expect(translate(dict, 'score.hours', { count: 1 })).toBe('1 hour')
    })

    it('picks the plural form otherwise', () => {
      expect(translate(dict, 'score.hours', { count: 3 })).toBe('3 hours')
      expect(translate(dict, 'score.hours', { count: 0 })).toBe('0 hours')
    })

    it('falls back to the base key when a language has no plural variants', () => {
      // Indonesian does not inflect for number, so id.ts defines the plain key.
      const id: MessageTree = { score: { hours: '{count} jam' } }
      expect(translate(id, 'score.hours', { count: 5 })).toBe('5 jam')
    })
  })
})

describe('resolveInitialLocale', () => {
  it('honours a stored preference above everything else', () => {
    expect(resolveInitialLocale('id', ['en-US'])).toBe('id')
    expect(resolveInitialLocale('en', ['id-ID'])).toBe('en')
  })

  it('ignores a stored value that is not a supported locale', () => {
    expect(resolveInitialLocale('fr', ['en-US'])).toBe('en')
  })

  it('uses Indonesian when the browser asks for it', () => {
    expect(resolveInitialLocale(null, ['id-ID', 'en-US'])).toBe('id')
    expect(resolveInitialLocale(null, ['id'])).toBe('id')
  })

  it('defaults to English for any other browser language', () => {
    expect(resolveInitialLocale(null, ['en-GB'])).toBe('en')
    expect(resolveInitialLocale(null, ['ja-JP'])).toBe('en')
  })

  it('defaults to English when the browser reports nothing', () => {
    expect(resolveInitialLocale(null, [])).toBe('en')
  })

  it('reads the first matching language, not a later one', () => {
    // A user whose first choice is English gets English even if Indonesian follows.
    expect(resolveInitialLocale(null, ['en-US', 'id-ID'])).toBe('en')
  })

  it('is not fooled by a language merely containing "id"', () => {
    // "yi" (Yiddish) and similar must not match; only the id subtag counts.
    expect(resolveInitialLocale(null, ['yi'])).toBe('en')
    expect(resolveInitialLocale(null, ['hid'])).toBe('en')
  })
})
