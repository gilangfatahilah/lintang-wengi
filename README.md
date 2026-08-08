# Lintang Wengi

Cari lokasi astrophotography dan stargazing di Indonesia. Klik satu titik di peta, dapat skor kelayakan malam ini dari gabungan polusi cahaya, prakiraan tutupan awan BMKG, dan gangguan cahaya bulan — dihitung untuk jendela gelap astronomis di lokasi tersebut.

Status: **Phase 1 (MVP)** berjalan. Lihat [`PLAN.md`](PLAN.md) untuk lingkup per fase.

## Menjalankan

```bash
pnpm install
pnpm data:lp        # wajib: bikin grid polusi cahaya (artefaknya tidak di-commit)
pnpm dev            # http://localhost:5173
```

`pnpm data:wilayah` tidak perlu dijalankan — indeks kecamatannya sudah ikut ter-commit. Jalankan hanya kalau kode wilayah Kemendagri berubah.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `pnpm dev` | Dev server. `/api/forecast` diteruskan langsung ke BMKG oleh Vite. |
| `pnpm test` | Unit test (`src/lib/`). |
| `pnpm build` | Typecheck + build produksi. |
| `pnpm preview:cf` | Build lalu sajikan lewat Cloudflare Workers — jalur produksi sesungguhnya, termasuk proxy. |
| `pnpm deploy` | Build dan deploy ke Cloudflare Workers. |
| `pnpm data:lp` | Regenerate grid polusi cahaya (mode stub). |
| `pnpm data:wilayah` | Regenerate indeks kecamatan. Tambahkan `--validate` untuk mengecek kode adm4 ke API BMKG. |

Dev server dan `preview:cf` memakai path `/api/forecast` yang sama, tapi implementasinya beda: Vite mem-proxy langsung, sedangkan produksi memakai [`worker/index.ts`](worker/index.ts). **Uji perubahan pada proxy lewat `pnpm preview:cf`** — perubahan di situ tidak akan terlihat di `pnpm dev`.

## Deploy

```bash
npx wrangler login
pnpm deploy
```

Tidak ada environment variable atau secret. BMKG tidak memerlukan API key.

Deploy-nya sebagai Cloudflare Worker dengan static assets, bukan Cloudflare Pages. Ini bukan soal teknis: sebagian ISP Indonesia memblokir `pages.dev` di level DNS, sehingga aplikasinya sehat tapi tidak bisa dibuka dari jaringan rumahan. Blokir semacam itu mencocokkan nama domain, dan daftarnya berbeda antar ISP — jadi `workers.dev` pun bukan jaminan untuk semua pengguna. Custom domain adalah satu-satunya perbaikan yang tahan lama.

## Catatan data

**Polusi cahaya saat ini masih data sementara**, disintesis dari posisi kota — angkanya masuk akal tapi bukan hasil pengukuran, dan UI menyatakan itu. Kota menengah cenderung terbaca terlalu terang di data stub ini.

Untuk memakai data asli (World Atlas 2015, Falchi dkk.):

```bash
mkdir -p scripts/raw && cd scripts/raw
curl -O https://datapub.gfz-potsdam.de/download/10.5880.GFZ.1.4.2016.001/World_Atlas_2015.zip
unzip World_Atlas_2015.zip && cd ../..

pip install rasterio    # wheel-nya sudah membundel GDAL, tidak perlu GDAL sistem
python3 scripts/build_lp_grid.py --input scripts/raw/World_Atlas_2015.tif
pnpm test               # suite kalibrasi otomatis aktif setelah data asli terpasang
```

Unduhannya 684 MB (±2,9 GB setelah diekstrak). Stub dan data asli menghasilkan kontrak yang sama, jadi pergantiannya cuma tukar file tanpa ubah kode.

**Prakiraan cuaca dari BMKG** (Badan Meteorologi, Klimatologi, dan Geofisika) via [API publik](https://data.bmkg.go.id/prakiraan-cuaca/). Mencantumkan BMKG sebagai sumber data adalah syarat penggunaan API tersebut. Peta dasar dari CARTO dan OpenStreetMap.

Perhitungan astronomi (senja, fase dan posisi bulan) dilakukan di sisi klien dengan `astronomy-engine`, tanpa API eksternal.

## Arsitektur

Detail arsitektur, kendala yang membentuk desainnya, dan hal-hal yang mudah salah ada di [`CLAUDE.md`](CLAUDE.md).
