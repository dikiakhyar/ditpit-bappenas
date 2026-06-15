"use client";

import { LAYERS } from "@/lib/layers";
import { Icon } from "@/components/ui/icons";

export default function DownloadPanel() {
  const items = LAYERS.filter((l) => l.downloadable);

  return (
    <div className="flex flex-col gap-3 p-4">
      {items.map((l) => (
        <div key={l.id} className="rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{l.name}</span>
            <button
              disabled
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted disabled:cursor-not-allowed"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              Unduh
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(l.formats ?? []).map((f) => (
              <span
                key={f}
                className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      ))}

      <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-muted">
        Tombol unduh diaktifkan pada{" "}
        <span className="font-medium text-foreground">Sprint 8</span> setelah sumber data
        tersedia.
      </p>
    </div>
  );
}
