import type { Kecamatan, LatLng } from '@/types'
import type { Landmark, LandmarkKind } from './landmarks'

export interface SearchResult extends LatLng {
  id: string
  kind: 'landmark' | 'kecamatan'
  /** Proper noun, rendered as-is; place names are not translated. */
  name: string
  /** Kabupaten or region, shown beneath the name to tell similar places apart. */
  secondary: string
  /** Only set for landmarks, and only to choose the descriptor ("Mount", "Gunung"). */
  landmarkKind?: LandmarkKind
}

/**
 * Case, accent and punctuation folded away.
 *
 * Indonesian place names are written inconsistently in the wild -- "Gn. Bromo",
 * "Rammang-Rammang", "Nusa Penida" -- so matching has to survive the difference
 * between how a name is printed and how someone types it.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    // Combining diacritical marks, escaped rather than typed literally so the
    // range survives copy-paste and stays legible.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Below this a query matches almost everything, so the list is noise. */
const MIN_QUERY_LENGTH = 2

const SCORE = {
  exact: 100,
  prefix: 70,
  wordStart: 50,
  substring: 25,
  /** Secondary text (kabupaten, region) is a weaker signal than the name itself. */
  secondary: 12,
  /**
   * Landmarks win ties. Someone typing "Ijen" means the volcano; a district that
   * merely shares the letters is not what they were reaching for.
   */
  landmarkBonus: 5,
} as const

function scoreField(haystack: string, needle: string): number {
  if (!haystack) return 0
  if (haystack === needle) return SCORE.exact
  if (haystack.startsWith(needle)) return SCORE.prefix
  if (haystack.includes(` ${needle}`)) return SCORE.wordStart
  if (haystack.includes(needle)) return SCORE.substring
  return 0
}

/**
 * Ranked places matching `query`, landmarks and kecamatan together.
 *
 * A linear scan over ~7,300 kecamatan plus a few dozen landmarks, which is fast
 * enough to run on every keystroke without debouncing; an index would be machinery
 * for a problem that does not exist at this size.
 */
export function searchPlaces(
  kecamatan: readonly Kecamatan[],
  landmarks: readonly Landmark[],
  query: string,
  limit = 8,
): SearchResult[] {
  const needle = normalise(query)
  if (needle.length < MIN_QUERY_LENGTH) return []

  const scored: { score: number; result: SearchResult }[] = []

  for (const l of landmarks) {
    const score =
      Math.max(
        scoreField(normalise(l.name), needle),
        scoreField(normalise(l.region), needle) && SCORE.secondary,
      ) + SCORE.landmarkBonus
    if (score > SCORE.landmarkBonus) {
      scored.push({
        score,
        result: {
          id: `landmark:${l.id}`,
          kind: 'landmark',
          name: l.name,
          secondary: l.region,
          landmarkKind: l.kind,
          lat: l.lat,
          lon: l.lon,
        },
      })
    }
  }

  for (const k of kecamatan) {
    const score = Math.max(
      scoreField(normalise(k.name), needle),
      scoreField(normalise(k.kotkab), needle) && SCORE.secondary,
    )
    if (score > 0) {
      scored.push({
        score,
        result: {
          id: `kec:${k.adm3}`,
          kind: 'kecamatan',
          name: k.name,
          secondary: k.kotkab,
          lat: k.lat,
          lon: k.lon,
        },
      })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name))
    .slice(0, limit)
    .map((s) => s.result)
}
