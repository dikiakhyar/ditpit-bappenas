"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MlMap, MapGeoJSONFeature, Popup, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDashboard } from "@/lib/dashboard-context";
import { basemapStyle, fallbackStyle, overviewPadding, BASEMAPS, LABEL_FONT, type BasemapId } from "@/lib/basemap";
import { bake, type Baked } from "@/lib/choropleth";
import { formatValue, findIndicator } from "@/lib/makro";
import { makroLegend } from "@/lib/legend";
import { Icon } from "@/components/ui/icons";
import { MAP_BOUNDS } from "@/lib/peta-wilayah";
import { LAYERS, kpLayerId } from "@/lib/layers";
import { isKawasan, namaWilayah } from "@/lib/wilayah";
import { JALAN_COLOR, JALAN_LAYER_ID, fmtKm, fungsiNama, jalanFilter, jalanScope } from "@/lib/jalan";
import { KATEGORI, KAT_IDS, KP_COUNT_RATIO, KP_DIAM, KP_TEXT_RATIO, katOf, kpFeatures, kpOffsetExpr, type KatId } from "@/lib/kawasan-prioritas";

// Cakupan peta: 16 provinsi wilayah timur (Sulawesi, Nusa Tenggara, Maluku, Papua) —
// dihitung dari data batas (lib/peta-wilayah.ts). [[W,S],[E,N]]
const BOUNDS = MAP_BOUNDS;

const EMPTY_FC = { type: "FeatureCollection", features: [] };

// ukuran bulatan Kawasan Prioritas per zoom; huruf & angka mengikuti rasio yang sama
// (offset teks dalam em, offset ikon dalam px × icon-size → tetap sejajar di semua zoom)
const KP_ZOOM: [number, number][] = [[4, 0.72], [6, 0.9], [8, 1.05], [11, 1.25]];
const kpSize = (ratio: number) => ["interpolate", ["linear"], ["zoom"], ...KP_ZOOM.flatMap(([z, v]) => [z, +(v * ratio).toFixed(2)])];

/** gambar bulatan kategori (2× untuk layar tajam) → ImageData untuk map.addImage */
function kpImage(fill: string, stroke: string) {
  const px = KP_DIAM * 2;
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const ctx = c.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  return ctx.getImageData(0, 0, px, px);
}
const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

// true bila basemap butuh internet (raster online). Basemap offline
// (wilayah/polos) tak boleh memicu logika fallback.
const needsNetwork = (id: BasemapId) =>
  !(BASEMAPS.find((b) => b.id === id)?.offline ?? false);

export default function MapContainer() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const hoverIdRef = useRef<string | number | null>(null);

  const {
    theme,
    basemapId,
    setBasemapId,
    activeCount,
    makroOn,
    makroOpacity,
    makroSel,
    kabkota,
    provinsi,
    layerState,
    makroData,
    dataStatus,
    selectedKode,
    setSelectedKode,
    focusMode,
    symb,
    labels,
    labelGeo,
    setTab,
    setSidebarOpen,
    setMapInstance,
    kawasan,
    jalan,
    jalanWidth,
    jalanCakupan,
  } = useDashboard();
  const jalanOn = !!layerState[JALAN_LAYER_ID]?.visible;
  const jalanScp = jalanScope(selectedKode, jalanCakupan, isKawasan(selectedKode));
  const params = useSearchParams();

  // titik bulatan Kawasan Prioritas (hanya kategori yang dinyalakan di tab Layer)
  const kpVisibleKey = KAT_IDS.filter((k) => layerState[kpLayerId(k)]?.visible).join("");
  const kpGeo = useMemo(() => {
    if (!kawasan || !labelGeo || !kpVisibleKey) return null;
    const pts = new Map<string, [number, number]>(labelGeo.features.map((f) => [f.properties.kode, f.geometry.coordinates]));
    return kpFeatures(kawasan.entries, pts, new Set(kpVisibleKey.split("") as KatId[]));
  }, [kawasan, labelGeo, kpVisibleKey]);

  // refs "nilai terbaru" agar handler peta & re-add style memakai data kini
  const latest = useRef({ theme, basemapId, makroOn, makroOpacity, makroSel, kabkota, provinsi, makroData, selectedKode, layerState, focusMode, symb, labels, labelGeo, kawasan, kpGeo, jalan, jalanOn, jalanWidth, jalanScp });
  latest.current = { theme, basemapId, makroOn, makroOpacity, makroSel, kabkota, provinsi, makroData, selectedKode, layerState, focusMode, symb, labels, labelGeo, kawasan, kpGeo, jalan, jalanOn, jalanWidth, jalanScp };
  const fromClickRef = useRef(false); // true bila pilihan berasal dari klik peta (jangan terbang)

  const bakedRef = useRef<Baked | null>(null);
  const jalanHoverRef = useRef<string | number | null>(null);
  const triedFallbackRef = useRef(false);
  const tileOkRef = useRef(false); // true bila ≥1 tile basemap online berhasil dimuat

  const [coord, setCoord] = useState({ lng: 124, lat: -5 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [usingFallback, setUsingFallback] = useState(false);
  const [legend, setLegend] = useState<Baked | null>(null);

  // ── pasang ulang layer choropleth setelah setiap style.load ──
  function addMakroLayers(map: MlMap) {
    if (!map.getSource("kabkota")) {
      map.addSource("kabkota", { type: "geojson", data: EMPTY_FC as never, promoteId: "__kode" });
    }
    const op = latest.current.makroOpacity;
    if (!map.getLayer("makro-fill")) {
      map.addLayer({
        id: "makro-fill",
        type: "fill",
        source: "kabkota",
        paint: {
          "fill-color": "rgba(150,160,175,0.25)",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            Math.min(op + 0.12, 1),
            op,
          ],
        },
      } as never);
    }
    if (!map.getLayer("makro-outline")) {
      map.addLayer({
        id: "makro-outline",
        type: "line",
        source: "kabkota",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            latest.current.theme === "dark" ? "#ffffff" : "#0b2540",
            "rgba(120,135,160,0.55)",
          ],
          // tipis di skala provinsi, sedikit menebal saat diperbesar; hover tetap jelas
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            4, ["case", ["boolean", ["feature-state", "hover"], false], 1.3, 0.2],
            8, ["case", ["boolean", ["feature-state", "hover"], false], 1.7, 0.45],
            11, ["case", ["boolean", ["feature-state", "hover"], false], 2.1, 0.8],
          ],
        },
      } as never);
    }
    // batas administrasi (layer "Provinsi" & "Kabupaten / Kota" di tab Layer)
    for (const [id, srcId] of [["kab-outline", "batas-kab"], ["prov-outline", "batas-prov"]] as const) {
      if (!map.getSource(srcId)) map.addSource(srcId, { type: "geojson", data: EMPTY_FC as never });
      if (!map.getLayer(id)) map.addLayer({ id, type: "line", source: srcId, layout: { "line-join": "round" }, paint: {} } as never);
    }
    applyBoundaries(map);
    if (!map.getLayer("makro-selected")) {
      map.addLayer({
        id: "makro-selected",
        type: "line",
        source: "kabkota",
        filter: selectionFilter(latest.current.selectedKode),
        paint: {
          "line-color": latest.current.theme === "dark" ? "#ffffff" : "#0b2540",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 8, 1.8, 11, 2.4],
        },
      } as never);
    }
    // Jalan Nasional — di atas choropleth & garis batas, di bawah label & bulatan kawasan.
    // "jalan-hit" = garis lebar tak terlihat agar ruas mudah disorot kursor.
    if (!map.getSource("jalan")) map.addSource("jalan", { type: "geojson", data: EMPTY_FC as never, generateId: true });
    const jHover = ["boolean", ["feature-state", "hover"], false];
    if (!map.getLayer("jalan-casing"))
      map.addLayer({ id: "jalan-casing", type: "line", source: "jalan", layout: { "line-join": "round", "line-cap": "round", visibility: "none" }, paint: { "line-color": "rgba(255,255,255,0.85)" } } as never);
    if (!map.getLayer("jalan-line"))
      map.addLayer({
        id: "jalan-line",
        type: "line",
        source: "jalan",
        layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
        paint: { "line-color": ["case", jHover, "#8a0008", JALAN_COLOR] },
      } as never);
    if (!map.getLayer("jalan-hit"))
      map.addLayer({ id: "jalan-hit", type: "line", source: "jalan", layout: { visibility: "none" }, paint: { "line-width": 12, "line-opacity": 0 } } as never);

    // label nama wilayah — paling atas. Provinsi ditambahkan terakhir → didahulukan
    // saat label bertabrakan (label yang tak muat otomatis disembunyikan MapLibre).
    if (!map.getSource("nama-wilayah")) map.addSource("nama-wilayah", { type: "geojson", data: EMPTY_FC as never });
    for (const lvl of ["kab", "prov"] as const) {
      const id = `label-${lvl}`;
      if (map.getLayer(id)) continue;
      map.addLayer({
        id,
        type: "symbol",
        source: "nama-wilayah",
        filter: ["==", ["get", "level"], lvl],
        layout: {
          visibility: "none",
          "text-field": ["get", "nama"],
          "text-font": LABEL_FONT,
          "text-size": 12,
          "text-max-width": lvl === "prov" ? 10 : 7,
          "text-line-height": 1.1,
          "text-padding": 3,
          "text-transform": lvl === "prov" ? "uppercase" : "none",
          "text-letter-spacing": lvl === "prov" ? 0.08 : 0,
        },
        paint: {},
      } as never);
    }
    // Kawasan Prioritas — paling atas; tidak menyembunyikan label nama wilayah
    for (const k of KATEGORI) {
      const id = `kpi-${k.id}`;
      if (!map.hasImage(id)) map.addImage(id, kpImage(k.fill, k.stroke), { pixelRatio: 2 });
    }
    if (!map.getSource("kp")) map.addSource("kp", { type: "geojson", data: EMPTY_FC as never });
    if (!map.getLayer("kp-icon")) {
      map.addLayer({
        id: "kp-icon",
        type: "symbol",
        source: "kp",
        layout: {
          "icon-image": ["concat", "kpi-", ["get", "kat"]],
          "icon-size": kpSize(1),
          "icon-offset": kpOffsetExpr("icon"),
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "text-field": ["get", "kat"],
          "text-font": LABEL_FONT,
          "text-size": kpSize(KP_TEXT_RATIO),
          "text-offset": kpOffsetExpr("text"),
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "symbol-sort-key": ["get", "n"],
        },
        paint: { "text-color": "#1f2937" },
      } as never);
    }
    if (!map.getLayer("kp-count")) {
      // jumlah lokasi (>1) di pojok kanan atas bulatan; tampil mulai zoom 5
      map.addLayer({
        id: "kp-count",
        type: "symbol",
        source: "kp",
        minzoom: 5,
        filter: [">", ["get", "n"], 1],
        layout: {
          "text-field": ["to-string", ["get", "n"]],
          "text-font": LABEL_FONT,
          "text-size": kpSize(KP_COUNT_RATIO),
          "text-offset": kpOffsetExpr("count"),
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#0b2540", "text-halo-color": "rgba(255,255,255,0.95)", "text-halo-width": 1.4 },
      } as never);
    }
    applyChoropleth(map);
    applyLabels(map);
    applyKawasan(map);
    applyJalan(map);
  }

  // Jalan Nasional: data (sekali), tampil/tidak, tebal, dan cakupan wilayah (provinsi / kab-kota terpilih)
  function applyJalan(map: MlMap) {
    const cur = latest.current;
    const src = map.getSource("jalan") as GeoJSONSource | undefined;
    if (!src || !map.getLayer("jalan-line")) return;
    const tagged = src as unknown as { __k?: string };
    if (cur.jalan && tagged.__k !== "1") {
      src.setData(cur.jalan as never);
      tagged.__k = "1";
    }
    const vis = cur.jalanOn && cur.jalan ? "visible" : "none";
    const w = cur.jalanWidth;
    const hover = ["boolean", ["feature-state", "hover"], false];
    const width = (extra = 0) => ["interpolate", ["linear"], ["zoom"], 4, ["case", hover, w * 0.55 + 1.5 + extra, w * 0.55 + extra], 8, ["case", hover, w + 1.5 + extra, w + extra], 12, ["case", hover, w * 1.6 + 1.5 + extra, w * 1.6 + extra]];
    const f = jalanFilter(cur.jalanScp);
    for (const id of ["jalan-casing", "jalan-line", "jalan-hit"]) {
      map.setLayoutProperty(id, "visibility", vis);
      map.setFilter(id, (f ?? null) as never);
    }
    map.setPaintProperty("jalan-line", "line-width", width() as never);
    map.setPaintProperty("jalan-casing", "line-width", width(2) as never);
  }

  // isi bulatan Kawasan Prioritas sesuai kategori yang dinyalakan
  function applyKawasan(map: MlMap) {
    const src = map.getSource("kp") as GeoJSONSource | undefined;
    if (!src) return;
    const g = latest.current.kpGeo;
    src.setData((g ?? EMPTY_FC) as never);
    for (const id of ["kp-icon", "kp-count"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", g ? "visible" : "none");
    applyFocus(map);
  }

  // isi & gaya label nama wilayah (ukuran, warna, garis tepi) — hanya ganti gaya, ringan
  function applyLabels(map: MlMap) {
    const cur = latest.current;
    const src = map.getSource("nama-wilayah") as GeoJSONSource | undefined;
    if (!src || !map.getLayer("label-kab")) return;
    const L = cur.labels;
    const want = L.mode !== "off" && cur.labelGeo ? "1" : "0";
    const tagged = src as unknown as { __k?: string };
    // data titik label baru dikirim ke peta saat label pertama kali dinyalakan
    if (want === "1" && tagged.__k !== "1") {
      src.setData(cur.labelGeo as never);
      tagged.__k = "1";
    }
    const halo = haloFor(L.color);
    for (const lvl of ["kab", "prov"] as const) {
      const id = `label-${lvl}`;
      const on = L.mode === "both" || L.mode === lvl;
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      if (!on) continue;
      map.setLayoutProperty(id, "text-size", lvl === "prov" ? Math.round(L.size * 1.2) : L.size);
      map.setPaintProperty(id, "text-color", L.color);
      map.setPaintProperty(id, "text-halo-color", halo);
      map.setPaintProperty(id, "text-halo-width", L.halo ? Math.max(1.2, L.size / 9) : 0);
      map.setPaintProperty(id, "text-halo-blur", 0.4);
    }
    applyFocus(map);
  }

  // garis tepi huruf yang kontras: huruf gelap → tepi putih, huruf terang → tepi gelap
  function haloFor(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return "rgba(255,255,255,0.9)";
    const n = parseInt(m[1], 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? "rgba(17,24,39,0.85)" : "rgba(255,255,255,0.92)";
  }

  // data & gaya garis batas: provinsi (tab Makro → Garis batas & label, warna menyesuaikan basemap)
  // dan kab/kota (tebal & warna pilihan pengguna — tetap tampil walau choropleth dimatikan)
  function applyBoundaries(map: MlMap) {
    const cur = latest.current;
    const sat = cur.basemapId === "satelit";
    const set = (srcId: string, geo: unknown) => {
      const src = map.getSource(srcId) as GeoJSONSource | undefined;
      const key = geo ? "1" : "0";
      if (src && (src as unknown as { __k?: string }).__k !== key) {
        src.setData((geo ?? EMPTY_FC) as never);
        (src as unknown as { __k?: string }).__k = key;
      }
    };
    set("batas-kab", cur.kabkota);
    set("batas-prov", cur.provinsi);
    const style = (id: string, layerId: string, color: string, satColor: string) => {
      if (!map.getLayer(id)) return;
      const def = LAYERS.find((l) => l.id === layerId);
      const st = cur.layerState[layerId];
      map.setLayoutProperty(id, "visibility", st?.visible ? "visible" : "none");
      map.setPaintProperty(id, "line-color", sat ? satColor : color);
      map.setPaintProperty(id, "line-width", ["interpolate", ["linear"], ["zoom"], 4, (def?.weight ?? 1) * 0.55, 8, def?.weight ?? 1]);
      map.setPaintProperty(id, "line-opacity", st?.opacity ?? 1);
    };
    style("prov-outline", "prov", "#334155", "rgba(255,255,255,0.95)");
    if (map.getLayer("kab-outline")) {
      const { width: w, color } = cur.symb.border;
      map.setLayoutProperty("kab-outline", "visibility", w > 0 ? "visible" : "none");
      map.setPaintProperty("kab-outline", "line-color", color);
      map.setPaintProperty("kab-outline", "line-width", ["interpolate", ["linear"], ["zoom"], 4, w * 0.45, 8, w, 11, w * 1.7]);
    }
  }

  // filter garis wilayah terpilih: kab/kota → kode persis; provinsi → 2 digit awal
  function selectionFilter(k: string | null, prop = "__kode"): unknown {
    if (!k || isKawasan(k)) return ["==", ["get", prop], "__none__"];
    if (Number(k) % 100 === 0) return ["==", ["slice", ["to-string", ["get", prop]], 0, 2], k.slice(0, 2)];
    return ["==", ["to-string", ["get", prop]], k];
  }

  // bingkai peta ke wilayah terpilih (dihitung dari geometri GeoJSON)
  function flyToSelection(map: MlMap, k: string) {
    if (isKawasan(k)) {
      map.fitBounds(BOUNDS, { padding: overviewPadding(map.getContainer()), duration: 900 });
      return;
    }
    const feats = (latest.current.kabkota?.features ?? []).filter((f) => {
      const kode = String(f.properties?.kode ?? "");
      return Number(k) % 100 === 0 ? kode.slice(0, 2) === k.slice(0, 2) : kode === k;
    });
    let w = Infinity, s2 = Infinity, e = -Infinity, n = -Infinity;
    const walk = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === "number") {
        const [x, y] = c as number[];
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s2) s2 = y;
        if (y > n) n = y;
      } else if (Array.isArray(c)) c.forEach(walk);
    };
    feats.forEach((f) => walk((f.geometry as { coordinates?: unknown })?.coordinates));
    if (!Number.isFinite(w)) return;
    map.fitBounds([[w, s2], [e, n]], { padding: 60, maxZoom: 8, duration: 900 });
  }

  // ── terapkan data + warna sesuai pilihan indikator ──
  function applyChoropleth(map: MlMap) {
    const cur = latest.current;
    const src = map.getSource("kabkota") as GeoJSONSource | undefined;
    if (!src) return;
    const b = bake(cur.kabkota, cur.makroData, cur.makroSel.indId, cur.makroSel.year, cur.symb);
    bakedRef.current = b;
    setLegend(b);
    const vis = cur.makroOn && !!b ? "visible" : "none";
    if (map.getLayer("makro-fill")) map.setLayoutProperty("makro-fill", "visibility", vis);
    if (map.getLayer("makro-outline")) map.setLayoutProperty("makro-outline", "visibility", vis);
    if (!b) {
      src.setData(EMPTY_FC as never);
      return;
    }
    src.setData(b.geo as never);
    applyBorder(map);
    applyFocus(map);
  }

  // garis sorot saat kursor di atas wilayah. Garis batas kab/kota biasa digambar oleh
  // layer "kab-outline" (applyBoundaries) supaya tetap ada walau choropleth dimatikan.
  function applyBorder(map: MlMap) {
    if (!map.getLayer("makro-outline")) return;
    const hover = ["boolean", ["feature-state", "hover"], false];
    map.setPaintProperty("makro-outline", "line-color", [
      "case", hover, latest.current.theme === "dark" ? "#ffffff" : "#0b2540", "rgba(0,0,0,0)",
    ] as never);
    map.setPaintProperty("makro-outline", "line-width", [
      "interpolate", ["linear"], ["zoom"], 4, ["case", hover, 1.3, 0], 8, ["case", hover, 1.7, 0], 11, ["case", hover, 2.1, 0],
    ] as never);
  }

  // ── fokus wilayah terpilih ──
  // Mode "abu": wilayah lain diredupkan abu-abu. Mode "sembunyi": wilayah lain
  // tidak digambar sama sekali (isi, garis, batas administrasi).
  // Hanya mengganti filter/ekspresi gaya (dievaluasi di GPU) — tanpa setData /
  // hitung ulang, jadi ringan dipanggil setiap kali pilihan berubah.
  function applyFocus(map: MlMap) {
    const cur = latest.current;
    // "Indonesia Timur" = seluruh kawasan terpilih → tidak ada yang diredupkan
    const k = isKawasan(cur.selectedKode) ? null : cur.selectedKode;
    const hide = !!k && cur.focusMode === "sembunyi";
    const setF = (id: string, f: unknown) => {
      if (map.getLayer(id)) map.setFilter(id, (f ?? null) as never);
    };
    setF("makro-fill", hide ? selectionFilter(k) : null);
    setF("makro-outline", hide ? selectionFilter(k) : null);
    setF("kab-outline", hide ? selectionFilter(k, "kode") : null);
    setF("prov-outline", hide ? selectionFilter(k, "kode") : null);
    // garis kab/kota & bulatan kawasan di luar wilayah terpilih: diredupkan (abu) / disembunyikan
    if (map.getLayer("kab-outline"))
      map.setPaintProperty("kab-outline", "line-opacity", (k && !hide ? ["case", selectionFilter(k, "kode"), 1, 0.35] : 1) as never);
    for (const id of ["kp-icon", "kp-count"]) {
      if (!map.getLayer(id)) continue;
      const base = id === "kp-count" ? [">", ["get", "n"], 1] : null;
      const sel = hide ? selectionFilter(k, "w") : null;
      setF(id, base && sel ? ["all", base, sel] : base ?? sel);
      const op = k && !hide ? ["case", selectionFilter(k, "w"), 1, 0.3] : 1;
      map.setPaintProperty(id, "text-opacity", op as never);
      if (id === "kp-icon") map.setPaintProperty(id, "icon-opacity", op as never);
    }
    for (const lvl of ["kab", "prov"]) {
      const id = `label-${lvl}`;
      if (!map.getLayer(id)) continue;
      const base = ["==", ["get", "level"], lvl];
      map.setFilter(id, (hide ? ["all", base, selectionFilter(k, "kode")] : base) as never);
      // mode abu-abu: label wilayah lain ikut diredupkan
      map.setPaintProperty(id, "text-opacity", (k && !hide ? ["case", selectionFilter(k, "kode"), 1, 0.4] : 1) as never);
    }

    const b = bakedRef.current;
    if (!b || !map.getLayer("makro-fill")) return;
    const op = cur.makroOpacity;
    const hover = ["boolean", ["feature-state", "hover"], false];
    const dark = cur.theme === "dark";
    if (!k || hide) {
      map.setPaintProperty("makro-fill", "fill-color", b.colorExpr as never);
      map.setPaintProperty("makro-fill", "fill-opacity", ["case", hover, Math.min(op + 0.12, 1), op] as never);
      if (map.getLayer("makro-outline")) map.setPaintProperty("makro-outline", "line-opacity", 1);
      return;
    }
    const inSel = selectionFilter(k);
    map.setPaintProperty("makro-fill", "fill-color", ["case", inSel, b.colorExpr, dark ? "#3a4250" : "#c3c9d2"] as never);
    map.setPaintProperty("makro-fill", "fill-opacity", [
      "case",
      inSel,
      ["case", hover, Math.min(op + 0.12, 1), op],
      ["case", hover, 0.7, 0.55],
    ] as never);
    if (map.getLayer("makro-outline"))
      map.setPaintProperty("makro-outline", "line-opacity", ["case", inSel, 1, hover, 1, 0.35] as never);
  }

  // ── tooltip hover ──
  function showPopup(map: MlMap, feature: MapGeoJSONFeature, lng: number, lat: number) {
    const b = bakedRef.current;
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    const ind = b?.ind ?? findIndicator(latest.current.makroSel.indId)?.ind;
    const nama = String(p.__nama ?? "—");
    const prov = String(p.__prov ?? "");
    let valLine = "Tidak ada data";
    if (b?.numeric) valLine = formatValue(typeof p.__v === "number" ? p.__v : null, ind?.format);
    else if (p.__c) valLine = String(p.__c);
    const rank =
      p.__rank != null
        ? `<div class="mlp-rank">Peringkat Provinsi: <b>#${String(p.__rank)}</b></div>`
        : "";
    const yr = latest.current.makroSel.year ? ` · ${latest.current.makroSel.year}` : "";
    const html = `
      <div class="mlp">
        <div class="mlp-head">${nama}${prov ? `<span>${prov}</span>` : ""}</div>
        <div class="mlp-ind">${ind?.label ?? ""}${yr}</div>
        <div class="mlp-val">${valLine}</div>
        ${rank}
        <div class="mlp-foot">Klik untuk ringkasan &amp; profil wilayah</div>
      </div>`;
    popupRef.current?.setLngLat([lng, lat]).setHTML(html).addTo(map);
  }

  // tooltip ruas Jalan Nasional: nama ruas, fungsi, panjang ruas & panjang di kab/kota tsb
  function showJalanPopup(map: MlMap, feature: MapGeoJSONFeature, lng: number, lat: number) {
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    const pj = Number(p.pj) || 0;
    const km = Number(p.km) || 0;
    const k = String(p.k ?? "");
    const split = Math.abs(pj - km) > 0.05;
    const html = `
      <div class="mlp">
        <div class="mlp-head">${esc(String(p.n ?? "—"))}<span>Jalan nasional · ${esc(fungsiNama(String(p.f ?? "")))} · ruas ${esc(String(p.r ?? ""))}</span></div>
        <div class="mlp-ind">Panjang ruas</div>
        <div class="mlp-val">${fmtKm(pj)} km</div>
        ${split ? `<div class="mlp-rank">di ${esc(namaWilayah(k))}: <b>${fmtKm(km)} km</b></div>` : `<div class="mlp-rank">${esc(namaWilayah(k))}</div>`}
      </div>`;
    popupRef.current?.setLngLat([lng, lat]).setHTML(html).addTo(map);
  }

  // tooltip bulatan Kawasan Prioritas: wilayah, kategori, daftar lokasi bernomor
  function showKpPopup(map: MlMap, feature: MapGeoJSONFeature, lng: number, lat: number) {
    const p = (feature.properties ?? {}) as Record<string, unknown>;
    const w = String(p.w ?? "");
    const kat = String(p.kat ?? "") as KatId;
    const k = katOf(kat);
    const list = (latest.current.kawasan?.entries ?? []).filter((e) => e.kat === kat && (e.kab.includes(w) || (e.provLevel && e.prov === w)));
    const MAX = 7;
    const rows = list
      .slice(0, MAX)
      .map((e) => {
        const t = e.lokasi || e.sub || e.kelompok || e.ket;
        const sub = e.lokasi && e.kelompok ? `<i>${esc(e.kelompok)}</i>` : e.ket && t !== e.ket ? `<i>${esc(e.ket)}</i>` : "";
        return `<li><b style="background:${k?.fill};border-color:${k?.stroke}">${esc(e.kode)}</b><span>${esc(t)}${sub}</span></li>`;
      })
      .join("");
    const more = list.length > MAX ? `<div class="mlp-rank">+${list.length - MAX} lokasi lain — lihat tab Layer</div>` : "";
    const html = `
      <div class="mlp">
        <div class="mlp-head">${esc(namaWilayah(w))}<span>${esc(k ? `${k.id}. ${k.nama}` : "")} · ${list.length} lokasi</span></div>
        <ul class="mlp-kp">${rows}</ul>
        ${more}
        <div class="mlp-foot">Klik untuk daftar lengkap di tab Layer</div>
      </div>`;
    popupRef.current?.setLngLat([lng, lat]).setHTML(html).addTo(map);
  }

  // ── inisialisasi peta (sekali) ──
  useEffect(() => {
    let map: MlMap | undefined;
    let cancelled = false;
    let ro: ResizeObserver | undefined;

    (async () => {
      const maplibregl = await import("maplibre-gl")
        .then((m) => m.default)
        .catch((err) => {
          console.error("[MapLibre] gagal memuat library:", err);
          return null;
        });
      if (!maplibregl) {
        setStatus("error");
        return;
      }
      if (!mapEl.current || cancelled) return;

      // diagnosa ukuran kontainer — 0px = penyebab umum peta kosong/putih
      const rect = mapEl.current.getBoundingClientRect();
      console.log("[MapContainer] ukuran area peta:", Math.round(rect.width), "x", Math.round(rect.height), "px");

      try {
        map = new maplibregl.Map({
          container: mapEl.current,
          style: basemapStyle(latest.current.basemapId, latest.current.theme),
          bounds: BOUNDS,
          fitBoundsOptions: { padding: overviewPadding(mapEl.current) },
          canvasContextAttributes: { preserveDrawingBuffer: true },
          attributionControl: { compact: true },
        });
      } catch (err) {
        console.error("[MapLibre] gagal inisialisasi peta (WebGL tidak tersedia?):", err);
        setStatus("error");
        return;
      }
      mapRef.current = map;
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "ml-popup",
        maxWidth: "260px",
      });

      map.on("mousemove", (e) => setCoord({ lng: e.lngLat.lng, lat: e.lngLat.lat }));

      // pindah ke basemap offline "Wilayah" bila basemap online gagal.
      const goFallback = () => {
        if (!map || triedFallbackRef.current) return;
        triedFallbackRef.current = true;
        setUsingFallback(true);
        setStatus("ready");
        map.setStyle(fallbackStyle(latest.current.theme));
      };

      map.on("load", () => {
        setStatus("ready");
        setMapInstance(map ?? null);
        map?.resize();
      });

      // PENTING: kanvas kadang terlanjur dibuat saat kontainer belum berukuran
      // final (layout flex/sidebar belum settle) → kanvas "kekecilan" (mis.
      // 187×375) dan peta tak terlihat. Paksa resize beberapa kali agar kanvas
      // menyamakan diri ke ukuran kontainer sebenarnya.
      const forceResize = () => mapRef.current?.resize();
      requestAnimationFrame(forceResize);
      [120, 350, 800, 1500].forEach((ms) => window.setTimeout(forceResize, ms));

      // tandai bila ada tile basemap yang BERHASIL dimuat (sumber "base").
      map.on("data", (e) => {
        const ev = e as { dataType?: string; sourceId?: string; tile?: unknown };
        if (ev.dataType === "source" && ev.sourceId === "base" && ev.tile) {
          tileOkRef.current = true;
        }
      });

      // fallback bila: (a) STYLE gagal termuat, ATAU (b) basemap online tapi
      // belum ada satu pun tile yang berhasil (mis. tile diblokir jaringan).
      map.on("error", (e) => {
        console.error("[MapLibre]", e?.error?.message ?? e);
        if (!map) return;
        // huruf label gagal dimuat bukan berarti basemap gagal
        if (/\.pbf|glyph|font/i.test(String(e?.error?.message ?? ""))) return;
        const online = needsNetwork(latest.current.basemapId);
        const styleFailed = !map.isStyleLoaded();
        const tilesBlocked = online && !tileOkRef.current;
        if ((styleFailed || tilesBlocked) && online) goFallback();
      });

      // jaring pengaman waktu: 6 detik basemap online tak menampilkan tile apa pun
      // → paksa fallback ke peta wilayah offline (hindari layar hitam berkepanjangan).
      const initialBasemap = latest.current.basemapId;
      window.setTimeout(() => {
        if (cancelled || !map) return;
        // basemap sudah diganti pengguna → pengecekan itu diurus efek ganti-basemap (jangan ikut menilai)
        if (latest.current.basemapId !== initialBasemap) return;
        const online = needsNetwork(latest.current.basemapId);
        if (online && !tileOkRef.current && !map.areTilesLoaded()) goFallback();
      }, 6000);

      // setiap style dimuat (init / ganti basemap / fallback) → pasang ulang data
      map.on("style.load", () => addMakroLayers(map!));

      // bulatan Kawasan Prioritas: tooltip daftar kawasan; klik → pilih kab/kota + buka tab Layer
      const overKp = (pt: { x: number; y: number }) =>
        !!map!.getLayer("kp-icon") && map!.getLayoutProperty("kp-icon", "visibility") !== "none" && map!.queryRenderedFeatures([pt.x, pt.y], { layers: ["kp-icon"] }).length > 0;
      map.on("mousemove", "kp-icon", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map!.getCanvas().style.cursor = "pointer";
        showKpPopup(map!, f, e.lngLat.lng, e.lngLat.lat);
      });
      map.on("mouseleave", "kp-icon", () => {
        map!.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });
      map.on("click", "kp-icon", (e) => {
        const w = e.features?.[0]?.properties?.w as string | undefined;
        if (!w) return;
        fromClickRef.current = true;
        setSelectedKode(String(w));
        setTab("layer");
        if (window.matchMedia("(max-width: 1023px)").matches) setSidebarOpen(true);
      });

      // ruas Jalan Nasional: sorot + tooltip nama ruas (bulatan kawasan tetap didahulukan)
      const overJalan = (pt: { x: number; y: number }) =>
        !!map!.getLayer("jalan-hit") && map!.getLayoutProperty("jalan-hit", "visibility") !== "none" && map!.queryRenderedFeatures([pt.x, pt.y], { layers: ["jalan-hit"] }).length > 0;
      const clearJalanHover = () => {
        if (jalanHoverRef.current != null) map!.setFeatureState({ source: "jalan", id: jalanHoverRef.current }, { hover: false });
        jalanHoverRef.current = null;
      };
      map.on("mousemove", "jalan-hit", (e) => {
        const f = e.features?.[0];
        if (!f || overKp(e.point)) return clearJalanHover();
        map!.getCanvas().style.cursor = "pointer";
        if (f.id != null && f.id !== jalanHoverRef.current) {
          clearJalanHover();
          jalanHoverRef.current = f.id;
          map!.setFeatureState({ source: "jalan", id: f.id }, { hover: true });
        }
        showJalanPopup(map!, f, e.lngLat.lng, e.lngLat.lat);
      });
      map.on("mouseleave", "jalan-hit", () => {
        clearJalanHover();
        map!.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });

      // interaksi choropleth
      map.on("mousemove", "makro-fill", (e) => {
        if (!e.features?.length) return;
        if (overKp(e.point) || overJalan(e.point)) return; // tooltip bulatan kawasan / ruas jalan didahulukan
        map!.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        const id = f.id ?? (f.properties?.__kode as string | undefined);
        if (id != null && id !== hoverIdRef.current) {
          if (hoverIdRef.current != null)
            map!.setFeatureState({ source: "kabkota", id: hoverIdRef.current }, { hover: false });
          hoverIdRef.current = id;
          map!.setFeatureState({ source: "kabkota", id }, { hover: true });
        }
        showPopup(map!, f, e.lngLat.lng, e.lngLat.lat);
      });
      map.on("click", "makro-fill", (e) => {
        const kode = e.features?.[0]?.properties?.__kode as string | undefined;
        if (!kode || overKp(e.point)) return;
        fromClickRef.current = true;
        setSelectedKode(kode);
        setTab("wilayah");
        if (window.matchMedia("(max-width: 1023px)").matches) setSidebarOpen(true);
      });
      map.on("mouseleave", "makro-fill", () => {
        map!.getCanvas().style.cursor = "";
        if (hoverIdRef.current != null)
          map!.setFeatureState({ source: "kabkota", id: hoverIdRef.current }, { hover: false });
        hoverIdRef.current = null;
        popupRef.current?.remove();
      });

      // perbaiki kanvas 0px (race ukuran kontainer / sidebar buka-tutup)
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(mapEl.current);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      popupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ganti basemap / tema → reset peluang fallback lalu setStyle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    triedFallbackRef.current = false;
    tileOkRef.current = false;
    setUsingFallback(false);
    map.setStyle(basemapStyle(basemapId, theme));

    // Jaring pengaman per-ganti-basemap: bila basemap online tapi 6 detik tak
    // ada tile yang berhasil (mis. request menggantung karena diblokir firewall,
    // tanpa memunculkan error) → otomatis pindah ke "Wilayah" offline + banner.
    if (!needsNetwork(basemapId)) return;
    const t = window.setTimeout(() => {
      const m = mapRef.current;
      if (!m || triedFallbackRef.current || tileOkRef.current) return;
      triedFallbackRef.current = true;
      setUsingFallback(true);
      m.setStyle(fallbackStyle(theme));
    }, 6000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemapId, theme]);

  // Terapkan perubahan ke peta. map.isStyleLoaded() bernilai false selama tile basemap (atau data) masih
  // dimuat; bila begitu perubahan TIDAK dibuang, melainkan ditunda sampai peta "idle" — basemap tampil
  // dulu, lalu choropleth / batas / jalan / kawasan menyusul sendiri tanpa perlu ganti basemap.
  // kunci = jenis perubahan → tiap jenis perubahan hanya diterapkan sekali walau tertunda berkali-kali
  const pendingRef = useRef(new Map<string, (m: MlMap) => void>());
  const pendingTimerRef = useRef<number | undefined>(undefined);
  function whenReady(map: MlMap, key: string, fn: (m: MlMap) => void) {
    if (map.isStyleLoaded()) {
      fn(map);
      return;
    }
    const first = pendingRef.current.size === 0;
    pendingRef.current.set(key, fn);
    if (!first) return;
    const flush = () => {
      window.clearTimeout(pendingTimerRef.current);
      map.off("idle", flush);
      const fns = [...pendingRef.current.values()];
      pendingRef.current.clear();
      if (mapRef.current !== map) return; // peta sudah dibongkar
      fns.forEach((f) => f(map)); // tiap fungsi mengecek sendiri source/layer-nya sudah ada
    };
    map.on("idle", flush);
    // jaring pengaman: bila "idle" tak kunjung tiba (tile lambat), tetap terapkan
    pendingTimerRef.current = window.setTimeout(flush, 8000);
  }
  useEffect(() => () => window.clearTimeout(pendingTimerRef.current), []);

  // perubahan pilihan makro / data / opacity → terapkan ulang choropleth
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    whenReady(map, "choropleth", applyChoropleth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makroSel, makroOn, makroOpacity, kabkota, makroData, symb]);

  // label nama wilayah: dinyalakan / ukuran / warna berubah
  useEffect(() => {
    const map = mapRef.current;
    if (map) whenReady(map, "labels", applyLabels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, labelGeo]);

  // batas administrasi: data dimuat / garis dinyalakan-dimatikan / tebal & warna diubah
  useEffect(() => {
    const map = mapRef.current;
    if (map) whenReady(map, "boundaries", applyBoundaries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kabkota, provinsi, layerState, symb.border]);

  // Jalan Nasional: data dimuat / dinyalakan / tebal / cakupan wilayah berubah
  useEffect(() => {
    const map = mapRef.current;
    if (map) whenReady(map, "jalan", applyJalan);
  }, [jalan, jalanOn, jalanWidth, jalanScp]);

  // Kawasan Prioritas: data dimuat / kategori dinyalakan-dimatikan
  useEffect(() => {
    const map = mapRef.current;
    if (map) whenReady(map, "kawasan", applyKawasan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpGeo]);

  // ?kode= dari URL (mis. tombol "Lihat di peta" di halaman Profil)
  const urlKode = params.get("kode");
  useEffect(() => {
    if (urlKode) {
      setSelectedKode(urlKode);
      setTab("wilayah");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKode]);

  // pilihan berubah → perbarui garis sorot & (bila bukan dari klik) terbang ke sana
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer("makro-selected")) map.setFilter("makro-selected", selectionFilter(selectedKode) as never);
      applyFocus(map);
      if (selectedKode && !fromClickRef.current) flyToSelection(map, selectedKode);
      fromClickRef.current = false;
    };
    if (map.isStyleLoaded() && map.getLayer("makro-selected")) apply();
    else map.once("idle", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKode, kabkota, status]);

  // ganti mode fokus (abu-abu / sembunyikan) → cukup ganti filter & gaya, tanpa terbang ulang
  useEffect(() => {
    const map = mapRef.current;
    if (map) whenReady(map, "focus", applyFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode]);

  const fb = BASEMAPS.find((b) => b.id === basemapId);

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 map-canvas">
      {/* style inline width/height 100% WAJIB: maplibre-gl.css memaksa
          .maplibregl-map ke position:relative sehingga inset-0 tak memberi
          tinggi → div runtuh ke 0. Inline style mengalahkan CSS itu. */}
      <div ref={mapEl} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

      {usingFallback && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit max-w-[90%] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-[12px] text-amber-900 shadow-sm">
          Basemap online tak terjangkau — memakai peta <b>Wilayah</b> (offline). Data tetap tampil.
        </div>
      )}
      {status === "error" && !usingFallback && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit max-w-[90%] rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-center text-[12px] text-red-900 shadow-sm">
          Peta gagal dimuat. Coba pilih basemap <b>Polos</b> di kiri atas.
        </div>
      )}
      {dataStatus === "error" && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-10 mx-auto w-fit max-w-[90%] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-[12px] text-amber-900 shadow-sm">
          Database belum dapat dimuat — periksa koneksi atau izin berbagi spreadsheet.
        </div>
      )}

      {/* pemilih basemap */}
      <div className="absolute left-3 top-3 z-10 flex overflow-hidden map-float">
        {BASEMAPS.filter((b) => b.picker).map((b) => (
          <button
            key={b.id}
            onClick={() => setBasemapId(b.id)}
            title={b.offline ? `${b.label} (offline)` : b.label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              basemapId === b.id
                ? "bg-primary text-primary-fg"
                : "text-ink-2 hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon name={b.icon} className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{b.label}</span>
          </button>
        ))}
      </div>

      {/* kontrol zoom */}
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden map-float">
        <button onClick={() => mapRef.current?.zoomIn()} className="p-2 text-ink-2 hover:bg-surface-2 hover:text-foreground" aria-label="Perbesar">
          <Icon name="plus" className="h-4 w-4" />
        </button>
        <span className="h-px bg-border" />
        <button onClick={() => mapRef.current?.zoomOut()} className="p-2 text-ink-2 hover:bg-surface-2 hover:text-foreground" aria-label="Perkecil">
          <Icon name="minus" className="h-4 w-4" />
        </button>
      </div>

      {/* HUD koordinat */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 map-float px-3 py-1.5 font-mono text-[11px] text-ink-2">
        <Icon name="crosshair" className="h-3.5 w-3.5" />
        <span>{coord.lat.toFixed(4)}°, {coord.lng.toFixed(4)}°</span>
        <span className="opacity-30">|</span>
        <span>{fb?.label ?? ""}</span>
        <span className="opacity-30">|</span>
        <span>{activeCount} layer</span>
      </div>

      <MapLegend legend={legend} on={makroOn} year={makroSel.year} total={kabkota?.features.length ?? 0} kats={kpVisibleKey.split("").filter(Boolean) as KatId[]} jalan={jalanOn && !!jalan} />
    </div>
  );
}

function MapLegend({ legend, on, year, total, kats, jalan }: { legend: Baked | null; on: boolean; year: number | null; total: number; kats: KatId[]; jalan: boolean }) {
  const showMakro = on && !!legend;
  if (!showMakro && !kats.length && !jalan) return null;
  return (
    <div className="map-float absolute bottom-3 right-3 z-10 max-h-[60%] w-[230px] overflow-y-auto p-3 text-foreground">
      <p className="subheader mb-1">Legenda</p>
      {showMakro && <MakroLegendBody legend={legend!} year={year} total={total} />}
      {jalan && (
        <div className={`flex items-center gap-2 text-[11.5px] ${showMakro ? "mt-2.5 border-t border-border pt-2" : ""}`}>
          <span className="h-[3px] w-5 shrink-0 rounded-full" style={{ background: JALAN_COLOR, boxShadow: "0 0 0 1px rgba(255,255,255,0.8)" }} />
          <span className="font-medium">Jalan nasional</span>
        </div>
      )}
      {kats.length > 0 && (
        <div className={showMakro || jalan ? "mt-2.5 border-t border-border pt-2" : ""}>
          <p className="mb-1 text-[12px] font-semibold leading-snug">Kawasan Prioritas RPJMN 2025–2029</p>
          <ul className="flex flex-col gap-1">
            {kats.map((id) => {
              const k = katOf(id)!;
              return (
                <li key={id} className="flex items-center gap-2 text-[11.5px] leading-snug">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-[#1f2937]"
                    style={{ background: k.fill, border: `1.5px solid ${k.stroke}` }}
                  >
                    {id}
                  </span>
                  <span>{k.nama}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[10.5px] leading-snug text-muted">Angka kecil = jumlah lokasi pada kab/kota tsb.</p>
        </div>
      )}
    </div>
  );
}

function MakroLegendBody({ legend, year, total }: { legend: Baked; year: number | null; total: number }) {
  const lg = makroLegend(legend, year, total);
  return (
    <>
      <p className="text-[12px] font-semibold leading-snug">{lg.title}</p>
      {lg.sub && <p className="mb-2 text-[11px] leading-snug text-muted">{lg.sub}</p>}
      {legend.count === 0 ? (
        <p className="text-[11px] text-muted">Belum ada data untuk pilihan ini.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lg.classes.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-[11.5px]">
              <span className="h-3 w-4 shrink-0 rounded-sm border border-black/10" style={{ background: c.color }} />
              <span className="tnum truncate">{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
