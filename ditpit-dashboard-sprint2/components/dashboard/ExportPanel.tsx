"use client";

import { useEffect, useMemo, useRef } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { LAYERS } from "@/lib/layers";
import { renderMapExport } from "@/lib/export-map";
import { Icon } from "@/components/ui/icons";

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "peta-ditpit"
  );
}

export default function ExportPanel() {
  const { exportTitle, setExportTitle, province, layerState } = useDashboard();
  const previewRef = useRef<HTMLCanvasElement>(null);

  const activeLayers = useMemo(
    () => LAYERS.filter((l) => layerState[l.id]?.visible),
    [layerState]
  );

  const autoTitle = `Peta Tematik — Provinsi ${province}`;

  // pratinjau live: render ulang saat judul / provinsi / layer berubah
  useEffect(() => {
    const c = previewRef.current;
    if (!c) return;
    renderMapExport(c, {
      title: exportTitle,
      province,
      layers: activeLayers,
      width: 360,
      pxRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
  }, [exportTitle, province, activeLayers]);

  const download = () => {
    const c = document.createElement("canvas");
    renderMapExport(c, {
      title: exportTitle,
      province,
      layers: activeLayers,
      width: 1100,
      pxRatio: 2,
    });
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(exportTitle || autoTitle)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
          Judul peta
        </label>
        <input
          value={exportTitle}
          onChange={(e) => setExportTitle(e.target.value)}
          placeholder={autoTitle}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-primary"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Diketik di sini langsung muncul di kepala peta. Kosongkan untuk pakai
          judul otomatis dari provinsi.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Pratinjau
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-white p-2">
          <canvas ref={previewRef} className="block h-auto w-full" />
        </div>
      </div>

      <button
        onClick={download}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
      >
        <Icon name="download" className="h-4 w-4" />
        Unduh PNG
      </button>

      <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-muted">
        Legenda dibuat otomatis dari{" "}
        <span className="font-medium text-foreground">{activeLayers.length} layer</span>{" "}
        yang aktif. Saat MapLibre aktif, tangkapan peta asli akan menggantikan area
        pratinjau pada PNG.
      </p>
    </div>
  );
}
