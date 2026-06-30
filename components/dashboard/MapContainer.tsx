"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, MapGeoJSONFeature, Popup, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDashboard } from "@/lib/dashboard-context";
import { basemapStyle, fallbackStyle, BASEMAPS, type BasemapId } from "@/lib/basemap";
import { bake, type Baked } from "@/lib/choropleth";
import { RAMP, formatValue, findIndicator } from "@/lib/makro";
import { Icon } from "@/components/ui/icons";

// Cakupan 4 provinsi: NTB (barat) → Maluku (timur). [[W,S],[E,N]]
const BOUNDS: [[number, number], [number, number]] = [
  [115.5, -11.2],
  [135.6, 2.7],
];

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
    makroData,
    dataStatus,
  } = useDashboard();

  // refs "nilai terbaru" agar handler peta & re-add style memakai data kini
  const latest = useRef({ theme, basemapId, makroOn, makroOpacity, makroSel, kabkota, makroData });
  latest.current = { theme, basemapId, makroOn, makroOpacity, makroSel, kabkota, makroData };

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
    applyChoropleth(map);
  }

  // ── terapkan data + warna sesuai pilihan indikator ──
  function applyChoropleth(map: MlMap) {
    const cur = latest.current;
    const src = map.getSource("kabkota") as GeoJSONSource | undefined;
    if (!src) return;
    const b = bake(cur.kabkota, cur.makroData, cur.makroSel.indId, cur.makroSel.year);
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
    map.setPaintProperty("makro-fill", "fill-color", b.colorExpr as never);
    map.setPaintProperty("makro-fill", "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      Math.min(cur.makroOpacity + 0.12, 1),
      cur.makroOpacity,
    ] as never);
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
          fitBoundsOptions: { padding: 36 },
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
        map?.resize();
      });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemapId, theme]);

  // perubahan pilihan makro / data / opacity → terapkan ulang choropleth
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded() && map.getSource("kabkota")) applyChoropleth(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makroSel, makroOn, makroOpacity, kabkota, makroData]);

  const fb = BASEMAPS.find((b) => b.id === basemapId);

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 map-canvas">
      <div ref={mapEl} className="absolute inset-0" />

      {usingFallback && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit max-w-[90%] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-[12px] text-amber-900 shadow-sm">
          Basemap online tak terjangkau — memakai latar <b>Polos</b> (offline). Data tetap tampil.
        </div>
      )}
      {status === "error" && !usingFallback && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit max-w-[90%] rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-center text-[12px] text-red-900 shadow-sm">
          Peta gagal dimuat. Coba pilih basemap <b>Polos</b> di kiri atas.
        </div>
      )}
      {dataStatus === "error" && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-10 mx-auto w-fit max-w-[90%] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-[12px] text-amber-900 shadow-sm">
          Data Makro belum ada di <span className="font-mono">public/data/</span>.
        </div>
      )}

      {/* pemilih basemap */}
      <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg border border-black/10 bg-white/85 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/45">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBasemapId(b.id)}
            title={b.offline ? `${b.label} (offline)` : b.label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              basemapId === b.id
                ? "bg-primary text-primary-fg"
                : "text-foreground/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
            }`}
          >
            <Icon name={b.icon} className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{b.label}</span>
          </button>
        ))}
      </div>

      {/* kontrol zoom */}
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/40">
        <button onClick={() => mapRef.current?.zoomIn()} className="p-2 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Perbesar">
          <Icon name="plus" className="h-4 w-4" />
        </button>
        <span className="h-px bg-black/10 dark:bg-white/10" />
        <button onClick={() => mapRef.current?.zoomOut()} className="p-2 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Perkecil">
          <Icon name="minus" className="h-4 w-4" />
        </button>
      </div>

      {/* HUD koordinat */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 font-mono text-[11px] text-foreground/75 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/40 dark:text-white/75">
        <Icon name="crosshair" className="h-3.5 w-3.5" />
        <span>{coord.lat.toFixed(4)}°, {coord.lng.toFixed(4)}°</span>
        <span className="opacity-30">|</span>
        <span>{fb?.label ?? ""}</span>
        <span className="opacity-30">|</span>
        <span>{activeCount} layer</span>
      </div>

      <MakroLegend legend={legend} on={makroOn} year={makroSel.year} />
    </div>
  );
}

function MakroLegend({ legend, on, year }: { legend: Baked | null; on: boolean; year: number | null }) {
  if (!on || !legend) return null;
  const { ind, numeric, breaks, min, max, count } = legend;

  return (
    <div className="absolute bottom-3 right-3 z-10 max-h-[60%] max-w-[230px] overflow-y-auto rounded-lg border border-black/10 bg-white/90 p-3 text-foreground/85 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/55 dark:text-white/85">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/50 dark:text-white/50">
        Legenda · Data Makro
      </p>
      <p className="mb-2 text-[11.5px] font-medium leading-snug">
        {ind.label}
        {year ? ` · ${year}` : ""}
        {ind.unit ? <span className="text-foreground/45 dark:text-white/45"> ({ind.unit})</span> : null}
      </p>

      {numeric ? (
        count > 0 ? (
          <>
            <div className="flex h-2.5 overflow-hidden rounded">
              {RAMP.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-foreground/55 dark:text-white/55">
              <span>{formatValue(min, ind.format)}</span>
              <span>{formatValue(max, ind.format)}</span>
            </div>
            <p className="mt-1.5 text-[10px] text-foreground/45 dark:text-white/45">
              Klasifikasi kuantil · {count} Kab/Kota{breaks.length ? "" : ""}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-foreground/50 dark:text-white/50">Belum ada data untuk pilihan ini.</p>
        )
      ) : (
        <ul className="flex flex-col gap-1">
          {(ind.classes ?? []).map((c) => (
            <li key={c.value} className="flex items-center gap-2 text-[11px]">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: c.color }} />
              <span className="truncate">{c.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
