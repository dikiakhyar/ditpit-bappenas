"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { LAYERS } from "@/lib/layers";
import { BASEMAPS } from "@/lib/basemap";
import { bake } from "@/lib/choropleth";
import { makroLegend } from "@/lib/legend";
import { composeMapExport, downloadCanvas, renderLegend, type LegendModel } from "@/lib/export-map";
import { namaWilayah } from "@/lib/wilayah";
import { Icon } from "@/components/ui/icons";

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "peta";

/** Ekspor = peta persis seperti di layar + legenda (simbol & keterangan). Tanpa judul/tata letak. */
export default function ExportPanel() {
  const { layerState, makroOn, makroSel, kabkota, makroData, selectedKode, basemapId, mapInstance, symb } = useDashboard();
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const model: LegendModel = useMemo(() => {
    const b = makroOn ? bake(kabkota, makroData, makroSel.indId, makroSel.year, symb) : null;
    const total = kabkota?.features.length ?? 0;
    return {
      makro: b ? makroLegend(b, makroSel.year, total) : undefined,
      // hanya layer yang benar-benar tergambar (sudah punya data/SHP)
      layers: LAYERS.filter((l) => layerState[l.id]?.visible && !!l.source),
      selected: selectedKode ? namaWilayah(selectedKode) : undefined,
      attribution: BASEMAPS.find((x) => x.id === basemapId)?.attribution || undefined,
    };
  }, [makroOn, kabkota, makroData, makroSel, layerState, selectedKode, basemapId, symb]);

  // pratinjau legenda (live)
  useEffect(() => {
    if (previewRef.current) renderLegend(previewRef.current, model, Math.min(window.devicePixelRatio || 1, 2));
  }, [model]);

  const fileBase = () => slug(model.makro?.title ?? "peta-tematik");

  const exportMap = async () => {
    const map = mapInstance;
    if (!map) return setMsg("Peta belum siap.");
    setBusy(true);
    setMsg(null);
    try {
      // tunggu tile selesai dimuat (maks 6 dtk), lalu gambar ulang satu frame
      if (!map.areTilesLoaded()) await Promise.race([new Promise((r) => map.once("idle", r)), new Promise((r) => setTimeout(r, 6000))]);
      await new Promise<void>((r) => {
        map.once("render", () => r());
        map.triggerRepaint();
      });
      const out = composeMapExport(map.getCanvas(), model, window.devicePixelRatio || 1);
      downloadCanvas(out, `${fileBase()}-${stamp()}.png`);
      setMsg("PNG diunduh: peta + legenda.");
    } catch (e) {
      console.error(e);
      setMsg("Gagal mengekspor peta. Coba basemap lain lalu ulangi.");
    } finally {
      setBusy(false);
    }
  };

  const exportLegend = () => {
    const c = document.createElement("canvas");
    renderLegend(c, model, 3);
    downloadCanvas(c, `legenda-${fileBase()}-${stamp()}.png`);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-[12.5px] text-ink-2">Peta persis seperti di layar, ditambah legenda di sisi kanan.</p>

      <button onClick={exportMap} disabled={busy || !mapInstance} className="btn btn-primary w-full disabled:opacity-60">
        <Icon name="download" className="h-4 w-4" />
        {busy ? "Menyiapkan…" : "Unduh peta + legenda (PNG)"}
      </button>
      <button onClick={exportLegend} className="btn w-full">
        <Icon name="download" className="h-4 w-4" />
        Unduh legenda saja (PNG)
      </button>
      {msg && <p className="text-[12px] text-muted">{msg}</p>}

      <div>
        <p className="subheader mb-1.5">Pratinjau legenda</p>
        <div className="overflow-hidden rounded-md border border-border bg-white">
          <canvas ref={previewRef} className="block h-auto w-full" />
        </div>

      </div>
    </div>
  );
}
