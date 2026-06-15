"use client";

import { useDashboard } from "@/lib/dashboard-context";
import {
  LAYERS,
  GROUPS,
  GEOMETRY_META,
  type Geometry,
} from "@/lib/layers";

function GeoDot({ geo }: { geo: Geometry }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: `var(${GEOMETRY_META[geo].varName})` }}
    />
  );
}

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

export default function LayerPanel() {
  const { layerState, toggleLayer, setOpacity, setGroupVisible } = useDashboard();

  return (
    <div className="flex flex-col gap-5 p-4">
      {GROUPS.map((group) => {
        const layers = LAYERS.filter((l) => l.group === group.id);
        const visibleCount = layers.filter((l) => layerState[l.id]?.visible).length;
        const allOn = visibleCount === layers.length;

        return (
          <section key={group.id}>
            <header className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.name}
                </h3>
                <span className="rounded-full bg-surface-2 px-1.5 text-[10px] font-medium text-muted">
                  {visibleCount}/{layers.length}
                </span>
              </div>
              <button
                onClick={() => setGroupVisible(group.id, !allOn)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {allOn ? "Sembunyikan" : "Tampilkan"} semua
              </button>
            </header>

            <ul className="flex flex-col gap-1">
              {layers.map((l) => {
                const st = layerState[l.id];
                return (
                  <li
                    key={l.id}
                    className="rounded-lg border border-transparent px-2 py-2 hover:border-border hover:bg-surface-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <GeoDot geo={l.geometry} />
                      <span className="flex-1 truncate text-sm">{l.name}</span>
                      <Switch checked={!!st?.visible} onChange={() => toggleLayer(l.id)} />
                    </div>
                    {st?.visible && (
                      <div className="mt-2 flex items-center gap-2 pl-5">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(st.opacity * 100)}
                          onChange={(e) => setOpacity(l.id, Number(e.target.value) / 100)}
                          className="dash-range h-1 flex-1"
                          aria-label={`Opacity ${l.name}`}
                        />
                        <span className="w-9 text-right font-mono text-[11px] text-muted">
                          {Math.round(st.opacity * 100)}%
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="rounded-lg bg-surface-2 p-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Keterangan geometri
        </h4>
        <ul className="flex flex-col gap-1.5 text-xs">
          {(Object.keys(GEOMETRY_META) as Geometry[]).map((g) => (
            <li key={g} className="flex items-center gap-2">
              <GeoDot geo={g} />
              <span>{GEOMETRY_META[g].label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
