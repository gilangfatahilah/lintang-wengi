import { describe, it, expect } from 'vitest'
import { weatherIcon, KNOWN_WEATHER_CODES, OBSERVED_WEATHER_CODES } from './weather'
import { ICONS } from './icons'
import raw from './__fixtures__/bmkg-kemayoran.json'
import { parseForecast, type BmkgResponse } from './bmkg'

describe('weatherIcon', () => {
  it('gives every documented BMKG code a glyph that exists', () => {
    for (const code of KNOWN_WEATHER_CODES) {
      expect(ICONS[weatherIcon(code)], `code ${code}`).toBeTruthy()
    }
  })

  it('covers the codes BMKG documents', () => {
    expect(KNOWN_WEATHER_CODES.sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 10, 17, 45, 60, 61, 62, 63, 80, 95, 97,
    ])
  })

  it('separates clear, cloudy and wet conditions', () => {
    expect(weatherIcon(0)).toBe('sun')
    expect(weatherIcon(2)).toBe('sun-cloud')
    expect(weatherIcon(4)).toBe('overcast')
    expect(weatherIcon(63)).toBe('downpour')
    expect(weatherIcon(95)).toBe('storm')
  })

  it('gives 95 and 97 the same glyph, as BMKG gives them the same wording', () => {
    expect(weatherIcon(95)).toBe(weatherIcon(97))
  })

  /*
   * These eight came from 984 live forecast points, cross-checked against the icon
   * slug BMKG ships in each one. Where they contradict the published code table,
   * they win — the published table calls 10 "Asap", 61 "Hujan Sedang", and does not
   * list 17 at all.
   */
  it('follows the live API where it contradicts the published table', () => {
    expect(weatherIcon(10)).toBe('haze') // "udara kabur", not smoke
    expect(weatherIcon(17)).toBe('storm') // "hujan petir", undocumented
    expect(weatherIcon(45)).toBe('fog') // "kabut"
    expect(weatherIcon(61)).toBe('drizzle') // "hujan ringan", not moderate rain
  })

  it('resolves every code confirmed against the live API', () => {
    for (const code of OBSERVED_WEATHER_CODES) {
      expect(KNOWN_WEATHER_CODES, `code ${code}`).toContain(code)
    }
  })

  /*
   * BMKG can add codes without notice. A neutral cloud is a better failure than an
   * empty cell, and the wording beside it still comes from the response, so the row
   * stays truthful either way.
   */
  it('falls back to a neutral glyph for an unknown code', () => {
    expect(weatherIcon(99)).toBe('cloud')
    expect(weatherIcon(-1)).toBe('cloud')
    expect(weatherIcon(Number.NaN)).toBe('cloud')
  })
})

describe('condition text from a real response', () => {
  const points = parseForecast(raw as unknown as BmkgResponse).points

  /*
   * This is the bug that motivated keeping both strings: the payload has always
   * carried `weather_desc_en`, and dropping it left the condition column in
   * Indonesian while the rest of the UI was in English.
   */
  it('keeps BMKG wording in both languages', () => {
    const cerah = points.find((p) => p.description.id === 'Cerah')
    expect(cerah?.description.en).toBe('Sunny')

    const berawan = points.find((p) => p.description.id === 'Cerah Berawan')
    expect(berawan?.description.en).toBe('Partly Cloudy')
  })

  it('keeps the numeric code, which is what the glyph is keyed from', () => {
    expect(points.every((p) => Number.isFinite(p.weatherCode))).toBe(true)
    expect(new Set(points.map((p) => p.weatherCode))).toEqual(new Set([0, 1, 2, 3]))
  })

  it('resolves a glyph for every point in a real forecast', () => {
    for (const p of points) {
      expect(ICONS[weatherIcon(p.weatherCode)]).toBeTruthy()
    }
  })
})
