# Dashboard GIS — DITPIT Bappenas (Sprint 2 · revisi layer + ekspor PNG)

Kerangka dashboard yang siap ditempeli MapLibre. Revisi ini mengganti taksonomi
layer agar sesuai kebutuhan wilayah (Maluku, Maluku Utara, NTB, NTT) dan
mengganti unduh GeoJSON/CSV dengan **ekspor peta ke PNG** berjudul + legenda
yang dibuat otomatis. **Tanpa dependensi baru** — cukup `npm run dev`.

## Penempatan file (timpa file lama bila perlu)

```
app/
  globals.css   layout.tsx   page.tsx   icon.png   favicon.ico
components/
  dashboard/  DashboardShell, TopBar, Sidebar, MapContainer,
              LayerPanel, StatsPanel, ExportPanel        ← (DownloadPanel dihapus)
  ui/         icons.tsx, Swatch.tsx                      ← Swatch.tsx baru
lib/
  layers.ts            ← registry layer (sumber tunggal) — DIUBAH
  dashboard-context.tsx← state provinsi + judul ekspor   — DIUBAH
  export-map.ts        ← penyusun PNG (Canvas 2D)         — BARU
public/
  logo.png
```

> **src/** — jika project memakai `src/app`, pindahkan `components/` & `lib/` ke
> dalam `src/`. Alias `@/*` tetap menunjuk ke root yang benar.

## Sumber tunggal: `lib/layers.ts`

Semua layer didefinisikan di satu tempat. Mengubah/menambah layer = mengubah satu
entri; panel, legenda peta, dan legenda PNG ikut otomatis. Tiap layer punya
**warna & simbol kartografis sendiri** (bukan sekadar warna per-geometri) supaya
peta tematik terbaca dan legenda bermakna.

Layer saat ini:

- **Batas Administrasi**: Provinsi, Kabupaten/Kota, Kecamatan (digambar sebagai
  garis batas). Pemilih provinsi: Maluku / Maluku Utara / NTB / NTT.
- **Tematik · Penggunaan Lahan** (area): Perkebunan, Ladang, Sawah, Garam,
  Tambak, Permukiman, Kawasan Konservasi & Taman Nasional.
- **Tematik · Jaringan Jalan** (garis): Nasional, Provinsi, Kabupaten/Kota,
  Lokal, Lain, Setapak.
- **Tematik · Fasilitas Pendidikan** (titik): Tinggi, Menengah, Dasar.
- **Tematik · Fasilitas Kesehatan** (titik): Rumah Sakit, Puskesmas Utama,
  Puskesmas Pembantu.
- **Tematik · Transportasi** (titik): Pelabuhan, Bandara.

## Ekspor PNG (tab "Ekspor")

- Input **judul** deskriptif → langsung tampil di kepala PNG. Kosong = judul
  otomatis dari provinsi terpilih.
- **Pratinjau live** ter-generate saat mengetik / mengubah layer.
- **Legenda otomatis** dari layer aktif, dikelompokkan per sub-grup, plus tanggal,
  panah utara, skala, dan footer sumber.
- Implementasi `lib/export-map.ts` murni Canvas 2D — tidak menambah dependensi.

## Mengaktifkan MapLibre (Sprint 3) + tangkapan peta asli pada PNG

Buka `components/dashboard/MapContainer.tsx`, blok MapLibre sudah ditulis sebagai
komentar. Saat inisialisasi peta, tambahkan **`preserveDrawingBuffer: true`** agar
kanvas WebGL bisa ditangkap. Lalu pada `ExportPanel`, oper kanvas peta ke
`renderMapExport(canvas, { ..., mapImage: mapRef.current.getCanvas() })` —
exporter akan otomatis menggambar tangkapan peta menggantikan area pratinjau.

## Catatan

- File ini revisi struktur/UI; **belum** memuat GeoJSON/PMTiles (sesuai
  permintaan, basemap belum disentuh).
- `app/layout.tsx` memakai Geist via `next/font/google` — perlu akses jaringan
  ke Google Fonts saat build (di Vercel aman).
