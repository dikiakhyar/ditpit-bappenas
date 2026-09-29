"use client";

import { useMemo } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import { findIndicator, formatValue, isApbdIndicator, kawasanSummary } from "@/lib/makro";
import { KAWASAN, KAWASAN_NAMA, namaWilayah } from "@/lib/wilayah";

/** Kompilasi "Indonesia Timur" untuk indikator Makro terpilih: nilai kawasan + sebaran kab/kota. */
export default function KawasanSummary({ onOpen }: { onOpen?: () => void }) {
  const { engine, makroData, makroSel, makroCatalog } = useDashboard();
  const found = findIndicator(makroSel.indId, makroCatalog);
  const ind = found?.ind;
  const s = useMemo(
    () => (ind ? kawasanSummary(engine, makroData, ind, makroSel.year, KAWASAN) : null),
    [engine, makroData, ind, makroSel.year]
  );
  if (!ind || !s) return null;
  const numeric = (ind.kind ?? "numeric") === "numeric";
  const fv = (v: number | null) => formatValue(v, ind.format);
  const value = typeof s.value === "number" ? fv(s.value) : s.value ?? "Tidak ada data";
  const noData = s.value == null;

  return (
    <section className="rounded-lg border border-primary/30 bg-primary-lt/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon name="globe" className="h-4 w-4 shrink-0 text-primary" />
          <h4 className="truncate text-[12px] font-semibold">{KAWASAN_NAMA}</h4>
        </div>
        <span className="shrink-0 font-mono text-[10.5px] text-muted">{makroSel.year ?? ""}</span>
      </div>
      <p className="mt-0.5 truncate text-[11px] text-muted">{ind.label}</p>
      <p className={`tnum mt-1 font-bold tracking-tight ${noData ? "text-[14px] text-muted" : "text-[20px]"}`}>{value}</p>
      {!noData && isApbdIndicator(ind.id) && (
        <p className="text-[10.5px] leading-snug text-muted">Gabungan APBD pemerintah provinsi.</p>
      )}
      {noData && (
        <p className="text-[10.5px] text-muted" title="Nilai kawasan hanya dihitung bila data seluruh provinsi lengkap">Data provinsi belum lengkap.</p>
      )}

      {numeric && s.min && s.max && (
        <dl className="mt-2 grid grid-cols-3 gap-1.5 border-t border-primary/15 pt-2 text-[11px]">
          <div className="min-w-0">
            <dt className="text-muted">Terendah</dt>
            <dd className="tnum font-semibold">{fv(s.min.v)}</dd>
            <dd className="truncate text-[10.5px] text-muted" title={namaWilayah(s.min.kode)}>{namaWilayah(s.min.kode)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted">Median</dt>
            <dd className="tnum font-semibold">{fv(s.median)}</dd>
            <dd className="text-[10.5px] text-muted">kab/kota</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted">Tertinggi</dt>
            <dd className="tnum font-semibold">{fv(s.max.v)}</dd>
            <dd className="truncate text-[10.5px] text-muted" title={namaWilayah(s.max.kode)}>{namaWilayah(s.max.kode)}</dd>
          </div>
        </dl>
      )}
      <p className="mt-1.5 text-[10.5px] text-muted">
        {s.n} dari {s.total} kab/kota di peta berdata
        {s.total - s.n > 0 ? ` · ${s.total - s.n} tidak ada data` : ""}
      </p>
      {onOpen && (
        <button onClick={onOpen} className="mt-2 flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline">
          Ringkasan lengkap {KAWASAN_NAMA}
          <Icon name="arrowRight" className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}
