import { describe, it, expect } from 'vitest'
import { parseForecast, formatLocalTime, groupByLocalDay, type BmkgResponse } from './bmkg'
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
    // The message is a key; the UI translates it. translate() passes any string
    // through unchanged, so this stays safe even for non-key messages.
    expect(() => parseForecast({ lokasi: {}, data: [] } as unknown as BmkgResponse)).toThrow(
      'errors.forecastEmpty',
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
      description: { en: '', id: '' },
      weatherCode: 0,
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
      description: { en: '', id: '' },
      weatherCode: 0,
    }
    expect(formatLocalTime(point)).toBe('02:00')
  })
})

describe('groupByLocalDay', () => {
  const days = groupByLocalDay(parseForecast(raw).points)

  it('splits the real response into three calendar days', () => {
    expect(days.length).toBe(3)
  })

  it('returns days in chronological order', () => {
    const keys = days.map((d) => d.key)
    expect(keys).toEqual([...keys].sort())
  })

  it('loses no points', () => {
    const total = days.reduce((n, d) => n + d.points.length, 0)
    expect(total).toBe(parseForecast(raw).points.length)
  })

  it('keeps each day a single calendar date at the forecast location', () => {
    for (const day of days) {
      for (const p of day.points) {
        const local = new Date(p.time.getTime() + p.offsetMinutes * 60000)
        expect(local.toISOString().slice(0, 10)).toBe(day.key)
      }
    }
  })

  it('groups by the location clock, not the viewer clock', () => {
    // 17:00 UTC is 02:00 the next day in WIT. Grouping on the UTC date -- or on the
    // machine's local date -- would file it under the previous day.
    const point = (utc: string) => ({
      time: new Date(utc),
      offsetMinutes: 540,
      cloudCover: 0,
      temp: 0,
      humidity: 0,
      description: { en: '', id: '' },
      weatherCode: 0,
    })
    const grouped = groupByLocalDay([point('2026-08-05T17:00:00Z'), point('2026-08-05T20:00:00Z')])

    expect(grouped.length).toBe(1)
    expect(grouped[0]!.key).toBe('2026-08-06')
  })

  it('labels days in the requested language', () => {
    // 2026-08-05 is a Wednesday.
    const grouped = groupByLocalDay([
      {
        time: new Date('2026-08-05T07:00:00Z'),
        offsetMinutes: 420,
        cloudCover: 0,
        temp: 0,
        humidity: 0,
        description: { en: '', id: '' },
        weatherCode: 0,
      },
    ])
    // Each language keeps its own conventional order -- month-first in English,
    // day-first in Indonesian -- which is why this goes through Intl rather than a
    // hand-maintained month table.
    expect(grouped[0]!.label).toBe('Wed, Aug 5')
    expect(groupByLocalDay(grouped[0]!.points, 'id')[0]!.label).toBe('Rab, 5 Agu')
  })
})
