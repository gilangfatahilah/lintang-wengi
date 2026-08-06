import type { Kecamatan, LatLng } from '@/types'

/** Shape of public/data/wilayah-kec.json, produced by scripts/build_wilayah_index.mjs. */
export interface RawIndex {
  generatedAt: string
  fields: string[]
  kotkabNames: string[]
  /** [adm3, desaSuffix, name, kotkabIndex, lat, lon] */
  rows: [string, string, string, number, number, number][]
}

const EARTH_RADIUS_KM = 6371
const DEG_TO_RAD = Math.PI / 180

export function parseIndex(raw: RawIndex): Kecamatan[] {
  return raw.rows.map(([adm3, desaSuffix, name, kotkabIndex, lat, lon]) => ({
    adm3,
    adm4: `${adm3}.${desaSuffix}`,
    name,
    kotkab: raw.kotkabNames[kotkabIndex] ?? '',
    lat,
    lon,
  }))
}

/**
 * Squared planar distance in "latitude-equivalent degrees".
 *
 * Longitude degrees converge toward the poles, so the east-west term is scaled by
 * cos(lat). Across Indonesia that correction is under 2%, but it costs nothing and
 * keeps the function honest anywhere else. Squared, because we only ever rank with
 * it -- taking a square root would not change the ordering.
 */
function rankingDistanceSq(a: LatLng, b: LatLng): number {
  const dLat = a.lat - b.lat
  const dLon = (a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * DEG_TO_RAD)
  return dLat * dLat + dLon * dLon
}

/**
 * Nearest kecamatan to a point, by linear scan.
 *
 * ~7,300 candidates is small enough that a scan runs in well under a millisecond,
 * so a k-d tree would add a build step and a dependency to solve a problem we do
 * not have. Returns null only for an empty index; any real point resolves to
 * something, including clicks out at sea.
 */
export function findNearest(index: Kecamatan[], point: LatLng): Kecamatan | null {
  let best: Kecamatan | null = null
  let bestDist = Infinity
  for (const candidate of index) {
    const d = rankingDistanceSq(point, candidate)
    if (d < bestDist) {
      bestDist = d
      best = candidate
    }
  }
  return best
}

/** Great-circle distance in km. Used to tell the user how far the forecast point is. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD
  const dLon = (b.lon - a.lon) * DEG_TO_RAD
  const lat1 = a.lat * DEG_TO_RAD
  const lat2 = b.lat * DEG_TO_RAD
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

let cached: Promise<Kecamatan[]> | null = null

/** Loads and caches the index. The payload is ~118 KB gzipped, fetched once per session. */
export function loadIndex(url = '/data/wilayah-kec.json'): Promise<Kecamatan[]> {
  cached ??= fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('errors.wilayahIndex')
      return res.json() as Promise<RawIndex>
    })
    .then(parseIndex)
    .catch((err) => {
      cached = null // let a later attempt retry instead of caching the failure
      throw err
    })
  return cached
}
