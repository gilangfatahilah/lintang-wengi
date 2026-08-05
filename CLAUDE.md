# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Stargazing Spot Finder — a GIS web app for finding astrophotography/stargazing locations in Indonesia. Click a point on the map, get a 1–5 viability score for tonight combining light pollution, BMKG cloud forecast, and moon interference. UI language is Indonesian. See `PLAN.md` for the phased product brief; Phase 1 (MVP) is implemented.

## Commands

```bash
pnpm dev              # Vite dev server; proxies /api/forecast straight to BMKG
pnpm build            # vue-tsc --noEmit && vite build
pnpm typecheck
pnpm test             # vitest run
pnpm test:watch
pnpm vitest run src/lib/scoring.test.ts        # single file
pnpm vitest run -t "limiting factor"           # single test by name

pnpm data:wilayah     # rebuild public/data/wilayah-kec.json (needs network)
pnpm data:lp          # rebuild the stub light pollution grid
node scripts/build_wilayah_index.mjs --validate   # + check adm4 codes against live BMKG
```

Generated data lives in `public/data/`. The light pollution artifacts are gitignored and must be built once after clone (`pnpm data:lp`); `wilayah-kec.json` is committed because rebuilding it needs network plus 11.6 MB of boundary SQL.

## Architecture

**All domain logic is pure functions in `src/lib/`, unit-tested with no DOM, no network, no map.** Vue components only render. When adding logic, put it in `src/lib/` with a test rather than inside a component.

The one piece of server-side code is `functions/api/forecast.ts`, a Cloudflare Pages Function proxying BMKG. It validates, fetches, caches, and adds CORS — no parsing. It targets the Workers runtime and is deliberately excluded from the app's tsconfig. `vite.config.ts` mirrors the same `/api/forecast` path in dev so client code never branches on environment.

Click flow: everything computable offline (light pollution sample, dark window, moon) resolves synchronously and renders immediately; only the forecast awaits the network, then cloud cover folds into the score.

## Constraints that shaped the design

**BMKG only accepts `adm4` (desa) codes.** `adm3`/`adm2`/`adm1` 301-redirect to an HTML page — verified, not assumed. So a map click must be resolved to a desa code locally, which is what `scripts/build_wilayah_index.mjs` and `src/lib/wilayah.ts` exist for. The index is kecamatan-granular (~7,284 points, 118 KB gzipped), each carrying one representative desa code; desa-level boundary data would be 200–300 MB to ingest and cloud cover does not vary across ~10 km.

**BMKG's `data[].cuaca` is a nested array** (one inner array per day), and the first day is partial — a real response returns ~20 points, not 3×8. `src/lib/__fixtures__/bmkg-kemayoran.json` is a genuine captured response; test parsing against it rather than a hand-written mock.

**Never parse BMKG's `local_datetime` into a `Date` directly.** It is wall-clock at the forecast location with no offset attached, so parsing it reinterprets it in the *viewer's* timezone. `ForecastPoint.time` is the true instant from `utc_datetime`; `offsetMinutes` exists only for rendering wall-clock text. Night-window comparisons work on absolute instants and need no timezone handling.

**BMKG attribution is mandatory** and lives in `SpotPanel.vue` next to the data, not in a footer. Rate limit is 60 req/min per IP; the proxy caches for 30 min because BMKG only publishes twice a day.

## Scoring

Sub-scores combine with a **harmonic mean**, not a weighted average. This is the point of `src/lib/scoring.ts`: these factors gate each other rather than adding up, so a Bortle 1 site under 95% cloud must score as unusable, not as "about average". The UI always names the limiting factor.

Two things that are easy to get wrong and are locked by tests:
- Moon interference is `illumination × fractionAboveHorizon`. A full moon that has already set costs nothing.
- When the forecast fails, the score drops a term and therefore reads *higher*. `Score.complete` marks this so the UI can present it as provisional instead of as confidence.

`DARKNESS_BY_BORTLE` is an explicit table, not a linear ramp, because the Bortle scale is not linear in what it costs you.

## Light pollution data

Currently **stub data** — synthesised from city positions by `scripts/build_lp_grid.py --stub`. Values are plausible, not measured, and the UI says so.

Both stub and real paths emit the same contract (`lp-grid.bin` uint8 + `lp-meta.json` describing the decode), so swapping in real data is a file replacement with no code change:

```bash
pip install rasterio    # wheels bundle GDAL; no system GDAL needed
python3 scripts/build_lp_grid.py --input scripts/raw/World_Atlas_2015.tif
```

Calibration lives entirely in `BORTLE_THRESHOLDS` in `src/lib/lightPollution.ts`. When real data lands, verify against a site of known Bortle class and correct there only.

## Design

The app is a field instrument, not a web page: used outdoors at night by people whose dark adaptation a bright screen destroys. Hence the near-black surface, warm accents, and no blue-white anywhere. "Mode lapangan" drops the whole interface — map included — to red monochrome. Keep new UI inside that constraint. Rationale is in the header comment of `src/styles.css`.

`NightBar.vue` is the signature element: dark window, cloud cover, and moon presence on one time axis. It answers *when* to go, which is the decision being made. Its SVG uses a uniform aspect ratio — an earlier `preserveAspectRatio="none"` distorted all text and must not come back.
