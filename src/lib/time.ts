/** Time formatting shared by the panel and the night bar. */

/** Renders "HH:MM" as read on a clock at the given UTC offset. */
export function formatAtOffset(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60000)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
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
