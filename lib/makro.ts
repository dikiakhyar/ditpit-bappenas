// ── Katalog "Data Makro" KabKota ─────────────────────────────────────────────
// Inti kerapian dashboard: alih-alih ~150 layer/kolom yang bikin panel penuh,
// SELURUH indikator makro disajikan lewat SATU layer poligon KabKota yang
// diwarnai (choropleth) berdasarkan pilihan:  Kategori → Sub-indikator → Tahun.
// Peta otomatis recolor + legenda graduasi + peringkat ikut menyesuaikan.
//
// Menambah indikator = cukup tambah entri di MAKRO_CATEGORIES di bawah, lalu
// sediakan kolom datanya (lihat `valueKey`) di public/data/makro.json.

export type IndKind = "numeric" | "categorical";
export type Sense = "high" | "low"; // arah "baik": high = makin besar makin baik
export type ValFormat =
  | "int"
  | "ribu"
  | "persen"
  | "rasio"
  | "tahun"
  | "milyar"
  | "juta"
  | "jiwakm2";

export interface ClassDef {
  value: string;
  color: string;
}

export interface Indicator {
  id: string;
  label: string;
  unit?: string;
  kind?: IndKind; // default "numeric"
  years?: number[]; // bila multi-tahun
  hasRank?: boolean; // ada "Peringkat Provinsi"
  sense?: Sense; // default "high"
  format?: ValFormat;
  classes?: ClassDef[]; // untuk kind "categorical"
  note?: string;
}

export interface MakroCategory {
  id: string;
  label: string;
  icon: string;
  indicators: Indicator[];
}

const Y_20_25 = [2020, 2021, 2022, 2023, 2024, 2025];

// kelas kualitatif (dipakai indikator categorical)
const KELAS_FISKAL: ClassDef[] = [
  { value: "Sangat Rendah", color: "#b91c1c" },
  { value: "Rendah", color: "#ef6c4d" },
  { value: "Sedang", color: "#f4b400" },
  { value: "Tinggi", color: "#74c476" },
  { value: "Sangat Tinggi", color: "#1a7e3e" },
];
const KELAS_IKLH: ClassDef[] = [
  { value: "Sangat Kurang", color: "#b91c1c" },
  { value: "Kurang", color: "#ef6c4d" },
  { value: "Cukup", color: "#f4b400" },
  { value: "Baik", color: "#74c476" },
  { value: "Sangat Baik", color: "#1a7e3e" },
];
const KELAS_IRBI: ClassDef[] = [
  { value: "Rendah", color: "#74c476" },
  { value: "Sedang", color: "#f4b400" },
  { value: "Tinggi", color: "#ef6c4d" },
  { value: "Sangat Tinggi", color: "#b91c1c" },
];

export const MAKRO_CATEGORIES: MakroCategory[] = [
  {
    id: "kependudukan",
    label: "Kependudukan",
    icon: "users",
    indicators: [
      { id: "jumlah_penduduk", label: "Jumlah Penduduk", unit: "Ribu Jiwa", format: "ribu", hasRank: true },
      { id: "persentase_penduduk", label: "Persentase Penduduk", unit: "%", format: "persen", hasRank: true },
      { id: "kepadatan", label: "Kepadatan Penduduk", unit: "Jiwa/km²", format: "jiwakm2", hasRank: true },
      { id: "sex_ratio", label: "Sex Ratio", format: "rasio", hasRank: true },
    ],
  },
  {
    id: "ketenagakerjaan",
    label: "Ketenagakerjaan",
    icon: "briefcase",
    indicators: [
      { id: "tpt", label: "Tingkat Pengangguran Terbuka (TPT)", unit: "% · Agustus", years: Y_20_25, hasRank: true, sense: "low", format: "persen" },
      { id: "tpak", label: "Tingkat Partisipasi Angkatan Kerja (TPAK)", unit: "% · Agustus", years: [2021, 2022, 2023, 2024, 2025], hasRank: true, sense: "high", format: "persen" },
    ],
  },
  {
    id: "kemiskinan",
    label: "Kemiskinan & Ketimpangan",
    icon: "trending",
    indicators: [
      { id: "ppm", label: "Persentase Penduduk Miskin (PPM)", unit: "% · Maret", years: Y_20_25, hasRank: true, sense: "low", format: "persen" },
      { id: "gini", label: "Rasio Gini", unit: "Semester 1", years: Y_20_25, hasRank: true, sense: "low", format: "rasio" },
    ],
  },
  {
    id: "ekonomi",
    label: "Ekonomi",
    icon: "chart",
    indicators: [
      { id: "lpe", label: "Laju Pertumbuhan Ekonomi (LPE)", unit: "%", years: Y_20_25, hasRank: true, sense: "high", format: "persen" },
    ],
  },
  {
    id: "pembangunan_manusia",
    label: "Pembangunan Manusia",
    icon: "users",
    indicators: [
      { id: "ipm", label: "Indeks Pembangunan Manusia (IPM)", years: Y_20_25, hasRank: true, sense: "high", format: "rasio" },
      { id: "hls", label: "Harapan Lama Sekolah (HLS)", unit: "Tahun", years: Y_20_25, hasRank: true, sense: "high", format: "tahun" },
      { id: "rls", label: "Rata-rata Lama Sekolah (RLS)", unit: "Tahun", years: Y_20_25, hasRank: true, sense: "high", format: "tahun" },
      { id: "uhh", label: "Umur Harapan Hidup (UHH)", unit: "Tahun", years: Y_20_25, hasRank: true, sense: "high", format: "tahun" },
    ],
  },
  {
    id: "kesehatan",
    label: "Kesehatan",
    icon: "heart",
    indicators: [
      { id: "stunting", label: "Prevalensi Stunting", unit: "%", years: [2021, 2022, 2023, 2024], hasRank: true, sense: "low", format: "persen" },
    ],
  },
  {
    id: "fiskal",
    label: "Fiskal Daerah",
    icon: "wallet",
    indicators: [
      { id: "kapasitas_fiskal", label: "Rasio Kapasitas Fiskal Daerah", years: [2024, 2025], hasRank: true, sense: "high", format: "rasio" },
      { id: "kapasitas_fiskal_kategori", label: "Kategori Kapasitas Fiskal", kind: "categorical", years: [2024, 2025], classes: KELAS_FISKAL },
      { id: "rasio_pad", label: "Rasio PAD terhadap Pendapatan Daerah", unit: "%", years: [2025], hasRank: true, sense: "high", format: "persen" },
      { id: "rasio_belanja_pegawai", label: "Rasio Belanja Pegawai terhadap Belanja Daerah", unit: "%", years: [2025], hasRank: true, sense: "low", format: "persen" },
    ],
  },
  {
    id: "apbd",
    label: "Postur APBD 2025 (Realisasi)",
    icon: "wallet",
    indicators: [
      { id: "apbd_pendapatan", label: "Pendapatan Daerah", unit: "Milyar Rp", format: "milyar", hasRank: true },
      { id: "apbd_pad", label: "Pendapatan Asli Daerah (PAD)", unit: "Milyar Rp", format: "milyar", hasRank: true },
      { id: "apbd_tkd", label: "Transfer ke Daerah (TKD)", unit: "Milyar Rp", format: "milyar", hasRank: true },
      { id: "apbd_belanja", label: "Belanja Daerah", unit: "Milyar Rp", format: "milyar", hasRank: true },
      { id: "apbd_belanja_pegawai", label: "Belanja Pegawai", unit: "Milyar Rp", format: "milyar", hasRank: true },
    ],
  },
  {
    id: "investasi",
    label: "Realisasi Investasi",
    icon: "trending",
    indicators: [
      { id: "investasi", label: "Realisasi Investasi", unit: "Juta Rp", years: [2021, 2022, 2023, 2024, 2025], hasRank: true, sense: "high", format: "juta" },
      { id: "investasi_total", label: "Total Investasi 2021–2025", unit: "Juta Rp", hasRank: true, sense: "high", format: "juta" },
    ],
  },
  {
    id: "pdrb",
    label: "PDRB",
    icon: "chart",
    indicators: [
      { id: "pdrb_adhb", label: "PDRB ADHB 2025", unit: "Rp Milyar", hasRank: true, sense: "high", format: "milyar" },
      { id: "kontribusi_pdrb", label: "Kontribusi PDRB", unit: "%", hasRank: true, sense: "high", format: "persen" },
      { id: "pdrb_perkapita", label: "PDRB per Kapita", unit: "Ribu Rp/Tahun", hasRank: true, sense: "high", format: "ribu" },
    ],
  },
  {
    id: "risiko_lingkungan",
    label: "Risiko & Lingkungan",
    icon: "shield",
    indicators: [
      { id: "irbi", label: "Indeks Risiko Bencana (IRBI) 2024", hasRank: false, sense: "low", format: "rasio" },
      { id: "irbi_kelas", label: "Kelas Risiko Bencana (IRBI)", kind: "categorical", classes: KELAS_IRBI },
      { id: "iku", label: "Indeks Kualitas Udara (IKU)", hasRank: true, sense: "high", format: "rasio" },
      { id: "ika", label: "Indeks Kualitas Air (IKA)", hasRank: true, sense: "high", format: "rasio" },
      { id: "ikl", label: "Indeks Kualitas Lahan (IKL)", hasRank: true, sense: "high", format: "rasio" },
      { id: "iklh", label: "Indeks Kualitas Lingkungan Hidup (IKLH)", hasRank: true, sense: "high", format: "rasio" },
      { id: "iklh_kategori", label: "Kategori IKLH", kind: "categorical", classes: KELAS_IKLH },
      { id: "ikp", label: "Indeks Ketahanan Pangan (IKP)", years: [2024, 2025], hasRank: true, sense: "high", format: "rasio" },
    ],
  },
];

// ── pencarian indikator ──────────────────────────────────────────────────────
export function findIndicator(id: string): { cat: MakroCategory; ind: Indicator } | null {
  for (const cat of MAKRO_CATEGORIES) {
    const ind = cat.indicators.find((i) => i.id === id);
    if (ind) return { cat, ind };
  }
  return null;
}

// ── kunci kolom data ─────────────────────────────────────────────────────────
// public/data/makro.json:  { [kodeKabKota]: { [key]: number|string } }
//   - indikator tanpa tahun  →  key = id              (mis. "sex_ratio")
//   - indikator bertahun      →  key = `${id}_${year}` (mis. "tpt_2023")
//   - peringkat provinsi      →  key + "__rank"        (mis. "tpt_2023__rank")
export function valueKey(id: string, year?: number | null): string {
  return year ? `${id}_${year}` : id;
}
export function rankKey(id: string, year?: number | null): string {
  return `${valueKey(id, year)}__rank`;
}

export type MakroRow = Record<string, number | string | null>;
export type MakroData = Record<string, MakroRow>;

export function getNumber(row: MakroRow | undefined, key: string): number | null {
  if (!row) return null;
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
export function getRaw(row: MakroRow | undefined, key: string): number | string | null {
  return row ? row[key] ?? null : null;
}

// ── klasifikasi & warna (choropleth numerik) ─────────────────────────────────
// Palet biru sekuensial (terang→pekat). Magnitudo besar = warna pekat,
// terlepas dari "sense"; sense hanya menentukan ujung "terbaik" pada peringkat.
export const RAMP = ["#eef6fc", "#cfe3f5", "#9ecae1", "#5fa6d4", "#2f7fbf", "#0b5394"];

/** Ambil ~k+1 kelas (k batas dalam) dengan metode kuantil dari nilai. */
export function quantileBreaks(values: number[], classes = RAMP.length): number[] {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return [];
  const inner = Math.max(1, classes - 1);
  const breaks: number[] = [];
  for (let i = 1; i <= inner; i++) {
    const p = i / classes;
    const idx = Math.min(v.length - 1, Math.floor(p * v.length));
    breaks.push(v[idx]);
  }
  // dedupe agar tangga step valid (harus menaik)
  const uniq: number[] = [];
  for (const b of breaks) if (uniq.length === 0 || b > uniq[uniq.length - 1]) uniq.push(b);
  return uniq;
}

/** Ekspresi MapLibre fill-color dari batas kuantil, baca properti "__v". */
export function stepColorExpression(breaks: number[], nodata = "rgba(150,160,175,0.25)"): unknown {
  if (breaks.length === 0) return nodata;
  const step: unknown[] = ["step", ["get", "__v"], RAMP[0]];
  breaks.forEach((b, i) => {
    step.push(b, RAMP[Math.min(i + 1, RAMP.length - 1)]);
  });
  return ["case", ["has", "__v"], step, nodata];
}

/** Ekspresi fill-color untuk indikator kategorikal (match string). */
export function categoricalColorExpression(
  classes: ClassDef[],
  nodata = "rgba(150,160,175,0.25)"
): unknown {
  const match: unknown[] = ["match", ["get", "__c"]];
  classes.forEach((c) => match.push(c.value, c.color));
  match.push(nodata);
  return ["case", ["has", "__c"], match, nodata];
}

// ── format angka untuk legenda & tooltip ─────────────────────────────────────
const ID = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const ID0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatValue(v: number | null | undefined, fmt?: ValFormat): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  switch (fmt) {
    case "persen":
      return `${ID.format(v)}%`;
    case "tahun":
      return `${ID.format(v)} thn`;
    case "rasio":
      return ID.format(v);
    case "ribu":
      return `${ID.format(v)} rb`;
    case "milyar":
      return `Rp ${ID0.format(v)} M`;
    case "juta":
      return `Rp ${ID0.format(v)} jt`;
    case "jiwakm2":
      return `${ID0.format(v)} jiwa/km²`;
    case "int":
    default:
      return ID0.format(v);
  }
}
