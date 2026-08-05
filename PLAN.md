# Stargazing Spot Finder — MVP Brief

> Working title. Side project — web app GIS untuk mencari & menilai lokasi astrophotography/stargazing terbaik di Indonesia berdasarkan light pollution, cuaca, dan fase bulan.

## 1. Ringkasan & Problem

Astrophotography dan stargazing butuh kombinasi kondisi yang jarang align: langit gelap (jauh dari light pollution), cuaca cerah (tutupan awan rendah), dan bulan yang nggak terlalu terang (biar Milky Way/bintang tetap kelihatan). Saat ini proses cari lokasi & waktu yang pas dilakukan manual — cek beberapa situs/app terpisah lalu disimpulkan sendiri.

**Value proposition:** user klik titik di peta (atau pilih dari spot favorit), app kasih skor kelayakan "malam ini" berdasarkan kombinasi light pollution lokasi, forecast cuaca 3 hari ke depan, dan fase bulan — plus kalender kapan galactic core Milky Way muncul di atas horizon untuk lokasi tersebut.

## 2. Target User

Personal use dulu (dogfooding untuk trip astrophotography sendiri), dengan potensi dibuka untuk komunitas stargazing/astrophotography Indonesia.

## 3. Scope Fitur

### Phase 1 — MVP
- [ ] Peta interaktif Indonesia dengan overlay light pollution (static layer)
- [ ] Klik titik di peta → tampilkan:
  - Forecast cuaca 3 hari (tutupan awan, per 3 jam) dari BMKG
  - Fase bulan malam ini + waktu moonrise/moonset
  - Skor kelayakan sederhana (kombinasi 3 faktor → rating 1–5)
- [ ] Tanpa auth, tanpa data tersimpan — pure client-side computation

### Phase 2
- [ ] Auth + simpan spot favorit
- [ ] Kalender visibilitas galactic core Milky Way per lokasi tersimpan
- [ ] Riwayat/catatan hasil sesi motret per spot

### Phase 3 (opsional, belum prioritas)
- [ ] Community notes/foto per spot
- [ ] Notifikasi kalau kondisi bagus mendekat di spot favorit

## 4. Arsitektur & Tech Stack

**Keputusan:** stack berbasis Vue, tanpa Laravel dan tanpa PostgreSQL — arsitektur dibuat seringan mungkin, backend minimal.

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | Vue 3 + Vite (SPA), TypeScript | Static-hostable, sesuai preferensi stack |
| Map rendering | MapLibre GL JS | Lebih ringan & modern dari Leaflet untuk overlay raster/vector tiles |
| Spatial query | Turf.js (client-side) | Dataset grid Indonesia relatif kecil, gak perlu spatial DB server-side untuk MVP |
| Data cuaca | BMKG public API, lewat 1 serverless proxy function (Cloudflare Workers/Vercel Functions) | API resmi BMKG kena CORS block dari browser — butuh proxy tipis, tapi tetap bukan backend framework penuh |
| Astronomi (moon phase, galactic core position) | Library JS client-side (`suncalc`, `astronomy-engine`) | Bisa dihitung, gak butuh API eksternal |
| Light pollution data | GeoTIFF (VIIRS/Sky Brightness) → preprocess sekali (Python/GDAL) → static GeoJSON/PMTiles | Data statis, gak berubah harian, cukup di-serve sebagai asset |
| Storage untuk Phase 2 (saved spots, auth) | PocketBase (SQLite-based, single binary) — kandidat utama; alternatif: Firebase | Ringan, cocok side project solo, gak perlu Postgres |
| Hosting | Static hosting (Netlify/Cloudflare Pages) + serverless function | Sesuai arsitektur backend-minimal |

## 5. Data Sources

- **Light pollution**: VIIRS/Sky Brightness GeoTIFF dari lightpollutionmap.info (resolusi ±500m/pixel, proyeksi EPSG:3857), atau atlas dari David Lorenz (data satelit 2024). Data statis, di-preprocess sekali di awal.
- **Cuaca**: BMKG public API — `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah_administrasi_tingkat_IV}`. Forecast 3 hari, 8 data per hari (per 3 jam). **Wajib mencantumkan BMKG sebagai sumber data** di UI.
- **Moon phase & galactic core**: dihitung client-side, tanpa API eksternal.

## 6. Known Constraints & Gotchas

- BMKG API tidak mengirim header CORS yang benar → perlu 1 serverless proxy function, bukan bisa langsung di-fetch dari browser.
- Kode wilayah BMKG pakai format administrasi tingkat IV (kelurahan/desa) — perlu mapping dari koordinat klik peta ke kode wilayah terdekat (butuh lookup table wilayah Indonesia).
- Raster GeoTIFF light pollution perlu di-convert ke format ringan (grid point/vector tiles) sebelum dipakai di frontend — file GeoTIFF mentah terlalu berat untuk diproses langsung di browser.

## 7. Out of Scope (untuk MVP)

- Auth & akun user
- Data tersimpan/persisten
- Community features
- Notifikasi

## 8. Next Steps

1. Setup project skeleton (Vue + Vite + TypeScript)
2. Preprocessing script (Python/GDAL) untuk convert light pollution GeoTIFF → GeoJSON grid
3. Setup serverless proxy function untuk BMKG API
4. Build peta dasar + overlay light pollution
5. Integrasi cuaca + moon phase + scoring logic
