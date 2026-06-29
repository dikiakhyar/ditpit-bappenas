"use client";

import { useMemo } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import { MAKRO_CATEGORIES, findIndicator, formatValue, RAMP } from "@/lib/makro";
import { ranking } from "@/lib/choropleth";

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function MakroPanel() {
  const {
    makroOn,
    setMakroOn,
    makroOpacity,
    setMakroOpacity,
    makroSel,
    setMakroCategory,
    setMakroIndicator,
    setMakroYear,
    kabkota,
    makroData,
    dataStatus,
  } = useDashboard();

  const cat = MAKRO_CATEGORIES.find((c) => c.id === makroSel.catId) ?? MAKRO_CATEGORIES[0];
  const found = findIndicator(makroSel.indId);
  const ind = found?.ind;

  const ranked = useMemo(
    () => ranking(kabkota, makroData, makroSel.indId, makroSel.year),
    [kabkota, makroData, makroSel.indId, makroSel.year]
  );
  const senseHigh = (ind?.sense ?? "high") === "high";
  const best = senseHigh ? ranked.slice(0, 5) : ranked.slice(-5).reverse();
  const bestLabel = senseHigh ? "Tertinggi (terbaik)" : "Terendah (terbaik)";

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* master */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon name="grid" className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Choropleth KabKota</span>
        </div>
        <Switch checked={makroOn} onChange={() => setMakroOn(!makroOn)} />
      </div>

      {dataStatus === "error" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
          File data belum ditemukan di <span className="font-mono">public/data/</span>. Tampil dengan
          data contoh setelah file <span className="font-mono">kabkota.geojson</span> &{" "}
          <span className="font-mono">makro.json</span> tersedia.
        </p>
      )}

      {/* kategori */}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Kategori</span>
        <div className="relative">
          <Icon name={cat.icon} className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <select
            value={makroSel.catId}
            onChange={(e) => setMakroCategory(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-surface py-2 pl-8 pr-8 text-sm font-medium outline-none focus:border-primary"
          >
            {MAKRO_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <Icon name="chevron" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
      </label>

      {/* sub-indikator */}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Indikator</span>
        <div className="relative">
          <select
            value={makroSel.indId}
            onChange={(e) => setMakroIndicator(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm outline-none focus:border-primary"
          >
            {cat.indicators.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
          <Icon name="chevron" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
        {ind?.unit && <span className="text-[11px] text-muted">Satuan: {ind.unit}</span>}
      </label>

      {/* tahun */}
      {ind?.years && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Tahun</span>
          <div className="flex flex-wrap gap-1">
            {ind.years.map((y) => (
              <button
                key={y}
                onClick={() => setMakroYear(y)}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  makroSel.year === y ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* opacity */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[11px] text-muted">Transparansi</span>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(makroOpacity * 100)}
          onChange={(e) => setMakroOpacity(Number(e.target.value) / 100)}
          className="dash-range h-1 flex-1"
          aria-label="Transparansi choropleth"
        />
        <span className="w-9 text-right font-mono text-[11px] text-muted">{Math.round(makroOpacity * 100)}%</span>
      </div>

      {/* peringkat (inovasi: ringkasan terbaik berbasis 'sense') */}
      {ind && (ind.kind ?? "numeric") === "numeric" && (
        <section className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{bestLabel}</h4>
            <span className="text-[10px] text-muted">{senseHigh ? "↑ baik" : "↓ baik"}</span>
          </div>
          {best.length === 0 ? (
            <p className="text-[11px] text-muted">Belum ada data.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {best.map((r, i) => (
                <li key={r.kode} className="flex items-center gap-2 text-[12px]">
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted">{i + 1}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: RAMP[Math.min(RAMP.length - 1, RAMP.length - 1 - i)] }} />
                  <span className="flex-1 truncate">{r.nama}</span>
                  <span className="shrink-0 font-mono text-[11px] text-foreground/70">{formatValue(r.value, ind.format)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-muted">
        Semua indikator makro dirangkum dalam <b>satu layer</b> peta yang berganti warna sesuai pilihan
        di atas — jadi panel tetap ringkas walau indikatornya banyak. Arahkan kursor ke wilayah untuk
        melihat nilai &amp; peringkat.
      </p>
    </div>
  );
}
