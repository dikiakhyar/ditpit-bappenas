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
  // Default "Peta" = tile Google Roads (dari Basemap Google.lyr). Bila Google
  // tak terjangkau, peta otomatis jatuh ke "Wilayah" (GeoJSON, 100% offline)
  // sehingga muka utama TIDAK PERNAH kosong.
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

// Basemap WILAYAH — 100% offline, digambar dari GeoJSON yang sudah ada di
// public/data (same-origin, NOL request ke server tile eksternal). Memberi
// peta wilayah yang langsung tampil walau internet/CDN diblokir total.
function localLandStyle(theme: "light" | "dark"): StyleSpecification {
  const sea = theme === "dark" ? "#0a1422" : "#bcd6ef";
  const land = theme === "dark" ? "#1c2c40" : "#eaf0e1";
  const coast = theme === "dark" ? "rgba(255,255,255,0.22)" : "rgba(70,100,70,0.45)";
  return {
    version: 8,
    sources: {
      wilayah: { type: "geojson", data: "/data/kabkota.geojson" },
    },
    layers: [
      { id: "laut", type: "background", paint: { "background-color": sea } },
      { id: "darat", type: "fill", source: "wilayah", paint: { "fill-color": land } },
      {
        id: "garis-pantai",
        type: "line",
        source: "wilayah",
        paint: { "line-color": coast, "line-width": 0.9 },
      },
    ],
  };
}

const CARTO_ATTR = "© OpenStreetMap, © CARTO"; // basemap online (opsional)
const GOOGLE_ATTR = "© Google";

// Endpoint tile Google (diambil dari "Basemap Google.lyr").
// lyrs=m Roads · lyrs=s Satelit · lyrs=y Hybrid · lyrs=p Terrain.
// 4 subdomain mt0–mt3 untuk paralelisasi unduh tile.
function googleTiles(lyrs: string): string[] {
  return [0, 1, 2, 3].map(
    (n) => `https://mt${n}.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`
  );
}

/** Style untuk basemap terpilih. */
export function basemapStyle(
  id: BasemapId,
  theme: "light" | "dark"
): string | StyleSpecification {
  switch (id) {
    case "wilayah":
      return localLandStyle(theme);
    case "voyager":
      // Google Roads — basemap jalan/standar (dari Basemap Google.lyr).
      return rasterStyle(googleTiles("m"), GOOGLE_ATTR);
    case "gelap":
      return rasterStyle(
        ["https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"],
        CARTO_ATTR,
        "#0a1422"
      );
    case "satelit":
      // Google Hybrid — citra satelit + label jalan (dari Basemap Google.lyr).
      return rasterStyle(googleTiles("y"), GOOGLE_ATTR, "#0b1a2b");
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
