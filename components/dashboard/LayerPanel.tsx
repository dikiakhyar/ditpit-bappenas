"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Icon } from "@/components/ui/icons";
import { MAP_BOUNDS } from "@/lib/peta-wilayah";
import { overviewPadding } from "@/lib/basemap";
import { MAP_PROV_CODES, isKawasan, isProvCode, namaWilayah, provOfCode } from "@/lib/wilayah";
import { kpLayerId } from "@/lib/layers";
import { KATEGORI, entriesIn, katOf, type KatId, type KawasanEntry } from "@/lib/kawasan-prioritas";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
    >
      <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

/** Bulatan kategori (sama dengan simbol di peta). `text` default = huruf kategori. */
export function KatDot({ kat, text, size = 20 }: { kat: KatId; text?: string; size?: number }) {
  const k = katOf(kat)!;
  const label = text ?? kat;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-[#1f2937]"
      style={{
        background: k.fill,
        border: `1.5px solid ${k.stroke}`,
        minWidth: size,
        height: size,
        padding: label.length > 1 ? "0 4px" : 0,
        fontSize: label.length > 2 ? size * 0.42 : size * 0.5,
      }}
      aria-hidden
    >
      {label}
    </span>
  );
}

const time = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function LayerPanel() {
  const { layerState, toggleLayer, setGroupVisible, selectedKode, setSelectedKode, mapInstance, kawasan, kawasanStatus } = useDashboard();
  const scope = selectedKode && !isKawasan(selectedKode) ? selectedKode : null;
  const provSel = scope ? provOfCode(scope) : "";
  const kabSel = scope && !isProvCode(scope) ? scope : null;
  const provList = useMemo(() => [...MAP_PROV_CODES].sort((a, b) => namaWilayah(a).localeCompare(namaWilayah(b), "id")), []);

  const entries = useMemo(() => kawasan?.entries ?? [], [kawasan]);
  const inScope = useMemo(() => entriesIn(entries, scope), [entries, scope]);
  const countBy = (list: KawasanEntry[], k: KatId) => list.filter((e) => e.kat === k).length;

  const kpOn = KATEGORI.filter((k) => layerState[kpLayerId(k.id)]?.visible).length;
  const allOn = kpOn === KATEGORI.length;

  const focus = (v: string) => {
    setSelectedKode(v || null);
    if (!v) mapInstance?.fitBounds(MAP_BOUNDS, { padding: overviewPadding(mapInstance.getContainer()), duration: 900 });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* fokus provinsi: memperbesar peta ke provinsi terpilih */}
      <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
        <Icon name="mappin" className="h-4 w-4 shrink-0 text-primary" />
        <span className="shrink-0 text-muted">Fokus</span>
        <select value={provSel} onChange={(e) => focus(e.target.value)} className="min-w-0 flex-1 bg-transparent text-right font-medium text-foreground outline-none">
          <option value="">Seluruh wilayah ({MAP_PROV_CODES.length} provinsi)</option>
          {provList.map((p) => (
            <option key={p} value={p}>
              {namaWilayah(p)}
            </option>
          ))}
        </select>
      </label>

      {/* ── layer: kategori kawasan prioritas ── */}
      <section className="flex flex-col gap-1.5">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Kawasan Prioritas</h3>
            <p className="text-[11px] leading-snug text-muted">RPJMN 2025–2029 · bulatan menandai kab/kota lokasi kawasan</p>
          </div>
          <button onClick={() => setGroupVisible("kawasan", !allOn)} className="shrink-0 pt-0.5 text-[11px] font-medium text-primary hover:underline">
            {allOn ? "Sembunyikan" : "Tampilkan"} semua
          </button>
        </header>

        <ul className="flex flex-col gap-0.5">
          {KATEGORI.map((k) => {
            const on = !!layerState[kpLayerId(k.id)]?.visible;
            const n = countBy(inScope, k.id);
            return (
              <li key={k.id} className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-surface-2">
                <KatDot kat={k.id} />
                <span className={`flex-1 text-[12.5px] leading-snug ${n ? "" : "text-muted"}`}>{k.nama}</span>
                <span className="w-6 text-right font-mono text-[11px] text-muted" title={`${n} lokasi`}>{n}</span>
                <Switch checked={on} onChange={() => toggleLayer(kpLayerId(k.id))} label={`Tampilkan ${k.nama}`} />
              </li>
            );
          })}
        </ul>
        {kawasanStatus === "loading" && <p className="text-[11px] text-muted">Memuat daftar kawasan…</p>}
        {kawasanStatus === "error" && <p className="rounded-md border border-bad/30 bg-bad-lt px-3 py-2 text-[11.5px] text-bad">Daftar kawasan belum dapat dimuat.</p>}
      </section>

      {/* ── daftar kawasan ── */}
      {kawasan &&
        (provSel ? (
          <DaftarProvinsi prov={provSel} kab={kabSel} entries={inScope} onPick={(k) => setSelectedKode(k)} />
        ) : (
          <RingkasanProvinsi entries={entries} provList={provList} onPick={focus} />
        ))}

      {kawasan && <SumberKawasan />}
    </div>
  );
}

/** Tanpa fokus: jumlah lokasi per provinsi × kategori; klik → fokus ke provinsi. */
function RingkasanProvinsi({ entries, provList, onPick }: { entries: KawasanEntry[]; provList: string[]; onPick: (p: string) => void }) {
  return (
    <section className="rounded-lg border border-border">
      <div className="border-b border-border px-3 py-2">
        <h4 className="text-[12.5px] font-medium">Daftar kawasan per provinsi</h4>
        <p className="text-[11px] text-muted">Klik provinsi untuk melihat rincian lokasinya.</p>
      </div>
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-muted">
            <th className="px-3 py-1.5 text-left font-medium">Provinsi</th>
            {KATEGORI.map((k) => (
              <th key={k.id} className="w-7 py-1.5 text-center font-medium">
                <KatDot kat={k.id} size={16} />
              </th>
            ))}
            <th className="w-9 px-2 py-1.5 text-right font-medium">Σ</th>
          </tr>
        </thead>
        <tbody>
          {provList.map((p) => {
            const list = entries.filter((e) => e.prov === p);
            return (
              <tr key={p} onClick={() => onPick(p)} className="cursor-pointer border-t border-border hover:bg-surface-2">
                <td className="truncate px-3 py-1.5">{namaWilayah(p)}</td>
                {KATEGORI.map((k) => {
                  const n = list.filter((e) => e.kat === k.id).length;
                  return (
                    <td key={k.id} className={`text-center font-mono ${n ? "text-foreground" : "text-muted/50"}`}>
                      {n || "–"}
                    </td>
                  );
                })}
                <td className="px-2 text-right font-mono font-medium">{list.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** Rincian satu provinsi (atau satu kab/kota): kategori → kelompok → lokasi bernomor seperti di peta PPT. */
function DaftarProvinsi({ prov, kab, entries, onPick }: { prov: string; kab: string | null; entries: KawasanEntry[]; onPick: (kode: string) => void }) {
  const [closed, setClosed] = useState<Set<KatId>>(new Set());
  const toggle = (k: KatId) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="min-w-0 truncate text-[12.5px] font-medium">
          {kab ? namaWilayah(kab) : `Kawasan di ${namaWilayah(prov)}`}
          <span className="ml-1.5 font-mono text-[11px] font-normal text-muted">{entries.length} lokasi</span>
        </h4>
        {kab && (
          <button onClick={() => onPick(prov)} className="shrink-0 text-[11px] font-medium text-primary hover:underline">
            Seluruh provinsi
          </button>
        )}
      </div>

      {entries.length === 0 && <p className="text-[11.5px] text-muted">Tidak ada kawasan prioritas tercatat untuk wilayah ini.</p>}

      {KATEGORI.map((k) => {
        const list = entries.filter((e) => e.kat === k.id);
        if (!list.length) return null;
        // kelompokkan per nama kawasan, urutan sesuai spreadsheet
        const groups: { name: string; items: KawasanEntry[] }[] = [];
        for (const e of list) {
          const name = e.kelompok || (k.id === "C" ? "Potensi swasembada" : "Lainnya");
          const g = groups.find((x) => x.name === name);
          if (g) g.items.push(e);
          else groups.push({ name, items: [e] });
        }
        const open = !closed.has(k.id);
        return (
          <div key={k.id} className="overflow-hidden rounded-lg border border-border">
            <button onClick={() => toggle(k.id)} aria-expanded={open} className="flex w-full items-center gap-2 px-2.5 py-2 text-left" style={{ background: `${k.fill}55` }}>
              <KatDot kat={k.id} size={18} />
              <span className="flex-1 text-[12px] font-semibold leading-snug">{k.nama}</span>
              <span className="font-mono text-[11px] text-muted">{list.length}</span>
              <Icon name="chevron" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="flex flex-col gap-2 px-2.5 py-2">
                {groups.map((g) => (
                  <div key={g.name}>
                    <p className="mb-0.5 text-[11.5px] font-semibold leading-snug text-foreground/85">{g.name}</p>
                    <ul className="flex flex-col">
                      {g.items.map((e) => (
                        <EntryRow key={`${e.no}-${e.kode}`} e={e} onPick={onPick} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function EntryRow({ e, onPick }: { e: KawasanEntry; onPick: (kode: string) => void }) {
  const title = e.lokasi || e.sub || "";
  const target = e.kab[0] ?? e.prov;
  const kabLine = e.kab.length ? e.kab.map(namaWilayah).join(", ") : e.kabText;
  return (
    <li>
      <button
        onClick={() => onPick(target)}
        title={e.provLevel ? "Lingkup provinsi" : "Tampilkan di peta"}
        className="flex w-full items-start gap-2 rounded px-1 py-1 text-left hover:bg-surface-2"
      >
        <KatDot kat={e.kat} text={e.kode} size={18} />
        <span className="min-w-0 flex-1 text-[11.5px] leading-snug">
          {title ? (
            <>
              <span className="block">{title}</span>
              <span className="block text-[10.5px] text-muted">{kabLine}</span>
            </>
          ) : (
            <span className="block">{kabLine}</span>
          )}
          {e.ket && <span className="block text-[10.5px] italic text-muted">{e.ket}</span>}
        </span>
      </button>
    </li>
  );
}

function SumberKawasan() {
  const { kawasan } = useDashboard();
  if (!kawasan) return null;
  const src = kawasan.source;
  const live = src.kind === "spreadsheet";
  return (
    <div className={`rounded-md border px-3 py-2 text-[11px] leading-snug ${live ? "border-border bg-surface-2 text-ink-2" : "border-warn/30 bg-warn-lt text-warn"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${live ? "bg-good" : "bg-warn"}`} />
        <span className="font-medium">{live ? "Daftar kawasan: Google Spreadsheet" : "Daftar kawasan: salinan lokal"}</span>
        {live && <span className="text-muted">· dibaca {time(src.fetchedAt)}</span>}
      </div>
      <a href={src.sheetUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline">
        Buka spreadsheet <Icon name="arrowRight" className="h-3 w-3" />
      </a>
      {kawasan.unmatched.length > 0 && (
        <p className="mt-1 text-muted" title={kawasan.unmatched.join("\n")}>
          {kawasan.unmatched.length} nama kab/kota tidak dikenali — periksa ejaan di spreadsheet.
        </p>
      )}
    </div>
  );
}

