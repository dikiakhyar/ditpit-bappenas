// Format angka & utilitas skala untuk Profil Daerah (port dari artifact).

export interface Fmt {
  k?: number; // pengali (mis. 0.001 untuk ribu → juta)
  d?: number; // jumlah desimal (default 1)
  pre?: string;
  suf?: string;
  du?: string; // satuan untuk teks selisih
  rp?: boolean; // rupiah dalam miliar → otomatis M / T / jt
  _top?: number;
}

export type Cell = number | string | null;

export function isN(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function nf(v: number, d: number): string {
  return v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Teks untuk nilai kosong / tidak tersedia di database (bukan 0). */
export const NA = "Tidak ada data";

export function fmt(v: unknown, f: Fmt = {}): string {
  if (!isN(v)) return NA;
  const x = v * (f.k ?? 1);
  if (f.rp) {
    const a = Math.abs(x);
    if (a >= 1000) return "Rp " + nf(x / 1000, a >= 100000 ? 0 : 2) + " T";
    if (a >= 1) return "Rp " + nf(x, a >= 100 ? 0 : 1) + " M";
    return "Rp " + nf(x * 1000, 0) + " jt";
  }
  return (f.pre ?? "") + nf(x, f.d == null ? 1 : f.d) + (f.suf ?? "");
}

export function fmtAxis(v: number, f: Fmt = {}, step: number): string {
  const x = v * (f.k ?? 1);
  const st = Math.abs(step * (f.k ?? 1));
  if (f.rp) {
    const top = f._top ?? Math.abs(x);
    if (top >= 1000) return nf(x / 1000, st / 1000 < 1 ? (st / 1000 < 0.1 ? 2 : 1) : 0) + " T";
    return nf(x, st < 1 ? 1 : 0) + " M";
  }
  const d = st >= 1 ? 0 : st >= 0.1 ? 1 : st >= 0.01 ? 2 : 3;
  return nf(x, d) + (f.suf && f.suf.trim() === "%" ? "%" : "");
}

export function niceTicks(lo: number, hi: number, n: number): number[] {
  if (!isN(lo) || !isN(hi)) return [0, 1];
  if (lo === hi) {
    const p = Math.abs(lo) * 0.1 || 1;
    lo -= p;
    hi += p;
  }
  const raw = (hi - lo) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = a; v <= b + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}

export const textW = (s: string, px: number) => s.length * px * 0.56;

export function trunc(s: string, maxW: number, px: number): string {
  if (textW(s, px) <= maxW) return s;
  const n = Math.max(3, Math.floor(maxW / (px * 0.56)) - 1);
  return s.slice(0, n) + "…";
}

export function lastIdx<T>(a: readonly T[] | null | undefined, pred: (v: T, i: number) => boolean): number {
  if (!a) return -1;
  for (let i = a.length - 1; i >= 0; i--) if (pred(a[i], i)) return i;
  return -1;
}

export const short = (n: string) => n.replace(/^Kabupaten /, "Kab. ");

// satuan persen sederhana yang sering dipakai kartu
export const pct1: Fmt = { d: 1, suf: " %" };
export const pct2: Fmt = { d: 2, suf: " %" };
export const idx2: Fmt = { d: 2 };
