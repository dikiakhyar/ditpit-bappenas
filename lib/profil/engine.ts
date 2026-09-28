// Mesin data Profil Daerah — logika murni (tanpa DOM), port dari artifact
// "Profil Daerah Indonesia Timur". Membaca public/data/profil.json:
//   regions: { kode: { n: nama, p: kode induk } }
//   sheets:  { namaSheet: { p: [periode…], u: satuan, r: { kode: { item: [nilai per periode] } } } }
//   desa:    { kode: { status: [Mandiri, Maju, Berkembang, Tertinggal, Sangat tertinggal], dims: {…} } }
//   meta:    { namaSheet: { n: nama, s: sumber } }

import { isN, lastIdx, type Cell } from "./format";

export interface Sheet {
  p: string[];
  u: string;
  r: Record<string, Record<string, Cell[]>>;
}
export interface ProfilData {
  regions: Record<string, { n: string; p: number | string }>;
  sheets: Record<string, Sheet>;
  desa: Record<string, { status?: number[]; dims?: Record<string, number> }>;
  meta: Record<string, { n: string; s: string }>;
  status: string[];
}
export type Better = "up" | "down" | 0;

export interface Latest {
  i: number;
  v: number;
  per: string;
  j: number;
  pv: number | null;
  pper: string | null;
}
export interface RankInfo {
  rank: number;
  n: number;
  rows: { c: string; v: number }[];
}

export function createEngine(D: ProfilData) {
  const R = D.regions;
  const S: Record<string, Sheet> = { ...D.sheets };
  const META: Record<string, { n: string; s: string }> = { ...D.meta };

  // ── sheet turunan ──
  {
    const P = S["Postur APBD"];
    if (P) {
      const rf: Sheet = { p: P.p, u: "persen", r: {} };
      for (const c in P.r) {
        const g = (k: string) => (P.r[c][k] || [])[0];
        const o: Record<string, Cell[]> = {};
        const pd = g("Pendapatan Daerah"), pad = g("PAD"), tkd = g("TKD"), bd = g("Belanja Daerah"), bp = g("Belanja Pegawai");
        if (isN(pd) && pd > 0 && isN(pad)) o["PAD/Pendapatan"] = [(pad / pd) * 100];
        if (isN(pd) && pd > 0 && isN(tkd)) o["TKD/Pendapatan"] = [(tkd / pd) * 100];
        if (isN(bd) && bd > 0 && isN(bp)) o["Pegawai/Belanja"] = [(bp / bd) * 100];
        rf.r[c] = o;
      }
      S["Rasio Fiskal"] = rf;
      META["Rasio Fiskal"] = { n: "Dihitung dari Postur APBD", s: "Postur APBD 2025" };
    }
    const ds: Sheet = { p: ["2025"], u: "", r: {} };
    for (const c in D.desa) {
      const d = D.desa[c];
      const o: Record<string, Cell[]> = {};
      if (d.status) {
        const t = d.status.reduce((a, b) => a + b, 0);
        if (t) {
          o["Mandiri+Maju"] = [((d.status[0] + d.status[1]) / t) * 100];
          o["Tertinggal"] = [((d.status[3] + d.status[4]) / t) * 100];
        }
      }
      if (d.dims && isN(d.dims["Skor"])) o["Skor"] = [d.dims["Skor"]];
      ds.r[c] = o;
    }
    S["Desa"] = ds;
    META["Desa"] = { n: "Indeks Desa 2025", s: "Indeks Desa (agregasi dari data per desa)" };
  }

  // ── wilayah ──
  const has = (c: string) => !!R[c];
  const name = (c: string) => R[c]?.n ?? c;
  const isProv = (c: string) => c !== "0" && Number(c) % 100 === 0;
  const provOf = (c: string) => (isProv(c) || c === "0" ? c : String(R[c]?.p ?? c.slice(0, 2) + "00"));
  const byName = (a: string, b: string) => R[a].n.localeCompare(R[b].n, "id");
  const PROVS = Object.keys(R).filter(isProv).sort(byName);
  const kabsCache = new Map<string, string[]>();
  const kabsOf = (p: string) => {
    let v = kabsCache.get(p);
    if (!v) {
      v = Object.keys(R).filter((c) => String(R[c].p) === p && c !== p && c !== "0").sort(byName);
      kabsCache.set(p, v);
    }
    return v;
  };
  const peersOf = (c: string) => (isProv(c) ? PROVS.slice() : kabsOf(provOf(c)));
  const peerWord = (c: string) => (isProv(c) ? `${PROVS.length} provinsi` : "kab/kota di " + name(provOf(c)));

  // ── akses data ──
  const sheet = (s: string): Sheet | undefined => S[s];
  const ser = (s: string, code: string, item?: string | null): Cell[] | null => {
    const sh = S[s];
    if (!sh || !sh.r[code]) return null;
    return sh.r[code][item == null ? "" : item] || null;
  };
  const pmask = (s: string, pf?: RegExp) => S[s].p.map((l) => !pf || pf.test(l));
  const latestOf = (s: string, code: string, item?: string | null, pf?: RegExp): Latest | null => {
    const a = ser(s, code, item);
    if (!a) return null;
    const m = pmask(s, pf);
    const i = lastIdx(a, (v, k) => isN(v) && m[k]);
    if (i < 0) return null;
    const j = lastIdx(a.slice(0, i), (v, k) => isN(v) && m[k]);
    return {
      i,
      v: a[i] as number,
      per: S[s].p[i],
      j,
      pv: j >= 0 ? (a[j] as number) : null,
      pper: j >= 0 ? S[s].p[j] : null,
    };
  };
  const valAt = (s: string, code: string, item: string | null | undefined, per: string): number | null => {
    const a = ser(s, code, item);
    if (!a) return null;
    const i = S[s].p.indexOf(per);
    const v = i >= 0 ? a[i] : null;
    return isN(v) ? v : null;
  };
  const rankInfo = (s: string, item: string | null | undefined, code: string, per: string, b: Better): RankInfo | null => {
    const rows: { c: string; v: number }[] = [];
    for (const c of peersOf(code)) {
      const v = valAt(s, c, item, per);
      if (isN(v)) rows.push({ c, v });
    }
    if (!rows.some((r) => r.c === code) || rows.length < 2) return null;
    const sorted = rows.slice().sort((a, z) => (b === "down" ? a.v - z.v : z.v - a.v));
    return { rank: sorted.findIndex((r) => r.c === code) + 1, n: rows.length, rows };
  };
  /** Kode yang punya data: kab/kota sendiri, atau jatuh ke provinsinya. */
  const pickCode = (s: string, item: string | null | undefined, code: string, pf?: RegExp) => {
    if (latestOf(s, code, item, pf)) return { code, fb: false };
    if (!isProv(code) && latestOf(s, provOf(code), item, pf)) return { code: provOf(code), fb: true };
    return null;
  };
  const composeRows = (s: string, code: string, opt: { ex?: string[]; order?: string[] }) => {
    const rows = S[s]?.r[code];
    if (!rows) return null;
    let keys = Object.keys(rows).filter((k) => !(opt.ex || []).includes(k));
    if (opt.order) keys = opt.order.filter((k) => rows[k]);
    if (!keys.length) return null;
    const i = Math.max(...keys.map((k) => lastIdx(rows[k], isN)));
    if (i < 0) return null;
    const list = keys.map((k) => ({ k, v: rows[k][i] })).filter((r): r is { k: string; v: number } => isN(r.v));
    if (!list.length) return null;
    return { i, per: S[s].p[i], list };
  };
  const meta = (s: string) => META[s] ?? { n: s, s: "" };
  const desa = (c: string) => D.desa[c];
  const coverage = {
    provinsi: PROVS.length,
    kabkota: Object.keys(R).filter((c) => c !== "0" && !isProv(c)).length,
    tabel: Object.keys(S).length - 2,
  };

  return {
    has, name, isProv, provOf, PROVS, kabsOf, peersOf, peerWord,
    sheet, ser, pmask, latestOf, valAt, rankInfo, pickCode, composeRows, meta, desa, coverage,
  };
}
export type Engine = ReturnType<typeof createEngine>;

// ── pemuatan (sekali per sesi, dipakai bersama halaman Peta & Profil) ──
let cache: Promise<Engine> | null = null;
export function loadProfil(): Promise<Engine> {
  if (!cache) {
    cache = fetch("/data/profil.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ProfilData) => createEngine(d))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}
