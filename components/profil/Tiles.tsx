"use client";

import type { Engine } from "@/lib/profil/engine";
import { TILES } from "@/lib/profil/config";
import { fmt } from "@/lib/profil/format";
import { Delta } from "./cards";

/** Kartu indikator utama (juga dipakai panel ringkasan di halaman peta). */
export function Tiles({ E, sel, compact }: { E: Engine; sel: string; compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
      {TILES.map((t) => {
        const pk = E.pickCode(t.s, t.i, sel);
        if (!pk)
          return (
            <div key={t.l} className="card px-3.5 py-3">
              <div className="text-[12px] font-medium text-muted">{t.l}</div>
              <div className="mt-1.5 text-[15px] font-semibold text-muted">Tidak ada data</div>
              <div className="text-[11.5px] text-muted">belum tersedia di database</div>
            </div>
          );
        const L = E.latestOf(t.s, pk.code, t.i)!;
        const rk = E.rankInfo(t.s, t.i, pk.code, L.per, t.b);
        const rkAll = E.rankKawasan(t.s, t.i, pk.code, L.per, t.b);
        return (
          <div key={t.l} className={`card ${compact ? "px-3 py-2.5" : "px-4 py-3.5"}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[12px] font-medium leading-tight text-ink-2">{t.l}</span>
              {pk.fb && <span className="badge badge-gold !px-1.5 !py-0 text-[10px]">prov.</span>}
            </div>
            <div className={`tnum mt-1 truncate font-bold tracking-tight ${compact ? "text-[18px]" : "text-[22px]"}`}>{fmt(L.v, t.f)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
              <span className="font-mono">{L.per}</span>
              <Delta L={L} f={t.f} b={t.b} g={t.g} compact />
              {rk && rk.rank > 0 && !!t.b && !compact && (
                <span title={`Peringkat ${rk.rank} dari ${rk.n} ${E.peerWord(pk.code)}`}>
                  Peringkat {rk.rank}/{rk.n}
                  {rkAll ? " prov." : ""}
                </span>
              )}
              {rkAll && !!t.b && !compact && (
                <span title={`Peringkat ${rkAll.rank} dari ${rkAll.n} ${E.kawasanWord}`}>
                  {rkAll.rank}/{rkAll.n} kawasan
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

