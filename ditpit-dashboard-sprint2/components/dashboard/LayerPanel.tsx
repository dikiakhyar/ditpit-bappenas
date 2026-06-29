"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { Swatch } from "@/components/ui/Swatch";
import { Icon } from "@/components/ui/icons";
import {
  LAYERS,
  GROUPS,
  SUBGROUPS,
  GEOMETRY_META,
  PROVINCES,
  type LayerDef,
  type GroupId,
  type Geometry,
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

function GroupCount({ on, total }: { on: number; total: number }) {
  return (
    <span className="rounded-full bg-surface-2 px-1.5 text-[10px] font-medium text-muted">
      {on}/{total}
    </span>
  );
}

export default function LayerPanel() {
  const { layerState, setGroupVisible, setSubgroupVisible, province, setProvince } =
    useDashboard();

  const isOn = (l: LayerDef) => !!layerState[l.id]?.visible;

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* pemilih provinsi */}
      <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
        <Icon name="mappin" className="h-4 w-4 shrink-0 text-primary" />
        <span className="shrink-0 text-muted">Provinsi</span>
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value as typeof province)}
          className="min-w-0 flex-1 bg-transparent text-right font-medium text-foreground outline-none"
        >
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

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

      {/* key bentuk geometri */}
      <section className="rounded-lg bg-surface-2 p-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Bentuk geometri
        </h4>
        <ul className="flex flex-col gap-1.5 text-xs">
          {(Object.keys(GEOMETRY_META) as Geometry[]).map((g) => {
            const sample = LAYERS.find((l) => l.geometry === g && !l.outline)!;
            return (
              <li key={g} className="flex items-center gap-2">
                <Swatch layer={sample} />
                <span>{GEOMETRY_META[g].label}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
