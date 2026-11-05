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

**The rating is for the best stretch of the night, not its average.** `scoreNight` scores every contiguous run of 3-hour forecast slots at least 2 h long, with the moon recomputed *for that run* (via the `moonFor` the caller binds to `moonConditions`), and keeps the longest run within `STRETCH_TOLERANCE` of the best at the same rating. Matching the rating alone was tried and is too loose: buckets are wide enough that "100, 0, 0" still rates 5, so the named hours would include an overcast slot. The whole-night candidate uses the night's own moon, so a night that is good throughout scores exactly as the plain average did. `Score.stretch` carries the hours; the verdict names them, and ScoreTab's cloud row reads them off the score so the two cannot disagree. SkyTab's summary still describes the whole night with `cloudCoverForNight`.

## Offline

Dark sites are remote, and remote means no signal, so the built app is a PWA (`vite-plugin-pwa`, configured in `vite.config.ts`, off in dev). The precache holds the shell, `public/data/*` and the Latin font subsets; the font is self-hosted from `@fontsource-variable` for exactly this reason. `maximumFileSizeToCacheInBytes` is raised above the 2 MiB default because `lp-grid.bin` is larger — Workbox drops an oversized file with only a build warning, so **raise it again when real light pollution data lands** and check `dist/sw.js` lists the grid. BMKG is `NetworkFirst` with a 3-day expiry, CARTO tiles `CacheFirst`; only tiles already viewed work offline. A saved forecast is labelled in the panel footer: `fetchedAt` comes from the response `date` header, which the cached copy keeps, and `isSavedForecast` flags anything older than an hour (the edge caches for 30 min, so a live answer never is). `navigateFallbackDenylist` keeps `/api/` out of the HTML fallback for the same reason `not_found_handling` must stay default.

The home-screen icons in `public/icon-*.png` are `logo-mark.png` in white on `--brand`, not the navy mark on `--void`, which would be invisible.

## Light pollution data

The real source is the 2015 World Atlas (Falchi et al.), built locally from the raster below; the artifacts are gitignored, so a fresh clone has only the **stub** from `pnpm data:lp` (synthesised from city positions, and the UI says so) until it is built. Do not tune the stub — its glow tail is too long and mid-sized cities saturate, and the fix is real data.

Calibrated against the atlas in November 2026: Jakarta Pusat B8, Surabaya B7, Yogyakarta and Denpasar B5, Bosscha B5, Bromo and Dieng B3, open sea and Papua interior B1. One correction came out of it: class 1 starts at 21.97, because the natural sky the build adds is 21.98 and the usual 21.99 boundary was reachable only through uint8 rounding.

**The atlas's licence prohibits redistribution and commercial use** (`README.txt` inside the zip). The grid is derived and downsampled, but deploying it publicly is still the licence holder's call — ask Fabio Falchi before shipping it, and cite both DOIs it requires.

**Link the dataset by its DOI, never by a file URL.** The direct download host moved from `datapub.gfz-potsdam.de` to `datapub.gfz.de` and in October 2026 neither answered at all, while the DOI kept resolving. A file URL in these docs goes stale silently; the DOI is the one address GFZ has committed to.

Both stub and real paths emit the same contract (`lp-grid.bin` uint8 + `lp-meta.json` describing the decode), so swapping in real data is a file replacement with no code change:

```bash
# 684 MB zipped, ~2.9 GB extracted. Falchi et al. 2016, artificial zenith
# radiance in mcd/m^2 on a 30 arcsec grid. Download World_Atlas_2015.zip from
# https://doi.org/10.5880/GFZ.1.4.2016.001 into scripts/raw/ and unzip it there.
pip install rasterio    # wheels bundle GDAL; no system GDAL needed
python3 scripts/build_lp_grid.py --input scripts/raw/World_Atlas_2015/World_Atlas_2015.tif
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

**The look is "Kubah proyeksi": a planetarium dome with the house lights down, not a dashboard.** Surfaces are the logo navy (`--brand`) taken down to near-black (`--void #060812`), never neutral black; text is the cool white of projected starlight; interaction is `--accent`, plain white one step brighter than the text. There is no coloured accent: the only hues on screen are the ones that mean something. Because white sits so close to the text, an interactive state must never be carried by colour alone — the active tab is a raised fill, the selected search result has a bar, focus has a ring. (Rose, H-alpha, was tried first and replaced at the owner's request.) One family, Plus Jakarta Sans (Tokotype), with hierarchy carried by size and weight; `--font-display` and `--font-body` both name it and stay separate tokens only so a heading face can return without touching components. Figures use `tabular-nums`; there is no monospace face and no uppercase tracked-out labels — section labels are `.label-quiet`, sentence case in `--haze`. The ornament is the dome itself: `.horizon-rule` divides sections as a shallow arc (a top border on a box with vertically rounded corners, which tapers at both ends without a mask), and `--starfield`, a hand-placed irregular tile used as a mask, textures the empty panel — a regular dot grid reads as graph paper, not sky. Filled shapes are given by role: the limiting factor is a chip, the factor readout is one raised row per factor with a meter. This replaced "Tenun Kombu" (Sumba ikat dyes, kawung ornament), which replaced a printed-star-atlas look (Newsreader serif, dashed graticule rules), which itself replaced generic defaults (Space Grotesk + Plex Mono, vermilion on black). Smallest type is 12px.

Translucent surfaces over the map use `color-mix(in srgb, var(--panel) N%, transparent)`, never a literal `rgba()` — a literal colour is a value field mode cannot reach.

**Colour carries three meanings and only three.** `--accent` (with `--accent-dim`) is interaction: active tab, selected row, focus ring, map marker. Identity is carried by the navy surfaces, so the logo is filled from `--star`, not from an accent. `--ember` (turmeric) is warning and nothing else: errors, the limiting factor, a provisional score. `--clear` is "good". `--ember` used to mean both accent and warning, which is why recolouring the app was a token split rather than a find-and-replace — a single token that means two things cannot be changed without changing both.

`--brand` is `#193667` exactly as the logo is drawn, and at 1.6:1 against `--panel` it can only ever be a surface. Anything that needs to be *read* uses `--star`, `--haze` or `--accent`; `--accent-dim` is a surface only.

**Every colour token must be remapped in the `:root[data-field='true']` block, the blue ones most of all.** The surfaces are navy now, so this covers `--void`, `--panel` and `--panel-raised` as much as any accent. Short wavelengths are precisely what field mode exists to remove; one token left unmapped makes the mode decorative instead of functional. Verify by screenshotting field mode and scanning computed styles for a dominant blue channel, not by eye.

**Icons are drawn in `src/lib/icons.ts`, not installed.** Filled glyphs on a 24 grid, `currentColor` throughout — which is what makes field mode recolour them for free, with no second asset and no per-icon CSS. They render at 12–14px beside 11–13px type, and *that* is the size to judge them at: an earlier stroked set turned to mush, and `cloud` vs `overcast` had to be redrawn as one layer vs two because scaling the same shape was indistinguishable there. `LANDMARK_ICONS` / `CATEGORY_ICONS` / `FACTOR_ICONS` are typed as full `Record`s so a new landmark kind or sub-score fails to compile until it has a glyph.

**The map marker is a pin standing in a ring, and the ring's centre is the coordinate.** The pin says "here" from across the map; the ring, an ellipse lying on the ground, says exactly where, which a pin's one-pixel tip cannot. The marker element has zero size and `anchor: 'center'`, so MapLibre puts it exactly on the coordinate; the ring is centred on it and the pin hangs above with its tip dropped the last 1.2/24 of the glyph onto the same spot. Centring the pin glyph itself would put the tip half a glyph below the sampled point, a marker quietly lying about where its numbers came from. Verified by clicking a known pixel: ring centre and pin tip both land on it, dx=0 dy=0. The pin's head is a real hole cut with `fill-rule="evenodd"`, so the map shows through it and there is no second colour for field mode to miss. The marker takes no pointer events: clicking on the pin picks the point under it.

**The map shows where the forecast came from.** Once BMKG answers, a dashed line runs from the pin to the desa it forecast for, labelled "Forecast: {desa}". The index is kecamatan-granular, so the source can be kilometres away; the panel says how far, the map says which way. The line is a canvas layer painted from `--accent`, the label a DOM marker. Both hide while the source sits within 28px of the pin (low zoom), and the label moves to the left of its dot when it would run off the map's right edge.

**A picked point stays on screen.** A tap near an edge pans the map just far enough to clear `FRAME_INSET` (the search field, the legend, the pin's own height), and a container resize keeps a point that was visible before it visible after. A point the user deliberately panned away is left alone. The arithmetic is `panIntoView` in `src/lib/mapFraming.ts`. The map's cursor is a crosshair, because a click picks a coordinate; dragging still grabs.

**Motion is confirmation, never decoration.** Four things move, each marking something the user cannot otherwise see happen: the pin drops and its ring closes in when a point is picked (outdoors and one-handed, your finger is over the spot), the verdict settles when the forecast lands (the rating can *fall* as cloud folds in, and unmarked that reads as a misread), the search list rises as it appears, and whatever takes over the panel column announces itself. All are under 200ms and animate **transform and opacity only** — animating a colour would mean animating a token, and field mode exists so that nothing changes colour unasked. `prefers-reduced-motion` neutralises all of it from the single block in `styles.css`.

The panel column's *width* is not animated and cannot easily be: the three states declare different numbers of grid tracks (`1fr auto <size>` against `1fr auto` and `0 1fr`), and CSS interpolates neither differing track counts nor differing track types. Padding them to match would mean rewriting the column out of grid tracks — a change to the most load-bearing layout in the app for the sake of 200ms. The contents transition; the track snaps.

Two traps when checking any of this in a browser: **Vue hashes scoped keyframe names**, so `verdict-settle` is actually `verdict-settle-c913093a` and an equality check on the name silently reports "never fired". And the class arrives on the *next* Vue tick — around 76ms after a click, once MapLibre's resize has run — so a single snapshot taken at 50ms reports nothing running. Poll across the window instead of sampling once; both of those cost a false bug report already.

`MoonGlyph.vue` draws the actual phase from `illumination`, so the picture cannot disagree with the number printed beside it. The geometry lives in `src/lib/moonShape.ts` because it got the terminator's curvature backwards once and rendered a full moon as a black disc — a component cannot be unit-tested into admitting that. The maria (`MARIA`, same file) are drawn through an SVG mask: its greys are luminance, setting how much `currentColor` shows, so they are not a hard-coded colour and field mode still reaches every pixel. They overlap on purpose — separate spots read as a cow, not a moon.

**The empty state answers what does not need a location.** Phase and illuminated fraction are geocentric — the same number for every observer on Earth at a given instant — so `MoonTonight.vue` can state them before a point is picked. Moonrise, moonset and time-above-horizon are not, vary by tens of minutes across the archipelago, and belong to the readout that appears after a click. `src/lib/moonTonight.ts` exposes only the two that travel; completing the set is the mistake it exists to prevent. It is evaluated at the midnight of the night in question, pivoting on local noon, because illumination moves up to seven points a day and "now" at breakfast is not tonight.

**The verdict lives in a sticky head, not in a tab.** `VerdictHeader.vue` is rendered by `SpotPanel` above the tabs so the rating and its limiting factor stay in view while you read the evidence on Langit or Cuaca. The head stops sticking below the 52rem breakpoint: stacked, the panel is under half the screen and the head would take most of it.

`NightBar.vue` is the signature element: dark window, cloud cover, and moon presence on one time axis. It answers *when* to go, which is the decision being made. Its SVG uses a uniform aspect ratio — an earlier `preserveAspectRatio="none"` distorted all text and must not come back.

## Panel layout

The readout panel is resizable, collapsible to a rail, and expandable to fill the window. All the arithmetic — clamping, the stored-preference fallback, pointer-to-size, keyboard steps, state toggles — is pure and lives in `src/lib/panelLayout.ts`; `usePanelLayout` only holds the reactive state, the listeners, and localStorage.

Sizes are stored in **pixels and re-clamped against the live container**, not as a fraction of it. The panel has an absolute minimum below which the forecast table stops laying out, and the map has one below which it stops being pickable; a fraction cannot express either. `clampPanelSize` also has to handle the two minimums not both fitting, because otherwise its lower and upper bounds cross and it silently returns whichever was applied last.

Three things that will bite:

- **`grid-template-columns` must match the number of children actually rendered.** The separator is only rendered in the `normal` state, so the minimized and maximized states declare two tracks, not three. Leaving three left the panel in the middle `auto` track, sized to its content instead of filling the window.
- **The `@media (max-width: 52rem)` breakpoint exists twice** — in `App.vue` and as `STACKED_QUERY` in `usePanelLayout.ts`. CSS decides the layout, JS decides whether a drag is measured against width or height. They have to agree.
- **Anything that can occupy the panel column has to carry `PanelControls`.** They are not part of the spot readout; they belong to the container. Living inside `SpotPanel`, which is not rendered before a point is picked, meant maximizing on a fresh session hid the map behind a panel with no way to shrink — and the state outlived a reload, so the app came back trapped. `App.vue` renders them in the empty state too.
- **MapLibre only watches the window, not its container.** `MapView` runs a `ResizeObserver` calling `map.resize()`. Without it a resized panel leaves a stretched canvas whose clicks return coordinates for somewhere the user did not click. MapLibre's own window listener is off (`trackResize: false`): it resized first, and its `moveend` recorded the picked point as off screen before the observer could keep it in view.

`SpotPanel`'s content is capped at 46rem and centred. Past that a readout column stops being easier to read and `NightBar`, which keeps a uniform aspect ratio on purpose, renders as a 400px-tall graphic with type to match.

**Do not use `:global(...)` as the first compound selector in a scoped block.** `:global(.body[data-placement='below']) .window-controls .icon { transform: rotate(90deg) }` compiled to a rule matching `.body` itself and rotated the entire application ninety degrees on narrow screens — a total layout failure that `pnpm build` and every unit test passed straight through. Pass the state down as a prop and put the class where it belongs.

The panel controls are a three-way layout picker (`PanelControls.vue`): rail, split, full, drawn as pictures of the result, with the current one as a raised fill like the active tab. The glyphs (`panelRail`/`panelSplit`/`panelFull`) are named for **what they draw**, not for the action they trigger. An earlier pair named `minimize`/`maximize` ended up pointing the wrong way, and its successor, a chevron against a bar, read as media skip buttons. In the empty state the picker floats so only the heading wraps around it; it carries `z-index: 1` because the positioned text after it otherwise covers it and swallows every click.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.claude/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.claude/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.claude/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.claude/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.claude/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.claude/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->
