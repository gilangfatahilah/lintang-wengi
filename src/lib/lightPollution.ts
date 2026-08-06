import type { LatLng } from '@/types'
import type { I18nText } from './i18n'

/** Contract emitted by scripts/build_lp_grid.py. See public/data/lp-meta.json. */
export interface LpMeta {
  /** [west, south, east, north] in EPSG:4326. */
  bbox: [number, number, number, number]
  width: number
  height: number
  encoding: 'uint8-linear-mag'
  /** Byte 0 decodes to this magnitude. */
  magMin: number
  /** Byte 255 decodes to this magnitude. */
  magMax: number
  source?: string
}

export interface LpGrid {
  meta: LpMeta
  /** Row-major, row 0 is the northernmost. */
  data: Uint8Array
}

/**
 * Whether the loaded grid is synthesised placeholder data.
 *
 * The UI has to say so, and it has to stop saying so once a real raster is in
 * place -- a stale "not calibrated" caption is its own kind of wrong. Driven by
 * what the build script recorded rather than by a hand-maintained flag.
 */
export function isStubGrid(meta: LpMeta): boolean {
  return meta.source === 'stub' || meta.source === undefined
}

/**
 * Bortle class boundaries in mag/arcsec^2 (higher is darker). Values at or above a
 * threshold take that class.
 *
 * These constants are the one place sky-brightness calibration lives. While the grid
 * is stub data they are unverified against reality; when a real raster is swapped in,
 * check a site of known Bortle class and correct here rather than anywhere else.
 */
const BORTLE_THRESHOLDS: ReadonlyArray<readonly [number, number]> = [
  [21.99, 1],
  [21.89, 2],
  [21.69, 3],
  [20.49, 4],
  [19.5, 5],
  [18.94, 6],
  [18.38, 7],
  [17.8, 8],
]

export function magnitudeToBortle(mag: number): number {
  for (const [limit, cls] of BORTLE_THRESHOLDS) {
    if (mag >= limit) return cls
  }
  return 9
}

/** What a Bortle class means in practice, as a key the render layer resolves. */
export function bortleText(bortle: number): I18nText {
  return { key: `bortle.${Math.min(Math.max(Math.round(bortle), 1), 9)}` }
}

function decode(byte: number, meta: LpMeta): number {
  return meta.magMin + (byte / 255) * (meta.magMax - meta.magMin)
}

/**
 * Sky brightness at a point, in mag/arcsec^2. Null if outside the grid.
 *
 * Bilinearly interpolated. Adjacent cells near a city edge can differ by a whole
 * Bortle class, and nearest-neighbour sampling would make the score jump as the
 * user nudges the marker; interpolation keeps it continuous.
 */
export function sampleMagnitude(grid: LpGrid, point: LatLng): number | null {
  const { bbox, width, height } = grid.meta
  const [west, south, east, north] = bbox

  if (point.lon < west || point.lon > east || point.lat < south || point.lat > north) {
    return null
  }

  // Continuous cell coordinates, offset by half a cell so integers land on centres.
  const fx = ((point.lon - west) / (east - west)) * width - 0.5
  const fy = ((north - point.lat) / (north - south)) * height - 0.5

  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0

  // Clamp so points in the outer half-cell border reuse the edge value.
  const cx = (x: number) => Math.min(Math.max(x, 0), width - 1)
  const cy = (y: number) => Math.min(Math.max(y, 0), height - 1)

  const at = (x: number, y: number) => grid.data[cy(y) * width + cx(x)] ?? 0

  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
  return decode(top * (1 - ty) + bottom * ty, grid.meta)
}

let cached: Promise<LpGrid> | null = null

export function loadGrid(base = '/data'): Promise<LpGrid> {
  cached ??= Promise.all([
    fetch(`${base}/lp-meta.json`).then((r) => {
      if (!r.ok) throw new Error('errors.lpMeta')
      return r.json() as Promise<LpMeta>
    }),
    fetch(`${base}/lp-grid.bin`).then((r) => {
      if (!r.ok) throw new Error('errors.lpGrid')
      return r.arrayBuffer()
    }),
  ])
    .then(([meta, buf]) => {
      const data = new Uint8Array(buf)
      const expected = meta.width * meta.height
      if (data.length !== expected) {
        // Not user-facing prose: a size mismatch means the build script and the
        // app disagree about the contract, which is a developer bug, not a
        // condition anyone in the field can act on.
        throw new Error(`lp-grid.bin is ${data.length} bytes, expected ${expected}`)
      }
      return { meta, data }
    })
    .catch((err) => {
      cached = null
      throw err
    })
  return cached
}
