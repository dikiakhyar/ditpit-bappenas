// Registry basemap dashboard DITPIT — semuanya GRATIS & tanpa API key.
//
//  • Peta    : OpenStreetMap gaya "Positron" (putih–abu, CARTO) — latar netral
//              agar warna choropleth/layer tematik menonjol.
//  • Satelit : Esri World Imagery + label batas & nama tempat (Esri).
//              (Citra satelit Google tidak punya akses tile gratis yang sah —
//               pemakaian langsung mt*.google.com melanggar ketentuan Google.)
//  • Polos   : latar putih bersih, tanpa jaringan sama sekali.
//
// Semua basemap online memakai RASTER TILE (satu endpoint gambar) dan mendukung
// CORS, sehingga peta bisa diekspor ke PNG. Bila tile gagal dimuat (jaringan
// tertutup), peta otomatis jatuh ke gaya "Wilayah" (batas kab/kota lokal).

import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "peta" | "satelit" | "polos" | "wilayah";

export interface BasemapDef {
  id: BasemapId;
  label: string;
  /** true bila tidak butuh internet sama sekali (aman di jaringan tertutup). */
  offline: boolean;
  icon: string;
  /** atribusi wajib (dicantumkan juga pada PNG ekspor) */
  attribution: string;
  /** tampil di pemilih basemap? ("wilayah" hanya cadangan otomatis) */
  picker: boolean;
}

const OSM_CARTO = "© OpenStreetMap contributors © CARTO";
const ESRI = "Citra © Esri, Maxar, Earthstar Geographics";

export const BASEMAPS: BasemapDef[] = [
  { id: "peta", label: "Peta", offline: false, icon: "map", attribution: OSM_CARTO, picker: true },
  { id: "satelit", label: "Satelit", offline: false, icon: "globe", attribution: ESRI, picker: true },
  { id: "polos", label: "Polos", offline: true, icon: "layers", attribution: "", picker: true },
  { id: "wilayah", label: "Wilayah (offline)", offline: true, icon: "layers", attribution: "", picker: false },
];
export const DEFAULT_BASEMAP: BasemapId = "peta";

function rasterStyle(layers: { id: string; tiles: string[]; maxzoom?: number }[], attribution: string, bg: string): StyleSpecification {
  return {
    version: 8,
    sources: Object.fromEntries(
      layers.map((l, i) => [l.id, { type: "raster", tiles: l.tiles, tileSize: 256, attribution: i === 0 ? attribution : undefined, maxzoom: l.maxzoom ?? 19 }])
    ) as StyleSpecification["sources"],
    layers: [
      // latar berwarna DI BAWAH tile: bila tile gagal, area peta tetap berwarna (bukan transparan)
      { id: "bg", type: "background", paint: { "background-color": bg } },
      ...layers.map((l) => ({ id: l.id, type: "raster" as const, source: l.id })),
    ],
  };
}

// Positron resolusi tinggi (@2x) — tajam di layar retina & saat diekspor
const positron = ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`);
const esriImagery = ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"];
const esriLabels = ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"];

// Batas kab/kota lokal (public/data/maluku_nusra.geojson) — NOL request eksternal.
function localLandStyle(theme: "light" | "dark"): StyleSpecification {
  const sea = theme === "dark" ? "#0b1b2e" : "#dfe8f1";
  const land = theme === "dark" ? "#23415e" : "#fbfaf6";
  const coast = theme === "dark" ? "rgba(180,205,235,0.55)" : "rgba(110,125,140,0.7)";
  return {
    version: 8,
    sources: { wilayah: { type: "geojson", data: "/data/maluku_nusra.geojson" } },
    layers: [
      { id: "laut", type: "background", paint: { "background-color": sea } },
      { id: "darat", type: "fill", source: "wilayah", paint: { "fill-color": land } },
      { id: "garis-pantai", type: "line", source: "wilayah", paint: { "line-color": coast, "line-width": 0.7 } },
    ],
  };
}

/** Style untuk basemap terpilih. */
export function basemapStyle(id: BasemapId, theme: "light" | "dark"): StyleSpecification {
  switch (id) {
    case "peta":
      return rasterStyle([{ id: "base", tiles: positron, maxzoom: 20 }], OSM_CARTO, "#f2f2f0");
    case "satelit":
      return rasterStyle(
        [
          { id: "base", tiles: esriImagery },
          { id: "labels", tiles: esriLabels },
        ],
        ESRI,
        "#0b1a2b"
      );
    case "wilayah":
      return localLandStyle(theme);
    case "polos":
    default:
      // putih bersih di tema terang maupun gelap
      return { version: 8, sources: {}, layers: [{ id: "latar", type: "background", paint: { "background-color": "#ffffff" } }] };
  }
}

/** Cadangan bila basemap online gagal: batas wilayah lokal (tetap tampil offline). */
export function fallbackStyle(theme: "light" | "dark"): StyleSpecification {
  return localLandStyle(theme);
}
