// Registry basemap dashboard DITPIT.
//
// Prinsip: peta TIDAK PERNAH kosong dan SELALU tampil tanpa perlu data —
// persis seperti basemap di GEE. Karena itu semua basemap online memakai
// RASTER TILE (satu endpoint gambar), bukan style vektor (yang butuh
// style.json + sprite + glyph + tiles → banyak titik gagal di jaringan tertutup).
// Tambahan gaya "Polos" sepenuhnya LOKAL untuk fallback offline terakhir.

import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "voyager" | "gelap" | "satelit" | "polos";
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
  { id: "voyager", label: "Peta", kind: "raster", offline: false, icon: "globe" },
  { id: "satelit", label: "Satelit", kind: "raster", offline: false, icon: "mappin" },
  { id: "gelap", label: "Gelap", kind: "raster", offline: false, icon: "moon" },
  { id: "polos", label: "Polos", kind: "local", offline: true, icon: "layers" },
];

// helper: style raster 1-source dari URL template tile
function rasterStyle(tiles: string[], attribution: string, maxzoom = 19): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: { type: "raster", tiles, tileSize: 256, attribution, maxzoom },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
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

const CARTO_ATTR = "© OpenStreetMap, © CARTO";
const ESRI_ATTR = "Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS Community";

/** Style untuk basemap terpilih. */
export function basemapStyle(
  id: BasemapId,
  theme: "light" | "dark"
): string | StyleSpecification {
  switch (id) {
    case "voyager":
      return rasterStyle(
        ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
        CARTO_ATTR
      );
    case "gelap":
      return rasterStyle(
        ["https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"],
        CARTO_ATTR
      );
    case "satelit":
      return rasterStyle(
        ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        ESRI_ATTR
      );
    case "polos":
    default:
      return localStyle(theme);
  }
}

/** Fallback yang dijamin tampil bila basemap online gagal dimuat. */
export function fallbackStyle(theme: "light" | "dark"): StyleSpecification {
  return localStyle(theme);
}
