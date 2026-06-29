// Registry basemap dashboard DITPIT.
//
// Tujuan utama: peta TIDAK PERNAH kosong. Karena itu di sini ada gaya "Polos"
// yang sepenuhnya LOKAL (tanpa request jaringan) sehingga selalu ter-render —
// dipakai juga sebagai fallback otomatis bila basemap CDN gagal/timeout.
//
// Setiap basemap punya bentuk style MapLibre: bisa URL (vektor CARTO) atau
// objek StyleSpecification (raster Esri / latar lokal). MapContainer memuatnya
// lalu menambahkan kembali source & layer data di event `style.load`.

import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "voyager" | "gelap" | "satelit" | "polos";
export type BasemapKind = "cdn" | "raster" | "local";

export interface BasemapDef {
  id: BasemapId;
  label: string;
  kind: BasemapKind;
  /** true bila tidak butuh internet sama sekali (aman di jaringan tertutup). */
  offline: boolean;
  /** id ikon (lib/ui/icons). */
  icon: string;
}

export const BASEMAPS: BasemapDef[] = [
  { id: "voyager", label: "Peta", kind: "cdn", offline: false, icon: "globe" },
  { id: "gelap", label: "Gelap", kind: "cdn", offline: false, icon: "moon" },
  { id: "satelit", label: "Satelit", kind: "raster", offline: false, icon: "mappin" },
  { id: "polos", label: "Polos", kind: "local", offline: true, icon: "layers" },
];

const CDN = {
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

// Latar polos lokal — hanya satu layer background, nol request jaringan.
// Warna mengikuti tema agar batas wilayah & choropleth tetap terbaca.
function localStyle(theme: "light" | "dark"): StyleSpecification {
  return {
    version: 8,
    // glyphs sengaja tidak diisi: layer kita (fill/line) tak butuh teks,
    // tooltip pakai HTML popup — jadi tetap 100% offline.
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

// Citra satelit Esri (raster, tanpa API key). Tetap butuh internet.
function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution:
          "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxzoom: 19,
      },
    },
    layers: [{ id: "esri", type: "raster", source: "esri" }],
  };
}

/** Style untuk basemap terpilih. CDN dikembalikan sebagai URL string. */
export function basemapStyle(
  id: BasemapId,
  theme: "light" | "dark"
): string | StyleSpecification {
  switch (id) {
    case "voyager":
      return CDN.voyager;
    case "gelap":
      return CDN.dark;
    case "satelit":
      return satelliteStyle();
    case "polos":
    default:
      return localStyle(theme);
  }
}

/** Fallback yang dijamin tampil bila basemap online gagal dimuat. */
export function fallbackStyle(theme: "light" | "dark"): StyleSpecification {
  return localStyle(theme);
}
