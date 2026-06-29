"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";

const CARDS = [
  { label: "Luas wilayah", unit: "km²" },
  { label: "Jumlah fitur", unit: "fitur" },
  { label: "Cakupan layer", unit: "%" },
];

export default function StatsPanel() {
  const { province } = useDashboard();
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
        <Icon name="mappin" className="h-4 w-4" />
        <span className="font-mono text-foreground">Provinsi {province}</span>
        <span className="opacity-40">›</span>
        <span className="opacity-70">Pilih kab/kota</span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {CARDS.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
              —<span className="ml-1 text-sm font-normal text-muted">{c.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-muted">
        Statistik diisi dari sumber CSV/Excel pada{" "}
        <span className="font-medium text-foreground">Sprint 7</span>. Struktur kartu di
        atas sudah siap dihubungkan ke data.
      </p>
    </div>
  );
}
