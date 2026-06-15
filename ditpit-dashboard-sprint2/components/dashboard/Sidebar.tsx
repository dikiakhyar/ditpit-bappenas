"use client";

import { useDashboard, type Tab } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import LayerPanel from "./LayerPanel";
import StatsPanel from "./StatsPanel";
import DownloadPanel from "./DownloadPanel";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "layer", label: "Layer", icon: "layers" },
  { id: "statistik", label: "Statistik", icon: "chart" },
  { id: "unduh", label: "Unduh", icon: "download" },
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-fg"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "layer" && <LayerPanel />}
          {tab === "statistik" && <StatsPanel />}
          {tab === "unduh" && <DownloadPanel />}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
          <span>{activeCount} layer aktif</span>
          <span className="font-mono">DITPIT · Bappenas</span>
        </div>
      </aside>
    </>
  );
}
