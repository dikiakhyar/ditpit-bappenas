"use client";

import { useRef, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { LAYERS, GEOMETRY_META } from "@/lib/layers";
import { Icon } from "@/components/ui/icons";

export default function MapContainer() {
  const mapEl = useRef<HTMLDivElement>(null);
  const { activeCount, layerState } = useDashboard();
  const [coord, setCoord] = useState({ lng: 117.0, lat: -2.5 });

  // ── SPRINT 3: aktifkan MapLibre di sini ────────────────────────────────
  // import maplibregl from "maplibre-gl";
  // import "maplibre-gl/dist/maplibre-gl.css";   // (taruh import di atas file)
  //
  // const mapRef = useRef<maplibregl.Map | null>(null);
  // useEffect(() => {
  //   if (!mapEl.current) return;
  //   const map = new maplibregl.Map({
  //     container: mapEl.current,
  //     style: "https://demotiles.maplibre.org/style.json",
  //     center: [117.0, -2.5],
  //     zoom: 4.2,
  //   });
  //   map.addControl(new maplibregl.NavigationControl(), "top-right");
  //   map.on("mousemove", (e) => setCoord({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
  //   mapRef.current = map;
  //   return () => map.remove();
  // }, []);
  //
  // ── SPRINT 4+: sinkronkan state layer ke MapLibre ───────────────────────
  // useEffect(() => {
  //   const map = mapRef.current;
  //   if (!map) return;
  //   Object.entries(layerState).forEach(([id, st]) => {
  //     if (!map.getLayer(id)) return;
  //     map.setLayoutProperty(id, "visibility", st.visible ? "visible" : "none");
  //     map.setPaintProperty(id, "fill-opacity", st.opacity);
  //   });
  // }, [layerState]);
  // ────────────────────────────────────────────────────────────────────────

  // placeholder: koordinat semu mengikuti kursor (hapus setelah MapLibre aktif)
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setCoord({ lng: 95 + x * 46, lat: 6 - y * 17 });
  };

  const activeLayers = LAYERS.filter((l) => layerState[l.id]?.visible);

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={mapEl} onMouseMove={onMove} className="map-canvas absolute inset-0" />

      {/* status tengah (placeholder) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="map-pulse h-3 w-3 rounded-full bg-primary" />
          <p className="text-sm font-medium text-white/80">Kanvas peta siap</p>
          <p className="max-w-xs text-xs text-white/45">
            MapLibre diaktifkan pada Sprint 3 — kode inisialisasi sudah disiapkan di
            komponen ini.
          </p>
        </div>
      </div>

      {/* kontrol zoom (visual) */}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30 backdrop-blur">
        <button className="p-2 text-white/70 hover:bg-white/10" aria-label="Perbesar">
          <Icon name="plus" className="h-4 w-4" />
        </button>
        <span className="h-px bg-white/10" />
        <button className="p-2 text-white/70 hover:bg-white/10" aria-label="Perkecil">
          <Icon name="minus" className="h-4 w-4" />
        </button>
      </div>

      {/* HUD koordinat */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 font-mono text-[11px] text-white/75 backdrop-blur">
        <Icon name="crosshair" className="h-3.5 w-3.5" />
        <span>
          {coord.lat.toFixed(4)}°, {coord.lng.toFixed(4)}°
        </span>
        <span className="text-white/30">|</span>
        <span>{activeCount} layer</span>
      </div>

      {/* legenda */}
      <div className="absolute bottom-3 right-3 max-w-[190px] rounded-lg border border-white/10 bg-black/35 p-3 text-white/80 backdrop-blur">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
          Legenda
        </p>
        {activeLayers.length === 0 ? (
          <p className="text-[11px] text-white/45">Belum ada layer aktif.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {activeLayers.slice(0, 6).map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: `var(${GEOMETRY_META[l.geometry].varName})` }}
                />
                <span className="truncate">{l.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
