# Kerangka Dashboard GIS — DITPIT Bappenas (Sprint 2)

Struktur bersih, modern, responsif, dan **siap ditempeli MapLibre**. Belum ada
database / GeoJSON / PMTiles — sesuai permintaan.

## Penempatan file

Salin folder ke root project `ditpit-bappenas` (timpa file lama bila perlu):

```
app/
  globals.css        ← timpa
  layout.tsx         ← timpa
  page.tsx           ← timpa
  icon.png           ← favicon dari Logo Bappenas (Next.js otomatis pakai)
  favicon.ico        ← hapus favicon.ico bawaan dulu, ganti dengan ini
components/
  dashboard/  (DashboardShell, TopBar, Sidebar, MapContainer, LayerPanel, StatsPanel, DownloadPanel)
  ui/         (icons.tsx)
lib/
  layers.ts            ← registry layer (sumber tunggal)
  dashboard-context.tsx
public/
  logo.png           ← logo untuk header
```

> **Catatan src/** — Jika project memakai `src/app`, pindahkan `components/` dan
> `lib/` ke dalam `src/`. Alias `@/*` bawaan create-next-app sudah menunjuk ke
> root yang tepat, jadi import `@/components/...` & `@/lib/...` tetap jalan.

Tidak ada dependensi baru. Cukup:

```bash
npm run dev
```

## Yang sudah jadi

- Layout dashboard: TopBar + Sidebar + Map (full-bleed) — responsif sampai mobile (sidebar jadi drawer).
- **Layer Manager** berkelompok (Admin / Tematik / Infrastruktur): switch on/off, slider opacity, master toggle per grup.
- Warna kategori diambil dari logo Bappenas → jadi **legenda fungsional**: biru = poligon, emas = garis, hijau = titik.
- Panel Statistik & Unduh (kerangka, siap diisi).
- HUD koordinat + legenda melayang di atas peta (glass panel).
- Dark / light mode (ikut sistem, bisa di-toggle).

## Mengaktifkan MapLibre (Sprint 3)

Buka `components/dashboard/MapContainer.tsx`. Blok kode MapLibre sudah ditulis
sebagai komentar — tinggal:

1. `import maplibregl from "maplibre-gl";` dan `import "maplibre-gl/dist/maplibre-gl.css";` di atas file.
2. Buka komentar blok `useEffect` inisialisasi peta.
3. Hapus handler `onMove` placeholder (koordinat akan diisi event peta asli).

## Menambah layer (Sprint 4+)

Cukup tambah satu entri di `lib/layers.ts`. Sidebar, legenda, dan daftar unduh
ikut otomatis. Saat data siap, isi `source` (path GeoJSON/PMTiles) lalu sinkronkan
di blok `useEffect [layerState]` pada `MapContainer.tsx`.

---

## Integrasi Profil Daerah + desain baru (Sprint berikutnya)

Aplikasi kini punya **dua halaman** dengan header bersama (`components/app/AppHeader.tsx`):

| Rute | Isi |
|---|---|
| `/` | **Peta Tematik** — GIS MapLibre (layer, choropleth makro, ekspor). Klik kab/kota → tab **Wilayah** menampilkan ringkasan indikator + tombol *Buka profil lengkap*. `/?kode=5310` langsung menyorot & membingkai wilayah. |
| `/profil?kode=5310` | **Profil Daerah** — port penuh dashboard "Profil Daerah Indonesia Timur" (11 bagian, ±70 kartu: tren / peringkat / tabel, fallback ke angka provinsi). Tombol *Lihat di peta* untuk wilayah di 4 provinsi peta. |

Pencarian wilayah di header (Ctrl K) mencari 218 provinsi & kab/kota lalu membuka profilnya.

### Arah desain
Bahasa visual mengacu ke **Tabler** (github.com/tabler/tabler, MIT) — diterjemahkan ke token
Tailwind 4 di `app/globals.css`, **tanpa** menambah Bootstrap/dependensi. Font Inter (OFL) disimpan
lokal di `app/fonts/` (tidak butuh Google Fonts → aman di jaringan tertutup).
Warna grafik: biru = wilayah terpilih, emas (logo Bappenas) = provinsi, abu putus-putus = nasional.

### Struktur baru
```
app/profil/page.tsx            ← rute Profil Daerah
components/app/AppHeader.tsx   ← header + navigasi + pencarian + tema
components/profil/             ← ProfilView, cards, charts (SVG tanpa pustaka), Tiles
lib/profil/engine.ts           ← logika data (latest, peringkat, fallback provinsi)
lib/profil/config.tsx          ← katalog bagian & kartu  ← tambah indikator di sini
lib/wilayah.ts                 ← indeks wilayah untuk pencarian (dari profil.json)
lib/theme.tsx                  ← tema terang/gelap bersama (disimpan di localStorage)
public/data/profil.json        ← data profil (±2,7 MB, dimuat sekali per sesi)
```

### Data peta
`public/data/kabkota.geojson` (53 kab/kota, kode BPS) dan `public/data/makro.json` (angka asli dari
Database PIT) dibangkitkan oleh `node scripts/build-map-data.mjs` — lihat `DATA-MAKRO.md`.
