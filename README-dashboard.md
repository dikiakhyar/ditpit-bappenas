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
