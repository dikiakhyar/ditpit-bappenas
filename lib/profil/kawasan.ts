// Agregat "Indonesia Timur" (kode wilayah KAWASAN) = gabungan seluruh provinsi
// di database (16 provinsi wilayah PIT). Dihitung SEKALI saat data dimuat.
//
// Cara menggabungkan tiap indikator:
//   • jumlah     — besaran (rupiah, orang, unit, ton, desa, MW, GWh, luas, jumlah …):
//                  Σ provinsi. WAJIB lengkap semua provinsi (kalau tidak → tidak ada data,
//                  bukan jumlah yang kurang).
//   • per kapita — PDRB per kapita: Σ PDRB ÷ Σ penduduk (penduduk_i = PDRB_i ÷ per kapita_i).
//   • pertumbuhan— LPE: rata-rata tertimbang PDRB ADHK periode sebelumnya
//                  (= pertumbuhan PDRB gabungan, persis).
//   • porsi      — Distribusi PDRB: Σ PDRB sektor ÷ Σ PDRB total × 100.
//   • % miskin   — Σ penduduk miskin ÷ Σ (penduduk miskin ÷ %miskin).
//   • rata-rata  — persen/indeks/rasio lain: rata-rata tertimbang JUMLAH PENDUDUK provinsi.
//                  Boleh bila provinsi berdata mencakup ≥ 90% penduduk kawasan.
//   • tidak diagregasi — teks/kategori (mis. nilai IPP, kategori RKFD) dan "Rasio APBD"
//                  (dihitung ulang dari Postur APBD gabungan oleh engine).

import { isN, type Cell } from "./format";
import type { Sheet, ProfilData } from "./engine";

export const KAWASAN = "KTI";
export const KAWASAN_NAMA = "Indonesia Timur";

type Method = "sum" | "wavg" | "growth" | "percap" | "share" | "miskin" | null;

const PDB = "Produk Domestik Bruto";
const SUM_UNIT = /rupiah|orang|^unit$|^ton$|desa|^mw$|gwh|jiwa/i;
const SUM_ITEM = /(^|\s)jumlah\b|\((unit|orang|ekor|kecamatan|km2)\)|\(ton|\(ekor|tempat tidur|estimasi jumlah penduduk/i;

function methodOf(sheet: string, item: string, unit: string): Method {
  switch (sheet) {
    case "ADHK Per Kapita":
    case "ADHB Per Kapita":
      return "percap";
    case "LPE":
    case "LPE Triwulan (yoy)":
    case "LPE Triwulan (qtoq)":
    case "LPE Triwulan (ctoc)":
      return "growth";
    case "Distribusi ADHB":
      return item && item !== PDB ? "share" : null;
    case "Kontribusi PDRB":
    case "Postur APBD":
    case "ADHK":
    case "ADHB":
    case "Triwulan ADHK":
    case "Triwulan ADHB":
    case "Nakes Prioritas":
    case "Kelas RS":
    case "Komdung":
      return "sum";
    case "Rasio APBD":
      return null;
    case "Kemiskinan":
      return /jumlah/i.test(item) ? "sum" : /persentase/i.test(item) ? "miskin" : "wavg";
    case "Luas Wilayah":
      return /persentase/i.test(item) ? null : "sum";
  }
  if (/%|persen|rasio|rate|indeks|prevalensi/i.test(item)) return "wavg";
  if (SUM_ITEM.test(item)) return "sum";
  if (SUM_UNIT.test(unit.trim())) return "sum";
  return "wavg";
}

const yearOf = (p: string) => Number(p.match(/(19|20)\d{2}/)?.[0] ?? NaN);
const qOf = (p: string) => Number(p.match(/^T([1-4])\s/)?.[1] ?? NaN);

/** Label periode sebelumnya (untuk bobot pertumbuhan). */
function prevLabel(sheet: string, p: string): string | null {
  const y = yearOf(p);
  if (!Number.isFinite(y)) return null;
  const q = qOf(p);
  if (!Number.isFinite(q)) return String(y - 1);
  if (sheet === "LPE Triwulan (qtoq)") return q === 1 ? `T4 ${y - 1}` : `T${q - 1} ${y}`;
  return `T${q} ${y - 1}`;
}

export function buildKawasan(
  S: Record<string, Sheet>,
  provs: string[],
  desa: ProfilData["desa"]
): { rows: Record<string, Record<string, Cell[]>>; desa: ProfilData["desa"][string] | null } {
  const val = (s: string, c: string, item: string, per: string): number | null => {
    const sh = S[s];
    const i = sh ? sh.p.indexOf(per) : -1;
    const v = i >= 0 ? sh.r[c]?.[item]?.[i] : null;
    return isN(v) ? v : null;
  };

  // penduduk provinsi per tahun (ribu jiwa) dari PDRB ADHB ÷ per kapita ADHB
  const popCache = new Map<string, number | null>();
  const popYear = (c: string, y: number): number | null => {
    const k = c + "|" + y;
    if (popCache.has(k)) return popCache.get(k)!;
    const a = val("ADHB", c, PDB, String(y)), pk = val("ADHB Per Kapita", c, "", String(y));
    const v = isN(a) && isN(pk) && pk > 0 ? (a / pk) * 1000 : null;
    popCache.set(k, v);
    return v;
  };
  const pop = (c: string, per: string): number | null => {
    const y = yearOf(per);
    if (!Number.isFinite(y)) return popYear(c, 2024);
    for (const d of [0, -1, 1, -2, 2, -3, 3]) {
      const v = popYear(c, y + d);
      if (isN(v)) return v;
    }
    return null;
  };

  const rows: Record<string, Record<string, Cell[]>> = {};
  for (const [name, sh] of Object.entries(S)) {
    const items = new Set<string>();
    for (const c of provs) for (const it of Object.keys(sh.r[c] ?? {})) items.add(it);
    if (!items.size) continue;
    const out: Record<string, Cell[]> = {};
    for (const item of items) {
      const m = methodOf(name, item, sh.u);
      if (!m) continue;
      const series: Cell[] = sh.p.map((per, i) => {
        const vs = provs.map((c) => {
          const v = sh.r[c]?.[item]?.[i];
          return isN(v) ? v : null;
        });
        const all = vs.every(isN);
        switch (m) {
          case "sum":
            return all ? (vs as number[]).reduce((a, b) => a + b, 0) : null;
          case "percap": {
            // Σ PDRB ÷ Σ (PDRB ÷ per kapita)
            const lvl = name.startsWith("ADHK") ? "ADHK" : "ADHB";
            let num = 0, den = 0;
            for (let k = 0; k < provs.length; k++) {
              const Y = val(lvl, provs[k], PDB, per), v = vs[k];
              if (!isN(Y) || !isN(v) || v <= 0) return null;
              num += Y;
              den += Y / v;
            }
            return den > 0 ? num / den : null;
          }
          case "growth": {
            const lvlSheet = name === "LPE" ? "ADHK" : "Triwulan ADHK";
            const prev = prevLabel(name, per);
            let num = 0, den = 0;
            for (let k = 0; k < provs.length; k++) {
              const v = vs[k];
              const w = (prev && val(lvlSheet, provs[k], item || PDB, prev)) ?? val(lvlSheet, provs[k], item || PDB, per);
              if (!isN(v) || !isN(w) || w <= 0) return null;
              num += v * w;
              den += w;
            }
            return den > 0 ? num / den : null;
          }
          case "share": {
            let num = 0, den = 0;
            for (const c of provs) {
              const a = val("ADHB", c, item, per), t = val("ADHB", c, PDB, per);
              if (!isN(a) || !isN(t)) return null;
              num += a;
              den += t;
            }
            return den > 0 ? (num / den) * 100 : null;
          }
          case "miskin": {
            let num = 0, den = 0;
            for (let k = 0; k < provs.length; k++) {
              const n = val("Kemiskinan", provs[k], "Jumlah Penduduk Miskin", per), p = vs[k];
              if (!isN(n) || !isN(p) || p <= 0) return null;
              num += n;
              den += (n / p) * 100;
            }
            return den > 0 ? (num / den) * 100 : null;
          }
          case "wavg": {
            let num = 0, den = 0, cov = 0, tot = 0;
            for (let k = 0; k < provs.length; k++) {
              const w = pop(provs[k], per);
              if (!isN(w)) return null; // tanpa bobot penduduk → jangan ditebak
              tot += w;
              const v = vs[k];
              if (!isN(v)) continue;
              num += v * w;
              den += w;
              cov += w;
            }
            return den > 0 && cov / tot >= 0.9 ? num / den : null;
          }
        }
      });
      if (series.some(isN)) out[item] = series.map((v) => (isN(v) ? Math.round(v * 1e4) / 1e4 : v));
    }
    if (Object.keys(out).length) rows[name] = out;
  }

  // Indeks Desa: jumlah desa per status dijumlahkan; skor dimensi = rata-rata tertimbang jumlah desa
  let dz: ProfilData["desa"][string] | null = null;
  if (provs.every((c) => desa[c]?.status)) {
    const status = [0, 0, 0, 0, 0];
    const sum: Record<string, number> = {}, cnt: Record<string, number> = {};
    for (const c of provs) {
      const d = desa[c]!;
      const n = d.status!.reduce((a, b) => a + b, 0);
      d.status!.forEach((v, i) => (status[i] += v));
      for (const [k, v] of Object.entries(d.dims ?? {})) {
        if (!isN(v)) continue;
        sum[k] = (sum[k] ?? 0) + v * n;
        cnt[k] = (cnt[k] ?? 0) + n;
      }
    }
    const dims: Record<string, number> = {};
    for (const k in sum) if (cnt[k]) dims[k] = Math.round((sum[k] / cnt[k]) * 100) / 100;
    dz = { status, dims };
  }
  return { rows, desa: dz };
}
