"use client";

import { useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { BREWER } from "@/lib/brewer";
import { CLASS_METHODS, DEFAULT_SYMB, parseColor, toRgbText, type ClassMethod, type ClassScale } from "@/lib/classify";
import { formatValue, legendClasses, PALETTE_OPTIONS, type Indicator, type PaletteChoice } from "@/lib/makro";

const NAMES: Record<number, string[]> = {
  2: ["Rendah", "Tinggi"],
  3: ["Rendah", "Sedang", "Tinggi"],
  4: ["Rendah", "Sedang", "Tinggi", "Sangat tinggi"],
  5: ["Sangat rendah", "Rendah", "Sedang", "Tinggi", "Sangat tinggi"],
  6: ["Sangat rendah", "Rendah", "Agak rendah", "Agak tinggi", "Tinggi", "Sangat tinggi"],
};
const BORDER_PRESETS = ["#c8c8c8", "#8c98aa", "#ffffff", "#334155", "#000000"];

const Lbl = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</span>
);

/** Kotak warna + isian teks RGB/hex ("49, 163, 84" atau "#31a354"). */
export function ColorField({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  // teks yang sedang diketik (null = tampilkan warna saat ini)
  const [edit, setEdit] = useState<string | null>(null);
  const txt = edit ?? toRgbText(value);
  const bad = parseColor(txt) === null;
  const commit = () => {
    const c = parseColor(txt);
    if (c && c !== value) onChange(c);
    setEdit(null);
  };
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded border border-black/15" style={{ background: value }} title={`${label}: pilih warna`}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${label}: pilih warna`} />
      </label>
      <input
        value={txt}
        onChange={(e) => setEdit(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        spellCheck={false}
        aria-label={`${label}: RGB atau hex`}
        title="RGB (mis. 49, 163, 84) atau hex (#31a354)"
        className={`w-[92px] rounded border bg-surface px-1.5 py-0.5 font-mono text-[11px] outline-none focus:border-primary ${bad ? "border-bad" : "border-border"}`}
      />
    </span>
  );
}

function num(s: string): number | null {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  // "1.234,5" (ID) atau "1234.5"
  const v = /,\d+$/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t.replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
}
function BreakInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [edit, setEdit] = useState<string | null>(null);
  const txt = edit ?? String(value);
  const commit = () => {
    const v = num(txt);
    if (v !== null && v !== value) onChange(v);
    setEdit(null);
  };
  return (
    <input
      value={txt}
      inputMode="decimal"
      onChange={(e) => setEdit(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      aria-label={label}
      className="w-[84px] rounded border border-border bg-surface px-1.5 py-0.5 text-right font-mono text-[11px] outline-none focus:border-primary"
    />
  );
}

const round = (v: number) => {
  const a = Math.abs(v);
  const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  return Math.round(v * 10 ** d) / 10 ** d;
};

/** Pengaturan simbolisasi choropleth (isi bagian "Simbolisasi" di tab Makro). */
export default function SymbologyEditor({ ind, scale, min, max }: { ind: Indicator | undefined; scale: ClassScale | null; min: number | null; max: number | null }) {
  const { symb, setSymb, makroOpacity, setMakroOpacity } = useDashboard();
  const numeric = !!ind && (ind.kind ?? "numeric") === "numeric";
  const k = scale?.colors.length ?? 0;
  const rows = scale && min != null && max != null ? legendClasses(scale, min, max) : [];
  const isCustom = symb.palette === "custom";
  const manual = symb.method === "manual";
  const mBreaks = ind ? symb.manual[ind.id] ?? [] : [];

  const setMethod = (m: ClassMethod) => {
    if (m === "manual" && ind && !symb.manual[ind.id]?.length && scale?.breaks.length)
      setSymb({ method: m, manual: { ...symb.manual, [ind.id]: scale.breaks.map(round) } });
    else setSymb({ method: m });
  };
  const setClasses = (n: number) => {
    if (manual && ind && min != null && max != null) {
      let b = (symb.manual[ind.id] ?? []).slice(0, n - 1);
      if (b.length < n - 1) {
        // tambah batas baru merata di antara batas terakhir dan nilai maksimum
        const lo = b.length ? b[b.length - 1] : min, need = n - 1 - b.length;
        b = [...b, ...Array.from({ length: need }, (_, i) => round(lo + ((max - lo) * (i + 1)) / (need + 1)))];
      }
      setSymb({ classes: n, manual: { ...symb.manual, [ind.id]: b } });
    } else setSymb({ classes: n });
  };
  const setBreak = (i: number, v: number) => {
    if (!ind) return;
    const b = mBreaks.slice();
    b[i] = v;
    setSymb({ manual: { ...symb.manual, [ind.id]: b.sort((x, y) => x - y) } });
  };
  // warna baris ke-i (terendah → tertinggi) diubah → pindah ke palet kustom berisi warna yang sedang tampil
  const setRowColor = (i: number, hex: string) => {
    const cur = scale?.colors ?? [];
    const base = isCustom ? (symb.reverse ? [...symb.custom.slice(0, k)].reverse() : symb.custom.slice(0, k)) : cur.slice();
    base[i] = hex;
    const custom = [...base, ...DEFAULT_SYMB.custom.slice(base.length)];
    setSymb({ palette: "custom", custom, reverse: false, classes: manual ? symb.classes : Math.max(k, 2) });
  };
  const setLabel = (i: number, t: string) => {
    const l = Array.from({ length: 6 }, (_, j) => symb.labels[j] ?? "");
    l[i] = t;
    setSymb({ labels: l });
  };

  const paletteSwatch = scale?.colors ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      {/* transparansi */}
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[11.5px] text-ink-2">Transparansi</span>
        <input type="range" min={20} max={100} value={Math.round(makroOpacity * 100)} onChange={(e) => setMakroOpacity(Number(e.target.value) / 100)} className="dash-range h-1 flex-1" aria-label="Transparansi" />
        <span className="w-9 text-right font-mono text-[11px] text-muted">{Math.round(makroOpacity * 100)}%</span>
      </div>

      {numeric ? (
        <>
          {/* palet */}
          <label className="flex flex-col gap-1">
            <Lbl>Palet warna</Lbl>
            <select value={symb.palette} onChange={(e) => setSymb({ palette: e.target.value as PaletteChoice })} className="form-select !py-1.5 text-[12.5px]">
              <option value="auto">Otomatis (sesuai makna indikator)</option>
              <optgroup label="Bawaan">
                {PALETTE_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="ColorBrewer">
                {BREWER.map((b) => (
                  <option key={b.id} value={`cb:${b.id}`}>{b.label}</option>
                ))}
              </optgroup>
              <option value="custom">Kustom (warna sendiri)</option>
            </select>
            <span className="flex h-2.5 overflow-hidden rounded-sm border border-black/10">
              {paletteSwatch.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </span>
          </label>

          {/* metode & jumlah kelas */}
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <Lbl>Pembagian kelas</Lbl>
              <select value={symb.method} onChange={(e) => setMethod(e.target.value as ClassMethod)} className="form-select !py-1.5 text-[12.5px]" title={CLASS_METHODS.find((m) => m.id === symb.method)?.hint}>
                {CLASS_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <Lbl>Kelas</Lbl>
              <div className="flex rounded-md border border-border bg-surface-2 p-0.5" role="radiogroup" aria-label="Jumlah kelas">
                {[3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={symb.classes === n}
                    onClick={() => setClasses(n)}
                    className={`w-7 rounded py-1 text-[12px] font-medium ${symb.classes === n ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* tabel kelas: warna · rentang · nama */}
          {rows.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Lbl>Kelas (rendah → tinggi)</Lbl>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-2">
                  <input type="checkbox" checked={symb.reverse} onChange={() => setSymb({ reverse: !symb.reverse })} className="accent-[var(--primary)]" />
                  Balik warna
                </label>
              </div>
              <ul className="flex flex-col gap-1">
                {rows.map((r, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <ColorField value={r.color} onChange={(hex) => setRowColor(i, hex)} label={`Warna kelas ${i + 1}`} />
                      <input
                        value={symb.labels[i] ?? ""}
                        onChange={(e) => setLabel(i, e.target.value)}
                        placeholder={`Nama (mis. ${NAMES[rows.length]?.[i] ?? `Kelas ${i + 1}`})`}
                        aria-label={`Nama kelas ${i + 1}`}
                        className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[11.5px] outline-none placeholder:text-muted/60 focus:border-primary"
                      />
                    </div>
                    <span className="tnum pl-[30px] text-[10.5px] text-muted">
                      {r.from === r.to ? formatValue(r.from, ind?.format) : `${formatValue(r.from, ind?.format)} – ${formatValue(r.to, ind?.format)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <button onClick={() => setSymb({ labels: NAMES[rows.length] ?? [] })} className="font-medium text-primary hover:underline">
                  Isi nama {(NAMES[rows.length] ?? []).length ? `${NAMES[rows.length][0]}…${NAMES[rows.length][rows.length - 1]}` : ""}
                </button>
                {symb.labels.some(Boolean) && (
                  <button onClick={() => setSymb({ labels: [] })} className="text-muted hover:text-foreground hover:underline">
                    Hapus nama
                  </button>
                )}
              </div>
              {isCustom && <p className="text-[10.5px] text-muted">Klik kotak warna, atau ketik RGB (49, 163, 84) / hex.</p>}
            </div>
          )}

          {/* batas manual */}
          {manual && ind && (
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 p-2">
              <Lbl>Batas bawah kelas</Lbl>
              {Array.from({ length: symb.classes - 1 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="text-ink-2">
                    {symb.labels[i + 1] || NAMES[symb.classes]?.[i + 1] || `Kelas ${i + 2}`} mulai
                  </span>
                  <BreakInput value={mBreaks[i] ?? 0} onChange={(v) => setBreak(i, v)} label={`Batas kelas ${i + 2}`} />
                </div>
              ))}
              <p className="text-[10.5px] text-muted">
                Data: {formatValue(min, ind.format)} – {formatValue(max, ind.format)}. Batas disimpan per indikator.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-[11.5px] text-muted">Indikator kategori memakai warna kelas baku.</p>
      )}

      {/* garis batas poligon */}
      <div className="flex flex-col gap-1.5">
        <Lbl>Garis batas kab/kota</Lbl>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={symb.border.width}
            onChange={(e) => setSymb({ border: { ...symb.border, width: Number(e.target.value) } })}
            className="dash-range h-1 flex-1"
            aria-label="Tebal garis batas"
          />
          <span className="w-16 text-right font-mono text-[11px] text-muted">{symb.border.width === 0 ? "tanpa" : `${symb.border.width.toFixed(2)} px`}</span>
        </div>
        {symb.border.width > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ColorField value={symb.border.color} onChange={(c) => setSymb({ border: { ...symb.border, color: c } })} label="Warna garis batas" />
            {BORDER_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setSymb({ border: { ...symb.border, color: c } })}
                aria-label={`Garis ${toRgbText(c)}`}
                title={toRgbText(c)}
                className={`h-5 w-5 rounded-full border ${symb.border.color === c ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : "border-border"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>

      <button onClick={() => setSymb({ ...DEFAULT_SYMB, manual: symb.manual })} className="self-start text-[11px] text-muted hover:text-foreground hover:underline">
        Kembalikan pengaturan bawaan
      </button>
    </div>
  );
}
