// Katalog bagian & kartu Profil Daerah. Menambah indikator = tambah entri di
// CARDS (sheet + item dari public/data/profil.json); kartu, grafik, peringkat,
// dan fallback ke angka provinsi ikut otomatis.

import type { ReactNode } from "react";
import type { Better, Engine } from "./engine";
import { fmt, idx2, pct1, pct2, type Fmt } from "./format";

export interface SectionDef {
  id: string;
  title: string;
  icon: string;
  desc: string;
}

interface Base {
  sec: string;
  wide?: boolean;
}
export interface MetricDef extends Base {
  t: "metric";
  s: string;
  i: string;
  title: string;
  d: string;
  f: Fmt;
  b: Better;
  g?: boolean; // selisih ditampilkan sebagai % pertumbuhan
  zero?: boolean; // sumbu y selalu memuat 0
  lvl?: boolean; // nilai level (tak dibandingkan dgn provinsi/nasional di tren)
  nocmp?: boolean;
  pf?: RegExp; // filter periode
  cat?: string; // item kategori pendamping (chip)
  extra?: (E: Engine, code: string) => ReactNode;
}
export interface ComposeDef extends Base {
  t: "compose";
  s: string;
  title: string;
  d: string;
  f: Fmt;
  ex?: string[];
  order?: string[];
  lab?: (s: string) => string;
  top?: number;
  sort?: boolean;
  nocmp?: boolean;
  extra?: (E: Engine, code: string) => ReactNode;
}
export interface MultiDef extends Base {
  t: "multi";
  title: string;
  d: string;
  f: Fmt;
  srcs: [sheet: string, item: string, label: string][];
}
export interface StackDef extends Base {
  t: "stack";
  s: string;
  title: string;
  d: string;
  rows: string[];
  cats: { key: string; name: string; color: string; fg: string }[];
  key: (row: string, cat: string) => string;
  sub?: (E: Engine, code: string, row: string) => string;
  counts?: string;
}
export interface SpecialDef extends Base {
  t: "apbd" | "desa" | "ipp" | "commod" | "wisata" | "sektor";
}
export type CardDef = MetricDef | ComposeDef | MultiDef | StackDef | SpecialDef;

export const SECTIONS: SectionDef[] = [
  { id: "fiskal", title: "Keuangan Daerah", icon: "wallet", desc: "Postur APBD 2025: pendapatan menurut sumbernya, belanja menurut peruntukannya, dan kemandirian fiskal terhadap transfer pusat." },
  { id: "ekonomi", title: "Ekonomi", icon: "chart", desc: "PDRB, pertumbuhan, struktur sektor, dan nilai tukar petani." },
  { id: "investasi", title: "Investasi", icon: "trending", desc: "Realisasi investasi PMA dan PMDN per tahun serta sebarannya menurut sektor KBLI." },
  { id: "sejahtera", title: "Kesejahteraan", icon: "users", desc: "Kemiskinan, pengangguran, ketimpangan, dan pembangunan manusia." },
  { id: "kesehatan", title: "Kesehatan", icon: "heart", desc: "Stunting, harapan hidup, jaminan kesehatan, imunisasi, serta tenaga dan fasilitas kesehatan." },
  { id: "pendidikan", title: "Pendidikan", icon: "book", desc: "Lama sekolah, partisipasi, putus sekolah, kondisi ruang kelas, dan kualifikasi guru." },
  { id: "infra", title: "Infrastruktur & Layanan Dasar", icon: "bolt", desc: "Akses rumah tangga ke air minum, sanitasi, listrik, jalan, sinyal, dan pengelolaan sampah." },
  { id: "desa", title: "Desa", icon: "home", desc: "Status Indeks Desa 2025 seluruh desa di wilayah ini dan skor rata-rata per dimensi." },
  { id: "lingkungan", title: "Lingkungan & Pangan", icon: "leaf", desc: "Kualitas lingkungan hidup, risiko bencana, dan ketahanan pangan." },
  { id: "tatakelola", title: "Tata Kelola", icon: "landmark", desc: "Pelayanan publik, integritas, keterbukaan informasi, dan pembangunan ekonomi inklusif." },
  { id: "potensi", title: "Potensi Unggulan", icon: "package", desc: "Produksi komoditas unggulan dan fasilitas pariwisata." },
];

const th = (d = 2): Fmt => ({ d, suf: " th", du: " th" });
const x100: Fmt = { k: 100, d: 1, suf: " %" };

export const CARDS: CardDef[] = [
  // ── fiskal
  { sec: "fiskal", t: "apbd", wide: true },
  { sec: "fiskal", t: "metric", s: "Rasio Fiskal", i: "PAD/Pendapatan", title: "Kemandirian fiskal (PAD ÷ pendapatan)", d: "Porsi pendapatan asli daerah dalam total pendapatan. Makin tinggi, makin kecil ketergantungan pada transfer pusat.", f: pct1, b: "up" },
  { sec: "fiskal", t: "metric", s: "Rasio Fiskal", i: "Pegawai/Belanja", title: "Porsi belanja pegawai", d: "Belanja pegawai dibanding total belanja daerah. Makin besar, makin sempit ruang belanja pembangunan.", f: pct1, b: "down" },
  { sec: "fiskal", t: "metric", s: "Kapasitas Fiskal", i: "RFKD", title: "Rasio Kapasitas Fiskal Daerah", d: "RKFD dan kategorinya menurut Kementerian Keuangan.", f: { d: 3 }, b: "up", cat: "Kategori RKFD" },
  // ── ekonomi
  { sec: "ekonomi", t: "metric", s: "LPE", i: "Produk Domestik Bruto", title: "Laju pertumbuhan ekonomi", d: "Pertumbuhan PDRB atas dasar harga konstan, persen per tahun.", f: pct2, b: "up", zero: true },
  { sec: "ekonomi", t: "metric", s: "ADHB", i: "Produk Domestik Bruto", title: "PDRB atas dasar harga berlaku", d: "Nilai total PDRB atas dasar harga berlaku.", f: { rp: true }, b: "up", g: true, lvl: true },
  { sec: "ekonomi", t: "metric", s: "ADHB Per Kapita", i: "", title: "PDRB per kapita", d: "PDRB per kapita atas dasar harga berlaku, per tahun.", f: { k: 0.001, pre: "Rp ", suf: " jt", d: 1, du: " jt" }, b: "up", g: true },
  // sektor (A–U) → sub-sektor → rincian dari 9 sheet PDRB; susunannya di lib/profil/sektor.ts
  { sec: "ekonomi", t: "sektor", wide: true },
  { sec: "ekonomi", t: "metric", s: "Kontribusi PDRB", i: "", title: "Kontribusi PDRB", d: "Kab/kota: porsi terhadap PDRB provinsi. Provinsi: porsi terhadap PDB nasional.", f: pct2, b: "up", nocmp: true },
  { sec: "ekonomi", t: "metric", s: "LPE Triwulan (yoy)", i: "Produk Domestik Bruto", title: "Pertumbuhan triwulanan (y-on-y)", d: "Pertumbuhan PDRB triwulanan dibanding triwulan yang sama tahun lalu.", f: pct2, b: "up", pf: /^T/, zero: true },
  { sec: "ekonomi", t: "metric", s: "LPE Triwulan (qtoq)", i: "Produk Domestik Bruto", title: "Pertumbuhan triwulanan (q-to-q)", d: "Pertumbuhan PDRB dibanding triwulan sebelumnya. Wajar naik-turun mengikuti musim.", f: pct2, b: "up", pf: /^T/, zero: true },
  { sec: "ekonomi", t: "metric", s: "LPE Triwulan (ctoc)", i: "Produk Domestik Bruto", title: "Pertumbuhan kumulatif (c-to-c)", d: "Pertumbuhan PDRB kumulatif sejak awal tahun dibanding periode yang sama tahun lalu.", f: pct2, b: "up", pf: /^T/, zero: true },
  { sec: "ekonomi", t: "metric", s: "NTP", i: "Petani", title: "Nilai Tukar Petani (NTP)", d: "2018 = 100. Di atas 100: harga yang diterima petani naik lebih cepat daripada harga yang dibayar.", f: idx2, b: "up" },
  // ── investasi
  { sec: "investasi", t: "metric", s: "Realisasi Investasi", i: "Realisasi Investasi (Juta Rupiah)", title: "Realisasi investasi (PMA + PMDN)", d: "Nilai realisasi investasi per tahun.", f: { k: 0.001, rp: true }, b: "up", g: true, lvl: true },
  { sec: "investasi", t: "compose", s: "Investasi Per Sektor", title: "Investasi menurut sektor", d: "Delapan sektor terbesar menurut nilai realisasi pada tahun terakhir.", f: { k: 0.001, rp: true }, ex: ["Total"], lab: (s) => s.replace(/^\d+\s*-\s*/, ""), top: 8, nocmp: true },
  // ── kesejahteraan
  { sec: "sejahtera", t: "metric", s: "Kemiskinan", i: "Persentase Penduduk Miskin", title: "Persentase penduduk miskin", d: "Penduduk di bawah garis kemiskinan.", f: pct2, b: "down" },
  { sec: "sejahtera", t: "metric", s: "Kemiskinan", i: "Jumlah Penduduk Miskin", title: "Jumlah penduduk miskin", d: "Dalam ribu jiwa.", f: { d: 2, suf: " rb", du: " rb" }, b: "down", lvl: true },
  { sec: "sejahtera", t: "metric", s: "Kemiskinan", i: "Garis Kemiskinan", title: "Garis kemiskinan", d: "Pengeluaran minimum per kapita per bulan agar tidak tergolong miskin.", f: { pre: "Rp ", d: 0 }, b: 0, g: true },
  { sec: "sejahtera", t: "metric", s: "TPT", i: "Tingkat Pengangguran Terbuka (TPT)", title: "Tingkat pengangguran terbuka (TPT)", d: "Persentase angkatan kerja yang tidak bekerja dan sedang mencari kerja.", f: pct2, b: "down" },
  { sec: "sejahtera", t: "metric", s: "TPT", i: "Tingkat Partisipasi Angkatan Kerja (TPAK)", title: "Partisipasi angkatan kerja (TPAK)", d: "Persentase penduduk usia kerja yang masuk angkatan kerja.", f: pct2, b: "up" },
  { sec: "sejahtera", t: "metric", s: "Rasio Gini", i: "", title: "Rasio Gini", d: "0 = merata sempurna, 1 = timpang sempurna.", f: { d: 3 }, b: "down" },
  { sec: "sejahtera", t: "metric", s: "IPM", i: "", title: "Indeks Pembangunan Manusia (IPM)", d: "Metode baru, UHH hasil Long Form SP2020.", f: idx2, b: "up" },
  // ── kesehatan
  { sec: "kesehatan", t: "metric", s: "Stunting", i: "Stunting", title: "Prevalensi stunting balita", d: "Balita pendek dan sangat pendek.", f: pct1, b: "down" },
  { sec: "kesehatan", t: "metric", s: "UHH", i: "", title: "Umur harapan hidup", d: "Umur harapan hidup saat lahir.", f: th(), b: "up" },
  { sec: "kesehatan", t: "compose", s: "Kepemilikan Jaskes", title: "Kepemilikan jaminan kesehatan", d: "Persentase penduduk menurut jenis jaminan kesehatan.", f: pct1, order: ["BPJS Kesehatan Penerima Bantuan Iuran (PBI)", "BPJS Kesehatan Non-Penerima Bantuan Iuran (Non-PBI)", "Jamkesda", "Perusahaan/Kantor", "Asuransi Swasta"] },
  { sec: "kesehatan", t: "metric", s: "Puskesmas dg Dok", i: "% Puskesmas dengan Dokter", title: "Puskesmas dengan dokter", d: "Persentase puskesmas yang memiliki dokter.", f: x100, b: "up" },
  { sec: "kesehatan", t: "metric", s: "Kelengkapan Nakes Puskes", i: "% Puskesmas Lengkap", title: "Puskesmas dengan 9 jenis nakes lengkap", d: "Persentase puskesmas dengan sembilan jenis tenaga kesehatan lengkap.", f: x100, b: "up" },
  { sec: "kesehatan", t: "compose", s: "Nakes Prioritas", title: "Tenaga kesehatan prioritas", d: "Jumlah tenaga kesehatan prioritas di RS dan puskesmas (orang).", f: { d: 0 }, lab: (s) => ({ ATLM: "Ahli teknologi lab. medik", BIDAN: "Bidan", DOKTER: "Dokter", "DOKTER GIGI": "Dokter gigi", FARMASI: "Farmasi", GIZI: "Nutrisionis", KESLING: "Kesehatan lingkungan", KESMAS: "Kesehatan masyarakat", PERAWAT: "Perawat" } as Record<string, string>)[s] || s, nocmp: true },
  { sec: "kesehatan", t: "metric", s: "Anak Terimunisasi Lengkap", i: "", title: "Imunisasi dasar lengkap", d: "Anak umur 12–23 bulan yang menerima imunisasi dasar lengkap.", f: pct2, b: "up" },
  { sec: "kesehatan", t: "metric", s: "Anak Terimunisasi Campak", i: "", title: "Imunisasi campak balita", d: "Balita (0–59 bulan) yang pernah mendapat imunisasi campak.", f: pct2, b: "up" },
  {
    sec: "kesehatan", t: "compose", s: "Kelas RS", title: "Rumah sakit menurut kelas", d: "Jumlah rumah sakit menurut kelas (unit).", f: { d: 0 },
    order: ["Kelas A (Unit)", "Kelas B (Unit)", "Kelas C (Unit)", "Kelas D dan Kelas D Pratama (Unit)", "Belum Ditetapkan Kelas (Unit)"],
    lab: (s) => s.replace(" (Unit)", "").replace("Kelas D dan Kelas D Pratama", "Kelas D & D Pratama"), nocmp: true,
    extra: (E, c) => {
      const j = E.latestOf("Kelas RS", c, "Jumlah RS (Unit)");
      const t = E.latestOf("Kelas RS", c, "Jumlah Tempat Tidur");
      return j ? <p className="text-[12.5px] text-ink-2"><b className="text-foreground">{fmt(j.v, { d: 0 })}</b> rumah sakit · <b className="text-foreground">{fmt(t?.v, { d: 0 })}</b> tempat tidur</p> : null;
    },
  },
  { sec: "kesehatan", t: "compose", s: "Jangkau Faskes", title: "Keterjangkauan fasilitas kesehatan", d: "Indeks keterjangkauan ke puskesmas dan rumah sakit (persen).", f: pct1, lab: (s) => s.replace("Indeks Keterjangkauan ke Fasilitas Kesehatan ", "").replace(" (%)", "") },
  { sec: "kesehatan", t: "compose", s: "Penyakit", title: "Prevalensi penyakit menular", d: "Prevalensi pada semua umur (SKI 2023), persen.", f: pct2, lab: (s) => s.replace(/^Prevalensi /, "").replace(/ pada Semua Umur.*$/, "").replace(/ \(D\/G\)/, "").replace(/ berdasarkan Riwayat.*$/, "").replace(/ Semua Umur.*$/, ""), sort: true },
  { sec: "kesehatan", t: "compose", s: ">15 Merokok Sebulan", title: "Perokok usia 15+ menurut umur", d: "Penduduk 15 tahun ke atas yang merokok dalam sebulan terakhir, persen.", f: pct1, order: ["15-24", "25-34", "35-44", "45-54", "55-64", "65+"], lab: (s) => s + " tahun" },
  // ── pendidikan
  { sec: "pendidikan", t: "metric", s: "RLS", i: "", title: "Rata-rata lama sekolah (RLS)", d: "Penduduk usia 25 tahun ke atas.", f: th(), b: "up" },
  { sec: "pendidikan", t: "metric", s: "HLS", i: "", title: "Harapan lama sekolah (HLS)", d: "Untuk anak usia 7 tahun.", f: th(), b: "up" },
  { sec: "pendidikan", t: "compose", s: "APS", title: "Angka partisipasi sekolah (APS)", d: "Menurut kelompok umur, persen.", f: pct1, order: ["7-12", "13-15", "16-18", "19-23"], lab: (s) => s + " tahun" },
  { sec: "pendidikan", t: "compose", s: "APM APK Sekolah", title: "Angka partisipasi kasar (APK)", d: "Per jenjang; bisa di atas 100 karena mencakup siswa di luar usia sekolah.", f: pct1, order: ["SD/MI", "SMP/MTs", "SMA/SMK/MA"] },
  { sec: "pendidikan", t: "metric", s: "APK PT", i: "", title: "APK perguruan tinggi", d: "Angka partisipasi kasar perguruan tinggi.", f: pct2, b: "up" },
  { sec: "pendidikan", t: "compose", s: "Siswa Putus Sekolah", title: "Siswa putus sekolah", d: "Tahun ajaran 2023/2024 (orang).", f: { d: 0 }, order: ["SD", "SMP", "SMA", "SMK"], nocmp: true },
  {
    sec: "pendidikan", t: "stack", s: "Kondisi Ruang Kelas", title: "Kondisi ruang kelas", d: "Persentase ruang kelas menurut kondisi, 2023/2024.", rows: ["SD", "SMP", "SMA", "SMK"],
    cats: [
      { key: "% Baik", name: "Baik", color: "var(--k1)", fg: "var(--k1-fg)" },
      { key: "% Rusak Ringan", name: "Rusak ringan", color: "var(--k2)", fg: "var(--k2-fg)" },
      { key: "% Rusak Sedang", name: "Rusak sedang", color: "var(--k3)", fg: "var(--k3-fg)" },
      { key: "% Rusak Berat", name: "Rusak berat", color: "var(--k4)", fg: "var(--k4-fg)" },
    ],
    key: (r, c) => r + " - " + c,
    sub: (E, c, r) => {
      const j = E.latestOf("Kondisi Ruang Kelas", c, r + " - Jumlah");
      return j ? fmt(j.v, { d: 0 }) + " ruang" : "";
    },
  },
  {
    sec: "pendidikan", t: "stack", s: "Kepsek dan Guru", title: "Kualifikasi kepala sekolah & guru", d: "Menurut ijazah tertinggi, 2023/2024.", rows: ["SD", "SMP", "SMA", "SMK"],
    cats: [
      { key: "≥ S1", name: "S1 ke atas", color: "var(--o3)", fg: "var(--o3-fg)" },
      { key: "<S1", name: "Di bawah S1", color: "var(--bar-muted)", fg: "var(--foreground)" },
    ],
    key: (r, c) => r + "-" + c, counts: "orang",
  },
  { sec: "pendidikan", t: "compose", s: "Penyelesaian Pendidikan", title: "Tingkat penyelesaian pendidikan", d: "Per jenjang, persen.", f: pct1, order: ["SD / Sederajat", "SMP / Sederajat", "SMA / Sederajat"] },
  { sec: "pendidikan", t: "metric", s: "Melek Aksara (>15)", i: "", title: "Angka melek aksara 15+", d: "Penduduk usia 15 tahun ke atas yang dapat membaca dan menulis.", f: pct2, b: "up" },
  { sec: "pendidikan", t: "multi", title: "Melek aksara menurut kelompok umur", d: "Penduduk yang dapat membaca dan menulis, persen.", f: pct2, srcs: [["Melek Aksara (15-24)", "", "15–24 tahun"], ["Melek Aksara (15-59)", "", "15–59 tahun"]] },
  { sec: "pendidikan", t: "multi", title: "Buta aksara", d: "Persen penduduk yang tidak dapat membaca dan menulis: menurut umur (15 tahun ke atas) dan jenis kelamin (10 tahun ke atas).", f: pct2, srcs: [["Buta Aksara (Umur)", "15-44", "Umur 15–44 tahun"], ["Buta Aksara (Umur)", "45+", "Umur 45 tahun ke atas"], ["Buta Aksara (Jenis Kelamin)", "Laki-Laki", "Laki-laki"], ["Buta Aksara (Jenis Kelamin)", "Perempuan", "Perempuan"]] },
  { sec: "pendidikan", t: "compose", s: "Rombel", title: "Rombongan belajar per jenjang", d: "Jumlah rombongan belajar, tahun ajaran 2023/2024 (unit).", f: { d: 0 }, order: ["SD", "SMP", "SMA", "SMK"], nocmp: true },
  { sec: "pendidikan", t: "compose", s: "Desa dengan Fasilitas Sekolah", title: "Desa yang memiliki sekolah", d: "Jumlah desa/kelurahan yang memiliki fasilitas sekolah, menurut jenjang.", f: { d: 0 }, order: ["SD", "SMP", "SMU", "SMK", "Perguruan Tinggi"], lab: (s) => (s === "SMU" ? "SMA" : s), nocmp: true },
  { sec: "pendidikan", t: "compose", s: "Jangkau Fasdik", title: "Keterjangkauan fasilitas pendidikan", d: "Indeks keterjangkauan per jenjang (persen).", f: pct1, order: ["SD", "SMP", "SMA", "SMK"].map((j) => "Indeks Keterjangkauan ke Fasilitas Pendidikan " + j + " (%)"), lab: (s) => s.replace("Indeks Keterjangkauan ke Fasilitas Pendidikan ", "").replace(" (%)", "") },
  // ── infrastruktur
  { sec: "infra", t: "metric", s: "RT Air Minum Layak", i: "", title: "Rumah tangga dengan air minum layak", d: "Persentase rumah tangga dengan akses sumber air minum layak.", f: pct2, b: "up" },
  { sec: "infra", t: "metric", s: "RT Sanitasi Layak", i: "", title: "Rumah tangga dengan sanitasi layak", d: "Persentase rumah tangga dengan akses sanitasi layak.", f: pct2, b: "up" },
  { sec: "infra", t: "metric", s: "RT Hunian Layak", i: "", title: "Rumah tangga dengan hunian layak", d: "Persentase rumah tangga dengan akses hunian layak.", f: pct2, b: "up" },
  { sec: "infra", t: "compose", s: "RT BABS", title: "Buang air besar sembarangan (BABS)", d: "Persentase rumah tangga yang masih BAB di tempat terbuka.", f: pct2, order: ["Perkotaan", "Perdesaan", "Perkotaan+Perdesaan"], lab: (s) => (s === "Perkotaan+Perdesaan" ? "Total" : s) },
  { sec: "infra", t: "metric", s: "RT Penerangan Listrik PLN", i: "", title: "Rumah tangga berlistrik PLN", d: "Sumber penerangan utama listrik PLN.", f: pct2, b: "up" },
  { sec: "infra", t: "metric", s: "RT Penerangan Listrik", i: "", title: "Rumah tangga berpenerangan listrik", d: "Rumah tangga dengan sumber penerangan utama listrik.", f: pct2, b: "up" },
  { sec: "infra", t: "metric", s: "Kapasitas Pembangkit Listrik", i: "", title: "Kapasitas pembangkit listrik", d: "Kapasitas terpasang (MW).", f: { d: 0, suf: " MW", du: " MW" }, b: "up", lvl: true },
  { sec: "infra", t: "multi", title: "Listrik dibangkitkan dan didistribusikan", d: "Tenaga listrik yang dibangkitkan dan yang didistribusikan per tahun (GWh).", f: { d: 0, suf: " GWh" }, srcs: [["Tenaga Listrik Dibangkitkan", "", "Dibangkitkan"], ["Listrik Terdistribusi", "", "Didistribusikan"]] },
  { sec: "infra", t: "compose", s: "Jangkauan 4G", title: "Jangkauan sinyal 4G", d: "Persentase kawasan permukiman dan wilayah yang terjangkau 4G.", f: pct1, lab: (s) => s.replace("(%)", "") },
  { sec: "infra", t: "multi", title: "Kemantapan jalan", d: "Persentase panjang jalan kondisi mantap (baik + sedang) menurut status jalan.", f: pct1, srcs: [["Jalan Nasional", "", "Jalan nasional"], ["Jalan Provinsi", "", "Jalan provinsi"], ["Jalan KabKota", "", "Jalan kab/kota"]] },
  {
    sec: "infra", t: "metric", s: "Persampahan", i: "%Sampah Terkelola(B+C)/A", title: "Sampah terkelola", d: "Sampah yang dikurangi dan ditangani dibanding timbulan tahunan.", f: x100, b: "up",
    extra: (E, c) => {
      const t = E.latestOf("Persampahan", c, "Timbulan Sampah Tahunan (ton/tahun)(A)");
      return t ? <p className="text-[12.5px] text-ink-2">Timbulan sampah <b className="text-foreground">{fmt(t.v, { d: 0 })} ton</b> per tahun</p> : null;
    },
  },
  // ── desa
  { sec: "desa", t: "desa", wide: true },
  { sec: "desa", t: "metric", s: "Desa", i: "Mandiri+Maju", title: "Desa berstatus Maju atau Mandiri", d: "Persentase desa berstatus Mandiri atau Maju pada Indeks Desa 2025.", f: pct1, b: "up" },
  { sec: "desa", t: "metric", s: "Desa", i: "Skor", title: "Rata-rata skor Indeks Desa", d: "Rata-rata skor Indeks Desa 2025 seluruh desa.", f: idx2, b: "up" },
  // ── lingkungan
  { sec: "lingkungan", t: "compose", s: "Lingkungan", title: "Indeks Kualitas Lingkungan Hidup", d: "IKLH gabungan dan komponennya.", f: idx2, order: ["IKLH", "IKA", "IKU", "IKL"], lab: (s) => ({ IKLH: "IKLH (gabungan)", IKA: "Kualitas air (IKA)", IKU: "Kualitas udara (IKU)", IKL: "Kualitas lahan (IKL)" } as Record<string, string>)[s] || s },
  { sec: "lingkungan", t: "metric", s: "IRBI", i: "IRBI", title: "Indeks Risiko Bencana (IRBI)", d: "BNPB. Makin tinggi, makin berisiko.", f: idx2, b: "down" },
  { sec: "lingkungan", t: "metric", s: "IKP", i: "IKP", title: "Indeks Ketahanan Pangan (IKP)", d: "Badan Pangan Nasional.", f: idx2, b: "up" },
  { sec: "lingkungan", t: "metric", s: "Prev Pangan", i: "Tidak ada", title: "Ketidakcukupan konsumsi pangan (PoU)", d: "Prevalensi penduduk yang kurang makan, persen.", f: pct2, b: "down" },
  // ── tata kelola
  { sec: "tatakelola", t: "ipp" },
  { sec: "tatakelola", t: "metric", s: "Indeks Integritas", i: "", title: "Indeks Integritas (SPI KPK)", d: "Survei Penilaian Integritas KPK.", f: idx2, b: "up" },
  { sec: "tatakelola", t: "metric", s: "IKIP", i: "", title: "Keterbukaan Informasi Publik (IKIP)", d: "Komisi Informasi Pusat.", f: idx2, b: "up" },
  { sec: "tatakelola", t: "metric", s: "IPEI", i: "", title: "Pembangunan Ekonomi Inklusif (IPEI)", d: "Skala 1–10.", f: idx2, b: "up" },
  // ── potensi
  { sec: "potensi", t: "commod", wide: true },
  { sec: "potensi", t: "wisata", wide: true },
];

export interface TileDef {
  s: string;
  i: string;
  l: string;
  f: Fmt;
  b: Better;
  g?: boolean;
}
export const TILES: TileDef[] = [
  { s: "LPE", i: "Produk Domestik Bruto", l: "Pertumbuhan ekonomi", f: pct2, b: "up" },
  { s: "ADHB Per Kapita", i: "", l: "PDRB per kapita", f: { k: 0.001, pre: "Rp ", suf: " jt", d: 1 }, b: "up", g: true },
  { s: "Kemiskinan", i: "Persentase Penduduk Miskin", l: "Penduduk miskin", f: pct2, b: "down" },
  { s: "TPT", i: "Tingkat Pengangguran Terbuka (TPT)", l: "Pengangguran terbuka", f: pct2, b: "down" },
  { s: "IPM", i: "", l: "Indeks Pembangunan Manusia", f: idx2, b: "up" },
  { s: "Stunting", i: "Stunting", l: "Prevalensi stunting", f: pct1, b: "down" },
  { s: "Postur APBD", i: "Belanja Daerah", l: "Belanja daerah (APBD)", f: { rp: true }, b: 0 },
  { s: "Rasio Fiskal", i: "PAD/Pendapatan", l: "Porsi PAD dalam pendapatan", f: pct1, b: "up" },
];
