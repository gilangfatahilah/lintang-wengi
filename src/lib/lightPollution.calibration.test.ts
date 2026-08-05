import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { sampleMagnitude, magnitudeToBortle, type LpGrid, type LpMeta } from './lightPollution'

/**
 * Calibration check for a REAL light pollution grid.
 *
 * Skipped while the grid is stub data, which is why it lives apart from the unit
 * tests: those verify the sampling maths against a synthetic grid, this one asks
 * whether the numbers coming out describe the actual sky.
 *
 * It deliberately calls the same sampleMagnitude the app calls. A standalone script
 * would have to reimplement the indexing and could drift away from production.
 *
 * To run it:
 *   1. Download https://datapub.gfz-potsdam.de/download/10.5880.GFZ.1.4.2016.001/World_Atlas_2015.zip
 *      (684 MB zipped, ~2.9 GB extracted; Falchi et al. 2016, artificial zenith
 *      radiance in mcd/m^2 on a 30 arcsec grid)
 *   2. pip install rasterio
 *   3. python3 scripts/build_lp_grid.py --input scripts/raw/World_Atlas_2015.tif
 *   4. pnpm test
 *
 * If a case fails, correct BORTLE_THRESHOLDS in lightPollution.ts -- that table is
 * the only place calibration lives. Cross-check individual points against
 * lightpollutionmap.info, which reports the same World Atlas values per coordinate.
 */

const DATA = resolve(import.meta.dirname, '../../public/data')
const META_PATH = resolve(DATA, 'lp-meta.json')
const GRID_PATH = resolve(DATA, 'lp-grid.bin')

function loadMeta(): LpMeta | null {
  if (!existsSync(META_PATH)) return null
  return JSON.parse(readFileSync(META_PATH, 'utf8')) as LpMeta
}

const meta = loadMeta()
const isReal = meta !== null && meta.source !== 'stub' && existsSync(GRID_PATH)

/**
 * Places whose sky class is not in dispute. Ranges are wide on purpose: this is
 * checking that the conversion is not off by a class or two, not pinning exact values.
 */
const REFERENCES = [
  // Open water, hundreds of km from any settlement. Nothing but natural airglow.
  // Kept inside the grid's southern edge (-11.5); further south samples off-grid.
  { name: 'Samudra Hindia, selatan Jawa', lat: -10.8, lon: 108.0, minBortle: 1, maxBortle: 2 },
  { name: 'Laut Banda', lat: -5.5, lon: 128.5, minBortle: 1, maxBortle: 2 },
  // Dense urban cores.
  { name: 'Jakarta Pusat', lat: -6.18, lon: 106.83, minBortle: 8, maxBortle: 9 },
  { name: 'Surabaya', lat: -7.25, lon: 112.75, minBortle: 7, maxBortle: 9 },
  // Mid-sized city: bright, but not a megacity core.
  { name: 'Yogyakarta', lat: -7.8, lon: 110.36, minBortle: 5, maxBortle: 8 },
  // Remote interior highland.
  { name: 'Pegunungan Papua', lat: -4.0, lon: 138.0, minBortle: 1, maxBortle: 3 },
]

describe.skipIf(!isReal)('light pollution calibration (real data only)', () => {
  const grid: LpGrid = { meta: meta!, data: new Uint8Array(readFileSync(GRID_PATH)) }

  it.each(REFERENCES)(
    '$name falls within Bortle $minBortle–$maxBortle',
    ({ lat, lon, minBortle, maxBortle }) => {
      const mag = sampleMagnitude(grid, { lat, lon })
      expect(mag).not.toBeNull()
      const bortle = magnitudeToBortle(mag!)
      expect(bortle).toBeGreaterThanOrEqual(minBortle)
      expect(bortle).toBeLessThanOrEqual(maxBortle)
    },
  )

  it('is darker over open ocean than over Jakarta', () => {
    const ocean = sampleMagnitude(grid, { lat: -10.8, lon: 108.0 })!
    const city = sampleMagnitude(grid, { lat: -6.18, lon: 106.83 })!
    // Higher mag/arcsec^2 means darker sky.
    expect(ocean).toBeGreaterThan(city)
    // A pristine sky versus a megacity should differ by several magnitudes.
    expect(ocean - city).toBeGreaterThan(2)
  })

  it('never exceeds the natural sky background', () => {
    // Artificial light can only add brightness. Anything darker than the natural
    // background of ~21.98 means the conversion or the natural constant is wrong.
    for (const ref of REFERENCES) {
      const mag = sampleMagnitude(grid, ref)!
      expect(mag).toBeLessThanOrEqual(22.1)
    }
  })
})

describe.skipIf(isReal)('light pollution calibration', () => {
  it('is skipped because the grid is stub data', () => {
    expect(meta?.source ?? 'missing').toBe('stub')
  })
})
