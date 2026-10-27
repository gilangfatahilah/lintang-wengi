# Lintang Wengi

Find astrophotography and stargazing locations in Indonesia. Click a point on the map — or search for a place, or use your device location — and get a 1–5 viability score for tonight, combining light pollution, BMKG cloud cover forecast, and moonlight interference, computed for the astronomical dark window at that location.

The interface is bilingual (English / Indonesian) and has a red-only field mode that preserves dark adaptation outdoors.

Status: **Phase 1 (MVP)** is implemented.

## Running

```bash
pnpm install
pnpm data:lp        # required: builds the light pollution grid (its artifacts are not committed)
echo 'VITE_CARTO_API_KEY=…' > .env.local   # required: base map key, free at https://carto.com/basemaps/apikey/
pnpm dev            # http://localhost:5173
```

The CARTO key ends up in every tile URL the browser requests, so it cannot be kept secret — restrict it to your domains in the CARTO dashboard instead. Vite bakes it in at build time, so it must also be present wherever `pnpm build` runs.

You do not need to run `pnpm data:wilayah` — the kecamatan index is committed. Run it only when Kemendagri revises its region codes.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server. Vite forwards `/api/forecast` straight to BMKG. |
| `pnpm test` | Unit tests (`src/lib/`). |
| `pnpm build` | Typecheck + production build. |
| `pnpm preview:cf` | Build, then serve through Cloudflare Workers — the real production path, proxy included. |
| `pnpm deploy:cf` | Build and deploy to Cloudflare Workers. |
| `pnpm data:lp` | Regenerate the light pollution grid (stub mode). |
| `pnpm data:wilayah` | Regenerate the kecamatan index. Add `--validate` to check adm4 codes against the BMKG API. |

The dev server and `preview:cf` use the same `/api/forecast` path, but different implementations: Vite proxies directly, while production uses [`worker/index.ts`](worker/index.ts). **Test changes to the proxy with `pnpm preview:cf`** — they will not show up under `pnpm dev`.

## Deploying

```bash
npx wrangler login
pnpm deploy:cf
```

It is named `deploy:cf` rather than `deploy` because pnpm has a built-in `deploy` subcommand that shadows any script of that name — `pnpm deploy` fails with `ERR_PNPM_CANNOT_DEPLOY` and never reaches the script.

There are no environment variables or secrets. BMKG does not require an API key.

The app deploys as a Cloudflare Worker with static assets, not as Cloudflare Pages. This is not a technical choice: some Indonesian ISPs block `pages.dev` at the DNS level, so the app is healthy but unreachable from home networks. Such blocks match on domain name and the lists differ between ISPs — so `workers.dev` is no guarantee for every user either. A custom domain is the only durable fix.

## Data notes

**Light pollution is currently placeholder data**, synthesised from city positions — the values are plausible but not measured, and the UI says so. Mid-sized cities tend to read too bright in this stub.

To use real data (World Atlas 2015, Falchi et al.):

```bash
mkdir -p scripts/raw && cd scripts/raw
curl -O https://datapub.gfz-potsdam.de/download/10.5880.GFZ.1.4.2016.001/World_Atlas_2015.zip
unzip World_Atlas_2015.zip && cd ../..

pip install rasterio    # the wheels bundle GDAL; no system GDAL needed
python3 scripts/build_lp_grid.py --input scripts/raw/World_Atlas_2015.tif
pnpm test               # the calibration suite activates automatically once real data is in place
```

The download is 684 MB (~2.9 GB extracted). The stub and real data emit the same contract, so switching is a file replacement with no code change.

**Weather forecasts come from BMKG** (Badan Meteorologi, Klimatologi, dan Geofisika — Indonesia's meteorological agency) via its [public API](https://data.bmkg.go.id/prakiraan-cuaca/). Crediting BMKG as the data source is a condition of using that API. Base map from CARTO and OpenStreetMap.

Astronomical calculations (twilight, moon phase and position) run client-side with `astronomy-engine`, with no external API.

## Architecture

Architecture details, the constraints that shaped the design, and the things that are easy to get wrong are in [`CLAUDE.md`](CLAUDE.md).
