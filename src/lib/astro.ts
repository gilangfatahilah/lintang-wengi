import * as A from 'astronomy-engine'
import type { LatLng, MoonConditions, NightWindow } from '@/types'

/**
 * Sun altitude defining astronomical darkness. Above this the sky still carries
 * enough scattered sunlight to wash out faint detail, so it is the threshold that
 * matters for astrophotography rather than plain sunset.
 */
const ASTRONOMICAL_TWILIGHT_DEG = -18

/** Altitude samples across the night when measuring moon presence. ~20 min apart. */
const MOON_SAMPLES = 32

const DIRECTION_SET = -1
const DIRECTION_RISE = +1

function observerAt(loc: LatLng): A.Observer {
  return new A.Observer(loc.lat, loc.lon, 0)
}

function altitudeOf(body: A.Body, at: Date, observer: A.Observer): number {
  const eq = A.Equator(body, at, observer, true, true)
  return A.Horizon(at, observer, eq.ra, eq.dec, 'normal').altitude
}

/**
 * The span of astronomical darkness relevant to `reference`.
 *
 * If `reference` falls inside a night already underway, that night is returned --
 * someone checking conditions at 2 AM means the night they are standing in, not
 * the following one. Otherwise the next upcoming night is returned.
 *
 * The window always crosses midnight, so `end` lands on the next calendar day.
 */
export function nightWindow(loc: LatLng, reference: Date = new Date()): NightWindow {
  const observer = observerAt(loc)

  const findWindow = (from: Date): NightWindow | null => {
    const dusk = A.SearchAltitude(
      A.Body.Sun,
      observer,
      DIRECTION_SET,
      from,
      2,
      ASTRONOMICAL_TWILIGHT_DEG,
    )
    if (!dusk) return null
    const dawn = A.SearchAltitude(
      A.Body.Sun,
      observer,
      DIRECTION_RISE,
      dusk.date,
      2,
      ASTRONOMICAL_TWILIGHT_DEG,
    )
    if (!dawn) return null
    return { start: dusk.date, end: dawn.date }
  }

  // Look back half a day first, so a night already in progress is picked up.
  const lookback = new Date(reference.getTime() - 12 * 3600_000)
  const candidate = findWindow(lookback)
  if (candidate && candidate.end.getTime() > reference.getTime()) return candidate

  const next = findWindow(reference)
  if (next) return next

  // No -18° crossing within the search span. Cannot occur at Indonesian latitudes,
  // but degrade to the sunset..sunrise span rather than failing the whole panel.
  const sunset = A.SearchRiseSet(A.Body.Sun, observer, DIRECTION_SET, lookback, 2)
  const sunrise = sunset && A.SearchRiseSet(A.Body.Sun, observer, DIRECTION_RISE, sunset.date, 2)
  if (sunset && sunrise) return { start: sunset.date, end: sunrise.date }

  throw new Error('Tidak dapat menghitung jendela malam untuk lokasi ini.')
}

/**
 * How much the moon interferes with the given night.
 *
 * `fractionAboveHorizon` is sampled rather than derived from rise/set times: a
 * window can contain zero, one, or two such events, and sampling handles every
 * case identically. Paired with illumination it captures the distinction that
 * actually matters -- a bright moon that has already set costs you nothing.
 */
export function moonConditions(loc: LatLng, window: NightWindow): MoonConditions {
  const observer = observerAt(loc)
  const startMs = window.start.getTime()
  const endMs = window.end.getTime()
  const midpoint = new Date((startMs + endMs) / 2)

  let aboveCount = 0
  for (let i = 0; i < MOON_SAMPLES; i++) {
    // Sample cell centres so neither endpoint is double-weighted.
    const t = new Date(startMs + ((i + 0.5) / MOON_SAMPLES) * (endMs - startMs))
    if (altitudeOf(A.Body.Moon, t, observer) > 0) aboveCount++
  }

  const rise = A.SearchRiseSet(A.Body.Moon, observer, DIRECTION_RISE, window.start, 1)
  const set = A.SearchRiseSet(A.Body.Moon, observer, DIRECTION_SET, window.start, 1)

  return {
    illumination: A.Illumination(A.Body.Moon, midpoint).phase_fraction,
    fractionAboveHorizon: aboveCount / MOON_SAMPLES,
    rise: rise?.date ?? null,
    set: set?.date ?? null,
    phaseName: phaseName(A.MoonPhase(midpoint)),
  }
}

/**
 * Indonesian name for a lunar phase angle in degrees (0 new, 180 full).
 * Boundaries are the conventional 45° bands centred on the principal phases.
 */
export function phaseName(phaseAngle: number): string {
  const a = ((phaseAngle % 360) + 360) % 360
  if (a < 22.5 || a >= 337.5) return 'Bulan Baru'
  if (a < 67.5) return 'Sabit Awal'
  if (a < 112.5) return 'Kuartal Pertama'
  if (a < 157.5) return 'Cembung Awal'
  if (a < 202.5) return 'Purnama'
  if (a < 247.5) return 'Cembung Akhir'
  if (a < 292.5) return 'Kuartal Terakhir'
  return 'Sabit Akhir'
}
