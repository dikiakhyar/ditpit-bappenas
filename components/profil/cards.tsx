"use client";

import { useState, type ReactNode } from "react";
import type { Better, Engine, Latest } from "@/lib/profil/engine";
import type { ComposeDef, MetricDef, MultiDef, StackDef } from "@/lib/profil/config";
import { fmt, idx2, isN, lastIdx, nf, pct1, short, type Cell, type Fmt } from "@/lib/profil/format";
import { BarsChart, Legend, LineChart, RankChart, Sparkline, StackBars, TipRow, useTip, type LegendItem, type LineSeries, type StackRow } from "./charts";

// ─────────────────────────────── kerangka kartu ───────────────────────────────
export function Card({
  title,
  desc,
  actions,
  children,
  src,
  wide,
}: {
  title: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  src?: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`card flex flex-col ${wide ? "col-span-full" : ""}`}>
      <header className="card-header">
        <div className="min-w-0 flex-[1_1_220px]">
          <h3 className="card-title">{title}</h3>
          {desc && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{desc}</p>}
        </div>
        {actions}
      </header>
      <div className="card-body flex flex-1 flex-col gap-3">{children}</div>
      {src && <footer className="card-footer">{src}</footer>}
    </article>
  );
}

function Src({ E, sheet, agg }: { E: Engine; sheet: string; agg?: boolean }) {
  const m = E.meta(sheet);
  return (
    <>
      Sumber: {m.s || "Database PIT"} · {agg ? "agregasi dari " : ""}sheet <span className="font-mono">{sheet}</span>
    </>
  );
}

export function FbNote({ E, code }: { E: Engine; code: string }) {
  return (
    <span className="badge badge-gold self-start font-medium">
      Data kab/kota belum tersedia · menampilkan {E.name(code)}
    </span>
  );
}

export function Delta({ L, f, b, g, compact }: { L: Latest | null; f: Fmt; b: Better; g?: boolean; compact?: boolean }) {
  if (!L || !isN(L.pv)) return null;
  let d: number, txt: string;
  if (g) {
    if (!L.pv) return null;
    d = ((L.v - L.pv) / Math.abs(L.pv)) * 100;
    txt = nf(Math.abs(d), 1) + " %";
  } else {
    d = (L.v - L.pv) * (f.k ?? 1);
    const dd = f.d == null ? 1 : f.d;
    txt = nf(Math.abs(d), dd) + (f.du != null ? f.du : f.suf && f.suf.trim() === "%" ? " poin" : "");
    if (+nf(Math.abs(d), dd).replace(/\./g, "").replace(",", ".") === 0) d = 0;
  }
  const cls = d === 0 || !b ? "flat" : (d > 0) === (b === "up") ? "good" : "bad";
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "■";
  const word = !b || d === 0 ? "" : cls === "good" ? " (membaik)" : " (memburuk)";
  return (
    <span className={`badge badge-${cls}`} title={`Dibanding ${L.pper}${word}`}>
      {arrow} {txt}
      {!compact && <span className="font-normal opacity-80">vs {L.pper}</span>}
    </span>
  );
}

const Big = ({ v, per, delta }: { v: string; per: string; delta?: ReactNode }) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <span className="tnum text-[26px] font-bold leading-tight tracking-tight">{v}</span>
    <span className="font-mono text-[12px] text-muted">{per}</span>
    {delta}
  </div>
);
const Cap = ({ children }: { children: ReactNode }) => <p className="text-[12.5px] text-ink-2">{children}</p>;

// ─────────────────────────────── metrik (tren/peringkat/tabel) ───────────────────────────────
type View = "tren" | "rank" | "tabel";

export function MetricCard({ E, cd, sel }: { E: Engine; cd: MetricDef; sel: string }) {
  const pk = E.pickCode(cd.s, cd.i, sel, cd.pf);
  const code = pk?.code ?? sel;
  const L = pk ? E.latestOf(cd.s, code, cd.i, cd.pf) : null;
  const m = pk ? E.pmask(cd.s, cd.pf) : [];
  const nPts = pk ? (E.ser(cd.s, code, cd.i) || []).filter((v, k) => isN(v) && m[k]).length : 0;
  const rk = L ? E.rankInfo(cd.s, cd.i, code, L.per, cd.b) : null;
  const initial: View = nPts >= 2 ? "tren" : rk ? "rank" : "tabel";
  const [tab, setTab] = useState<View>(initial);
  if (!pk || !L) return null;
  const view: View = tab === "tren" && nPts < 2 ? (rk ? "rank" : "tabel") : tab === "rank" && !rk ? (nPts >= 2 ? "tren" : "tabel") : tab;

  const prov = E.provOf(code);
  const isP = E.isProv(code);
  const cmpParts: string[] = [];
  if (!cd.nocmp && !isP) {
    const pv = E.valAt(cd.s, prov, cd.i, L.per);
    if (isN(pv)) cmpParts.push(`Provinsi ${fmt(pv, cd.f)}`);
  }
  const nv = cd.nocmp ? null : E.valAt(cd.s, "0", cd.i, L.per);
  if (isN(nv)) cmpParts.push(`Nasional ${fmt(nv, cd.f)}`);

  let chips: ReactNode = null;
  if (cd.cat) {
    const a = E.ser(cd.s, code, cd.cat), bb = E.ser(cd.s, code, cd.i);
    const P = E.sheet(cd.s)!.p;
    if (a)
      chips = (
        <div className="flex flex-wrap gap-1.5">
          {P.map((p, k) =>
            a[k] ? (
              <span key={p} className="flex flex-col items-center rounded-md border border-border bg-surface-2 px-2.5 py-1">
                <b className="text-[13px]">{String(a[k])}</b>
                <span className="font-mono text-[10.5px] text-muted">
                  {p}
                  {isN(bb?.[k]) ? " · " + fmt(bb![k], cd.f) : ""}
                </span>
              </span>
            ) : null
          )}
        </div>
      );
  }

  // isi grafik
  let legend: ReactNode = null, body: ReactNode;
  if (view === "tren") {
    const P = E.sheet(cd.s)!.p;
    const main = E.ser(cd.s, code, cd.i)!;
    const first = main.findIndex((v, k) => isN(v) && m[k]);
    const last = lastIdx(main, (v, k) => isN(v) && m[k]);
    const ids: number[] = [];
    for (let k = first; k <= last; k++) if (m[k]) ids.push(k);
    const series: LineSeries[] = [{ name: E.name(code), vals: ids.map((k) => main[k]), color: "var(--s1)", main: true }];
    if (!cd.lvl && !cd.nocmp && !isP) {
      const p = E.ser(cd.s, prov, cd.i);
      if (p && ids.some((k) => isN(p[k]))) series.push({ name: E.name(prov), vals: ids.map((k) => p[k]), color: "var(--s2)" });
    }
    const n0 = cd.lvl || cd.nocmp ? null : E.ser(cd.s, "0", cd.i);
    if (n0 && ids.some((k) => isN(n0[k]))) series.push({ name: "Indonesia", vals: ids.map((k) => n0[k]), color: "var(--natl)", dash: true });
    if (series.length > 1) legend = <Legend items={series.map<LegendItem>((s) => ({ name: s.name, color: s.color, kind: s.dash ? "dash" : "line" }))} />;
    body = <LineChart labels={ids.map((k) => P[k])} series={series} f={cd.f} zero={cd.zero} aria={cd.title} />;
  } else if (view === "rank") {
    const rows = rk!.rows.map((r) => ({ c: r.c, name: short(E.name(r.c)), v: r.v, sel: r.c === code })).sort((a, b) => b.v - a.v);
    let refLine: { name: string; v: number } | null = null;
    if (!cd.lvl && !cd.nocmp) {
      if (!isP) {
        const pv = E.valAt(cd.s, prov, cd.i, L.per);
        if (isN(pv)) refLine = { name: "Provinsi", v: pv };
      } else {
        const nv2 = E.valAt(cd.s, "0", cd.i, L.per);
        if (isN(nv2)) refLine = { name: "Nasional", v: nv2 };
      }
    }
    legend = <Legend items={[]} lead={<span className="font-mono text-muted">{L.per}</span>} />;
    body = <RankChart rows={rows} refLine={refLine} f={cd.f} aria={cd.title} />;
  } else {
    const P = E.sheet(cd.s)!.p;
    const cols = [code];
    if (!isP) cols.push(prov);
    if (E.ser(cd.s, "0", cd.i)) cols.push("0");
    body = (
      <div className="max-h-[260px] overflow-auto rounded-md border border-border">
        <table className="tv">
          <thead>
            <tr>
              <th>Periode</th>
              {cols.map((c) => (
                <th key={c}>{short(E.name(c))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {P.map((p, k) => {
              if (!m[k]) return null;
              const vs = cols.map((c) => (E.ser(cd.s, c, cd.i) || [])[k]);
              if (!vs.some(isN)) return null;
              return (
                <tr key={p}>
                  <td className="font-mono">{p}</td>
                  {vs.map((v, j) => (
                    <td key={j}>{fmt(v, cd.f)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const actions = (
    <div className="seg" role="group" aria-label="Tampilan">
      {(
        [
          ["tren", "Tren", nPts < 2],
          ["rank", "Peringkat", !rk],
          ["tabel", "Tabel", false],
        ] as const
      ).map(([id, label, dis]) => (
        <button key={id} type="button" aria-pressed={view === id} disabled={dis} onClick={() => setTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Card title={cd.title} desc={cd.d} actions={actions} src={<Src E={E} sheet={cd.s} />} wide={cd.wide}>
      {pk.fb && <FbNote E={E} code={code} />}
      <Big v={fmt(L.v, cd.f)} per={L.per} delta={<Delta L={L} f={cd.f} b={cd.b} g={cd.g} />} />
      {chips}
      {cmpParts.length > 0 && <Cap>{cmpParts.join(" · ")}</Cap>}
      {cd.extra?.(E, code)}
      {legend}
      {body}
      {rk && (
        <Cap>
          Peringkat <b className="text-foreground">{rk.rank}</b> dari {rk.n} {E.peerWord(code)}{" "}
          <span className="text-muted">({cd.b === "down" ? "1 = terendah" : cd.b === "up" ? "1 = tertinggi" : "1 = terbesar"})</span>
        </Cap>
      )}
    </Card>
  );
}

// ─────────────────────────────── komposisi ───────────────────────────────
export function ComposeCard({ E, cd, sel }: { E: Engine; cd: ComposeDef; sel: string }) {
  let code = sel, fb = false;
  let cr = E.composeRows(cd.s, code, cd);
  if (!cr && !E.isProv(sel)) {
    code = E.provOf(sel);
    fb = true;
    cr = E.composeRows(cd.s, code, cd);
  }
  if (!cr) return null;
  let list = cr.list;
  if (!cd.order || cd.sort) list = list.slice().sort((a, b) => b.v - a.v);
  if (cd.top && list.length > cd.top) list = list.slice(0, cd.top);
  const cmpCode = !E.isProv(code) && !cd.nocmp ? E.provOf(code) : null;
  const rows = list.map((r) => ({ label: cd.lab ? cd.lab(r.k) : r.k, v: r.v, cmp: cmpCode ? E.valAt(cd.s, cmpCode, r.k, cr!.per) : null }));
  const hasCmp = rows.some((r) => isN(r.cmp));
  const items: LegendItem[] = [{ name: short(E.name(code)), color: "var(--s1)", kind: "sq" }];
  if (hasCmp) items.push({ name: E.name(cmpCode!), color: "var(--s2)", kind: "tick" });
  return (
    <Card title={cd.title} desc={cd.d} src={<Src E={E} sheet={cd.s} />} wide={cd.wide}>
      {fb && <FbNote E={E} code={code} />}
      {cd.extra?.(E, code)}
      <Legend items={items} lead={<span className="font-mono text-muted">{cr.per}</span>} />
      <BarsChart rows={rows} f={cd.f} per={cr.per} selName={E.name(code)} cmpName={hasCmp ? E.name(cmpCode!) : ""} aria={cd.title} />
    </Card>
  );
}

export function MultiCard({ E, cd, sel }: { E: Engine; cd: MultiDef; sel: string }) {
  const get = (c: string) =>
    cd.srcs.map(([s, i, l]) => {
      const L = E.latestOf(s, c, i);
      return { label: l, v: L ? L.v : null, per: L ? L.per : null };
    });
  let code = sel, fb = false, rows = get(code);
  if (!rows.some((r) => isN(r.v)) && !E.isProv(sel)) {
    code = E.provOf(sel);
    fb = true;
    rows = get(code);
  }
  if (!rows.some((r) => isN(r.v))) return null;
  const per = rows.find((r) => r.per)!.per!;
  return (
    <Card title={cd.title} desc={cd.d} src={<Src E={E} sheet={cd.srcs[0][0]} />}>
      {fb && <FbNote E={E} code={code} />}
      <Legend items={[{ name: E.name(code), color: "var(--s1)", kind: "sq" }]} lead={<span className="font-mono text-muted">{per}</span>} />
      <BarsChart rows={rows} f={cd.f} per={per} selName={E.name(code)} aria={cd.title} />
    </Card>
  );
}

export function StackCard({ E, cd, sel }: { E: Engine; cd: StackDef; sel: string }) {
  const get = (c: string): StackRow[] | null => {
    const rr = E.sheet(cd.s)?.r[c];
    if (!rr) return null;
    const out: StackRow[] = [];
    cd.rows.forEach((r) => {
      const parts = cd.cats.map((ct) => {
        const a = rr[cd.key(r, ct.key)];
        const i = a ? lastIdx(a, isN) : -1;
        return i >= 0 ? (a[i] as number) : null;
      });
      if (parts.some(isN))
        out.push({
          label: r,
          parts,
          sub: cd.sub ? cd.sub(E, c, r) : cd.counts ? nf(parts.reduce<number>((a, b) => a + (isN(b) ? b : 0), 0), 0) + " " + cd.counts : "",
        });
    });
    return out.length ? out : null;
  };
  let code = sel, fb = false, rows = get(code);
  if (!rows && !E.isProv(sel)) {
    code = E.provOf(sel);
    fb = true;
    rows = get(code);
  }
  if (!rows) return null;
  return (
    <Card title={cd.title} desc={cd.d} src={<Src E={E} sheet={cd.s} />}>
      {fb && <FbNote E={E} code={code} />}
      <StackBars rows={rows} cats={cd.cats} counts={cd.counts} />
    </Card>
  );
}

// ─────────────────────────────── kartu khusus ───────────────────────────────
function Seg({ v, tot, mx, color, fg, name }: { v: number | null; tot: number; mx: number; color: string; fg: string; name: string }) {
  const { show, hide } = useTip();
  if (!isN(v) || v <= 0) return null;
  return (
    <span
      style={{ flex: `${v} 1 0`, background: color, color: fg }}
      onPointerMove={(e) => show(<TipRow color={color} label={name} value={`${fmt(v, { rp: true })} · ${nf((v / tot) * 100, 1)}%`} />, e)}
      onPointerLeave={hide}
    >
      {v / mx >= 0.1 ? `${name} ${nf((v / tot) * 100, 0)}%` : ""}
    </span>
  );
}

export function ApbdCard({ E, sel }: { E: Engine; sel: string }) {
  const g = (c: string, k: string) => E.latestOf("Postur APBD", c, k)?.v ?? null;
  const code = sel;
  const pd = g(code, "Pendapatan Daerah"), pad = g(code, "PAD"), tkd = g(code, "TKD"), bd = g(code, "Belanja Daerah"), bp = g(code, "Belanja Pegawai");
  if (!isN(pd) && !isN(bd)) return null;
  const mx = Math.max(pd || 0, bd || 0) || 1;
  const per = E.sheet("Postur APBD")!.p.slice(-1)[0];
  const lain = isN(pd) ? Math.max(0, pd - (pad || 0) - (tkd || 0)) : null;
  const blain = isN(bd) ? Math.max(0, bd - (bp || 0)) : null;
  const peers = E.peersOf(code);
  const med = (k: string) => {
    const vs = peers.map((c) => E.ser("Rasio Fiskal", c, k)?.[0]).filter(isN).sort((a, b) => a - b);
    return vs.length ? vs[Math.floor((vs.length - 1) / 2)] : null;
  };
  const rv = (k: string) => E.ser("Rasio Fiskal", code, k)?.[0] ?? null;
  const surplus = isN(pd) && isN(bd) ? pd - bd : null;

  return (
    <Card
      wide
      title={`Postur APBD ${per}`}
      desc="Pendapatan menurut sumbernya dan belanja menurut peruntukannya. Panjang batang sebanding dengan nilai rupiahnya."
      src={<Src E={E} sheet="Postur APBD" />}
    >
      <Legend
        items={[
          { name: "PAD (pendapatan asli daerah)", color: "var(--s1)", kind: "sq" },
          { name: "TKD (transfer ke daerah)", color: "var(--s2)", kind: "sq" },
          { name: "Pendapatan lain", color: "var(--bar-muted)", kind: "sq" },
          { name: "Belanja pegawai", color: "var(--s3)", kind: "sq" },
          { name: "Belanja lainnya", color: "var(--o4)", kind: "sq" },
        ]}
      />
      <div className="flex flex-col gap-3">
        {isN(pd) && (
          <div>
            <div className="mb-1 flex justify-between gap-2 text-[12.5px]">
              <b className="font-semibold">Pendapatan daerah</b>
              <span className="tnum text-ink-2">{fmt(pd, { rp: true })}</span>
            </div>
            <div className="stackbar !h-[30px]" style={{ width: `${((pd / mx) * 100).toFixed(2)}%` }}>
              <Seg mx={mx} v={pad} tot={pd} color="var(--s1)" fg="#fff" name="PAD" />
              <Seg mx={mx} v={tkd} tot={pd} color="var(--s2)" fg="#2a1a02" name="TKD" />
              <Seg mx={mx} v={lain} tot={pd} color="var(--bar-muted)" fg="var(--foreground)" name="Lain" />
            </div>
          </div>
        )}
        {isN(bd) && (
          <div>
            <div className="mb-1 flex justify-between gap-2 text-[12.5px]">
              <b className="font-semibold">Belanja daerah</b>
              <span className="tnum text-ink-2">{fmt(bd, { rp: true })}</span>
            </div>
            <div className="stackbar !h-[30px]" style={{ width: `${((bd / mx) * 100).toFixed(2)}%` }}>
              <Seg mx={mx} v={bp} tot={bd} color="var(--s3)" fg="#fff" name="Pegawai" />
              <Seg mx={mx} v={blain} tot={bd} color="var(--o4)" fg="var(--o4-fg)" name="Lainnya" />
            </div>
          </div>
        )}
      </div>
      {isN(surplus) && (
        <Cap>
          {surplus >= 0 ? "Surplus" : "Defisit"} <b className="text-foreground">{fmt(Math.abs(surplus), { rp: true })}</b>{" "}
          <span className="text-muted">(pendapatan dikurangi belanja)</span>
        </Cap>
      )}
      <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
        {(
          [
            ["PAD/Pendapatan", "Porsi PAD dalam pendapatan"],
            ["TKD/Pendapatan", "Porsi transfer pusat dalam pendapatan"],
            ["Pegawai/Belanja", "Porsi belanja pegawai"],
          ] as const
        ).map(([k, l]) => (
          <div key={k}>
            <div className="text-[12px] text-ink-2">{l}</div>
            <div className="tnum text-[20px] font-bold">{fmt(rv(k), pct1)}</div>
            <div className="text-[11.5px] text-muted">
              Median {E.peerWord(code)}: {fmt(med(k), pct1)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const STAT_COL = ["var(--o1)", "var(--o2)", "var(--o3)", "var(--o4)", "var(--o5)"];
const STAT_FG = ["var(--o1-fg)", "var(--o2-fg)", "var(--o3-fg)", "var(--o4-fg)", "var(--o5-fg)"];
const STAT_NAME = ["Mandiri", "Maju", "Berkembang", "Tertinggal", "Sangat tertinggal"];

export function DesaCard({ E, sel }: { E: Engine; sel: string }) {
  const d = E.desa(sel);
  if (!d || !d.status) return null;
  const isP = E.isProv(sel);
  const prov = E.provOf(sel);
  const total = (s: number[]) => nf(s.reduce((a, b) => a + b, 0), 0) + " desa";
  const rows: StackRow[] = [{ label: E.name(sel), parts: d.status, sub: total(d.status) }];
  const pd = !isP ? E.desa(prov) : undefined;
  if (pd?.status) rows.push({ label: E.name(prov), parts: pd.status, sub: total(pd.status) });
  const dimsK = ["Layanan Dasar", "Sosial", "Ekonomi", "Lingkungan", "Aksesibilitas", "Tata Kelola Pemerintah"];
  const drows = dimsK
    .filter((k) => d.dims && isN(d.dims[k]))
    .map((k) => ({ label: k === "Tata Kelola Pemerintah" ? "Tata kelola pemerintahan" : k, v: d.dims![k], cmp: pd?.dims ? pd.dims[k] : null }));
  const items: LegendItem[] = [{ name: short(E.name(sel)), color: "var(--s1)", kind: "sq" }];
  if (pd) items.push({ name: E.name(prov), color: "var(--s2)", kind: "tick" });
  return (
    <Card wide title="Status desa — Indeks Desa 2025" desc="Jumlah desa per status, dari Mandiri sampai Sangat Tertinggal, dan skor rata-rata per dimensi." src={<Src E={E} sheet="Indeks Desa" agg />}>
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <StackBars rows={rows} cats={STAT_NAME.map((n, i) => ({ name: n, color: STAT_COL[i], fg: STAT_FG[i] }))} counts="desa" />
        <div className="flex flex-col gap-2">
          <Legend items={items} lead={<span className="text-ink-2">Skor rata-rata per dimensi</span>} />
          <BarsChart rows={drows} f={idx2} per="2025" selName={E.name(sel)} cmpName={pd ? E.name(prov) : ""} aria="Skor Indeks Desa per dimensi" />
        </div>
      </div>
    </Card>
  );
}

const GRADE = (g: unknown) => String(g).trim().replace(/^-(\w)/, "$1−").replace(/^\+(\w)/, "$1+");
function IppRow({ who, arr, P }: { who: string; arr: Cell[] | null; P: string[] }) {
  if (!arr) return null;
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="min-w-[120px] text-[12.5px] text-ink-2">{who}</span>
      <div className="flex flex-wrap gap-1.5">
        {P.map((p, k) =>
          arr[k] != null ? (
            <span key={p} className="flex min-w-[54px] flex-col items-center rounded-md border border-border bg-surface-2 px-2 py-1">
              <b className="text-[15px]">{GRADE(arr[k])}</b>
              <span className="font-mono text-[10.5px] text-muted">{p}</span>
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
export function IppCard({ E, sel }: { E: Engine; sel: string }) {
  const a = E.ser("IPP", sel, "");
  const isP = E.isProv(sel);
  const pa = !isP ? E.ser("IPP", E.provOf(sel), "") : null;
  if (!a && !pa) return null;
  const P = E.sheet("IPP")!.p;
  return (
    <Card title="Indeks Pelayanan Publik" desc="Nilai KemenPAN-RB. A = sangat baik; tanda minus (−) berarti di batas bawah kategori." src={<Src E={E} sheet="IPP" />}>
      <IppRow who={short(E.name(sel))} arr={a} P={P} />
      {!isP && <IppRow who={E.name(E.provOf(sel))} arr={pa} P={P} />}
    </Card>
  );
}

export function CommodCard({ E, sel }: { E: Engine; sel: string }) {
  let code = sel, fb = false;
  let rows = E.sheet("Komdung")?.r[code];
  if (!rows && !E.isProv(sel)) {
    code = E.provOf(sel);
    fb = true;
    rows = E.sheet("Komdung")?.r[code];
  }
  if (!rows) return null;
  const P = E.sheet("Komdung")!.p;
  const list = Object.keys(rows)
    .map((k) => {
      const a = rows![k];
      const i = lastIdx(a, isN);
      if (i < 0) return null;
      const j = lastIdx(a.slice(0, i), isN);
      const unitM = k.match(/\(([^)]*(ton|kg|ekor)[^)]*)\)/i);
      const unit = unitM ? unitM[1].replace(/Produksi,?\s*/i, "") : "ton";
      const name = k.replace(/\s*\([^)]*\)\s*/g, " ").replace(/^Produksi\s+/, "").replace(/\s+/g, " ").trim();
      return { name, unit, v: a[i] as number, per: P[i], pv: j >= 0 ? (a[j] as number) : null, pper: j >= 0 ? P[j] : null, a };
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((x, y) => y.v - x.v);
  if (!list.length) return null;
  return (
    <Card wide title="Produksi komoditas unggulan" desc={`Komoditas unggulan sesuai RPJMN, ${P[0]}–${P[P.length - 1]}.`} src={<Src E={E} sheet="Komdung" />}>
      {fb && <FbNote E={E} code={code} />}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="tv">
          <thead>
            <tr>
              <th>Komoditas</th>
              <th>Produksi terakhir</th>
              <th style={{ textAlign: "left" }}>Tren</th>
              <th>Perubahan</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const ch = isN(r.pv) && r.pv ? ((r.v - r.pv) / Math.abs(r.pv)) * 100 : null;
              return (
                <tr key={r.name}>
                  <td className="font-medium">{r.name}</td>
                  <td>
                    <b>{fmt(r.v, { d: r.v < 100 ? 1 : 0 })}</b>{" "}
                    <span className="text-muted">
                      {r.unit} · {r.per}
                    </span>
                  </td>
                  <td style={{ textAlign: "left", width: 100 }}>
                    <Sparkline vals={r.a} />
                  </td>
                  <td>
                    {isN(ch) ? (
                      <span className={`badge ${ch >= 0 ? "badge-good" : "badge-bad"}`}>
                        {ch >= 0 ? "▲" : "▼"} {nf(Math.abs(ch), 1)}%<span className="hidden font-normal opacity-80 sm:inline">vs {r.pper}</span>
                      </span>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function WisataCard({ E, sel }: { E: Engine; sel: string }) {
  const rows = E.sheet("Pariwisata")?.r[sel];
  if (!rows) return null;
  const g = (k: string) => {
    const a = rows[k];
    if (!a) return null;
    const i = lastIdx(a, (v) => v != null && v !== "");
    return i >= 0 ? a[i] : null;
  };
  const show = (v: unknown) => (v == null ? "–" : isN(v) ? nf(v, 0) : String(v).trim());
  const groups: [string, [string, string][]][] = [
    ["Akomodasi & kuliner", [["Tempat tidur hotel bintang", "Jumlah Tempat Tidur Hotel Bintang"], ["Tempat tidur hotel non-bintang", "Jumlah Tempat Tidur Hotel Non-Bintang"], ["Rumah makan / restoran", "Jumlah Rumah Makan/Restoran"]]],
    ["Destinasi", [["Daya tarik wisata (DTW)", "Jumlah DTW"], ["Desa wisata penerima ADWI", "Desa wisata potensial (penerima penghargaan ADWI)"], ["KSPN / KEK pariwisata", "KSPN dan/atau KEK Pariwisata"], ["Event pariwisata", "Jumlah event pariwisata yang diselenggarakan (pertahun)"], ["Situs warisan dunia UNESCO", "Jumlah situs budaya warisan dunia (standar UNESCO)"]]],
    ["Akses", [["Bandara", "Nama Bandara"], ["Kelas bandara", "Kelas Bandara"], ["Penggunaan bandara", "Penggunaan Bandara"], ["Pelabuhan utama", "Pelabuhan Utama (PU)"], ["Pelabuhan pengumpul", "Pelabuhan Pengumpul (PP)"], ["Pelabuhan pengumpan regional", "Pelabuhan Pengumpan Regional (PR)"]]],
  ];
  if (!groups.some(([, it]) => it.some(([, k]) => g(k) != null))) return null;
  return (
    <Card wide title="Fasilitas pariwisata" desc="Fasilitas dan daya tarik wisata (data 2021–2022, nilai terbaru yang tersedia)." src={<Src E={E} sheet="Pariwisata" />}>
      <div className="grid gap-x-6 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
        {groups.map(([t, it]) => (
          <div key={t}>
            <h4 className="subheader mb-1.5">{t}</h4>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 text-[12.5px]">
              {it.map(([l, k]) => (
                <div key={k} className="contents">
                  <dt className="border-b border-border py-1 text-ink-2">{l}</dt>
                  <dd className="tnum border-b border-border py-1 text-right font-semibold">{show(g(k))}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Card>
  );
}
