import { describe, it, expect } from 'vitest'
import { searchPlaces, normalise } from './search'
import { LANDMARKS } from './landmarks'
import type { Kecamatan } from '@/types'

const KECAMATAN: Kecamatan[] = [
  { adm3: '35.14.03', adm4: '35.14.03.2001', name: 'Tosari', kotkab: 'Kabupaten Pasuruan', lat: -7.9, lon: 112.93 },
  { adm3: '31.71.03', adm4: '31.71.03.1001', name: 'Kemayoran', kotkab: 'Kota Adm. Jakarta Pusat', lat: -6.16, lon: 106.85 },
  { adm3: '32.04.01', adm4: '32.04.01.2001', name: 'Cileunyi', kotkab: 'Kabupaten Bandung', lat: -6.93, lon: 107.7 },
  { adm3: '11.01.01', adm4: '11.01.01.2001', name: 'Bakongan', kotkab: 'Kabupaten Aceh Selatan', lat: 2.96, lon: 97.46 },
  // Deliberately shares a name with a landmark's region word.
  { adm3: '35.07.15', adm4: '35.07.15.2001', name: 'Sumbermanjing', kotkab: 'Kabupaten Malang', lat: -8.3, lon: 112.7 },
]

const find = (q: string, limit = 8) => searchPlaces(KECAMATAN, LANDMARKS, q, limit)

describe('normalise', () => {
  it('folds case', () => {
    expect(normalise('BROMO')).toBe(normalise('bromo'))
  })

  it('folds diacritics so accented input still matches', () => {
    expect(normalise('Café')).toBe('cafe')
  })

  it('collapses punctuation and repeated spacing', () => {
    expect(normalise('Rammang-Rammang')).toBe('rammang rammang')
    expect(normalise('  Gn.   Bromo ')).toBe('gn bromo')
  })
})

describe('searchPlaces', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(find('')).toEqual([])
    expect(find('   ')).toEqual([])
  })

  it('ignores a single character, which would match nearly everything', () => {
    expect(find('b')).toEqual([])
  })

  it('finds a landmark that is not a kecamatan name', () => {
    // The reason landmarks exist: the kecamatan at Bromo is called Tosari.
    const [top] = find('bromo')
    expect(top?.kind).toBe('landmark')
    expect(top?.name).toBe('Bromo')
  })

  it('still finds the kecamatan by its own name', () => {
    const [top] = find('tosari')
    expect(top?.kind).toBe('kecamatan')
    expect(top?.name).toBe('Tosari')
  })

  it('ranks an exact match above a merely prefixed one', () => {
    const results = find('toba')
    expect(results[0]!.name).toBe('Toba')
  })

  it('prefers a landmark over a kecamatan when both match equally well', () => {
    // Someone typing a mountain's name means the mountain, not a district that
    // happens to start with the same letters.
    const results = searchPlaces(
      [{ adm3: '00.00.00', adm4: '00.00.00.0001', name: 'Ijen', kotkab: 'Kabupaten Uji', lat: 0, lon: 0 }],
      LANDMARKS,
      'ijen',
      8,
    )
    expect(results[0]!.kind).toBe('landmark')
  })

  it('matches on a word that starts later in the name', () => {
    const results = find('penida')
    expect(results.some((r) => r.name === 'Nusa Penida')).toBe(true)
  })

  it('matches a kecamatan through its kabupaten', () => {
    const results = find('aceh selatan')
    expect(results.some((r) => r.name === 'Bakongan')).toBe(true)
  })

  it('is case and diacritic insensitive', () => {
    expect(find('BROMO')[0]?.name).toBe('Bromo')
    expect(find('  bRoMo  ')[0]?.name).toBe('Bromo')
  })

  it('honours the limit', () => {
    expect(find('a', 3).length).toBeLessThanOrEqual(3)
    expect(find('an', 3).length).toBeLessThanOrEqual(3)
  })

  it('carries coordinates so a result can be picked straight from the list', () => {
    const [top] = find('bromo')
    expect(top!.lat).toBeCloseTo(-7.94, 1)
    expect(top!.lon).toBeCloseTo(112.95, 1)
  })

  it('gives kecamatan results their kabupaten as secondary text', () => {
    const [top] = find('kemayoran')
    expect(top!.secondary).toBe('Kota Adm. Jakarta Pusat')
  })

  it('gives landmark results their region as secondary text', () => {
    const [top] = find('rinjani')
    expect(top!.secondary).toBe('Lombok')
  })

  it('returns no duplicates', () => {
    const ids = find('a', 20).map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('finds a hyphenated landmark typed without the hyphen', () => {
    expect(find('rammang rammang').some((r) => r.name === 'Rammang-Rammang')).toBe(true)
  })
})
