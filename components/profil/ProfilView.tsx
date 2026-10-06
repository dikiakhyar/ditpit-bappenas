"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { consumePending, goToRegion, notifyLocation, readKode, subscribeLocation } from "@/lib/profil/location";
import AppHeader, { CompactNav } from "@/components/app/AppHeader";
import DataSource from "@/components/app/DataSource";
import { Icon } from "@/components/ui/icons";
import { useProfil } from "@/lib/profil/useProfil";
import type { Engine } from "@/lib/profil/engine";
import { CARDS, SECTIONS, type CardDef } from "@/lib/profil/config";
import { nf } from "@/lib/profil/format";
import { onMap } from "@/lib/wilayah";
import { KAWASAN } from "@/lib/profil/kawasan";
import { TipProvider } from "./charts";
import { Tiles as TilesRaw } from "./Tiles";
import { ApbdCard, CommodCard, ComposeCard, DesaCard, IppCard, MetricCard, MultiCard, SektorCard, StackCard, WisataCard } from "./cards";

const LS_KEY = "pdit-sel";
const DEFAULT = "5300";

export default function ProfilView() {
  const { E, error } = useProfil();
  // Wilayah aktif dibaca LANGSUNG dari alamat browser (window.location), bukan dari
  // cache router Next.js — Next 16 menyimpan halaman yang pernah dibuka beserta URL
  // lamanya, sehingga pilihan bisa "mental" ke wilayah sebelumnya.
  useSearchParams(); // tetap berlangganan navigasi Next agar komponen digambar ulang
  const kode = useSyncExternalStore(subscribeLocation, readKode, () => null);
  // tujuan yang dicatat saat pindah dari halaman lain (mis. Peta) — jalan tiap kali halaman tampil
  useEffect(() => consumePending(), []);

  // ?kode valid → pakai; kalau tidak → pilihan terakhir (disimpan di browser) → default
  const sel = useMemo(() => {
    if (!E) return null;
    const ok = (c: string | null): c is string => !!c && c !== "0" && E.has(c);
    if (ok(kode)) return kode;
    let s: string | null = null;
    try {
      s = localStorage.getItem(LS_KEY);
    } catch {}
    return ok(s) ? s : DEFAULT;
  }, [E, kode]);

  useEffect(() => {
    if (!sel) return;
    // sedang berpindah ke halaman lain (mis. Peta) → jangan sentuh alamat
    if (window.location.pathname !== "/profil") return;
    // alamat berubah tanpa event (mis. navigasi Next) → baca ulang dulu
    if (readKode() !== kode) return notifyLocation();
    try {
      localStorage.setItem(LS_KEY, sel);
    } catch {}
    document.title = `${E?.name(sel)} · Profil Daerah - KASUARI Bappenas`;
    if (kode !== sel) window.history.replaceState(null, "", `/profil?kode=${sel}`);
  }, [sel, E, kode]);

  // Ganti wilayah = ubah alamat lewat History API: instan, tanpa permintaan ke server.
  const choose = useCallback((c: string, keepScroll = false) => {
    goToRegion(c, { keepScroll });
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      {error ? (
        <div className="mx-auto mt-10 max-w-lg px-4">
          <div className="card card-body text-[13px]">
            <p className="font-semibold">Data profil belum bisa dimuat.</p>
            <p className="mt-1 text-muted">
              Pastikan berkas <span className="font-mono">public/data/profil.json</span> tersedia. ({error})
            </p>
          </div>
        </div>
      ) : !E || !sel ? (
        <Skeleton />
      ) : (
        <TipProvider>
          <Profil E={E} sel={sel} choose={choose} />
        </TipProvider>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] animate-pulse px-4 py-6 sm:px-6" aria-busy="true" aria-label="Memuat profil">
      <div className="h-4 w-40 rounded bg-surface-3" />
      <div className="mt-3 h-8 w-72 rounded bg-surface-3" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card h-24" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card h-72" />
        <div className="card h-72" />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
type Choose = (c: string, keepScroll?: boolean) => void;

/** Pemilih provinsi + kab/kota (dipakai di kepala halaman & di bilah yang melekat saat menggulir). */
function RegionPicker({ E, sel, choose, compact }: { E: Engine; sel: string; choose: (c: string) => void; compact?: boolean }) {
  const isK = E.isKawasan(sel);
  const prov = E.provOf(sel);
  const selects = [
    <select key="p" aria-label="Provinsi" className={`form-select ${compact ? "min-w-0 flex-1 !py-1.5 text-[12.5px] sm:w-[200px] sm:flex-none" : "sm:w-[220px]"}`} value={prov} onChange={(e) => choose(e.target.value)}>
      {E.has(KAWASAN) && <option value={KAWASAN}>{E.name(KAWASAN)} (seluruh kawasan)</option>}
      {E.PROVS.map((c) => (
        <option key={c} value={c}>
          {E.name(c)}
        </option>
      ))}
    </select>,
    <select key="k" aria-label="Kabupaten / kota" className={`form-select ${compact ? "min-w-0 flex-1 !py-1.5 text-[12.5px] sm:w-[220px] sm:flex-none" : "sm:w-[240px]"}`} value={sel} disabled={isK} onChange={(e) => choose(e.target.value)}>
      <option value={prov}>{isK ? "— pilih provinsi dulu —" : "Seluruh provinsi"}</option>
      {E.kabsOf(prov).map((c) => (
        <option key={c} value={c}>
          {E.name(c)}
        </option>
      ))}
    </select>,
  ];
  if (compact) return <>{selects}</>;
  return (
    <>
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 sm:flex-none">
        <span className="subheader">Provinsi</span>
        {selects[0]}
      </label>
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 sm:flex-none">
        <span className="subheader">Kabupaten / kota</span>
        {selects[1]}
      </label>
    </>
  );
}

function Profil({ E, sel, choose }: { E: Engine; sel: string; choose: Choose }) {
  const isP = E.isProv(sel);
  const isK = E.isKawasan(sel);
  const prov = E.provOf(sel);
  const active = useScrollSpy(SECTIONS.map((s) => s.id), sel);

  // ── pemilih wilayah yang melekat: muncul setelah pemilih di kepala halaman tergulir keluar layar ──
  const pickerRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = pickerRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Ganti wilayah dari bilah melekat → tetap di bagian yang sedang dibaca: catat posisi bagian aktif
  // sebelum ganti, lalu kembalikan setelah isi wilayah baru tergambar (tinggi kartu bisa berbeda).
  const anchorRef = useRef<{ id: string; top: number } | null>(null);
  const chooseKeep = useCallback(
    (c: string) => {
      const el = document.getElementById(active);
      anchorRef.current = el ? { id: active, top: el.getBoundingClientRect().top } : null;
      choose(c, true);
    },
    [active, choose]
  );
  useLayoutEffect(() => {
    const a = anchorRef.current;
    anchorRef.current = null;
    if (!a) return;
    // Kartu wilayah baru masih berubah tinggi beberapa saat (grafik digambar ulang) dan browser ikut
    // mengoreksi scroll → koreksi berulang tiap frame sampai posisi stabil (maks ±1,5 dtk),
    // berhenti bila pengguna menggulir sendiri.
    let raf = 0;
    let stable = 0;
    const t0 = performance.now();
    const stop = () => cancelAnimationFrame(raf);
    const tick = () => {
      const el = document.getElementById(a.id);
      if (!el) return;
      const d = el.getBoundingClientRect().top - a.top;
      if (Math.abs(d) > 1) {
        window.scrollBy({ top: d });
        stable = 0;
      } else stable++;
      if (stable < 20 && performance.now() - t0 < 1500) raf = requestAnimationFrame(tick);
    };
    tick();
    const opts = { passive: true, once: true } as const;
    window.addEventListener("wheel", stop, opts);
    window.addEventListener("touchstart", stop, opts);
    window.addEventListener("keydown", stop, opts);
    return () => {
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [sel]);

  const lw = E.latestOf("Luas Wilayah", sel, "Luas Wilayah (km2)");
  const pl = E.latestOf("Luas Wilayah", sel, "Jumlah Pulau");
  const dz = E.desa(sel);
  const facts: [string, string, string][] = [];
  if (lw) facts.push(["Luas wilayah", nf(lw.v, 0), "km²"]);
  if (pl) facts.push(["Jumlah pulau", nf(pl.v, 0), ""]);
  if (dz?.status) facts.push(["Jumlah desa", nf(dz.status.reduce((a, b) => a + b, 0), 0), ""]);
  if (isK) {
    facts.push(["Provinsi", String(E.PROVS.length), ""]);
    facts.push(["Kabupaten/kota", String(E.allKabs().length), ""]);
  } else if (isP) facts.push(["Kabupaten/kota", String(E.kabsOf(sel).length), ""]);

  return (
    <>
      {/* ── page header (pola Tabler: pretitle + judul + aksi) ── */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-5 pt-4 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1 text-[12.5px] text-muted" aria-label="Breadcrumb">
            <span>Profil Daerah</span>
            <Icon name="chevronRight" className="h-3.5 w-3.5" />
            <button onClick={() => choose(KAWASAN)} className={isK ? "font-medium text-foreground" : "hover:text-primary hover:underline"}>
              {E.name(KAWASAN)}
            </button>
            {!isK && (
              <>
                <Icon name="chevronRight" className="h-3.5 w-3.5" />
                <button onClick={() => choose(prov)} className={isP ? "font-medium text-foreground" : "hover:text-primary hover:underline"}>
                  {E.name(prov)}
                </button>
              </>
            )}
            {!isP && (
              <>
                <Icon name="chevronRight" className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{E.name(sel)}</span>
              </>
            )}
          </nav>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{E.name(sel)}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                <span className="badge badge-blue font-mono">{sel}</span>
                {isK
                  ? `Gabungan ${E.PROVS.length} provinsi wilayah timur`
                  : isP
                    ? "Provinsi"
                    : `${E.name(sel).startsWith("Kota") ? "Kota" : "Kabupaten"} di Provinsi ${E.name(prov)}`}
              </p>
            </div>

            <div ref={pickerRef} className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <RegionPicker E={E} sel={sel} choose={choose} />
              {(onMap(sel) || isK) && (
                <Link href={`/?kode=${sel}`} className="btn">
                  <Icon name="map" className="h-4 w-4 text-primary" />
                  Lihat di peta
                </Link>
              )}
            </div>
          </div>

          {facts.length > 0 && (
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {facts.map(([a, b, u]) => (
                <div key={a}>
                  <dt className="subheader">{a}</dt>
                  <dd className="tnum text-[17px] font-semibold">
                    {b}
                    {u && <small className="ml-1 text-[12px] font-normal text-muted">{u}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* bilah navigasi + pemilih wilayah melayang di atas layar setelah pemilih di kepala halaman tergulir
          (fixed, bukan di dalam alur halaman → isi tidak "meloncat" saat bilah muncul) */}
      <div
        className={`fixed inset-x-0 top-0 z-30 h-[52px] border-b border-border bg-surface/95 shadow-sm backdrop-blur transition-transform duration-200 ${stuck ? "translate-y-0" : "-translate-y-full"}`}
        aria-hidden={!stuck}
        inert={!stuck}
      >
        <div className="mx-auto flex h-full max-w-[1320px] items-center gap-2 px-4 sm:px-6">
          {/* merek + pindah halaman tetap terjangkau tanpa menggulir ke atas */}
          <CompactNav />
          <span className="hidden h-6 w-px shrink-0 bg-border md:block" aria-hidden />
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="truncate text-[14px] font-semibold leading-tight">{E.name(sel)}</p>
            <p className="truncate text-[11px] text-muted">{isK ? `Gabungan ${E.PROVS.length} provinsi` : isP ? "Provinsi" : `Provinsi ${E.name(prov)}`}</p>
          </div>
          <RegionPicker E={E} sel={sel} choose={chooseKeep} compact />
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="btn shrink-0 !px-2" title="Kembali ke atas" aria-label="Kembali ke atas">
            <Icon name="arrowUp" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* navigasi bagian — horizontal untuk layar < xl (menempel di bawah bilah pemilih) */}
      <div className={`sticky z-20 border-b border-border bg-surface/95 backdrop-blur transition-[top] duration-200 xl:hidden ${stuck ? "top-[52px]" : "top-0"}`}>
        <div className="no-scrollbar mx-auto flex max-w-[1320px] gap-1 overflow-x-auto px-4 sm:px-6">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`relative whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium ${active === s.id ? "text-primary" : "text-ink-2 hover:text-foreground"}`}
            >
              {s.title}
              {active === s.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-primary" />}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 sm:px-6">
        {isK && (
          <div className="mb-4 flex gap-2.5 rounded-lg border border-border bg-primary-lt px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              <b className="text-foreground">Angka Indonesia Timur adalah agregat {E.PROVS.length} provinsi.</b> Besaran (rupiah, jiwa, unit, luas) dijumlahkan;
              PDRB per kapita = total PDRB ÷ total penduduk; laju pertumbuhan ditimbang PDRB; persentase miskin dari total penduduk miskin; persen/indeks
              lain = rata-rata tertimbang jumlah penduduk. Bila ada provinsi yang datanya kosong, nilai kawasan ditulis <i>Tidak ada data</i> (tidak dijumlah
              sebagian). Tampilan <b>Peringkat</b> di tiap kartu membandingkan seluruh provinsi.
            </p>
          </div>
        )}
        <Tiles E={E} sel={sel} />

        <div className="mt-6 flex gap-6">
          {/* daftar isi melekat (xl+) */}
          <aside className="hidden w-52 shrink-0 xl:block">
            <nav className={`sticky transition-[top] ${stuck ? "top-[72px]" : "top-5"}`} aria-label="Bagian profil">
              <p className="subheader mb-2 px-2.5">Isi profil</p>
              <ul className="flex flex-col gap-0.5">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                        active === s.id ? "bg-primary-lt text-primary" : "text-ink-2 hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      <Icon name={s.icon} className="h-4 w-4 shrink-0" />
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            {SECTIONS.map((sec, si) => (
              <section
                key={sec.id}
                id={sec.id}
                className="scroll-mt-28 pb-8 xl:scroll-mt-20"
                // bagian di luar layar tidak digambar browser sampai mendekati layar (lebih ringan)
                style={si > 1 ? { contentVisibility: "auto", containIntrinsicSize: "auto 1200px" } : undefined}
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-lt text-primary">
                    <Icon name={sec.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h2 className="text-[18px] font-semibold leading-tight">{sec.title}</h2>
                    <p className="mt-0.5 max-w-[75ch] text-[13px] text-muted">{sec.desc}</p>
                  </div>
                </div>
                <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,350px),1fr))]">
                  <p className="card card-body col-span-full hidden text-[13px] text-muted only:block">
                    Belum ada data untuk wilayah ini di bagian ini.
                  </p>
                  {CARDS.map((cd, i) => (cd.sec === sec.id ? <CardSwitch key={`${sel}-${i}`} E={E} cd={cd} sel={sel} /> : null))}
                </div>
              </section>
            ))}

            <footer className="card card-body text-[12.5px] leading-relaxed text-ink-2">
              <div className="mb-3">
                <DataSource />
              </div>
              <p className="font-semibold text-foreground">Tentang data</p>
              <p className="mt-1">
                Semua angka dibaca langsung dari Google Spreadsheet Database PIT (sheet per indikator; sumber utama BPS Simdasi dan instansi terkait seperti tertera di
                tiap kartu). Cakupan: {E.coverage.provinsi} provinsi · {E.coverage.kabkota} kabupaten/kota · {E.coverage.tabel} tabel indikator. Jika data
                kab/kota tidak tersedia, kartu menampilkan angka provinsi dan diberi keterangan.
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                <li>Rasio APBD dihitung ulang dari sheet Postur APBD agar provinsi dan kab/kota dapat dibandingkan dengan cara yang sama.</li>
                <li>Indeks Desa diagregasi dari data per desa: jumlah desa per status dan rata-rata skor per dimensi.</li>
                <li>Sheet IDSD tidak ditampilkan karena identik dengan Indeks Integritas; Rasio Tenaga Kesehatan dan Rasio STR tidak ditampilkan karena satuannya belum jelas.</li>
                <li>
                  Peringkat dihitung pada periode yang sama: kab/kota terhadap kab/kota lain di provinsinya dan terhadap seluruh kab/kota di database
                  (se-Indonesia Timur — bukan se-Indonesia, karena database hanya memuat kawasan timur); provinsi terhadap seluruh provinsi.
                </li>
                <li>
                  Lapangan usaha PDRB disusun sektor (A–U) → sub-sektor → rincian. Nilai sektor diambil dari baris sektornya di spreadsheet, tidak dijumlah
                  dari sub-sektor; rincian sub-sektor hanya tersedia di tingkat provinsi.
                </li>
                <li>
                  Indonesia Timur = agregat seluruh provinsi: besaran dijumlahkan, rasio/indeks ditimbang jumlah penduduk (dihitung dari PDRB ÷ PDRB per kapita),
                  pertumbuhan ditimbang PDRB. Sel kosong di spreadsheet ditampilkan sebagai <i>Tidak ada data</i>, bukan 0.
                </li>
              </ul>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}

// memo: kartu hanya dihitung ulang bila data/wilayahnya berubah — bukan tiap kali bagian aktif di
// daftar isi berganti atau bilah atas muncul/hilang saat menggulir
const Tiles = memo(TilesRaw);
const CardSwitch = memo(function CardSwitch({ E, cd, sel }: { E: Engine; cd: CardDef; sel: string }) {
  switch (cd.t) {
    case "metric":
      return <MetricCard E={E} cd={cd} sel={sel} />;
    case "compose":
      return <ComposeCard E={E} cd={cd} sel={sel} />;
    case "multi":
      return <MultiCard E={E} cd={cd} sel={sel} />;
    case "stack":
      return <StackCard E={E} cd={cd} sel={sel} />;
    case "apbd":
      return <ApbdCard E={E} sel={sel} />;
    case "desa":
      return <DesaCard E={E} sel={sel} />;
    case "ipp":
      return <IppCard E={E} sel={sel} />;
    case "commod":
      return <CommodCard E={E} sel={sel} />;
    case "wisata":
      return <WisataCard E={E} sel={sel} />;
    case "sektor":
      return <SektorCard E={E} sel={sel} />;
  }
});

function useScrollSpy(ids: string[], dep: string) {
  const [active, setActive] = useState(ids[0]);
  const key = useMemo(() => ids.join(","), [ids]);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" }
    );
    key.split(",").forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [key, dep]);
  return active;
}

