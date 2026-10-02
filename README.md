# KASUARI Bappenas

**Kumpulan Statistik Unggulan Regional Indonesia Timur** — dashboard Direktorat Pengembangan Kawasan
Indonesia Timur (DITPIT) Bappenas untuk 16 provinsi dan 176 kab/kota di wilayah timur.

| Halaman | Isi |
|---|---|
| `/` **Peta Tematik** | Peta MapLibre: choropleth indikator makro per kab/kota (tab **Makro**), Jalan Nasional & Kawasan Prioritas RPJMN 2025–2029 (tab **Layer**), ringkasan wilayah (tab **Wilayah**), ekspor PNG (tab **Ekspor**). `/?kode=7371` langsung menyorot wilayah. |
| `/profil?kode=7371` **Profil Daerah** | ±70 kartu indikator per provinsi/kab-kota (tren, peringkat, tabel) dalam 11 bagian. |

## Menjalankan di komputer

Klik dua kali **`dev.cmd`** (memasang dependensi lalu membuka http://localhost:3000), atau:

```bash
npm install
npm run dev
```

Salin `.env.example` menjadi `.env.local` dan isi `NEXT_PUBLIC_CARTO_KEY` (basemap "Peta").
Di Vercel, isi variabel yang sama di *Project Settings → Environment Variables*.

## Struktur folder

```
app/                      halaman & API (Next.js App Router)
  page.tsx                  Peta Tematik
  profil/page.tsx           Profil Daerah
  api/database/             baca Google Spreadsheet "Database PIT" (cache ±5 menit)
  api/kawasan-prioritas/    baca spreadsheet Daftar Kawasan RPJMN (cache ±5 menit)
components/
  app/                      header bersama, keterangan sumber data
  dashboard/                peta & panel samping (Layer, Wilayah, Makro, Ekspor)
  profil/                   kartu & grafik Profil Daerah
  ui/                       ikon, swatch
lib/                      logika data & peta (layers.ts = daftar layer, makro.ts = indikator peta,
                          profil/config.tsx = kartu profil, jalan.ts, kawasan-prioritas.ts, db/ = pembaca spreadsheet)
public/data/              data statis yang dipakai situs (batas wilayah, jalan nasional, salinan cadangan database)
public/fonts/             huruf label peta (offline)
scripts/                  pengolah data mentah → public/data (dijalankan manual bila data sumber berubah)
docs/                     DATABASE.md (spreadsheet, kawasan, jalan) · DATA-MAKRO.md (choropleth, batas wilayah)
data-sumber/              data GIS mentah (SHP, GPKG) — HANYA di komputer, tidak di-commit (terlalu besar)
```

## Data

- **Indikator (Profil & Makro)** dibaca langsung dari Google Spreadsheet — edit spreadsheet, situs ikut berubah
  dalam ±5 menit tanpa git push. Lihat [`docs/DATABASE.md`](docs/DATABASE.md).
- **Kawasan Prioritas RPJMN** — spreadsheet terpisah, pola sama. Lihat [`docs/DATABASE.md`](docs/DATABASE.md).
- **Batas wilayah** (`public/data/wilayah.topo.json`) dari `data-sumber/KabKotaPIT.shp` via `scripts/build-map-data.mjs`.
  Lihat [`docs/DATA-MAKRO.md`](docs/DATA-MAKRO.md).
- **Jalan Nasional** (`public/data/jalan-nasional.geojson`) dari `data-sumber/JalanNasionalPIT.gpkg` via
  `scripts/build-jalan-nasional.py`.
- **Basemap**: Peta (CARTO, butuh key), Satelit (Esri), Polos. Bila tile online gagal → otomatis peta "Wilayah" offline.

### Menambah data besar berikutnya
Olah dulu data mentah menjadi berkas ringkas di `public/data/` (buang atribut & ketelitian yang tidak perlu,
sederhanakan geometri), muat **hanya saat layer dinyalakan** (lihat pola Jalan Nasional di `lib/dashboard-context.tsx`),
dan simpan berkas mentahnya di `data-sumber/`. Untuk data > ±10 MB pertimbangkan *vector tiles* (PMTiles).

## Tampilan
Bahasa visual mengacu ke Tabler (MIT) yang diterjemahkan ke Tailwind 4 di `app/globals.css`, tanpa dependensi
tambahan. Font Inter (OFL) disimpan lokal di `app/fonts/`.
