"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { openProfil } from "@/lib/profil/location";
import { useMemo } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import { useProfil } from "@/lib/profil/useProfil";
import { TipProvider } from "@/components/profil/charts";
import { Tiles } from "@/components/profil/Tiles";
import { findIndicator, formatValue, getNumber, getRaw, rankKey, valueKey } from "@/lib/makro";
import { MAP_PROV_CODES, namaWilayah, isProvCode, provOfCode, isKawasan, KAWASAN, KAWASAN_NAMA } from "@/lib/wilayah";
import KawasanSummary from "./KawasanSummary";
import { nf } from "@/lib/profil/format";
import FocusModeToggle from "./FocusModeToggle";

/** Tab "Wilayah": ringkasan kab/kota yang diklik di peta + tautan ke Profil Daerah. */
export default function StatsPanel() {
  const { selectedKode, setSelectedKode, kabkota, makroData, makroSel } = useDashboard();
  const router = useRouter();
  const { E, error } = useProfil();

  // daftar pilihan: provinsi peta + kab/kota yang punya batas di wilayah.topo.json
  const options = useMemo(() => {
    const kabs = (kabkota?.features ?? [])
      .map((f) => String(f.properties?.kode ?? ""))
      .filter(Boolean)
      .sort((a, b) => namaWilayah(a).localeCompare(namaWilayah(b), "id"));
    return MAP_PROV_CODES.map((p) => ({ p, kabs: kabs.filter((k) => provOfCode(k) === p) }));
  }, [kabkota]);

  const k = selectedKode;
  const found = findIndicator(makroSel.indId);
  const row = k ? makroData?.[k] : undefined;
  const vKey = valueKey(makroSel.indId, makroSel.year);
  const mv = found && (found.ind.kind ?? "numeric") === "numeric" ? formatValue(getNumber(row, vKey), found.ind.format) : String(getRaw(row, vKey) ?? "Tidak ada data");
  const rank = getRaw(row, rankKey(makroSel.indId, makroSel.year));

  return (
    <div className="flex flex-col gap-4 p-4">
      <label className="flex flex-col gap-1">
        <span className="subheader">Wilayah</span>
        <select className="form-select" value={k ?? ""} onChange={(e) => setSelectedKode(e.target.value || null)}>
          <option value="">— Klik peta atau pilih di sini —</option>
          <option value={KAWASAN}>{KAWASAN_NAMA} (seluruh kawasan · {MAP_PROV_CODES.length} provinsi)</option>
          {options.map(({ p, kabs }) => (
            <optgroup key={p} label={namaWilayah(p)}>
              <option value={p}>{namaWilayah(p)} (provinsi)</option>
              {kabs.map((c) => (
                <option key={c} value={c}>
                  {namaWilayah(c)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <FocusModeToggle />

      {!k ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-lt text-primary">
            <Icon name="pointer" className="h-5 w-5" />
          </span>
          <p className="text-[13px] font-medium">Klik kabupaten/kota di peta</p>
          <p className="text-[12px] leading-relaxed text-muted">
            Ringkasan indikator utama akan tampil di sini, lengkap dengan tautan ke profil daerahnya.
          </p>
          <button onClick={() => setSelectedKode(KAWASAN)} className="btn mt-1">
            <Icon name="globe" className="h-4 w-4 text-primary" />
            Lihat ringkasan {KAWASAN_NAMA}
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header !py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{namaWilayah(k)}</p>
                <p className="text-[12px] text-muted">
                  <span className="font-mono">{k}</span> ·{" "}
                  {isKawasan(k) ? `Gabungan ${MAP_PROV_CODES.length} provinsi` : isProvCode(k) ? "Provinsi" : namaWilayah(provOfCode(k))}
                </p>
              </div>
              <button onClick={() => setSelectedKode(null)} aria-label="Hapus pilihan" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            {isKawasan(k) && (
              <div className="px-3 py-2.5">
                <KawasanSummary />
              </div>
            )}
            {found && !isProvCode(k) && !isKawasan(k) && (
              <div className="px-4 py-2.5">
                <p className="text-[11.5px] text-muted">
                  Layer makro: {found.ind.label}
                  {makroSel.year ? ` · ${makroSel.year}` : ""}
                </p>
                <p className="tnum text-[18px] font-bold">{mv}</p>
                {rank != null && rank !== "" && <p className="text-[12px] text-ink-2">Peringkat provinsi #{String(rank)}</p>}
              </div>
            )}
          </div>

          {error ? (
            <p className="text-[12px] text-muted">Data profil belum tersedia ({error}).</p>
          ) : !E ? (
            <div className="grid animate-pulse grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card h-[84px]" />
              ))}
            </div>
          ) : E.has(k) ? (
            <TipProvider>
              <Tiles E={E} sel={k} compact />
              <DesaMini E={E} k={k} />
            </TipProvider>
          ) : (
            <p className="text-[12px] text-muted">Wilayah ini belum ada di data profil.</p>
          )}

          <Link
            href={`/profil?kode=${k}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              openProfil(router, k);
            }}
            className="btn btn-primary w-full"
          >
            Buka profil lengkap
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Profil memuat 11 bagian — fiskal, ekonomi, investasi, kesejahteraan, kesehatan, pendidikan, infrastruktur, desa, lingkungan, tata kelola,
            dan potensi — dengan tren, peringkat antarwilayah, dan tabel.
          </p>
        </>
      )}
    </div>
  );
}

function DesaMini({ E, k }: { E: NonNullable<ReturnType<typeof useProfil>["E"]>; k: string }) {
  const d = E.desa(k);
  if (!d?.status) return null;
  const t = d.status.reduce((a, b) => a + b, 0);
  if (!t) return null;
  const cols = ["var(--o1)", "var(--o2)", "var(--o3)", "var(--o4)", "var(--o5)"];
  const names = ["Mandiri", "Maju", "Berkembang", "Tertinggal", "Sangat tertinggal"];
  return (
    <div className="card px-3 py-2.5">
      <div className="mb-1.5 flex justify-between text-[12px]">
        <span className="font-medium text-ink-2">Status desa 2025</span>
        <span className="tnum text-muted">{nf(t, 0)} desa</span>
      </div>
      <div className="stackbar !h-2.5">
        {d.status.map((v, i) => (v > 0 ? <span key={i} title={`${names[i]}: ${nf(v, 0)}`} style={{ flex: `${v} 1 0`, background: cols[i] }} /> : null))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
        {d.status.map((v, i) => (
          <span key={i}>
            <i className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: cols[i] }} />
            {names[i]} {nf(v, 0)}
          </span>
        ))}
      </div>
    </div>
  );
}
