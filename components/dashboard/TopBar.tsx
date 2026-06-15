"use client";

import Image from "next/image";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";

export default function TopBar() {
  const { theme, toggleTheme, sidebarOpen, setSidebarOpen } = useDashboard();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-4">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Buka panel"
        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2.5">
        <Image
          src="/logo.png"
          alt="Logo Bappenas"
          width={30}
          height={30}
          priority
          className="h-7 w-7 object-contain"
        />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">DITPIT</p>
          <p className="-mt-0.5 text-[10px] uppercase tracking-wider text-muted">
            Bappenas · GIS
          </p>
        </div>
      </div>

      {/* pencarian wilayah */}
      <div className="ml-2 hidden min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 md:flex">
        <Icon name="search" className="h-4 w-4 shrink-0 text-muted" />
        <input
          placeholder="Cari wilayah — provinsi, kabupaten, kecamatan…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <kbd className="hidden shrink-0 rounded border border-border px-1.5 font-mono text-[10px] text-muted lg:block">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="hidden items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted sm:flex">
          <Icon name="globe" className="h-4 w-4" />
          <select className="bg-transparent text-foreground outline-none" defaultValue="terang">
            <option value="terang">Basemap Terang</option>
            <option value="gelap">Basemap Gelap</option>
            <option value="satelit">Citra Satelit</option>
          </select>
        </label>

        <button
          onClick={toggleTheme}
          aria-label="Ganti tema"
          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
