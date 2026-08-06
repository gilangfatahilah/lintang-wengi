# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lintang Wengi — a GIS web app for finding astrophotography/stargazing locations in Indonesia. Click a point on the map — or search for one, or use your device location — and get a 1–5 viability score for tonight combining light pollution, BMKG cloud forecast, and moon interference. Bilingual EN/ID. See `PLAN.md` for the phased product brief; Phase 1 (MVP) is implemented.

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

Currently **stub data** — synthesised from city positions by `scripts/build_lp_grid.py --stub`. Values are plausible, not measured, and the UI says so. Known stub artifacts: its glow falloff has too long a tail (open ocean 340 km south of Java reads Bortle 3 instead of 1) and mid-sized cities saturate (Yogyakarta reads Bortle 9 instead of ~6–7). Do not tune these — the fix is real data.

Both stub and real paths emit the same contract (`lp-grid.bin` uint8 + `lp-meta.json` describing the decode), so swapping in real data is a file replacement with no code change:

```bash
# 684 MB zipped, ~2.9 GB extracted. Falchi et al. 2016, artificial zenith
# radiance in mcd/m^2 on a 30 arcsec grid.
curl -O https://datapub.gfz-potsdam.de/download/10.5880.GFZ.1.4.2016.001/World_Atlas_2015.zip
pip install rasterio    # wheels bundle GDAL; no system GDAL needed
python3 scripts/build_lp_grid.py --input scripts/raw/World_Atlas_2015.tif
pnpm test               # calibration suite activates automatically
```

`src/lib/lightPollution.calibration.test.ts` skips itself while `lp-meta.json` reports `source: "stub"` and activates the moment real data is in place, checking sampled values at places whose sky class is not in dispute. Calibration lives entirely in `BORTLE_THRESHOLDS` in `src/lib/lightPollution.ts` — if a case fails, correct that table and nothing else, cross-checking individual coordinates against lightpollutionmap.info, which reports the same World Atlas values.

## Language

**`src/lib/` must never return a user-facing sentence.** Domain code returns `I18nText` (`{ key, params }`) or a message key; the render layer resolves it. This is the same rule as "lib is pure logic" — a sentence is presentation. `translate` resolves nested `I18nText` params and `Localized` (`{ en, id }`) params, which is how "{phase} ({percent}%)" gets its phase name translated before substitution.

Two mechanisms, on purpose:
- **UI chrome** → key lookup in `src/locales/{en,id}.ts`. `en.ts` is canonical and `Messages` is a widened `typeof en`, so a key missing from `id.ts` fails `pnpm typecheck`. Do not add `as const` back to `en.ts` — it pins values to literal types and Indonesian can then only repeat the English.
- **Sky catalogue content** → `{ en, id }` inline in `skyCatalog.ts`, because a name belongs with its coordinates; splitting it into the dictionaries lets an id and a key drift apart silently.

Errors throw message keys (`throw new Error('errors.forecastEmpty')`). `translate` returns unknown keys unchanged, so `t(err.message)` is safe on any string.

Dates go through `Intl.DateTimeFormat(locale, { timeZone: 'UTC', … })` applied to a `shift()`ed instant. The `timeZone: 'UTC'` is load-bearing — `shift()` already moved the instant so its UTC fields read as local wall clock, and letting Intl apply the viewer's zone would shift it twice.

Default is English, but a browser asking for Indonesian gets Indonesian; an explicit choice wins and persists in `localStorage`. That whole rule is `resolveInitialLocale` in `src/lib/i18n.ts`, pure and tested.

## Search and location

`searchPlaces` (`src/lib/search.ts`) ranks the kecamatan index together with `LANDMARKS`. The landmark list exists because the index only has kecamatan names: nobody searches for "Tosari", they search for "Bromo". Landmarks store `name` plus a `kind`, so one entry renders as "Mount Bromo" or "Gunung Bromo" without duplicating the proper noun.

**Geolocation must reject positions outside the light pollution bbox.** `sampleMagnitude` correctly returns null out there, but `findNearest` will still return the closest Indonesian kecamatan from any distance, and the panel would then show a real BMKG forecast for somewhere the user is not. `PlaceSearch.vue` checks the bbox before emitting.

## Design

The app is a field instrument, not a web page: used outdoors at night by people whose dark adaptation a bright screen destroys. Hence the near-black surface, warm accents, and no blue-white anywhere. "Mode lapangan" drops the whole interface — map included — to red monochrome. Keep new UI inside that constraint. Rationale is in the header comment of `src/styles.css`.

`NightBar.vue` is the signature element: dark window, cloud cover, and moon presence on one time axis. It answers *when* to go, which is the decision being made. Its SVG uses a uniform aspect ratio — an earlier `preserveAspectRatio="none"` distorted all text and must not come back.
