// Ubah workbook "Database PIT" menjadi dataset yang dipakai situs
// (format sama dengan public/data/profil.json → dibaca lib/profil/engine.ts).
//
// Aturan sheet (sesuai spreadsheet):
//   • Sheet data standar: kolom  region_code | province | regency | item | units | <periode…>
//     — periode di header boleh angka (2024), teks ("T1 2025") atau tanggal (→ "Agu 2025").
//     — region_code 9999 = Indonesia (nasional).
//   • "Metadata": nama_sheet → nama_data (judul) & sumber.
//   • "Indeks Desa": data per desa → diringkas per kab/kota & provinsi (status + skor dimensi).
// Sheet baru yang mengikuti format standar otomatis ikut terbaca.

import type { ProfilData, Sheet } from "@/lib/profil/engine";
import { BULAN, DATE_MARK, excelDate, openWorkbook, type CellValue, type Row } from "./xlsx";

/** Sheet yang bukan data indikator (diabaikan). */
const SKIP = new Set(["Metadata", "Metadata Non-BPS", "Pivot Table 2", "Sheet61", "Sheet36", "Progres", "LPE_PDB_Unpivot", "IDSD"]);
const DESA_SHEET = "Indeks Desa";
export const DESA_STATUS = ["MANDIRI", "MAJU", "BERKEMBANG", "TERTINGGAL", "SANGAT TERTINGGAL"];
const NATIONAL = 9999;

const str = (v: CellValue) => (v == null ? "" : String(v).trim());
const isDate = (v: CellValue): boolean => typeof v === "string" && v.startsWith(DATE_MARK);
/** Nama item: NFKC ("km²"→"km2"), spasi dirapikan; tanggal hasil konversi otomatis Excel
 *  (mis. kelompok umur "7-12" terbaca 12 Juli) dikembalikan ke "7-12". */
function itemName(v: CellValue): string {
  if (isDate(v)) {
    const d = excelDate(Number(String(v).slice(1)));
    return `${d.m}-${d.d}`;
  }
  return str(v).normalize("NFKC").replace(/\s+/g, " ");
}
const norm = (h: string) => h.toLowerCase().replace(/\s+/g, "_");

/** Label periode. Header bertanggal diformat per sheet:
 *  • sheet bulanan (>4 bulan berbeda, mis. NTP) → "Jan 2019"
 *  • sheet triwulanan (ada bulan 6 & 12)       → "T1 2019" … "T4 2019"; Januari → "2019" (tahunan)
 *  • selainnya (mis. TPT Feb/Agu, Gini Mar/Sep) → "Agu 2019"; Januari → "2019" */
function periodLabels(heads: CellValue[]): string[] {
  const dates = heads.map((h) => (typeof h === "string" && h.startsWith(DATE_MARK) ? excelDate(Number(h.slice(1))) : null));
  const months = new Set(dates.filter((d) => d).map((d) => d!.m));
  // triwulanan: hanya Jan (tahunan) + Mar/Jun/Sep/Des
  const quarterly = months.has(6) && months.has(12) && [...months].every((m) => m === 1 || m % 3 === 0);
  const monthly = !quarterly && months.size > 4;
  return heads.map((h, i) => {
    const d = dates[i];
    if (d) {
      if (monthly) return `${BULAN[d.m - 1]} ${d.y}`;
      if (d.m === 1) return String(d.y);
      if (quarterly && d.m % 3 === 0) return `T${d.m / 3} ${d.y}`;
      return `${BULAN[d.m - 1]} ${d.y}`;
    }
    if (typeof h === "number") return Number.isInteger(h) ? String(h) : String(+h.toFixed(4));
    return str(h);
  });
}
function cleanValue(v: CellValue): number | string | null {
  if (v == null) return null;
  if (isDate(v)) return Number(String(v).slice(1)); // nilai data bergaya tanggal → angka aslinya
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v).trim();
  if (!s || /^(n\/?a|#n\/a|nat|nan|-+|–)$/i.test(s)) return null;
  // angka yang terketik sebagai teks: "580.370,29" (format Indonesia) atau "12.5"
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
/** Sumber berupa tautan diringkas: docs.google → "Google Sheet internal", bps.go.id → "BPS". */
function sourceLabel(src: string): string {
  if (!/^https?:\/\//i.test(src)) return src;
  if (/docs\.google\.com|drive\.google\.com/i.test(src)) return "Google Sheet internal";
  if (/bps\.go\.id/i.test(src)) return "BPS";
  try {
    return new URL(src).hostname.replace(/^www\./, "");
  } catch {
    return src;
  }
}
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
/** Kunci pencocokan nama kab/kota: tanpa "Kab."/"Kabupaten", "Kepulauan"→"kep", tanpa tanda baca.
 *  Kunci kedua membuang awalan "kep" (mis. "Kep. Siau Tagulandang Biaro" = "Siau Tagulandang Biaro"). */
function nameKeys(n: string): string[] {
  const kota = /^kota\b/i.test(n.trim());
  const base = n.toLowerCase().replace(/^(kab\.?|kabupaten|kota)\s+/, "").replace(/kepulauan/g, "kep").replace(/[^a-z]/g, "");
  const tag = kota ? "kota:" : "kab:";
  const keys = [tag + base];
  if (base.startsWith("kep")) keys.push(tag + base.slice(3));
  return keys;
}

export interface BuildStats {
  sheets: number;
  regions: number;
  desaKab: number;
  skipped: string[];
  ms: number;
}

export async function buildDataset(buf: Uint8Array): Promise<{ data: ProfilData; stats: BuildStats }> {
  const t0 = Date.now();
  const book = openWorkbook(buf, [DESA_SHEET]);
  const regions: ProfilData["regions"] = { "0": { n: "Indonesia", p: 0 } };
  const sheets: Record<string, Sheet> = {};
  const skipped: string[] = [];

  const addRegion = (code: string, prov: string, reg: string) => {
    if (code === "0" || regions[code]) return;
    const n = Number(code);
    const isProv = n % 100 === 0;
    const name = isProv ? prov : reg || prov;
    if (!name) return;
    regions[code] = { n: name, p: isProv ? 0 : Math.floor(n / 100) * 100 };
  };

  for (const name of book.wb.names) {
    if (SKIP.has(name) || name === DESA_SHEET) continue;
    const rows = book.rows(name);
    if (!rows.length) continue;
    const head = rows[0].map((h) => norm(str(h)));
    const iCode = head.indexOf("region_code"), iProv = head.indexOf("province"), iReg = head.indexOf("regency");
    const iItem = head.indexOf("item"), iUnit = head.indexOf("units");
    if (iCode < 0 || iItem < 0 || iUnit < 0) {
      skipped.push(name);
      continue;
    }
    // kolom periode = setelah "units", sampai header kosong
    const pCols: number[] = [];
    const p: string[] = [];
    const labels = periodLabels(rows[0]);
    for (let c = iUnit + 1; c < rows[0].length; c++) {
      const lab = labels[c];
      if (!lab) continue;
      pCols.push(c);
      p.push(lab);
    }
    if (!p.length) {
      skipped.push(name);
      continue;
    }
    const sh: Sheet = { p, u: "", r: {} };
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rc = r[iCode];
      const num = typeof rc === "number" ? Math.round(rc) : Number(str(rc));
      if (!Number.isFinite(num) || num < 0) continue;
      const code = num === NATIONAL || num === 0 ? "0" : String(num);
      addRegion(code, str(r[iProv]), str(r[iReg]));
      if (!sh.u) sh.u = str(r[iUnit]);
      const item = itemName(r[iItem]);
      const vals = pCols.map((c) => cleanValue(r[c]));
      const bucket = (sh.r[code] ??= {});
      const prev = bucket[item];
      // baris ganda (kode+item sama) → isi yang kosong saja
      bucket[item] = prev ? prev.map((v, k) => (v ?? vals[k])) : vals;
    }
    sheets[name] = sh;
  }

  // ── metadata ──
  const meta: ProfilData["meta"] = {};
  const md = book.rows("Metadata");
  if (md.length) {
    const h = md[0].map((x) => norm(str(x)));
    const iN = h.indexOf("nama_data"), iS = h.indexOf("sumber"), iSheet = h.indexOf("nama_sheet");
    for (let i = 1; i < md.length; i++) {
      // nama_sheet di Metadata dicocokkan longgar (mis. "Jalan Kab/Kota" ↔ sheet "Jalan KabKota")
      const raw = str(md[i][iSheet]);
      const sheet = sheets[raw] ? raw : Object.keys(sheets).find((k) => key(k) === key(raw)) ?? raw;
      if (!sheet || meta[sheet]) continue;
      const src = str(md[i][iS]);
      meta[sheet] = { n: str(md[i][iN]) || sheet, s: sourceLabel(src) };
    }
  }

  // ── Indeks Desa (streaming) → ringkas per kab/kota & provinsi ──
  // Kode desa memakai kode Kemendagri yang sering BERBEDA dari kode BPS
  // (mis. Kab. Sikka: Kemendagri 5307, BPS 5310). Karena itu kab/kota
  // dipasangkan lewat NAMA (dalam provinsi yang sama), bukan lewat kode.
  const provByName = new Map<string, string>();
  for (const [c, r] of Object.entries(regions)) if (c !== "0" && +c % 100 === 0) provByName.set(key(r.n), c);
  const kabIndex = new Map<string, string[]>();
  for (const [c, r] of Object.entries(regions)) {
    if (c === "0" || +c % 100 === 0) continue;
    for (const k of nameKeys(r.n)) kabIndex.set(k, [...(kabIndex.get(k) ?? []), c]);
  }
  const provPrefix = new Set([...provByName.values()].map((c) => c.slice(0, 2)));
  const resolved = new Map<string, string | null>(); // "prov|regency" → kode BPS
  const resolve = (provName: string, reg: string): string | null => {
    const id = provName + "|" + reg;
    if (resolved.has(id)) return resolved.get(id)!;
    const provCode = provByName.get(key(provName));
    let hit: string | null = null;
    for (const k of nameKeys(reg)) {
      const cands = kabIndex.get(k) ?? [];
      // utamakan kab/kota yang induknya = provinsi di data desa (mis. Papua Tengah, bukan Papua lama)
      hit = cands.find((c) => provCode && String(regions[c].p) === provCode) ?? (cands.length === 1 ? cands[0] : null);
      if (hit) break;
    }
    resolved.set(id, hit);
    return hit;
  };

  type Acc = { status: number[]; sum: Record<string, number>; cnt: Record<string, number> };
  const acc = new Map<string, Acc>();
  const get = (k: string) => {
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { status: [0, 0, 0, 0, 0], sum: {}, cnt: {} }));
    return a;
  };
  const unmatched = new Set<string>();
  let dIdx: { code: number; prov: number; reg: number; item: number; val: number } | null = null;
  await book.streamRows(DESA_SHEET, (r: Row, rowNum) => {
    if (rowNum === 1) {
      const h = r.map((x) => norm(str(x)));
      dIdx = { code: h.indexOf("region_code"), prov: h.indexOf("province"), reg: h.indexOf("regency"), item: h.indexOf("item"), val: h.length - 1 };
      return;
    }
    const ix = dIdx;
    if (!ix) return;
    const rc = r[ix.code];
    const village = typeof rc === "number" ? rc : Number(str(rc));
    if (!Number.isFinite(village) || !provPrefix.has(String(Math.floor(village / 1e8)))) return;
    const provName = str(r[ix.prov]), reg = str(r[ix.reg]);
    const kab = resolve(provName, reg);
    if (!kab) {
      unmatched.add(`${reg} (${provName})`);
      return;
    }
    const prov = String(regions[kab].p);
    const item = itemName(r[ix.item]);
    const v = r[ix.val];
    for (const target of [kab, prov]) {
      const a = get(target);
      if (item === "Status Indeks Desa") {
        const k = DESA_STATUS.indexOf(str(v).toUpperCase());
        if (k >= 0) a.status[k]++;
      } else if (typeof v === "number") {
        a.sum[item] = (a.sum[item] ?? 0) + v;
        a.cnt[item] = (a.cnt[item] ?? 0) + 1;
      }
    }
  });
  const desa: ProfilData["desa"] = {};
  for (const [k, a] of acc) {
    const dims: Record<string, number> = {};
    for (const it in a.sum) dims[it] = round(a.sum[it] / a.cnt[it], 2);
    desa[k] = { status: a.status, dims };
  }
  if (unmatched.size) skipped.push(...[...unmatched].map((u) => `Indeks Desa: ${u} tidak cocok dengan kab/kota mana pun`));

  return {
    data: { regions, sheets, desa, meta, status: DESA_STATUS },
    stats: { sheets: Object.keys(sheets).length, regions: Object.keys(regions).length, desaKab: acc.size, skipped, ms: Date.now() - t0 },
  };
}
