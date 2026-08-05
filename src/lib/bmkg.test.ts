import { describe, it, expect } from 'vitest'
import { parseForecast, formatLocalTime, type BmkgResponse } from './bmkg'
import fixture from './__fixtures__/bmkg-kemayoran.json'

// A real response captured from the live API for Kemayoran (31.71.03.1001).
// Using the genuine payload rather than a hand-written mock is the point: the
// nested `cuaca` day arrays and the partial first day are easy to get wrong.
const raw = fixture as unknown as BmkgResponse

describe('parseForecast', () => {
  const forecast = parseForecast(raw)

  it('flattens the nested per-day arrays into a single series', () => {
    const nestedTotal = raw.data[0]!.cuaca.reduce((n, day) => n + day.length, 0)
    expect(forecast.points).toHaveLength(nestedTotal)
    expect(forecast.points.length).toBeGreaterThan(0)
  })

  it('does not assume 8 points per day -- the first day is partial', () => {
    // The API starts at the current 3-hour slot, so day one is short. A parser
    // that assumed 3 days x 8 slots would read past the end.
    expect(raw.data[0]!.cuaca[0]!.length).toBeLessThan(8)
  })

  it('reads cloud cover from tcc', () => {
    expect(forecast.points[0]!.cloudCover).toBe(raw.data[0]!.cuaca[0]![0]!.tcc)
  })

  it('treats utc_datetime as the authoritative instant', () => {
    const first = raw.data[0]!.cuaca[0]![0]!
    expect(forecast.points[0]!.time.toISOString()).toBe(
      new Date(first.utc_datetime.replace(' ', 'T') + 'Z').toISOString(),
    )
  })

  it('derives the location offset from the local/utc pair', () => {
    // Kemayoran is WIB, UTC+7
    expect(forecast.points[0]!.offsetMinutes).toBe(420)
  })

  it('returns points in ascending chronological order', () => {
    const times = forecast.points.map((p) => p.time.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('extracts location metadata', () => {
    expect(forecast.location.adm4).toBe('31.71.03.1001')
    expect(forecast.location.desa).toBe('Kemayoran')
    expect(forecast.location.provinsi).toBe('DKI Jakarta')
    expect(forecast.location.lat).toBeCloseTo(-6.16, 1)
  })

  it('throws a readable error when the response has no forecast data', () => {
    expect(() => parseForecast({ lokasi: {}, data: [] } as unknown as BmkgResponse)).toThrow(
      /tidak tersedia/i,
    )
  })
})

describe('formatLocalTime', () => {
  it('renders wall-clock time at the location, not in the viewer timezone', () => {
    // 07:00 UTC at +7 is 14:00 local, regardless of where this test runs.
    const point = {
      time: new Date('2026-08-05T07:00:00Z'),
      offsetMinutes: 420,
      cloudCover: 0,
      temp: 0,
      humidity: 0,
      description: '',
    }
    expect(formatLocalTime(point)).toBe('14:00')
  })

  it('handles a point that rolls into the next day at WIT', () => {
    // 17:00 UTC at +9 is 02:00 the following day.
    const point = {
      time: new Date('2026-08-05T17:00:00Z'),
      offsetMinutes: 540,
      cloudCover: 0,
      temp: 0,
      humidity: 0,
      description: '',
    }
    expect(formatLocalTime(point)).toBe('02:00')
  })
})
