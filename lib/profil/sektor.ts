// Susunan lapangan usaha PDRB: SEKTOR (A, B, C, … R,S,T,U) → SUB-SEKTOR → RINCIAN.
//
// Sheet PDRB di spreadsheet (ADHB, ADHK, Distribusi ADHB, LPE, LPE Triwulan yoy/qtoq/ctoc,
// Triwulan ADHB, Triwulan ADHK) menaruh sektor, sub-sektor, dan rincian sebagai baris
// `item` yang sejajar. Tanpa susunan ini baris-baris itu tercampur dan terhitung ganda
// (mis. "A Pertanian…" tampil bersama "Tanaman Pangan" yang sudah termasuk di dalamnya).
//
// Aturan:
//   • SEKTOR dikenali dari kode hurufnya ("A …", "M,N …", "R,S,T,U …") — sektor baru
//     di spreadsheet otomatis ikut.
//   • SUB-SEKTOR & RINCIAN dikenali dari daftar di bawah (ejaan/huruf besar-kecil bebas).
//     Nilai sektor SELALU diambil dari baris sektornya sendiri di spreadsheet; sub-sektor
//     tidak pernah dijumlahkan menjadi sektor (laju pertumbuhan tidak bisa dijumlah).
//   • Sektor A bertingkat tiga: "Pertanian, Peternakan, Perburuan, dan Jasa Pertanian"
//     adalah sub-sektor yang masih punya rincian (tanaman pangan, hortikultura, …).
//   • Baris TOTAL (PDB/PDRB, Nilai Tambah Bruto, Pajak Dikurang Subsidi) dan SUBTOTAL
//     ("Industri Pengolahan Non Migas") bukan sektor/sub-sektor — tidak ikut ditampilkan
//     sebagai lapangan usaha.

import type { Fmt } from "./format";
import { pct2 } from "./format";

export const PDB = "Produk Domestik Bruto";

/** Baris total: PDRB = NTB atas harga dasar (Σ 17 sektor) + pajak dikurang subsidi atas produk. */
export const TOTAL_ITEMS = [PDB, "Nilai Tambah Bruto Atas Harga Dasar", "Pajak Dikurang Subsidi Atas Produk"];
/** Subtotal di dalam sektor (sudah tercakup oleh sub-sektornya). */
export const SUBTOTAL_ITEMS = ["Industri Pengolahan Non Migas"];

type Sub = string | { sub: string; rincian: string[] };

/** Sektor → sub-sektor (→ rincian). Urutan = urutan baku KBLI. */
const SUSUNAN: [sektor: string, sub: Sub[]][] = [
  [
    "A Pertanian, Kehutanan, dan Perikanan",
    [
      {
        sub: "Pertanian, Peternakan, Perburuan, dan Jasa Pertanian",
        rincian: ["Tanaman Pangan", "Tanaman Hortikultura", "Tanaman Perkebunan", "Peternakan", "Jasa Pertanian dan Perburuan"],
      },
      "Kehutanan dan Penebangan Kayu",
      "Perikanan",
    ],
  ],
  [
    "B Pertambangan dan Penggalian",
    ["Pertambangan Minyak, Gas, dan Panas Bumi", "Pertambangan Batubara dan Lignit", "Pertambangan Bijih Logam", "Pertambangan dan Penggalian Lainnya"],
  ],
  [
    "C Industri Pengolahan",
    [
      "Industri Batubara dan Pengilangan Migas",
      "Industri Makanan dan Minuman",
      "Industri Pengolahan Tembakau",
      "Industri Tekstil dan Pakaian Jadi",
      "Industri Kulit, Barang dari Kulit, dan Alas Kaki",
      "Industri Kayu, Barang dari Kayu dan Gabus; dan Barang Anyaman dari Bambu, Rotan, dan Sejenisnya",
      "Industri Kertas dan Barang dari Kertas; Percetakan dan Reproduksi Media Rekaman",
      "Industri Kimia, Farmasi, dan Obat Tradisional",
      "Industri Karet; Barang dari Karet dan Plastik",
      "Industri Barang Galian bukan Logam",
      "Industri Logam Dasar",
      "Industri Barang Logam; Komputer, Barang Elektronik, Optik; dan Peralatan Listrik",
      "Industri Mesin dan Perlengkapan",
      "Industri Alat Angkutan",
      "Industri Furnitur",
      "Industri Pengolahan Lainnya; Jasa Reparasi dan Pemasangan Mesin dan Peralatan",
    ],
  ],
  ["D Pengadaan Listrik dan Gas", ["Ketenagalistrikan", "Pengadaan Gas dan Produksi Es"]],
  ["E Pengadaan Air; Pengelolaan Sampah, Limbah, dan Daur Ulang", []],
  ["F Konstruksi", []],
  [
    "G Perdagangan Besar dan Eceran; Reparasi Mobil dan Sepeda Motor",
    ["Perdagangan Mobil, Sepeda Motor dan Reparasinya", "Perdagangan Besar dan Eceran, Bukan Mobil dan Sepeda Motor"],
  ],
  [
    "H Transportasi dan Pergudangan",
    ["Angkutan Rel", "Angkutan Darat", "Angkutan Laut", "Angkutan Sungai, Danau, dan Penyeberangan", "Angkutan Udara", "Pergudangan dan Jasa Penunjang Angkutan; Pos dan Kurir"],
  ],
  ["I Penyediaan Akomodasi dan Makan Minum", ["Penyediaan Akomodasi", "Penyediaan Makan Minum"]],
  ["J Informasi dan Komunikasi", []],
  ["K Jasa Keuangan dan Asuransi", ["Jasa Perantara Keuangan", "Asuransi dan Dana Pensiun", "Jasa Keuangan Lainnya", "Jasa Penunjang Keuangan"]],
  ["L Real Estat", []],
  ["M,N Jasa Perusahaan", []],
  ["O Administrasi Pemerintahan, Pertahanan, dan Jaminan Sosial Wajib", []],
  ["P Jasa Pendidikan", []],
  ["Q Jasa Kesehatan dan Kegiatan Sosial", []],
  ["R,S,T,U Jasa Lainnya", []],
];

const KODE_RE = /^([A-U](?:,[A-U])*)\s+(.+)$/;
const kunci = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Kode huruf sektor ("A", "M,N", "R,S,T,U") atau null bila bukan baris sektor. */
export const kodeSektor = (item: string): string | null => KODE_RE.exec(item.trim())?.[1] ?? null;
export const isSektor = (item: string) => kodeSektor(item) !== null;
/** Nama tanpa kode huruf, sedikit diringkas untuk label. */
export const namaSektor = (item: string) =>
  (KODE_RE.exec(item.trim())?.[2] ?? item)
    .replace(/ Mo$/, " Motor")
    .replace(/\s+$/, "");

export interface SektorNode {
  /** nama baris `item` persis seperti di spreadsheet */
  item: string;
  label: string;
  /** kode huruf (hanya sektor) */
  kode?: string;
  /** 0 = sektor, 1 = sub-sektor, 2 = rincian */
  level: 0 | 1 | 2;
  children: SektorNode[];
}

const URUT = new Map(SUSUNAN.map(([s], i) => [kodeSektor(s)!, i]));
const SUB_BY_KODE = new Map(SUSUNAN.map(([s, sub]) => [kodeSektor(s)!, sub]));
const ABAIKAN = new Set([...TOTAL_ITEMS, ...SUBTOTAL_ITEMS].map(kunci));

/**
 * Susun baris-baris `item` yang tersedia menjadi pohon sektor → sub-sektor → rincian.
 * Hanya baris yang benar-benar ada di data yang masuk pohon. `lain` = baris yang tidak
 * dikenali (bukan sektor, bukan sub-sektor terdaftar, bukan total) — untuk diperiksa.
 */
export function susunSektor(items: string[]): { sektor: SektorNode[]; lain: string[] } {
  const ada = new Map(items.filter((i) => i.trim()).map((i) => [kunci(i), i]));
  const terpakai = new Set<string>();
  const ambil = (nama: string): string | null => {
    const k = kunci(nama);
    const it = ada.get(k);
    if (it) terpakai.add(k);
    return it ?? null;
  };

  const sektor: SektorNode[] = [];
  for (const it of ada.values()) {
    const kode = kodeSektor(it);
    if (!kode) continue;
    terpakai.add(kunci(it));
    const children: SektorNode[] = [];
    for (const s of SUB_BY_KODE.get(kode) ?? []) {
      const nama = typeof s === "string" ? s : s.sub;
      const item = ambil(nama);
      const rincian: SektorNode[] = [];
      if (typeof s !== "string")
        for (const r of s.rincian) {
          const ri = ambil(r);
          if (ri) rincian.push({ item: ri, label: ri, level: 2, children: [] });
        }
      if (item) children.push({ item, label: item, level: 1, children: rincian });
      // sub-sektor induknya tak ada di data tetapi rinciannya ada → naikkan rinciannya
      else children.push(...rincian.map((r) => ({ ...r, level: 1 as const })));
    }
    sektor.push({ item: it, label: namaSektor(it), kode, level: 0, children });
  }
  sektor.sort((a, b) => (URUT.get(a.kode!) ?? 99) - (URUT.get(b.kode!) ?? 99) || a.kode!.localeCompare(b.kode!));
  const lain = [...ada.entries()].filter(([k]) => !terpakai.has(k) && !ABAIKAN.has(k)).map(([, v]) => v);
  return { sektor, lain };
}

const SAUDARA = new Map<string, string[]>();
for (const [, subs] of SUSUNAN) {
  const grup = subs.map((s) => (typeof s === "string" ? s : s.sub));
  for (const g of grup) SAUDARA.set(kunci(g), grup);
  for (const s of subs) if (typeof s !== "string") for (const r of s.rincian) SAUDARA.set(kunci(r), s.rincian);
}
/**
 * Sub-sektor/rincian yang seinduk dengan `item` (termasuk dirinya), atau null bila `item`
 * bukan sub-sektor/rincian terdaftar. Dipakai agregat kawasan: provinsi yang punya
 * saudara-saudaranya tetapi tidak punya baris ini berarti kegiatannya memang tidak ada (= 0),
 * mis. "Angkutan Rel" di luar Sulawesi Selatan.
 */
export const saudaraSektor = (item: string): string[] | null => SAUDARA.get(kunci(item)) ?? null;

// ── ukuran yang bisa dipilih di kartu "Lapangan usaha" ──
export type JenisUkuran = "porsi" | "nilai" | "laju";
export interface UkuranSektor {
  id: string;
  label: string;
  /** nama sheet di spreadsheet */
  s: string;
  jenis: JenisUkuran;
  f: Fmt;
  /** filter periode (sheet triwulanan memuat juga kolom tahunan) */
  pf?: RegExp;
  d: string;
}
const TRIWULAN = /^T[1-4]\s/;
const rp: Fmt = { rp: true };
export const UKURAN_SEKTOR: UkuranSektor[] = [
  { id: "distribusi", label: "Distribusi PDRB (%)", s: "Distribusi ADHB", jenis: "porsi", f: pct2, d: "Porsi tiap lapangan usaha dalam PDRB atas dasar harga berlaku." },
  { id: "adhb", label: "PDRB harga berlaku (ADHB)", s: "ADHB", jenis: "nilai", f: rp, d: "Nilai tambah tiap lapangan usaha atas dasar harga berlaku, per tahun." },
  { id: "adhk", label: "PDRB harga konstan (ADHK)", s: "ADHK", jenis: "nilai", f: rp, d: "Nilai tambah tiap lapangan usaha atas dasar harga konstan 2010, per tahun." },
  { id: "lpe", label: "Laju pertumbuhan tahunan (LPE)", s: "LPE", jenis: "laju", f: pct2, d: "Pertumbuhan nilai tambah harga konstan dibanding tahun sebelumnya." },
  { id: "tw_adhb", label: "Triwulanan · PDRB ADHB", s: "Triwulan ADHB", jenis: "nilai", f: rp, pf: TRIWULAN, d: "Nilai tambah harga berlaku per triwulan." },
  { id: "tw_adhk", label: "Triwulanan · PDRB ADHK", s: "Triwulan ADHK", jenis: "nilai", f: rp, pf: TRIWULAN, d: "Nilai tambah harga konstan 2010 per triwulan." },
  { id: "tw_yoy", label: "Triwulanan · pertumbuhan y-on-y", s: "LPE Triwulan (yoy)", jenis: "laju", f: pct2, pf: TRIWULAN, d: "Pertumbuhan dibanding triwulan yang sama tahun lalu." },
  { id: "tw_qtoq", label: "Triwulanan · pertumbuhan q-to-q", s: "LPE Triwulan (qtoq)", jenis: "laju", f: pct2, pf: TRIWULAN, d: "Pertumbuhan dibanding triwulan sebelumnya (wajar naik-turun mengikuti musim)." },
  { id: "tw_ctoc", label: "Triwulanan · pertumbuhan c-to-c", s: "LPE Triwulan (ctoc)", jenis: "laju", f: pct2, pf: TRIWULAN, d: "Pertumbuhan kumulatif sejak awal tahun dibanding periode yang sama tahun lalu." },
];
/** Sheet-sheet yang barisnya berupa lapangan usaha. */
export const SHEET_SEKTOR = new Set(UKURAN_SEKTOR.map((u) => u.s));

/**
 * Selisih yang masih wajar antara nilai induk dan jumlah anak-anaknya (pembulatan 2 desimal
 * per baris + 2% untuk angka sementara). Di atas ini rincian dianggap tidak cocok.
 */
export function rincianCocok(induk: number, anak: number[]): boolean {
  if (!anak.length) return true;
  const jumlah = anak.reduce((a, b) => a + b, 0);
  return Math.abs(jumlah - induk) <= Math.max(Math.abs(induk) * 0.02, 0.006 * (anak.length + 1));
}
