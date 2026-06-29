"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDashboard } from "@/lib/dashboard-context";
import { LAYERS } from "@/lib/layers";
import { Swatch } from "@/components/ui/Swatch";
import { Icon } from "@/components/ui/icons";

// Basemap gratis CARTO (tanpa API key). Mengikuti tema terang/gelap dashboard.
const BASEMAP = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

// Cakupan 4 provinsi: NTB (barat) → Maluku (timur). [[W,S],[E,N]]
const BOUNDS: [[number, number], [number, number]] = [
  [115.5, -11.2],
  [135.6, 2.7],
];

export default function MapContainer() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const { activeCount, layerState, theme } = useDashboard();
  const [coord, setCoord] = useState({ lng: 124, lat: -5 });

  // Inisialisasi peta sekali. maplibre-gl di-import dinamis agar tidak
  // dievaluasi saat SSR (library ini butuh `window`).
  useEffect(() => {
    let map: MlMap | undefined;
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (!mapEl.current || cancelled) return;
      map = new maplibregl.Map({
        container: mapEl.current,
        style: theme === "dark" ? BASEMAP.dark : BASEMAP.light,
        bounds: BOUNDS,
        fitBoundsOptions: { padding: 36 },
        // v5: preserveDrawingBuffer pindah ke canvasContextAttributes.
        // Wajib agar ekspor PNG bisa menangkap kanvas peta.
        canvasContextAttributes: { preserveDrawingBuffer: true },
        attributionControl: { compact: true }, // attribution OSM + CARTO (lisensi)
      });
      map.on("mousemove", (e) => setCoord({ lng: e.lngLat.lng, lat: e.lngLat.lat }));

      // Saat basemap diganti (mis. tema), MapLibre me-reset style — semua
      // source & layer data harus DITAMBAH ULANG di sini nanti.
      map.on("style.load", () => {
        // TODO (tahap data): tambahkan kembali source GeoJSON/PMTiles + layer
        // dari registry LAYERS di sini, mengambil warna/simbol dari lib/layers.ts.
      });

      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // sengaja sekali jalan; pergantian tema ditangani efek di bawah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ganti basemap saat tema berubah
  useEffect(() => {
    mapRef.current?.setStyle(theme === "dark" ? BASEMAP.dark : BASEMAP.light);
  }, [theme]);

  const activeLayers = LAYERS.filter((l) => layerState[l.id]?.visible);

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={mapEl} className="absolute inset-0" />

      {/* kontrol zoom (terhubung ke peta) */}
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/40">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="p-2 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Perbesar"
        >
          <Icon name="plus" className="h-4 w-4" />
        </button>
        <span className="h-px bg-black/10 dark:bg-white/10" />
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="p-2 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Perkecil"
        >
          <Icon name="minus" className="h-4 w-4" />
        </button>
      </div>

      {/* HUD koordinat */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 font-mono text-[11px] text-foreground/75 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/40 dark:text-white/75">
        <Icon name="crosshair" className="h-3.5 w-3.5" />
        <span>
          {coord.lat.toFixed(4)}°, {coord.lng.toFixed(4)}°
        </span>
        <span className="opacity-30">|</span>
        <span>{activeCount} layer</span>
      </div>

      {/* legenda */}
      <div className="absolute bottom-3 right-3 z-10 max-h-[55%] max-w-[210px] overflow-y-auto rounded-lg border border-black/10 bg-white/85 p-3 text-foreground/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/45 dark:text-white/80">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/50 dark:text-white/50">
          Legenda
        </p>
        {activeLayers.length === 0 ? (
          <p className="text-[11px] text-foreground/45 dark:text-white/45">
            Belum ada layer aktif.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {activeLayers.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-[11px]">
                <span className="shrink-0">
                  <Swatch layer={l} size={14} />
                </span>
                <span className="truncate">{l.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
