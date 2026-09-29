"use client";

import { useDashboard, type LabelMode } from "@/lib/dashboard-context";
import { Swatch } from "@/components/ui/Swatch";
import { Icon } from "@/components/ui/icons";
import { MAP_BOUNDS } from "@/lib/peta-wilayah";
import { overviewPadding } from "@/lib/basemap";
import { MAP_PROV_CODES, namaWilayah, provOfCode } from "@/lib/wilayah";
import {
  LAYERS,
  GROUPS,
  SUBGROUPS,
  type LayerDef,
} from "@/lib/layers";

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function LayerRow({ l }: { l: LayerDef }) {
  const { layerState, toggleLayer, setOpacity } = useDashboard();
  const st = layerState[l.id];
  const isArea = l.geometry === "area" && !l.outline;
  return (
    <li className="rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-surface-2">
      <div className="flex items-center gap-2.5">
        <Swatch layer={l} />
        <span className="flex-1 truncate text-sm">{l.name}</span>
        <Switch checked={!!st?.visible} onChange={() => toggleLayer(l.id)} />
      </div>
      {st?.visible && isArea && (
        <div className="mt-1.5 flex items-center gap-2 pl-[26px]">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(st.opacity * 100)}
            onChange={(e) => setOpacity(l.id, Number(e.target.value) / 100)}
            className="dash-range h-1 flex-1"
            aria-label={`Transparansi ${l.name}`}
          />
          <span className="w-9 text-right font-mono text-[11px] text-muted">
            {Math.round(st.opacity * 100)}%
          </span>
        </div>
      )}
    </li>
  );
}

const LABEL_MODES: { id: LabelMode; label: string }[] = [
  { id: "off", label: "Tidak" },
  { id: "kab", label: "Kab/Kota" },
  { id: "prov", label: "Provinsi" },
  { id: "both", label: "Keduanya" },
];
const LABEL_COLORS = ["#1f2937", "#ffffff", "#0b2540", "#b21621", "#047437", "#6d44b2"];

/** Label nama wilayah dari batas GeoJSON: tampil/tidak, ukuran & warna huruf. */
function LabelSection() {
  const { labels, setLabels } = useDashboard();
  const on = labels.mode !== "off";
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Icon name="mappin" className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Label nama wilayah</h3>
      </div>
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

      {on && (
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
            <Switch checked={labels.halo} onChange={() => setLabels({ halo: !labels.halo })} />
          </div>
        </>
      )}
    </section>
  );
}

function GroupCount({ on, total }: { on: number; total: number }) {
  return (
    <span className="rounded-full bg-surface-2 px-1.5 text-[10px] font-medium text-muted">
      {on}/{total}
    </span>
  );
}

export default function LayerPanel() {
  const { layerState, setGroupVisible, setSubgroupVisible, selectedKode, setSelectedKode, mapInstance } =
    useDashboard();
  const provSel = selectedKode ? provOfCode(selectedKode) : "";
  const provList = [...MAP_PROV_CODES].sort((a, b) => namaWilayah(a).localeCompare(namaWilayah(b), "id"));

  const isOn = (l: LayerDef) => !!layerState[l.id]?.visible;

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* fokus provinsi: memperbesar peta ke provinsi terpilih */}
      <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
        <Icon name="mappin" className="h-4 w-4 shrink-0 text-primary" />
        <span className="shrink-0 text-muted">Fokus</span>
        <select
          value={provSel}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedKode(v || null);
            if (!v) mapInstance?.fitBounds(MAP_BOUNDS, { padding: overviewPadding(mapInstance.getContainer()), duration: 900 });
          }}
          className="min-w-0 flex-1 bg-transparent text-right font-medium text-foreground outline-none"
        >
          <option value="">Seluruh wilayah ({MAP_PROV_CODES.length} provinsi)</option>
          {provList.map((p) => (
            <option key={p} value={p}>
              {namaWilayah(p)}
            </option>
          ))}
        </select>
      </label>

      <LabelSection />

      {GROUPS.map((group) => {
        const layers = LAYERS.filter((l) => l.group === group.id);
        const visibleCount = layers.filter(isOn).length;
        const allOn = visibleCount === layers.length;
        const subs = SUBGROUPS.filter((s) => s.group === group.id);
        const looseLayers = layers.filter((l) => !l.subgroup);

        return (
          <section key={group.id}>
            <header className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.name}
                </h3>
                <GroupCount on={visibleCount} total={layers.length} />
              </div>
              <button
                onClick={() => setGroupVisible(group.id, !allOn)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {allOn ? "Sembunyikan" : "Tampilkan"} semua
              </button>
            </header>

            {/* layer tanpa sub-grup (mis. batas administrasi) */}
            {looseLayers.length > 0 && (
              <ul className="mb-2 flex flex-col gap-0.5">
                {looseLayers.map((l) => (
                  <LayerRow key={l.id} l={l} />
                ))}
              </ul>
            )}

            {/* sub-grup */}
            {subs.map((sg) => {
              const items = layers.filter((l) => l.subgroup === sg.id);
              if (items.length === 0) return null;
              const onCount = items.filter(isOn).length;
              const subAllOn = onCount === items.length;
              return (
                <div key={sg.id} className="mb-2.5">
                  <div className="mb-1 flex items-center justify-between pl-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground/80">
                        {sg.name}
                      </span>
                      <GroupCount on={onCount} total={items.length} />
                    </div>
                    <button
                      onClick={() => setSubgroupVisible(group.id, sg.id, !subAllOn)}
                      className="text-[10px] font-medium text-muted hover:text-primary hover:underline"
                    >
                      {subAllOn ? "—" : "semua"}
                    </button>
                  </div>
                  <ul className="flex flex-col gap-0.5 border-l border-border pl-2">
                    {items.map((l) => (
                      <LayerRow key={l.id} l={l} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}

    </div>
  );
}
