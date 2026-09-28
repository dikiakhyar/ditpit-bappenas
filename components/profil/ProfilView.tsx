"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/app/AppHeader";
import DataSource from "@/components/app/DataSource";
import { Icon } from "@/components/ui/icons";
import { useProfil } from "@/lib/profil/useProfil";
import type { Engine } from "@/lib/profil/engine";
import { CARDS, SECTIONS, type CardDef } from "@/lib/profil/config";
import { nf } from "@/lib/profil/format";
import { onMap } from "@/lib/wilayah";
import { TipProvider } from "./charts";
import { Tiles } from "./Tiles";
import { ApbdCard, CommodCard, ComposeCard, DesaCard, IppCard, MetricCard, MultiCard, StackCard, WisataCard } from "./cards";

const LS_KEY = "pdit-sel";
const DEFAULT = "5300";

export default function ProfilView() {
  const { E, error } = useProfil();
  const params = useSearchParams();
  const router = useRouter();
  const kode = params.get("kode");

  // kode dari URL bila valid; kalau tidak, pakai pilihan terakhir / default
  const sel = E && kode && kode !== "0" && E.has(kode) ? kode : null;
  useEffect(() => {
    if (!E || sel) return;
    let s: string | null = null;
    try {
      s = localStorage.getItem(LS_KEY);
    } catch {}
    router.replace(`/profil?kode=${s && E.has(s) && s !== "0" ? s : DEFAULT}`, { scroll: false });
  }, [E, sel, router]);
  useEffect(() => {
    if (!sel) return;
    try {
      localStorage.setItem(LS_KEY, sel);
    } catch {}
    document.title = `${E?.name(sel)} · Profil Daerah — DITPIT Bappenas`;
  }, [sel, E]);

  const choose = (c: string) => router.push(`/profil?kode=${c}`, { scroll: false });

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
function Profil({ E, sel, choose }: { E: Engine; sel: string; choose: (c: string) => void }) {
  const isP = E.isProv(sel);
  const prov = E.provOf(sel);
  const active = useScrollSpy(SECTIONS.map((s) => s.id), sel);

  const lw = E.latestOf("Luas Wilayah", sel, "Luas Wilayah (km2)");
  const pl = E.latestOf("Luas Wilayah", sel, "Jumlah Pulau");
  const dz = E.desa(sel);
  const facts: [string, string, string][] = [];
  if (lw) facts.push(["Luas wilayah", nf(lw.v, 0), "km²"]);
  if (pl) facts.push(["Jumlah pulau", nf(pl.v, 0), ""]);
  if (dz?.status) facts.push(["Jumlah desa", nf(dz.status.reduce((a, b) => a + b, 0), 0), ""]);
  if (isP) facts.push(["Kabupaten/kota", String(E.kabsOf(sel).length), ""]);

  return (
    <>
      {/* ── page header (pola Tabler: pretitle + judul + aksi) ── */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-5 pt-4 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1 text-[12.5px] text-muted" aria-label="Breadcrumb">
            <span>Profil Daerah</span>
            <Icon name="chevronRight" className="h-3.5 w-3.5" />
            <button onClick={() => choose(prov)} className={isP ? "font-medium text-foreground" : "hover:text-primary hover:underline"}>
              {E.name(prov)}
            </button>
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
                {isP ? "Provinsi" : `${E.name(sel).startsWith("Kota") ? "Kota" : "Kabupaten"} di Provinsi ${E.name(prov)}`}
              </p>
            </div>

            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <label className="flex min-w-[180px] flex-1 flex-col gap-1 sm:flex-none">
                <span className="subheader">Provinsi</span>
                <select className="form-select sm:w-[220px]" value={prov} onChange={(e) => choose(e.target.value)}>
                  {E.PROVS.map((c) => (
                    <option key={c} value={c}>
                      {E.name(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[180px] flex-1 flex-col gap-1 sm:flex-none">
                <span className="subheader">Kabupaten / kota</span>
                <select className="form-select sm:w-[240px]" value={sel} onChange={(e) => choose(e.target.value)}>
                  <option value={prov}>Seluruh provinsi</option>
                  {E.kabsOf(prov).map((c) => (
                    <option key={c} value={c}>
                      {E.name(c)}
                    </option>
                  ))}
                </select>
              </label>
              {onMap(sel) && (
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

      {/* navigasi bagian — horizontal untuk layar < xl */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur xl:hidden">
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
        <Tiles E={E} sel={sel} />

        <div className="mt-6 flex gap-6">
          {/* daftar isi melekat (xl+) */}
          <aside className="hidden w-52 shrink-0 xl:block">
            <nav className="sticky top-5" aria-label="Bagian profil">
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
            {SECTIONS.map((sec) => (
              <section key={sec.id} id={sec.id} className="scroll-mt-14 pb-8 xl:scroll-mt-5">
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
                <li>Peringkat dihitung terhadap kab/kota lain di provinsi yang sama, atau terhadap seluruh provinsi untuk tampilan provinsi, pada periode yang sama.</li>
              </ul>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}

function CardSwitch({ E, cd, sel }: { E: Engine; cd: CardDef; sel: string }) {
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
  }
}

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

