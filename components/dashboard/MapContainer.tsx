"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MlMap, MapGeoJSONFeature, Popup, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDashboard } from "@/lib/dashboard-context";
import { basemapStyle, fallbackStyle, overviewPadding, BASEMAPS, type BasemapId } from "@/lib/basemap";
import { bake, type Baked } from "@/lib/choropleth";
import { formatValue, findIndicator } from "@/lib/makro";
import { makroLegend } from "@/lib/legend";
import { Icon } from "@/components/ui/icons";
import { MAP_BOUNDS } from "@/lib/peta-wilayah";
import { LAYERS } from "@/lib/layers";

// Cakupan peta: 16 provinsi wilayah timur (Sulawesi, Nusa Tenggara, Maluku, Papua) —
// dihitung dari data batas (lib/peta-wilayah.ts). [[W,S],[E,N]]
const BOUNDS = MAP_BOUNDS;

const EMPTY_FC = { type: "FeatureCollection", features: [] };

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
    makroPalette,
    makroReverse,
    setTab,
    setSidebarOpen,
    setMapInstance,
  } = useDashboard();
  const params = useSearchParams();

  // refs "nilai terbaru" agar handler peta & re-add style memakai data kini
  const latest = useRef({ theme, basemapId, makroOn, makroOpacity, makroSel, kabkota, provinsi, makroData, selectedKode, layerState, focusMode, makroPalette, makroReverse });
  latest.current = { theme, basemapId, makroOn, makroOpacity, makroSel, kabkota, provinsi, makroData, selectedKode, layerState, focusMode, makroPalette, makroReverse };
  const fromClickRef = useRef(false); // true bila pilihan berasal dari klik peta (jangan terbang)

  const bakedRef = useRef<Baked | null>(null);
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
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.2, 0.6],
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
          "line-width": 2.6,
        },
      } as never);
    }
    applyChoropleth(map);
  }

  // data & gaya garis batas provinsi / kab-kota (warna menyesuaikan basemap)
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
    style("kab-outline", "kabkota", "#64748b", "rgba(255,255,255,0.7)");
    style("prov-outline", "prov", "#334155", "rgba(255,255,255,0.95)");
  }

  // filter garis wilayah terpilih: kab/kota → kode persis; provinsi → 2 digit awal
  function selectionFilter(k: string | null, prop = "__kode"): unknown {
    if (!k) return ["==", ["get", prop], "__none__"];
    if (Number(k) % 100 === 0) return ["==", ["slice", ["to-string", ["get", prop]], 0, 2], k.slice(0, 2)];
    return ["==", ["to-string", ["get", prop]], k];
  }

  // bingkai peta ke wilayah terpilih (dihitung dari geometri GeoJSON)
  function flyToSelection(map: MlMap, k: string) {
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
    const b = bake(cur.kabkota, cur.makroData, cur.makroSel.indId, cur.makroSel.year, { palette: cur.makroPalette, reverse: cur.makroReverse });
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
    applyFocus(map);
  }

  // ── fokus wilayah terpilih ──
  // Mode "abu": wilayah lain diredupkan abu-abu. Mode "sembunyi": wilayah lain
  // tidak digambar sama sekali (isi, garis, batas administrasi).
  // Hanya mengganti filter/ekspresi gaya (dievaluasi di GPU) — tanpa setData /
  // hitung ulang, jadi ringan dipanggil setiap kali pilihan berubah.
  function applyFocus(map: MlMap) {
    const cur = latest.current;
    const k = cur.selectedKode;
    const hide = !!k && cur.focusMode === "sembunyi";
    const setF = (id: string, f: unknown) => {
      if (map.getLayer(id)) map.setFilter(id, (f ?? null) as never);
    };
    setF("makro-fill", hide ? selectionFilter(k) : null);
    setF("makro-outline", hide ? selectionFilter(k) : null);
    setF("kab-outline", hide ? selectionFilter(k, "kode") : null);
    setF("prov-outline", hide ? selectionFilter(k, "kode") : null);

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
    let valLine = "—";
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
        const online = needsNetwork(latest.current.basemapId);
        const styleFailed = !map.isStyleLoaded();
        const tilesBlocked = online && !tileOkRef.current;
        if ((styleFailed || tilesBlocked) && online) goFallback();
      });

      // jaring pengaman waktu: 6 detik basemap online tak menampilkan tile apa pun
      // → paksa fallback ke peta wilayah offline (hindari layar hitam berkepanjangan).
      window.setTimeout(() => {
        if (cancelled || !map) return;
        const online = needsNetwork(latest.current.basemapId);
        if (online && !tileOkRef.current && !map.areTilesLoaded()) goFallback();
      }, 6000);

      // setiap style dimuat (init / ganti basemap / fallback) → pasang ulang data
      map.on("style.load", () => addMakroLayers(map!));

      // interaksi choropleth
      map.on("mousemove", "makro-fill", (e) => {
        if (!e.features?.length) return;
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
        if (!kode) return;
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

  // perubahan pilihan makro / data / opacity → terapkan ulang choropleth
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded() && map.getSource("kabkota")) applyChoropleth(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makroSel, makroOn, makroOpacity, kabkota, makroData, makroPalette, makroReverse]);

  // batas administrasi: data dimuat / layer dinyalakan-dimatikan
  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded() && map.getLayer("prov-outline")) applyBoundaries(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kabkota, provinsi, layerState]);

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
    if (map?.isStyleLoaded() && map.getLayer("makro-fill")) applyFocus(map);
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

      <MakroLegend legend={legend} on={makroOn} year={makroSel.year} total={kabkota?.features.length ?? 0} />
    </div>
  );
}

function MakroLegend({ legend, on, year, total }: { legend: Baked | null; on: boolean; year: number | null; total: number }) {
  if (!on || !legend) return null;
  const lg = makroLegend(legend, year, total);
  return (
    <div className="map-float absolute bottom-3 right-3 z-10 max-h-[60%] w-[230px] overflow-y-auto p-3 text-foreground">
      <p className="subheader mb-1">Legenda</p>
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
    </div>
  );
}
