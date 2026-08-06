import type { Forecast, ForecastPoint } from '@/types'
import type { Locale } from './i18n'
import { formatAtOffset, formatDayLabel, localDayKey } from './time'

/** The subset of the BMKG response we rely on. */
export interface BmkgResponse {
  lokasi: Record<string, unknown>
  data: Array<{
    lokasi: {
      adm4: string
      desa: string
      kecamatan: string
      kotkab: string
      provinsi: string
      lat: number
      lon: number
      timezone: string
    }
    /** Nested one array per forecast day, NOT a flat list. */
    cuaca: Array<
      Array<{
        utc_datetime: string
        local_datetime: string
        tcc: number
        t: number
        hu: number
        weather_desc: string
      }>
    >
  }>
}

/** "2026-08-05 07:00:00" -> Date, read as UTC. */
function parseUtc(s: string): Date {
  return new Date(`${s.replace(' ', 'T')}Z`)
}

/**
 * BMKG gives wall-clock local time with no offset attached, alongside the UTC
 * instant. The difference between them is the location's offset, which is more
 * reliable than parsing the `timezone` field (observed as both "Asia/Jakarta" and
 * "+0700" in different parts of the same payload).
 */
function offsetMinutesOf(localDatetime: string, utcDatetime: string): number {
  const local = parseUtc(localDatetime).getTime() // read as UTC on purpose
  const utc = parseUtc(utcDatetime).getTime()
  return Math.round((local - utc) / 60000)
}

export function parseForecast(raw: BmkgResponse): Forecast {
  const entry = raw.data?.[0]
  if (!entry?.cuaca?.length) {
    throw new Error('errors.forecastEmpty')
  }

  const points: ForecastPoint[] = entry.cuaca.flat().map((p) => ({
    time: parseUtc(p.utc_datetime),
    offsetMinutes: offsetMinutesOf(p.local_datetime, p.utc_datetime),
    cloudCover: p.tcc,
    temp: p.t,
    humidity: p.hu,
    description: p.weather_desc,
  }))

  points.sort((a, b) => a.time.getTime() - b.time.getTime())

  const l = entry.lokasi
  return {
    location: {
      adm4: l.adm4,
      desa: l.desa,
      kecamatan: l.kecamatan,
      kotkab: l.kotkab,
      provinsi: l.provinsi,
      lat: l.lat,
      lon: l.lon,
      timezone: l.timezone,
    },
    points,
  }
}

/** Renders "HH:MM" as it reads on a clock at the forecast location. */
export function formatLocalTime(point: ForecastPoint): string {
  return formatAtOffset(point.time, point.offsetMinutes)
}

export interface ForecastDay {
  /** Sortable "YYYY-MM-DD" at the forecast location. */
  key: string
  /** "Rab, 5 Agu" */
  label: string
  points: ForecastPoint[]
}

/**
 * Splits the flat forecast into calendar days *at the forecast location*.
 *
 * The grouping has to use each point's own offset, not the viewer's: a Papuan
 * forecast read from Jakarta would otherwise have its late-evening points pushed
 * into the previous day, and the first day is already partial without help. Days
 * come back in chronological order; the first is normally short, because BMKG
 * publishes from the current 3-hour slot rather than from midnight.
 */
export function groupByLocalDay(
  points: readonly ForecastPoint[],
  locale: Locale = 'en',
): ForecastDay[] {
  const days = new Map<string, ForecastDay>()
  for (const p of points) {
    const key = localDayKey(p.time, p.offsetMinutes)
    let day = days.get(key)
    if (!day) {
      day = { key, label: formatDayLabel(p.time, p.offsetMinutes, locale), points: [] }
      days.set(key, day)
    }
    day.points.push(p)
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * Fetches a forecast through our proxy. BMKG sends no usable CORS headers, so the
 * browser can never call it directly -- see functions/api/forecast.ts (production)
 * and the dev proxy in vite.config.ts, which share this path.
 */
export async function fetchForecast(adm4: string, signal?: AbortSignal): Promise<Forecast> {
  const res = await fetch(`/api/forecast?adm4=${encodeURIComponent(adm4)}`, { signal })
  if (!res.ok) {
    throw new Error('errors.forecastFetch')
  }
  return parseForecast((await res.json()) as BmkgResponse)
}
