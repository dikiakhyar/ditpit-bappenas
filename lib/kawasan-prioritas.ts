// Kawasan Prioritas Provinsi — RPJMN 2025–2029.
// Sumber: Google Spreadsheet "Daftar_Kawasan_Provinsi_RPJMN_2025-2029" sheet "Daftar Kawasan"
// (dibaca server lewat /api/kawasan-prioritas; cadangan public/data/kawasan-prioritas.json).
// Satu baris spreadsheet = satu lokasi bernomor (A1, B2, …) pada peta provinsi PPT RPJMN.
//
// File ini dipakai server & browser: mengubah baris spreadsheet → entri berkode wilayah BPS,
// lalu → titik simbol (bulatan per kategori) di tiap kab/kota.

import { MAP_KAB_CODES, MAP_PROV_CODES } from "./peta-wilayah";
import { namaWilayah } from "./wilayah";

export type KatId = "A" | "B" | "C" | "D" | "E";

export interface Kategori {
  id: KatId;
  nama: string;
  /** isian bulatan (warna pastel seperti di PPT) */
  fill: string;
  /** garis tepi bulatan — lebih gelap agar tetap terbaca di atas warna choropleth */
  stroke: string;
}

// warna mengikuti legenda peta provinsi RPJMN (PPT), sedikit dipertegas untuk layar
export const KATEGORI: readonly Kategori[] = [
  { id: "A", nama: "Kawasan Pertumbuhan", fill: "#9fd4f2", stroke: "#2475b0" },
  { id: "B", nama: "Kawasan Komoditas Unggulan", fill: "#f9c8a4", stroke: "#bd5d22" },
  { id: "C", nama: "Kawasan Swasembada Pangan, Air, dan Energi", fill: "#bde6b3", stroke: "#3b8a3b" },
  { id: "D", nama: "Kawasan Afirmasi", fill: "#ffcf40", stroke: "#a87800" },
  { id: "E", nama: "Kawasan Konservasi dan Rawan Bencana", fill: "#f1bbe6", stroke: "#a1418f" },
];
export const KAT_IDS: KatId[] = KATEGORI.map((k) => k.id);
export const katOf = (id: string) => KATEGORI.find((k) => k.id === id);

// ── data mentah (kolom baku) ─────────────────────────────────────────────
/** Urutan kolom baku yang dikirim /api/kawasan-prioritas & disimpan di salinan lokal. */
export const KP_COLUMNS = ["No", "Provinsi", "Kategori Kawasan", "Kode", "Kelompok / Nama Kawasan", "Sub-Kelompok", "Nama Lokasi / Uraian", "Kabupaten/Kota", "Keterangan / Potensi"] as const;

export interface KawasanSource {
  kind: "spreadsheet" | "snapshot";
  fetchedAt: string;
  sheetUrl: string;
  note?: string;
}
export interface KawasanRaw {
  source: KawasanSource;
  columns: readonly string[];
  rows: string[][];
}

const low = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Baris sheet apa adanya (judul, catatan, header, data) → kolom baku.
 * Header dicari otomatis (baris yang memuat "Kode" dan "Kabupaten/Kota"), sehingga
 * urutan/penambahan kolom di spreadsheet tidak merusak pembacaan.
 */
export function toCanonical(sheet: string[][]): string[][] {
  const hi = sheet.findIndex((r) => r.some((c) => low(c) === "kode") && r.some((c) => low(c).startsWith("kabupaten")));
  if (hi < 0) return [];
  const head = sheet[hi].map(low);
  const find = (pred: (h: string) => boolean) => head.findIndex(pred);
  const idx = [
    find((h) => h === "no"),
    find((h) => h === "provinsi"),
    find((h) => h.startsWith("kategori")),
    find((h) => h === "kode"),
    find((h) => h.startsWith("kelompok")),
    find((h) => h.startsWith("sub")),
    find((h) => h.includes("lokasi")),
    find((h) => h.startsWith("kabupaten")),
    find((h) => h.startsWith("keterangan")),
  ];
  const out: string[][] = [];
  for (const r of sheet.slice(hi + 1)) {
    const row = idx.map((i) => (i >= 0 ? String(r[i] ?? "").replace(/\s+/g, " ").trim() : ""));
    if (!row[3] || !row[1]) continue; // tanpa kode / provinsi = bukan baris data
    out.push(row);
  }
  return out;
}

// ── entri berkode wilayah ────────────────────────────────────────────────
export interface KawasanEntry {
  no: number;
  /** kode BPS provinsi (4 digit, mis. "7100") */
  prov: string;
  kat: KatId;
  /** kode lokasi pada peta PPT, mis. "A1" */
  kode: string;
  kelompok: string;
  sub: string;
  lokasi: string;
  /** teks kab/kota asli dari spreadsheet */
  kabText: string;
  ket: string;
  /** kode BPS kab/kota yang tercakup (bisa lebih dari satu) */
  kab: string[];
  /** true bila tidak menunjuk kab/kota tertentu (mis. "10 Kab. di Provinsi NTT") → ditandai di provinsi */
  provLevel: boolean;
}

export interface KawasanData {
  entries: KawasanEntry[];
  source: KawasanSource;
  /** teks kab/kota yang tidak dikenali (untuk diperiksa di spreadsheet) */
  unmatched: string[];
}

const PROV_BY_KEY = new Map<string, string>(MAP_PROV_CODES.map((c) => [slug(namaWilayah(c)), c]));

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\bdan\b/g, "").replace(/[^a-z0-9]/g, "");
}

type KabKey = { kota: boolean; name: string };
function kabKey(s: string): KabKey {
  const t = s.trim().toLowerCase();
  const kota = /^kota\b/.test(t);
  return { kota, name: slug(t.replace(/^(kabupaten|kab\.?|kota)\s*/, "")) };
}

// indeks kab/kota per provinsi: [kode, key]
const KAB_INDEX = new Map<string, { code: string; key: KabKey }[]>();
for (const c of MAP_KAB_CODES) {
  const p = c.slice(0, 2) + "00";
  if (!KAB_INDEX.has(p)) KAB_INDEX.set(p, []);
  KAB_INDEX.get(p)!.push({ code: c, key: kabKey(namaWilayah(c)) });
}

/** Cocokkan satu nama kab/kota (mis. "Kota Pare-Pare", "Kab. Toli-Toli") ke kode BPS di provinsinya. */
function matchKab(prov: string, text: string): string | null {
  const list = KAB_INDEX.get(prov) ?? [];
  const k = kabKey(text);
  if (!k.name) return null;
  const same = list.filter((x) => x.key.name === k.name);
  const exact = same.find((x) => x.key.kota === k.kota);
  if (exact) return exact.code;
  if (same.length === 1) return same[0].code; // jenis tertukar (mis. "Kab. Tidore Kepulauan" = Kota)
  // nama sebagian (mis. "Kepulauan Siau Tagulandang Biaro" ↔ "Siau Tagulandang Biaro")
  const part = list.filter((x) => x.key.kota === k.kota && x.key.name.length >= 4 && (x.key.name.includes(k.name) || k.name.includes(x.key.name)));
  return part.length === 1 ? part[0].code : null;
}

/** "Kab. Sigi dan Kab. Poso", "Kab. A, Kab. B, dan Kab. C" → daftar nama. "Pangkajene dan Kepulauan" tidak dipecah. */
function splitKab(text: string): string[] {
  return text
    .split(/\s*,\s*(?:dan\s+)?|\s+dan\s+(?=(?:kab\.?|kabupaten|kota)\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseKawasan(raw: KawasanRaw): KawasanData {
  const entries: KawasanEntry[] = [];
  const unmatched: string[] = [];
  for (const r of raw.rows) {
    const [no, provNama, katText, kode, kelompok, sub, lokasi, kabText, ket] = r;
    const prov = PROV_BY_KEY.get(slug(provNama ?? ""));
    const letter = (/^[A-E]/i.exec(kode ?? "")?.[0] ?? /^[A-E]/i.exec(katText ?? "")?.[0] ?? "").toUpperCase();
    if (!prov || !letter) {
      unmatched.push(`${provNama} · ${kode} · ${kabText}`);
      continue;
    }
    const kab: string[] = [];
    for (const part of splitKab(kabText ?? "")) {
      const c = matchKab(prov, part);
      if (c) {
        if (!kab.includes(c)) kab.push(c);
      } else if (/^(kab|kota)/i.test(part)) unmatched.push(`${provNama}: ${part}`);
    }
    entries.push({
      no: Number(no) || entries.length + 1,
      prov,
      kat: letter as KatId,
      kode: kode.toUpperCase(),
      kelompok: kelompok || "",
      sub: sub || "",
      lokasi: lokasi || "",
      kabText: kabText || "",
      ket: ket || "",
      kab,
      provLevel: kab.length === 0,
    });
  }
  return { entries, source: raw.source, unmatched };
}

/** Judul ringkas entri: nama lokasi, sub-kelompok, atau kelompok. */
export const entryTitle = (e: KawasanEntry) => e.lokasi || e.sub || e.kelompok || e.ket || e.kabText;

/** Entri di dalam cakupan wilayah: null = semua; kode provinsi; kode kab/kota. */
export function entriesIn(entries: KawasanEntry[], kode: string | null): KawasanEntry[] {
  if (!kode) return entries;
  if (Number(kode) % 100 === 0) return entries.filter((e) => e.prov === kode);
  return entries.filter((e) => e.kab.includes(kode));
}

// ── titik simbol peta ────────────────────────────────────────────────────
export interface KpProps {
  /** kode wilayah tempat bulatan (kab/kota, atau provinsi untuk entri lingkup provinsi) */
  w: string;
  /** 2 digit provinsi — untuk filter fokus */
  p: string;
  kat: KatId;
  /** jumlah entri kategori ini di wilayah tsb */
  n: number;
  /** posisi dalam jajaran: "<jumlah bulatan>-<urutan>", mis. "3-1" */
  slot: string;
}
export interface KpFeature {
  type: "Feature";
  properties: KpProps;
  geometry: { type: "Point"; coordinates: [number, number] };
}

/** Diameter bulatan (px pada icon-size 1) & jarak antarbulatan. */
export const KP_DIAM = 22;
const STEP = 19; // < diameter → bulatan sedikit bertumpuk seperti "chip"
const LIFT = -13; // sedikit di atas titik label agar nama wilayah tetap terbaca
/** rasio ukuran huruf terhadap icon-size (harus sama dengan gaya layer di peta) */
export const KP_TEXT_RATIO = 11;
export const KP_COUNT_RATIO = 8;

/**
 * Ekspresi MapLibre offset tiap bulatan menurut "slot"-nya. (Properti GeoJSON berupa array
 * diubah jadi teks oleh MapLibre, jadi offset dipilih lewat `match` dari daftar tetap.)
 * icon → px (× icon-size), text/count → em (× ukuran huruf) — keduanya ikut membesar bersama zoom.
 */
export function kpOffsetExpr(kind: "icon" | "text" | "count"): unknown {
  const cases: unknown[] = [];
  for (let m = 1; m <= KAT_IDS.length; m++)
    for (let i = 0; i < m; i++) {
      const x = (i - (m - 1) / 2) * STEP;
      const v: [number, number] =
        kind === "icon" ? [x, LIFT] : kind === "text" ? [x / KP_TEXT_RATIO, LIFT / KP_TEXT_RATIO] : [(x + 8) / KP_COUNT_RATIO, (LIFT - 9) / KP_COUNT_RATIO];
      cases.push(`${m}-${i}`, ["literal", v.map((n) => +n.toFixed(3))]);
    }
  return ["match", ["get", "slot"], ...cases, ["literal", [0, 0]]];
}

/**
 * Satu bulatan per (wilayah × kategori) yang ditampilkan. Bulatan satu wilayah dijajarkan
 * mendatar di atas titik label; jumlah entri (>1) ditulis kecil di pojok kanan atas.
 */
export function kpFeatures(entries: KawasanEntry[], points: Map<string, [number, number]>, visible: ReadonlySet<KatId>) {
  const cnt = new Map<string, Map<KatId, number>>(); // wilayah → kategori → jumlah
  const add = (w: string, k: KatId) => {
    if (!cnt.has(w)) cnt.set(w, new Map());
    const m = cnt.get(w)!;
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  for (const e of entries) {
    if (!visible.has(e.kat)) continue;
    if (e.provLevel) add(e.prov, e.kat);
    else for (const k of e.kab) add(k, e.kat);
  }
  const features: KpFeature[] = [];
  for (const [w, m] of cnt) {
    const pt = points.get(w);
    if (!pt) continue;
    const kats = KAT_IDS.filter((k) => m.has(k));
    kats.forEach((kat, i) => {
      features.push({
        type: "Feature",
        properties: { w, p: w.slice(0, 2), kat, n: m.get(kat)!, slot: `${kats.length}-${i}` },
        geometry: { type: "Point", coordinates: pt },
      });
    });
  }
  return { type: "FeatureCollection" as const, features };
}
