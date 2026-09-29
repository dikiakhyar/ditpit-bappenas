"use client";

import { useDashboard, type FocusMode } from "@/lib/dashboard-context";

const OPTIONS: { id: FocusMode; label: string; hint: string }[] = [
  { id: "abu", label: "Abu-abu", hint: "Wilayah lain diredupkan abu-abu" },
  { id: "sembunyi", label: "Sembunyikan", hint: "Hanya wilayah terpilih yang tampil" },
];

/** Pilihan tampilan wilayah yang TIDAK dipilih saat ada wilayah terpilih. */
export default function FocusModeToggle() {
  const { focusMode, setFocusMode } = useDashboard();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Wilayah lain saat memilih</span>
      <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={focusMode === o.id}
            title={o.hint}
            onClick={() => setFocusMode(o.id)}
            className={`rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors ${
              focusMode === o.id ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
