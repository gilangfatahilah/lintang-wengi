#!/usr/bin/env node
/**
 * Builds the coordinate -> BMKG region code lookup used by src/lib/wilayah.ts.
 *
 * Why this exists: the BMKG forecast API only accepts adm4 (desa) codes. Querying
 * with adm3/adm2/adm1 does not work -- those 301-redirect to an HTML page rather
 * than returning JSON. So a map click has to be resolved to a desa code locally.
 *
 * We index at kecamatan granularity (~7,285 points) rather than desa (~83,000).
 * Desa-level boundary data is ~200-300 MB to download, and cloud cover simply does
 * not vary meaningfully across a ~10 km kecamatan. Each kecamatan carries one
 * representative desa code, which is what actually gets sent to BMKG.
 *
 * Sources (both MIT-licensed):
 *   - cahyadsn/wilayah_boundaries  kecamatan centroids (lat/lng ship in the SQL)
 *   - cahyadsn/wilayah             full code list, used for desa codes + kabupaten names
 *
 * Usage:
 *   node scripts/build_wilayah_index.mjs            build the index
 *   node scripts/build_wilayah_index.mjs --validate build, then check codes against live BMKG
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/wilayah-kec.json')

const BOUNDARIES_API =
  'https://api.github.com/repos/cahyadsn/wilayah_boundaries/contents/db/kec'
const BOUNDARIES_RAW =
  'https://raw.githubusercontent.com/cahyadsn/wilayah_boundaries/main/db/kec'
const CODES_RAW = 'https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql'

const BMKG_ENDPOINT = 'https://api.bmkg.go.id/publik/prakiraan-cuaca'
/** BMKG allows 60 req/min per IP; stay comfortably under it during validation. */
const VALIDATE_DELAY_MS = 1100
const VALIDATE_SAMPLE_SIZE = 30

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return res.text()
}

/**
 * Parses `INSERT INTO wilayah_boundaries(kode,nama,lat,lng,path) VALUES (...)` rows.
 * The trailing `path` column holds the full polygon and is deliberately not captured --
 * it is by far the largest part of the file and we only need the centroid.
 */
function parseBoundaries(sql) {
  const re = /\('(\d{2}\.\d{2}\.\d{2})','((?:[^']|'')*)',(-?[\d.]+),(-?[\d.]+),/g
  const out = []
  let m
  while ((m = re.exec(sql)) !== null) {
    out.push({
      adm3: m[1],
      name: m[2].replace(/''/g, "'"),
      lat: Number(m[3]),
      lon: Number(m[4]),
    })
  }
  return out
}

/** Parses the flat `('kode','nama')` pairs from wilayah.sql at every admin level. */
function parseCodes(sql) {
  const re = /\('([\d.]+)','((?:[^']|'')*)'\)/g
  const kabupaten = new Map() // "13.01" -> name
  const firstDesaOf = new Map() // "13.01.01" -> "13.01.01.2001"
  let m
  while ((m = re.exec(sql)) !== null) {
    const code = m[1]
    const name = m[2].replace(/''/g, "'")
    const depth = code.split('.').length
    if (depth === 2) {
      kabupaten.set(code, name)
    } else if (depth === 4) {
      const adm3 = code.slice(0, 8)
      // Codes are emitted in ascending order, so the first hit is the lowest desa
      // code in that kecamatan -- an arbitrary but stable representative.
      if (!firstDesaOf.has(adm3)) firstDesaOf.set(adm3, code)
    }
  }
  return { kabupaten, firstDesaOf }
}

async function build() {
  console.log('Fetching kecamatan boundary file list...')
  const listing = await fetch(BOUNDARIES_API).then((r) => r.json())
  if (!Array.isArray(listing)) {
    throw new Error(`Unexpected GitHub API response: ${JSON.stringify(listing).slice(0, 200)}`)
  }
  const files = listing.filter((f) => f.name.endsWith('.sql')).map((f) => f.name)
  console.log(`  ${files.length} province files`)

  console.log('Fetching code list (wilayah.sql)...')
  const { kabupaten, firstDesaOf } = parseCodes(await fetchText(CODES_RAW))
  console.log(`  ${kabupaten.size} kabupaten, ${firstDesaOf.size} kecamatan with a desa code`)

  console.log('Fetching boundaries...')
  const chunks = await Promise.all(
    files.map((name) => fetchText(`${BOUNDARIES_RAW}/${name}`).then(parseBoundaries)),
  )
  const kecamatan = chunks.flat()
  console.log(`  ${kecamatan.length} kecamatan centroids`)

  // Dedupe kabupaten names into a side table; ~514 names shared across 7,285 rows.
  const kotkabNames = []
  const kotkabIndex = new Map()
  const rows = []
  const skipped = []

  for (const k of kecamatan) {
    const adm4 = firstDesaOf.get(k.adm3)
    if (!adm4) {
      // A kecamatan with boundary data but no desa in the code list cannot be queried.
      skipped.push(k.adm3)
      continue
    }
    const kabCode = k.adm3.slice(0, 5)
    const kabName = kabupaten.get(kabCode) ?? ''
    let ki = kotkabIndex.get(kabName)
    if (ki === undefined) {
      ki = kotkabNames.length
      kotkabNames.push(kabName)
      kotkabIndex.set(kabName, ki)
    }
    rows.push([
      k.adm3,
      adm4.slice(9), // 4-digit desa suffix; adm4 is reassembled client-side
      k.name,
      ki,
      Number(k.lat.toFixed(4)), // ~11 m precision, far finer than a kecamatan
      Number(k.lon.toFixed(4)),
    ])
  }

  if (skipped.length) {
    console.warn(`  WARNING: ${skipped.length} kecamatan skipped (no desa code):`)
    console.warn(`    ${skipped.slice(0, 10).join(', ')}${skipped.length > 10 ? ', ...' : ''}`)
  }

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    fields: ['adm3', 'desaSuffix', 'name', 'kotkabIndex', 'lat', 'lon'],
    kotkabNames,
    rows,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(payload))
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0)
  console.log(`\nWrote ${OUT}`)
  console.log(`  ${rows.length} kecamatan, ${kb} KB raw`)
  return payload
}

/**
 * Spot-checks generated adm4 codes against the live API. Region codes are revised
 * periodically by Kemendagri, and a stale code fails silently at runtime (empty panel)
 * rather than loudly, so it is worth catching at build time.
 */
async function validate(payload) {
  const { rows } = payload
  const picks = Array.from({ length: VALIDATE_SAMPLE_SIZE }, (_, i) => {
    const r = rows[Math.floor((i * rows.length) / VALIDATE_SAMPLE_SIZE)]
    return { adm4: `${r[0]}.${r[1]}`, name: r[2] }
  })

  console.log(`\nValidating ${picks.length} codes against ${BMKG_ENDPOINT} ...`)
  let ok = 0
  const failures = []
  for (const p of picks) {
    try {
      const res = await fetch(`${BMKG_ENDPOINT}?adm4=${p.adm4}`)
      const body = await res.text()
      let good = false
      try {
        const json = JSON.parse(body)
        good = Array.isArray(json.data) && json.data.length > 0 && !!json.data[0].cuaca
      } catch {
        good = false // non-JSON means a redirect to the HTML error page
      }
      if (good) ok++
      else failures.push(`${p.adm4} (${p.name}) http=${res.status}`)
    } catch (err) {
      failures.push(`${p.adm4} (${p.name}) ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, VALIDATE_DELAY_MS))
  }

  console.log(`\nHIT RATE: ${ok}/${picks.length}`)
  if (failures.length) {
    console.log('FAILURES:')
    failures.forEach((f) => console.log(`  ${f}`))
    process.exitCode = 1
  }
}

const payload = await build()
if (process.argv.includes('--validate')) await validate(payload)
