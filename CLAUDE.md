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

The one piece of server-side code is `worker/index.ts`, a Cloudflare Worker that serves the built assets and proxies BMKG at `/api/forecast`. It validates, fetches, caches, and adds CORS — no parsing. It targets the Workers runtime and is deliberately excluded from the app's tsconfig. `vite.config.ts` mirrors the same `/api/forecast` path in dev so client code never branches on environment.

**A Worker has to name its own routes; Pages routed by filename.** `/api/forecast` is matched exactly, not by prefix, and everything else goes to the `ASSETS` binding. Two things in `wrangler.toml` are load-bearing: assets are matched *before* the Worker wakes, so serving the app costs no invocation, and `not_found_handling` must stay at its default — setting `single-page-application` would answer `/api/forecast` with `index.html`, turning the forecast into HTML with a 200 status.

Click flow: everything computable offline (light pollution sample, dark window, moon) resolves synchronously and renders immediately; only the forecast awaits the network, then cloud cover folds into the score.

## Constraints that shaped the design

**BMKG only accepts `adm4` (desa) codes.** `adm3`/`adm2`/`adm1` 301-redirect to an HTML page — verified, not assumed. So a map click must be resolved to a desa code locally, which is what `scripts/build_wilayah_index.mjs` and `src/lib/wilayah.ts` exist for. The index is kecamatan-granular (~7,284 points, 118 KB gzipped), each carrying one representative desa code; desa-level boundary data would be 200–300 MB to ingest and cloud cover does not vary across ~10 km.

**BMKG's `data[].cuaca` is a nested array** (one inner array per day), and the first day is partial — a real response returns ~20 points, not 3×8. `src/lib/__fixtures__/bmkg-kemayoran.json` is a genuine captured response; test parsing against it rather than a hand-written mock.

**The published BMKG weather-code table is wrong, and `src/lib/weather.ts` documents where.** Sampling 984 forecast points across 52 kecamatan, cross-checked against the icon slug BMKG ships inside each point (`image`, e.g. `.../cuaca/cerah-am.svg`), contradicts the circulated list on three codes: `10` is *Udara Kabur* not *Asap*, `61` is *Hujan Ringan* not *Hujan Sedang*, and `17` (*Petir*) is not on the list at all. Codes observed live win over the documented table; the rest are marked as unverified in that file. Re-sample before trusting any addition — the sample above was August, so no heavy-rain code could appear.

**The response carries `weather_desc_en` alongside `weather_desc`.** `ForecastPoint.description` is therefore `Localized`, not a string. Do not translate condition wording locally — BMKG has already named it in both languages, and inventing a second vocabulary would drift from theirs.

**The wording is theirs; the glyph is ours.** A clear night arrives as "Cerah"/"Sunny" at 23:00 and stays that way — but printing a midday sun beside it was the one place the picture contradicted the subject. `ForecastPoint.isNight` comes from BMKG's own icon slug (`cerah-am.svg` by day, `cerah-pm.svg` after dark; 17:00 local is `-am` and 20:00 is `-pm`, so the split is daylight, not morning), and `weatherIcon(code, isNight)` swaps only the two glyphs that draw a sun. A missing slug reads as day. Rain and fog look the same at any hour and get no night variant — five more glyphs separated by a detail that vanishes at 13px is exactly the mistake `cloud` vs `overcast` already taught.

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

**`translate` returning unknown keys unchanged is what makes leaks silent, so sweep the rendered page rather than the source.** Four separate leaks survived a source-level review: BMKG condition wording, `ObjectTable`'s empty state, `compassPoint` used where `compassShortKey` was meant, and `groupByLocalDay` called without a locale. None of them looked wrong in the file. All were obvious in the browser in English. Sweep every tab, and reach the states normal clicking misses — the empty object list needs a point with nothing above 20°.

Dates go through `Intl.DateTimeFormat(locale, { timeZone: 'UTC', … })` applied to a `shift()`ed instant. The `timeZone: 'UTC'` is load-bearing — `shift()` already moved the instant so its UTC fields read as local wall clock, and letting Intl apply the viewer's zone would shift it twice.

Default is English, but a browser asking for Indonesian gets Indonesian; an explicit choice wins and persists in `localStorage`. That whole rule is `resolveInitialLocale` in `src/lib/i18n.ts`, pure and tested.

## Search and location

`searchPlaces` (`src/lib/search.ts`) ranks the kecamatan index together with `LANDMARKS`. The landmark list exists because the index only has kecamatan names: nobody searches for "Tosari", they search for "Bromo". Landmarks store `name` plus a `kind`, so one entry renders as "Mount Bromo" or "Gunung Bromo" without duplicating the proper noun.

**Geolocation must reject positions outside the light pollution bbox.** `sampleMagnitude` correctly returns null out there, but `findNearest` will still return the closest Indonesian kecamatan from any distance, and the panel would then show a real BMKG forecast for somewhere the user is not. `PlaceSearch.vue` checks the bbox before emitting.

## Design

The app is a field instrument, not a web page: used outdoors at night by people whose dark adaptation a bright screen destroys. Hence the near-black surface and nothing that glares. "Mode lapangan" drops the whole interface — map included — to red monochrome. Keep new UI inside that constraint. Rationale is in the header comment of `src/styles.css`.

**The look is a printed star atlas, not a dashboard.** Surfaces are the logo navy taken down to near-black (`--void #080d1c`), never neutral black; text is warm paper. Newsreader (serif) letters place names, the verdict sentence and the empty-state line — nothing else. Everything else, figures included, is Atkinson Hyperlegible Next with `tabular-nums`; there is no monospace face, and no uppercase tracked-out labels — section labels are `.label-quiet`, sentence case in `--haze`. Sections are separated by `--rule-section` (dashed, like a graticule) rather than boxes. The verdict is five stars lit to the rating, unlit ones the same glyph at low opacity. These were chosen to replace a set of generic defaults (Space Grotesk + Plex Mono, vermilion on black, eyebrow labels, a stat tile); do not drift back to them.

Translucent surfaces over the map use `color-mix(in srgb, var(--panel) N%, transparent)`, never a literal `rgba()` — a literal colour is a value field mode cannot reach.

**Colour carries three meanings and only three.** `--azure` (with `--azure-dim`, and `--brand` for the literal logo navy) is identity and interaction: active tab, selected row, focus ring, map marker, logo. `--ember` (ochre, the colour of an annotation inked onto a chart) is warning and nothing else: errors, the limiting factor, a provisional score. `--clear` is "good". `--ember` used to mean both accent and warning, which is why recolouring the app was a token split rather than a find-and-replace — a single token that means two things cannot be changed without changing both.

`--brand` is `#193667` exactly as the logo is drawn, and at 1.6:1 against `--panel` it can only ever be a surface. Anything that needs to be *read* uses `--azure`, the same hue lifted to 6.7:1.

**Every colour token must be remapped in the `:root[data-field='true']` block, the blue ones most of all.** Short wavelengths are precisely what field mode exists to remove; one token left unmapped makes the mode decorative instead of functional. Verify by screenshotting field mode and scanning computed styles for a dominant blue channel, not by eye.

**Icons are drawn in `src/lib/icons.ts`, not installed.** Filled glyphs on a 24 grid, `currentColor` throughout — which is what makes field mode recolour them for free, with no second asset and no per-icon CSS. They render at 12–14px beside 11–13px type, and *that* is the size to judge them at: an earlier stroked set turned to mush, and `cloud` vs `overcast` had to be redrawn as one layer vs two because scaling the same shape was indistinguishable there. `LANDMARK_ICONS` / `CATEGORY_ICONS` / `FACTOR_ICONS` are typed as full `Record`s so a new landmark kind or sub-score fails to compile until it has a glyph.

**The map marker is a pin, and a pin has to be anchored at its tip.** `maplibregl.Marker` centres by default, which would put the tip half a glyph below the coordinate the app actually sampled — a marker quietly lying about where its numbers came from. `MapView` passes `anchor: 'bottom'`; verified by clicking a known pixel and asserting the element's bottom-centre lands on it, dx=0 dy=0. The head is a real hole cut with `fill-rule="evenodd"` rather than a disc filled with the background colour, so the map shows through it and there is no second colour for field mode to miss.

**Motion is confirmation, never decoration.** Four things move, each marking something the user cannot otherwise see happen: the pin drops when a point is picked (outdoors and one-handed, your finger is over the spot), the verdict settles when the forecast lands (the rating can *fall* as cloud folds in, and unmarked that reads as a misread), the search list rises as it appears, and whatever takes over the panel column announces itself. All are under 200ms and animate **transform and opacity only** — animating a colour would mean animating a token, and field mode exists so that nothing changes colour unasked. `prefers-reduced-motion` neutralises all of it from the single block in `styles.css`.

The panel column's *width* is not animated and cannot easily be: the three states declare different numbers of grid tracks (`1fr auto <size>` against `1fr auto` and `0 1fr`), and CSS interpolates neither differing track counts nor differing track types. Padding them to match would mean rewriting the column out of grid tracks — a change to the most load-bearing layout in the app for the sake of 200ms. The contents transition; the track snaps.

Two traps when checking any of this in a browser: **Vue hashes scoped keyframe names**, so `verdict-settle` is actually `verdict-settle-c913093a` and an equality check on the name silently reports "never fired". And the class arrives on the *next* Vue tick — around 76ms after a click, once MapLibre's resize has run — so a single snapshot taken at 50ms reports nothing running. Poll across the window instead of sampling once; both of those cost a false bug report already.

`MoonGlyph.vue` draws the actual phase from `illumination`, so the picture cannot disagree with the number printed beside it. The geometry lives in `src/lib/moonShape.ts` because it got the terminator's curvature backwards once and rendered a full moon as a black disc — a component cannot be unit-tested into admitting that.

**The empty state answers what does not need a location.** Phase and illuminated fraction are geocentric — the same number for every observer on Earth at a given instant — so `MoonTonight.vue` can state them before a point is picked. Moonrise, moonset and time-above-horizon are not, vary by tens of minutes across the archipelago, and belong to the readout that appears after a click. `src/lib/moonTonight.ts` exposes only the two that travel; completing the set is the mistake it exists to prevent. It is evaluated at the midnight of the night in question, pivoting on local noon, because illumination moves up to seven points a day and "now" at breakfast is not tonight.

`NightBar.vue` is the signature element: dark window, cloud cover, and moon presence on one time axis. It answers *when* to go, which is the decision being made. Its SVG uses a uniform aspect ratio — an earlier `preserveAspectRatio="none"` distorted all text and must not come back.

## Panel layout

The readout panel is resizable, collapsible to a rail, and expandable to fill the window. All the arithmetic — clamping, the stored-preference fallback, pointer-to-size, keyboard steps, state toggles — is pure and lives in `src/lib/panelLayout.ts`; `usePanelLayout` only holds the reactive state, the listeners, and localStorage.

Sizes are stored in **pixels and re-clamped against the live container**, not as a fraction of it. The panel has an absolute minimum below which the forecast table stops laying out, and the map has one below which it stops being pickable; a fraction cannot express either. `clampPanelSize` also has to handle the two minimums not both fitting, because otherwise its lower and upper bounds cross and it silently returns whichever was applied last.

Three things that will bite:

- **`grid-template-columns` must match the number of children actually rendered.** The separator is only rendered in the `normal` state, so the minimized and maximized states declare two tracks, not three. Leaving three left the panel in the middle `auto` track, sized to its content instead of filling the window.
- **The `@media (max-width: 52rem)` breakpoint exists twice** — in `App.vue` and as `STACKED_QUERY` in `usePanelLayout.ts`. CSS decides the layout, JS decides whether a drag is measured against width or height. They have to agree.
- **Anything that can occupy the panel column has to carry `PanelControls`.** They are not part of the spot readout; they belong to the container. Living inside `SpotPanel`, which is not rendered before a point is picked, meant maximizing on a fresh session hid the map behind a panel with no way to shrink — and the state outlived a reload, so the app came back trapped. `App.vue` renders them in the empty state too.
- **MapLibre only watches the window, not its container.** `MapView` runs a `ResizeObserver` calling `map.resize()`. Without it a resized panel leaves a stretched canvas whose clicks return coordinates for somewhere the user did not click.

`SpotPanel`'s content is capped at 46rem and centred. Past that a readout column stops being easier to read and `NightBar`, which keeps a uniform aspect ratio on purpose, renders as a 400px-tall graphic with type to match.

**Do not use `:global(...)` as the first compound selector in a scoped block.** `:global(.body[data-placement='below']) .window-controls .icon { transform: rotate(90deg) }` compiled to a rule matching `.body` itself and rotated the entire application ninety degrees on narrow screens — a total layout failure that `pnpm build` and every unit test passed straight through. Pass the state down as a prop and put the class where it belongs.

The collapse and expand glyphs are named for **what they draw**, not for the action they trigger. Naming them `minimize`/`maximize` is precisely how they ended up pointing the wrong way: collapsing a right-hand panel moves it *toward* the right edge, not away from it.
