"use client";

import { useDashboard, type Tab } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import LayerPanel from "./LayerPanel";
import MakroPanel from "./MakroPanel";
import StatsPanel from "./StatsPanel";
import ExportPanel from "./ExportPanel";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "layer", label: "Layer", icon: "layers" },
  { id: "wilayah", label: "Wilayah", icon: "report" },
  { id: "makro", label: "Makro", icon: "grid" },
  { id: "ekspor", label: "Ekspor", icon: "download" },
];

export default function Sidebar() {
  const { tab, setTab, sidebarOpen, setSidebarOpen, activeCount, makroOn } = useDashboard();

  return (
    <>
      {sidebarOpen && (
        <button
          aria-label="Tutup panel"
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`absolute z-30 flex h-full w-[88%] max-w-[360px] flex-col border-r border-border bg-surface transition-transform duration-300 lg:static lg:w-[340px] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* tab bergaris bawah (Tabler nav-tabs) */}
        <div className="flex shrink-0 border-b border-border px-2" role="tablist">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 px-1 py-3 text-[13px] font-medium transition-colors ${
                  on ? "text-primary" : "text-ink-2 hover:text-foreground"
                }`}
              >
                <Icon name={t.icon} className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.label}</span>
                {on && <span className="absolute inset-x-2 bottom-[-1px] h-0.5 rounded-t bg-primary" />}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "layer" && <LayerPanel />}
          {tab === "makro" && <MakroPanel />}
          {tab === "wilayah" && <StatsPanel />}
          {tab === "ekspor" && <ExportPanel />}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border bg-surface-2 px-4 py-2.5 text-[12px] text-muted">
          <span>
            {activeCount} layer aktif{makroOn ? " · choropleth" : ""}
          </span>
          <span className="font-mono">DITPIT · Bappenas</span>
        </div>
      </aside>
    </>
  );
}
