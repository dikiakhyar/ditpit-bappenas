"use client";

import type { ReactNode } from "react";
import { useDashboard, type LabelMode } from "@/lib/dashboard-context";
import { toRgbText } from "@/lib/classify";
import { ColorField } from "./SymbologyEditor";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
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

const Lbl = ({ children }: { children: ReactNode }) => (
  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</span>
);

const BORDER_PRESETS = ["#c8c8c8", "#8c98aa", "#ffffff", "#334155", "#000000"];
const LABEL_MODES: { id: LabelMode; label: string }[] = [
  { id: "off", label: "Tidak" },
  { id: "kab", label: "Kab/Kota" },
  { id: "prov", label: "Provinsi" },
  { id: "both", label: "Keduanya" },
];
const LABEL_COLORS = ["#1f2937", "#ffffff", "#0b2540", "#b21621", "#047437", "#6d44b2"];

/**
 * Semua pengaturan "rupa" peta di luar warna kelas: garis batas provinsi & kab/kota
 * dan label nama wilayah. Berada di tab Makro, bersebelahan dengan Simbolisasi.
 */
export default function BatasLabelSettings() {
  const { symb, setSymb, layerState, toggleLayer, labels, setLabels } = useDashboard();
  const provOn = !!layerState.prov?.visible;
  const labelOn = labels.mode !== "off";

  return (
    <div className="flex flex-col gap-3.5">
      {/* garis batas provinsi */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px]">
          <span className="inline-block h-0 w-5 border-t-2" style={{ borderColor: "#334155" }} aria-hidden />
          Garis batas provinsi
        </span>
        <Switch checked={provOn} onChange={() => toggleLayer("prov")} label="Garis batas provinsi" />
      </div>

      {/* garis batas kab/kota — tetap tampil walau choropleth dimatikan */}
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
            aria-label="Tebal garis batas kab/kota"
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

      {/* label nama wilayah */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <Lbl>Label nama wilayah</Lbl>
        <div role="radiogroup" className="grid grid-cols-4 gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5">
          {LABEL_MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={labels.mode === m.id}
              onClick={() => setLabels({ mode: m.id })}
              className={`rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors ${
                labels.mode === m.id ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {labelOn && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] text-muted">Ukuran</span>
              <input
                type="range"
                min={8}
                max={24}
                value={labels.size}
                onChange={(e) => setLabels({ size: Number(e.target.value) })}
                className="dash-range h-1 flex-1"
                aria-label="Ukuran huruf label"
              />
              <span className="w-9 text-right font-mono text-[11px] text-muted">{labels.size}px</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] text-muted">Warna</span>
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setLabels({ color: c })}
                    aria-label={`Warna ${c}`}
                    className={`h-5 w-5 rounded-full border ${
                      labels.color.toLowerCase() === c ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : "border-border"
                    }`}
                    style={{ background: c }}
                  />
                ))}
                <label
                  title="Warna lain"
                  className="relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border text-[10px] text-muted"
                  style={{ background: LABEL_COLORS.includes(labels.color.toLowerCase()) ? undefined : labels.color }}
                >
                  {LABEL_COLORS.includes(labels.color.toLowerCase()) && "+"}
                  <input
                    type="color"
                    value={labels.color}
                    onChange={(e) => setLabels({ color: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Pilih warna huruf lain"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted" title="Agar nama tetap terbaca di atas warna peta">Garis tepi huruf</span>
              <Switch checked={labels.halo} onChange={() => setLabels({ halo: !labels.halo })} label="Garis tepi huruf" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
