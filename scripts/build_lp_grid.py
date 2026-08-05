#!/usr/bin/env python3
"""
Builds the light pollution grid consumed by src/lib/lightPollution.ts.

Two artifacts, one contract:
  public/data/lp-grid.bin     uint8 grid, row-major, north row first
  public/data/lp-meta.json    bbox + dimensions + how to decode the bytes
  public/data/lp-overlay.png  RGBA colouring of the same grid, for the map

Values are sky brightness in mag/arcsec^2 (higher = darker), quantised to uint8
across [MAG_MIN, MAG_MAX]. uint8 rather than float32 because 0.03 mag of precision
is far finer than the Bortle classes we bucket into, and it keeps the payload at
~2 MB instead of ~8 MB.

Modes
  --stub   Synthesise a plausible grid from city positions. No download required,
           so the whole app can be built and tested end to end before committing
           to the 2.9 GB source raster.
  (none)   Read a real GeoTIFF of artificial sky brightness in mcd/m^2 and crop it
           to Indonesia. Requires `pip install rasterio` (its wheels bundle GDAL,
           so no system GDAL install is needed).

Because both modes emit the same contract, swapping stub for real data is a file
replacement -- no application code changes.

Usage:
  python3 scripts/build_lp_grid.py --stub
  python3 scripts/build_lp_grid.py --input scripts/raw/World_Atlas_2015.tif
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data"

# Sabang to Merauke, with a margin so coastal clicks never fall outside the grid.
BBOX = (94.5, -11.5, 141.5, 6.5)  # west, south, east, north
RESOLUTION_DEG = 0.02  # ~2.2 km; finer than this does not change site selection

# Quantisation range. Real skies span ~16 (inner city) to ~22 (pristine).
MAG_MIN, MAG_MAX = 16.0, 22.5

# Zenith brightness of a natural, unpolluted sky.
NATURAL_MCD_M2 = 0.174
# B [cd/m^2] -> mag/arcsec^2 uses S = -2.5 log10(B / 1.08e5).
# Working in mcd/m^2 folds the /1000 into the constant.
MCD_TO_MAG_CONST = 1.08e8


def mcd_to_mag(brightness_mcd: np.ndarray) -> np.ndarray:
    """Total sky brightness in mcd/m^2 -> mag/arcsec^2 (higher is darker)."""
    safe = np.maximum(brightness_mcd, 1e-6)
    return -2.5 * np.log10(safe / MCD_TO_MAG_CONST)


# Rough population-weighted glow sources. Intensities are relative, tuned so Jakarta
# lands in Bortle 8-9 and remote areas stay Bortle 1-2. Stub data only -- these are
# not measurements, and exist purely so the UI and scoring have realistic contrast.
CITIES = [
    # (lat, lon, relative intensity)
    (-6.20, 106.85, 900),  # Jakarta
    (-7.25, 112.75, 420),  # Surabaya
    (-6.91, 107.62, 380),  # Bandung
    (3.59, 98.67, 300),    # Medan
    (-6.97, 110.42, 200),  # Semarang
    (-5.15, 119.43, 190),  # Makassar
    (-2.98, 104.75, 170),  # Palembang
    (-8.65, 115.22, 150),  # Denpasar
    (-7.80, 110.36, 145),  # Yogyakarta
    (-7.98, 112.63, 130),  # Malang
    (-6.60, 106.80, 130),  # Bogor
    (-7.57, 110.83, 120),  # Surakarta
    (0.51, 101.45, 115),   # Pekanbaru
    (-3.32, 114.59, 100),  # Banjarmasin
    (-1.24, 116.85, 95),   # Balikpapan
    (-0.02, 109.34, 95),   # Pontianak
    (-0.95, 100.35, 90),   # Padang
    (1.49, 124.84, 85),    # Manado
    (-6.71, 108.55, 80),   # Cirebon
    (-8.58, 116.10, 65),   # Mataram
    (-3.70, 128.18, 55),   # Ambon
    (-10.18, 123.61, 50),  # Kupang
    (-2.53, 140.72, 45),   # Jayapura
    (-0.88, 131.25, 40),   # Sorong
]


def build_grid_shape() -> tuple[int, int]:
    west, south, east, north = BBOX
    width = int(round((east - west) / RESOLUTION_DEG))
    height = int(round((north - south) / RESOLUTION_DEG))
    return width, height


def cell_centre_coords(width: int, height: int) -> tuple[np.ndarray, np.ndarray]:
    """Longitude and latitude of each cell centre. Row 0 is the northernmost."""
    west, south, east, north = BBOX
    lons = west + (np.arange(width) + 0.5) * (east - west) / width
    lats = north - (np.arange(height) + 0.5) * (north - south) / height
    return lons, lats


def synthesise() -> np.ndarray:
    """Sum a distance falloff from each city onto the natural background."""
    width, height = build_grid_shape()
    lons, lats = cell_centre_coords(width, height)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    brightness = np.full((height, width), NATURAL_MCD_M2, dtype=np.float64)

    for lat, lon, intensity in CITIES:
        # Degrees are not equal distances, but near the equator the correction is
        # small and this is synthetic data regardless.
        d_lat = lat_grid - lat
        d_lon = (lon_grid - lon) * math.cos(math.radians(lat))
        dist_deg = np.sqrt(d_lat**2 + d_lon**2)
        # Light scatters with a steep but long tail: bright core, glow persisting
        # for tens of km. ~0.09 deg (10 km) core scale.
        brightness += intensity * NATURAL_MCD_M2 / (1.0 + (dist_deg / 0.09) ** 2.5)

    return mcd_to_mag(brightness)


def from_geotiff(path: Path) -> np.ndarray:
    """Crop and resample a real artificial-brightness raster onto our grid."""
    try:
        import rasterio
        from rasterio.enums import Resampling
        from rasterio.warp import calculate_default_transform, reproject
    except ImportError as exc:  # pragma: no cover - depends on optional install
        raise SystemExit(
            "rasterio is required for the real-data path.\n"
            "  pip install rasterio\n"
            "Its wheels bundle GDAL, so no system GDAL package is needed."
        ) from exc

    width, height = build_grid_shape()
    west, south, east, north = BBOX
    dst = np.zeros((height, width), dtype=np.float32)

    with rasterio.open(path) as src:
        dst_transform, _, _ = calculate_default_transform(
            src.crs, "EPSG:4326", width, height, west, south, east, north
        )
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=dst_transform,
            dst_crs="EPSG:4326",
            resampling=Resampling.average,
        )

    # World Atlas rasters carry artificial brightness only; the natural sky adds on top.
    return mcd_to_mag(dst.astype(np.float64) + NATURAL_MCD_M2)


def quantise(mag: np.ndarray) -> np.ndarray:
    normalised = (mag - MAG_MIN) / (MAG_MAX - MAG_MIN)
    return np.clip(np.round(normalised * 255), 0, 255).astype(np.uint8)


def render_overlay(mag: np.ndarray) -> Image.Image:
    """
    Colours the grid for display over a dark basemap.

    Pristine sky is left fully transparent so the map underneath shows through --
    on a stargazing map the interesting signal is where the light *is*.
    """
    stops = [
        # (mag/arcsec^2, R, G, B, A)
        (22.00, 0, 0, 0, 0),        # pristine: invisible
        (21.70, 20, 60, 130, 60),   # deep blue haze
        (21.30, 30, 130, 120, 110), # teal
        (20.50, 60, 170, 70, 150),  # green
        (19.50, 220, 200, 60, 180), # yellow
        (18.90, 240, 140, 40, 200), # orange
        (18.30, 230, 70, 50, 220),  # red
        (17.00, 255, 245, 235, 240),# saturated core
    ]
    knots = np.array([s[0] for s in stops][::-1])
    channels = np.array([[s[i] for s in stops][::-1] for i in range(1, 5)], dtype=np.float64)

    flat = np.clip(mag.ravel(), knots[0], knots[-1])
    rgba = np.stack([np.interp(flat, knots, ch) for ch in channels], axis=-1)
    return Image.fromarray(
        rgba.reshape(*mag.shape, 4).astype(np.uint8), mode="RGBA"
    )


def bortle_summary(mag: np.ndarray) -> str:
    thresholds = [(21.99, 1), (21.89, 2), (21.69, 3), (20.49, 4),
                  (19.50, 5), (18.94, 6), (18.38, 7), (17.80, 8)]
    counts = {}
    remaining = np.ones(mag.shape, dtype=bool)
    for limit, cls in thresholds:
        hit = remaining & (mag >= limit)
        counts[cls] = int(hit.sum())
        remaining &= ~hit
    counts[9] = int(remaining.sum())
    total = mag.size
    return "  " + "  ".join(
        f"B{c}:{100 * n / total:.1f}%" for c, n in sorted(counts.items()) if n
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stub", action="store_true",
                        help="synthesise placeholder data instead of reading a raster")
    parser.add_argument("--input", type=Path,
                        help="path to a GeoTIFF of artificial sky brightness (mcd/m^2)")
    args = parser.parse_args()

    if args.stub:
        print("Synthesising placeholder light pollution grid...")
        mag = synthesise()
    elif args.input:
        print(f"Reading {args.input} ...")
        mag = from_geotiff(args.input)
    else:
        parser.error("pass --stub or --input <geotiff>")

    width, height = build_grid_shape()
    grid = quantise(mag)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    (OUT_DIR / "lp-grid.bin").write_bytes(grid.tobytes())
    render_overlay(mag).save(OUT_DIR / "lp-overlay.png", optimize=True)
    (OUT_DIR / "lp-meta.json").write_text(json.dumps({
        "bbox": list(BBOX),
        "width": width,
        "height": height,
        "encoding": "uint8-linear-mag",
        "magMin": MAG_MIN,
        "magMax": MAG_MAX,
        "source": "stub" if args.stub else str(args.input),
        "note": "mag/arcsec^2 = magMin + (byte/255)*(magMax-magMin); row 0 is north",
    }, indent=2) + "\n")

    print(f"\nWrote {OUT_DIR}")
    print(f"  grid {width}x{height} = {grid.nbytes / 1e6:.2f} MB")
    print(f"  mag range {mag.min():.2f} .. {mag.max():.2f}")
    print(bortle_summary(mag))
    if args.stub:
        print("\n  NOTE: placeholder data. Values are plausible, not measured.")


if __name__ == "__main__":
    main()
