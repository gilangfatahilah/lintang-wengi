/** Time formatting shared by the panel and the night bar. */

import type { I18nText, Locale } from './i18n'

/** Renders "HH:MM" as read on a clock at the given UTC offset. */
export function formatAtOffset(date: Date, offsetMinutes: number): string {
  const shifted = shift(date, offsetMinutes)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Shifts an instant so its UTC fields read as wall-clock at the given offset.
 *
 * Every formatter below reads `getUTC*` off the result. Going through the host's
 * local-time getters instead would render a forecast for Papua in the viewer's
 * timezone, which is the mistake ForecastPoint exists to prevent.
 */
function shift(date: Date, offsetMinutes: number): Date {
  return new Date(date.getTime() + offsetMinutes * 60000)
}

/** Sortable "YYYY-MM-DD" for the calendar day an instant falls on at some offset. */
export function localDayKey(date: Date, offsetMinutes: number): string {
  return shift(date, offsetMinutes).toISOString().slice(0, 10)
}

/**
 * Renders "Wed, 5 Aug" / "Rab, 5 Agu" as read on a calendar at the given offset.
 *
 * `timeZone: 'UTC'` is load-bearing, not boilerplate: `shift()` has already moved
 * the instant so its UTC fields read as local wall clock. Letting Intl apply the
 * viewer's zone on top would shift it a second time.
 */
export function formatDayLabel(date: Date, offsetMinutes: number, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(shift(date, offsetMinutes))
}

/** Renders "5 Aug" -- the short form used where the weekday is already implied. */
export function formatShortDate(date: Date, offsetMinutes: number, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(shift(date, offsetMinutes))
}

/**
 * A span as a translatable phrase, dropping either part when it is zero.
 *
 * Returns keys rather than text because English inflects for number and Indonesian
 * does not; only the dictionaries know which form a language needs.
 */
export function durationText(ms: number): I18nText {
  const totalMinutes = Math.max(Math.round(ms / 60000), 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return { key: 'units.minutes', params: { count: minutes } }
  if (minutes === 0) return { key: 'units.hours', params: { count: hours } }
  return { key: 'units.hoursMinutes', params: { hours, minutes } }
}

/** Indonesian timezone abbreviation for an offset. */
export function timezoneLabel(offsetMinutes: number): string {
  return { 420: 'WIB', 480: 'WITA', 540: 'WIT' }[offsetMinutes] ?? `UTC+${offsetMinutes / 60}`
}

/**
 * Rough UTC offset for a longitude, clamped to Indonesia's three zones.
 *
 * Only used to label times before a forecast arrives -- the real zone boundaries are
 * political, not meridian-aligned, so once BMKG responds its offset takes over.
 */
export function approximateOffsetMinutes(lon: number): number {
  const hours = Math.min(Math.max(Math.round(lon / 15), 7), 9)
  return hours * 60
}
