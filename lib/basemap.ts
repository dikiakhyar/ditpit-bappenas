// Registry basemap dashboard DITPIT.
//
// Prinsip: peta TIDAK PERNAH kosong dan SELALU tampil tanpa perlu data —
// persis seperti basemap di GEE. Karena itu semua basemap online memakai
// RASTER TILE (satu endpoint gambar), bukan style vektor (yang butuh
// style.json + sprite + glyph + tiles → banyak titik gagal di jaringan tertutup).
// Tambahan gaya "Polos" sepenuhnya LOKAL untuk fallback offline terakhir.

import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "wilayah" | "voyager" | "gelap" | "satelit" | "polos";
export type BasemapKind = "raster" | "local";

export interface BasemapDef {
  id: BasemapId;
  label: string;
  kind: BasemapKind;
  /** true bila tidak butuh internet sama sekali (aman di jaringan tertutup). */
  offline: boolean;
  icon: string;
}

export const BASEMAPS: BasemapDef[] = [
  // "Peta"/"Satelit"/"Gelap" = MapTiler (butuh NEXT_PUBLIC_MAPTILER_KEY + jaringan).
  // Bila tile MapTiler gagal/diblokir, peta OTOMATIS jatuh ke "Wilayah" (batas
  // kabupaten asli, 100% offline) → muka utama TIDAK PERNAH kosong.
  { id: "voyager", label: "Peta", kind: "raster", offline: false, icon: "globe" },
  { id: "satelit", label: "Satelit", kind: "raster", offline: false, icon: "mappin" },
  { id: "wilayah", label: "Wilayah", kind: "local", offline: true, icon: "layers" },
  { id: "gelap", label: "Gelap", kind: "raster", offline: false, icon: "moon" },
  { id: "polos", label: "Polos", kind: "local", offline: true, icon: "layers" },
];

// helper: style raster 1-source dari URL template tile.
// Selalu ada layer "bg" berwarna DI BAWAH tile: kalau tile gagal dimuat
// (mis. diblokir jaringan), area peta tetap berwarna — bukan kosong transparan.
function rasterStyle(
  tiles: string[],
  attribution: string,
  bg = "#e6edf5",
  maxzoom = 19
): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: { type: "raster", tiles, tileSize: 256, attribution, maxzoom },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": bg } },
      { id: "base", type: "raster", source: "base" },
    ],
  };
}

// Latar polos lokal — hanya satu layer background, NOL request jaringan.
function localStyle(theme: "light" | "dark"): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "latar",
        type: "background",
        paint: { "background-color": theme === "dark" ? "#0a1422" : "#dde6f1" },
      },
    ],
  };
}

// Basemap WILAYAH — 100% offline, digambar dari batas kabupaten asli
// (Maluku & Nusa Tenggara) yang sudah disederhanakan ke ~120 KB di
// public/data/maluku_nusra.geojson. Same-origin, NOL request tile eksternal,
// jadi peta wilayah LANGSUNG tampil walau internet/CDN/Google diblokir total.
function localLandStyle(theme: "light" | "dark"): StyleSpecification {
  const sea = theme === "dark" ? "#0b1b2e" : "#aacbe6";
  const land = theme === "dark" ? "#23415e" : "#f3efe2";
  const coast = theme === "dark" ? "rgba(180,205,235,0.55)" : "rgba(90,120,90,0.7)";
  return {
    version: 8,
    sources: {
      wilayah: { type: "geojson", data: "/data/maluku_nusra.geojson" },
    },
    layers: [
      { id: "laut", type: "background", paint: { "background-color": sea } },
      { id: "darat", type: "fill", source: "wilayah", paint: { "fill-color": land } },
      {
        id: "garis-pantai",
        type: "line",
        source: "wilayah",
        paint: { "line-color": coast, "line-width": 0.7 },
      },
    ],
  };
}

const MAPTILER_ATTR = "© MapTiler © OpenStreetMap contributors";

// Kunci MapTiler dari .env.local (NEXT_PUBLIC_ → tersedia di sisi klien).
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

// Diagnostik sekali jalan: tunjukkan apakah key benar-benar "terbakar" ke
// bundle. Jika "KOSONG" → server perlu di-restart/rebuild SETELAH .env.local.
if (typeof window !== "undefined") {
  console.log(
    `[basemap] MapTiler key: ${
      MAPTILER_KEY ? `OK (${MAPTILER_KEY.length} karakter)` : "KOSONG — .env.local belum terbaca, restart/rebuild server"
    }`
  );
}

// Endpoint RASTER MapTiler (256px). mapId mis. "streets-v2" (jalan),
// "hybrid" (satelit + label), "streets-v2-dark" (gelap), "satellite" (citra).
function maptilerTiles(mapId: string, ext: "png" | "jpg" = "png"): string[] {
  return [
    `https://api.maptiler.com/maps/${mapId}/256/{z}/{x}/{y}.${ext}?key=${MAPTILER_KEY}`,
  ];
}

/** true bila kunci MapTiler tersedia (kalau tidak, basemap online dilewati). */
export const hasMaptiler = MAPTILER_KEY.length > 0;

/** Style untuk basemap terpilih. */
export function basemapStyle(
  id: BasemapId,
  theme: "light" | "dark"
): string | StyleSpecification {
  switch (id) {
    case "voyager":
      // MapTiler Streets — basemap jalan/standar.
      return rasterStyle(maptilerTiles("streets-v2"), MAPTILER_ATTR);
    case "satelit":
      // MapTiler Hybrid — citra satelit + label jalan.
      return rasterStyle(maptilerTiles("hybrid", "jpg"), MAPTILER_ATTR, "#0b1a2b");
    case "gelap":
      // MapTiler Streets (gelap).
      return rasterStyle(maptilerTiles("streets-v2-dark"), MAPTILER_ATTR, "#0a1422");
    case "wilayah":
      return localLandStyle(theme);
    case "polos":
    default:
      return localStyle(theme);
  }
}

/** Fallback yang dijamin tampil bila basemap online gagal dimuat.
 *  Memakai GeoJSON wilayah (offline) supaya peta tetap menampilkan
 *  bentuk wilayah, bukan sekadar latar polos kosong. */
export function fallbackStyle(theme: "light" | "dark"): StyleSpecification {
  return localLandStyle(theme);
}
