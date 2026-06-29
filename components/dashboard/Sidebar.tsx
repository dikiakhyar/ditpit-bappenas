"use client";

import { useDashboard, type Tab } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import LayerPanel from "./LayerPanel";
import MakroPanel from "./MakroPanel";
import StatsPanel from "./StatsPanel";
import ExportPanel from "./ExportPanel";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "layer", label: "Layer", icon: "layers" },
  { id: "makro", label: "Makro", icon: "grid" },
  { id: "statistik", label: "Statistik", icon: "chart" },
  { id: "ekspor", label: "Ekspor", icon: "download" },
];

export default function Sidebar() {
  const { tab, setTab, sidebarOpen, setSidebarOpen, activeCount } = useDashboard();

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
        className={`absolute z-30 flex h-full w-[88%] max-w-[340px] flex-col border-r border-border bg-surface transition-transform duration-300 lg:static lg:w-80 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex shrink-0 gap-1 border-b border-border p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-fg"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "layer" && <LayerPanel />}
          {tab === "makro" && <MakroPanel />}
          {tab === "statistik" && <StatsPanel />}
          {tab === "ekspor" && <ExportPanel />}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
          <span>{activeCount} layer aktif</span>
          <span className="font-mono">DITPIT · Bappenas</span>
        </div>
      </aside>
    </>
  );
}
