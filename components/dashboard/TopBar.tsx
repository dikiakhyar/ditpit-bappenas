"use client";

import AppHeader from "@/components/app/AppHeader";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";

/** Header halaman peta = header bersama + tombol buka panel (layar kecil). */
export default function TopBar() {
  const { sidebarOpen, setSidebarOpen } = useDashboard();
  return (
    <AppHeader
      leading={
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Tutup panel" : "Buka panel"}
          className="btn !px-2 lg:hidden"
        >
          <Icon name="menu" className="h-[18px] w-[18px]" />
        </button>
      }
    />
  );
}
