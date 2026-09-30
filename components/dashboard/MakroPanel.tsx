"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import { colorOf, findIndicator, formatValue } from "@/lib/makro";
import { makeScale } from "@/lib/classify";
import FocusModeToggle from "./FocusModeToggle";
import KawasanSummary from "./KawasanSummary";
import SymbologyEditor from "./SymbologyEditor";
import BatasLabelSettings from "./BatasLabelSettings";
import { KAWASAN } from "@/lib/wilayah";
import DataSource from "@/components/app/DataSource";
import { ranking } from "@/lib/choropleth";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
    >
      <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

/** Bagian yang bisa dibuka-tutup. */
export function Section({ title, icon, aside, children, defaultOpen = false }: { title: string; icon: string; aside?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-border">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <Icon name={icon} className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-[13px] font-medium">{title}</span>
        {aside}
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border px-3 pb-3 pt-3">{children}</div>}
    </section>
  );
}

const Lbl = ({ children }: { children: ReactNode }) => (
  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</span>
);

export default function MakroPanel() {
  const {
    makroOn,
    setMakroOn,
    makroSel,
    setMakroCategory,
    setMakroIndicator,
    setMakroYear,
    kabkota,
    makroData,
    dataStatus,
    makroCatalog,
    symb,
    setSelectedKode,
    setTab,
    labels,
  } = useDashboard();
  const labelBadge =
    labels.mode !== "off" ? (
      <span className="rounded-full bg-primary-lt px-1.5 text-[10px] font-medium text-primary">label aktif</span>
    ) : null;

  const cat = makroCatalog.find((c) => c.id === makroSel.catId) ?? makroCatalog[0];
  const found = findIndicator(makroSel.indId, makroCatalog);
  const ind = found?.ind;
  const numeric = !!ind && (ind.kind ?? "numeric") === "numeric";

  const ranked = useMemo(
    () => ranking(kabkota, makroData, makroSel.indId, makroSel.year),
    [kabkota, makroData, makroSel.indId, makroSel.year]
  );
  // skala kelas = sama persis dengan peta (warna titik peringkat & tabel kelas)
  const scale = useMemo(
    () => (ind && numeric && ranked.length ? makeScale(ranked.map((r) => r.value), ind, found?.cat, symb) : null),
    [ranked, ind, numeric, found?.cat, symb]
  );
  const min = ranked.length ? ranked[ranked.length - 1].value : null;
  const max = ranked.length ? ranked[0].value : null;
  const senseHigh = (ind?.sense ?? "high") === "high";
  const best = senseHigh ? ranked.slice(0, 5) : ranked.slice(-5).reverse();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon name="grid" className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Warnai kab/kota</span>
        </div>
        <Switch checked={makroOn} onChange={() => setMakroOn(!makroOn)} label="Tampilkan choropleth" />
      </div>

      {dataStatus === "error" && (
        <p className="rounded-md border border-bad/30 bg-bad-lt px-3 py-2 text-[11.5px] text-bad">Database belum dapat dimuat.</p>
      )}
      {dataStatus === "loading" && <p className="text-[11.5px] text-muted">Memuat database…</p>}

      <label className="flex flex-col gap-1">
        <Lbl>Kategori</Lbl>
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

      <label className="flex flex-col gap-1">
        <Lbl>Indikator</Lbl>
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
        {(ind?.unit || ind?.note) && (
          <span className="text-[11px] leading-snug text-muted" title={ind?.note}>
            {ind?.unit && `Satuan: ${ind.unit}`}
            {ind?.unit && ind?.note && " · "}
            {ind?.note}
          </span>
        )}
      </label>

      {ind?.years && (
        <div className="flex flex-col gap-1">
          <Lbl>Tahun</Lbl>
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

      <Section
        title="Simbolisasi"
        icon="layers"
        aside={
          scale && (
            <span className="flex h-2.5 w-16 overflow-hidden rounded-sm border border-black/10" aria-hidden>
              {scale.colors.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </span>
          )
        }
      >
        <div className="flex flex-col gap-3.5">
          <SymbologyEditor ind={ind} scale={scale} min={min} max={max} />
          <div className="border-t border-border pt-3">
            <FocusModeToggle />
          </div>
        </div>
      </Section>

      {/* garis batas + label nama wilayah: satu tempat dengan simbolisasi */}
      <Section title="Garis batas & label" icon="mappin" aside={labelBadge}>
        <BatasLabelSettings />
      </Section>

      <KawasanSummary
        onOpen={() => {
          setSelectedKode(KAWASAN);
          setTab("wilayah");
        }}
      />

      {ind && numeric && (
        <section className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">5 {senseHigh ? "tertinggi" : "terendah"} (terbaik)</h4>
            <span className="text-[10px] text-muted">{senseHigh ? "↑ baik" : "↓ baik"}</span>
          </div>
          {best.length === 0 ? (
            <p className="text-[11px] text-muted">Tidak ada data.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {best.map((r, i) => (
                <li key={r.kode}>
                  <button onClick={() => setSelectedKode(r.kode)} className="flex w-full items-center gap-2 rounded text-left text-[12px] hover:bg-surface">
                    <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted">{i + 1}</span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: scale ? colorOf(r.value, scale) : undefined }} />
                    <span className="flex-1 truncate">{r.nama}</span>
                    <span className="shrink-0 font-mono text-[11px] text-foreground/70">{formatValue(r.value, ind.format)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <DataSource compact />
    </div>
  );
}
