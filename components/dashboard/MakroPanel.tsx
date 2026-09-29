"use client";

import { useMemo } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import { colorOf, findIndicator, formatValue, numericScale, paletteSwatch, PALETTE_OPTIONS, resolvePalette, type PaletteChoice } from "@/lib/makro";
import FocusModeToggle from "./FocusModeToggle";
import KawasanSummary from "./KawasanSummary";
import { KAWASAN } from "@/lib/wilayah";
import DataSource from "@/components/app/DataSource";
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
    makroCatalog,
    makroPalette,
    setMakroPalette,
    makroReverse,
    setMakroReverse,
    setSelectedKode,
    setTab,
  } = useDashboard();

  const cat = makroCatalog.find((c) => c.id === makroSel.catId) ?? makroCatalog[0];
  const found = findIndicator(makroSel.indId, makroCatalog);
  const ind = found?.ind;

  const ranked = useMemo(
    () => ranking(kabkota, makroData, makroSel.indId, makroSel.year),
    [kabkota, makroData, makroSel.indId, makroSel.year]
  );
  // warna titik peringkat = warna kelasnya di peta
  const scale = useMemo(
    () =>
      ind && ranked.length
        ? numericScale(ranked.map((r) => r.value), resolvePalette(ind, found?.cat, makroPalette), makroReverse)
        : null,
    [ranked, ind, found?.cat, makroPalette, makroReverse]
  );
  const numericInd = !!ind && (ind.kind ?? "numeric") === "numeric";
  const autoPalette = ind ? resolvePalette(ind, found?.cat, "auto") : "biru";
  const paletteChoices: { id: PaletteChoice; label: string; swatch: string[] }[] = [
    { id: "auto", label: "Otomatis", swatch: paletteSwatch(autoPalette) },
    ...PALETTE_OPTIONS.map((p) => ({ id: p.id as PaletteChoice, label: p.label, swatch: paletteSwatch(p.id) })),
  ];
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
        <p className="rounded-md border border-bad/30 bg-bad-lt px-3 py-2 text-[11.5px] leading-snug text-bad">
          Database belum dapat dimuat. Periksa koneksi internet server atau izin berbagi spreadsheet.
        </p>
      )}
      {dataStatus === "loading" && <p className="text-[11.5px] text-muted">Memuat database dari spreadsheet…</p>}

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
            {makroCatalog.map((c) => (
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
        {ind?.note && <span className="text-[11px] leading-snug text-muted">{ind.note}</span>}
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

      {/* palet warna pilihan pengguna */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Palet warna</span>
          {numericInd && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
              Balik warna
              <Switch checked={makroReverse} onChange={() => setMakroReverse(!makroReverse)} />
            </label>
          )}
        </div>
        {numericInd ? (
          <>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Palet warna">
              {paletteChoices.map((p) => {
                const on = makroPalette === p.id;
                const sw = makroReverse ? [...p.swatch].reverse() : p.swatch;
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMakroPalette(p.id)}
                    title={p.id === "auto" ? "Warna ditentukan otomatis sesuai konteks indikator" : p.label}
                    className={`flex flex-col gap-1 rounded-md border px-2 py-1.5 text-left transition-colors ${
                      on ? "border-primary bg-primary-lt" : "border-border bg-surface hover:border-primary/50"
                    }`}
                  >
                    <span className="flex h-2.5 w-full overflow-hidden rounded-sm">
                      {sw.map((c, i) => (
                        <span key={i} className="flex-1" style={{ background: c }} />
                      ))}
                    </span>
                    <span className={`truncate text-[11px] ${on ? "font-semibold text-foreground" : "text-muted"}`}>{p.label}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] leading-snug text-muted">
              {makroPalette === "auto"
                ? "Otomatis: warna mengikuti makna indikator (hijau = makin tinggi makin baik, merah = masalah, dst.)."
                : "Palet tetap dipakai untuk semua indikator sampai diganti kembali ke Otomatis."}
            </span>
          </>
        ) : (
          <span className="text-[11px] leading-snug text-muted">Indikator ini berupa kelas/kategori dengan warna baku, jadi paletnya tetap.</span>
        )}
      </div>

      <FocusModeToggle />

      {/* kompilasi seluruh kawasan */}
      <KawasanSummary
        onOpen={() => {
          setSelectedKode(KAWASAN);
          setTab("wilayah");
        }}
      />

      {/* peringkat (inovasi: ringkasan terbaik berbasis 'sense') */}
      {ind && (ind.kind ?? "numeric") === "numeric" && (
        <section className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{bestLabel}</h4>
            <span className="text-[10px] text-muted">{senseHigh ? "↑ baik" : "↓ baik"}</span>
          </div>
          {best.length === 0 ? (
            <p className="text-[11px] text-muted">Tidak ada data.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {best.map((r, i) => (
                <li key={r.kode} className="flex items-center gap-2 text-[12px]">
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted">{i + 1}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: scale ? colorOf(r.value, scale) : undefined }} />
                  <span className="flex-1 truncate">{r.nama}</span>
                  <span className="shrink-0 font-mono text-[11px] text-foreground/70">{formatValue(r.value, ind.format)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-muted">
        Satu layer peta yang berganti warna sesuai pilihan di atas. Nilai & peringkat dihitung langsung dari database; indikator dan
        tahun yang tampil hanya yang berdata untuk kab/kota di peta. Arahkan kursor ke wilayah untuk melihat nilainya.
      </p>
      <DataSource />
    </div>
  );
}
