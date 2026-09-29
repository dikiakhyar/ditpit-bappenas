// Registry basemap dashboard DITPIT — semuanya GRATIS & tanpa API key.
//
//  • Peta    : OpenStreetMap gaya "Positron" (putih–abu, CARTO) — latar netral
//              agar warna choropleth/layer tematik menonjol. Butuh API key CARTO
//              (gratis): env NEXT_PUBLIC_CARTO_KEY. Tanpa key, tile ber-watermark.
//  • Satelit : Esri World Imagery + label batas & nama tempat (Esri).
//              (Citra satelit Google tidak punya akses tile gratis yang sah —
//               pemakaian langsung mt*.google.com melanggar ketentuan Google.)
//  • Polos   : latar putih bersih, tanpa jaringan sama sekali.
//
// Selain CARTO, semua gratis tanpa key. Semua basemap online memakai RASTER TILE (satu endpoint gambar) dan mendukung
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

// Positron resolusi tinggi (@2x) — tajam di layar retina & saat diekspor.
// Key CARTO dibaca dari .env.local / env hosting (bukan ditulis di kode agar tak ikut ke Git).
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY ?? "";
export const hasCartoKey = CARTO_KEY.length > 0;
const positron = [
  `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}@2x.png${hasCartoKey ? `?key=${encodeURIComponent(CARTO_KEY)}` : ""}`,
];
if (typeof window !== "undefined" && !hasCartoKey) {
  console.warn("[basemap] NEXT_PUBLIC_CARTO_KEY kosong — basemap Peta (CARTO) akan ber-watermark. Isi di .env.local lalu restart server.");
}
const esriImagery = ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"];
const esriLabels = ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"];

// Daratan wilayah timur (public/data/darat.geojson, ±90 KB) — NOL request eksternal.
function localLandStyle(theme: "light" | "dark"): StyleSpecification {
  const sea = theme === "dark" ? "#0b1b2e" : "#dfe8f1";
  const land = theme === "dark" ? "#23415e" : "#fbfaf6";
  const coast = theme === "dark" ? "rgba(180,205,235,0.55)" : "rgba(110,125,140,0.7)";
  return {
    version: 8,
    sources: { wilayah: { type: "geojson", data: "/data/darat.geojson" } },
    layers: [
      { id: "laut", type: "background", paint: { "background-color": sea } },
      { id: "darat", type: "fill", source: "wilayah", paint: { "fill-color": land } },
      { id: "garis-pantai", type: "line", source: "wilayah", paint: { "line-color": coast, "line-width": 0.7 } },
    ],
  };
}

// Huruf untuk label nama wilayah — disimpan sendiri di public/fonts (±80 KB, hanya
// diunduh saat label dinyalakan), jadi label tetap tampil offline & ikut di ekspor PNG.
export const LABEL_FONT = ["Open Sans Semibold"];
function withGlyphs(style: StyleSpecification): StyleSpecification {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return { ...style, glyphs: `${origin}/fonts/{fontstack}/{range}.pbf` };
}

/** Style untuk basemap terpilih. */
export function basemapStyle(id: BasemapId, theme: "light" | "dark"): StyleSpecification {
  return withGlyphs(baseStyle(id, theme));
}

function baseStyle(id: BasemapId, theme: "light" | "dark"): StyleSpecification {
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
  return withGlyphs(localLandStyle(theme));
}

/** Padding saat menampilkan seluruh wilayah: di layar lebar, sisi kanan dikosongkan
 *  untuk legenda agar Papua tidak tertutup. */
export function overviewPadding(el: HTMLElement | null | undefined) {
  const w = el?.clientWidth ?? 0;
  return w >= 900 ? { top: 56, bottom: 48, left: 24, right: 250 } : { top: 56, bottom: 56, left: 16, right: 16 };
}
