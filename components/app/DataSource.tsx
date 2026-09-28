"use client";

import { useState } from "react";
import { refreshDatabase, useProfil } from "@/lib/profil/useProfil";
import { Icon } from "@/components/ui/icons";

const time = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Keterangan asal data + tombol baca ulang spreadsheet. */
export default function DataSource({ compact }: { compact?: boolean }) {
  const { E } = useProfil();
  const [busy, setBusy] = useState(false);
  const src = E?.source;
  if (!src) return null;
  const live = src.kind === "spreadsheet";
  if (src.refreshing)
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[11.5px] text-ink-2">
        <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
        Memuat data terbaru dari spreadsheet… (sementara menampilkan salinan terakhir)
      </div>
    );

  return (
    <div className={`rounded-md border px-3 py-2 text-[11.5px] leading-snug ${live ? "border-border bg-surface-2 text-ink-2" : "border-warn/30 bg-warn-lt text-warn"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${live ? "bg-good" : "bg-warn"}`} />
        <span className="font-medium">{live ? "Database: Google Spreadsheet" : "Database: salinan lokal"}</span>
        <span className="text-muted">· dibaca {time(src.fetchedAt)}</span>
      </div>
      {!live && src.note && !compact && <p className="mt-1">{src.note}</p>}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {src.sheetUrl && (
          <a href={src.sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Buka spreadsheet <Icon name="arrowRight" className="h-3 w-3" />
          </a>
        )}
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refreshDatabase();
            } finally {
              setBusy(false);
            }
          }}
          className="font-medium text-primary hover:underline disabled:opacity-60"
        >
          {busy ? "Membaca ulang…" : "Perbarui sekarang"}
        </button>
      </div>
      {!compact && live && <p className="mt-1 text-muted">Perubahan di spreadsheet otomatis tampil dalam ±5 menit.</p>}
    </div>
  );
}
