// ── Katalog "Data Makro" Kab/Kota ────────────────────────────────────────────
// Semua indikator makro disajikan lewat SATU layer poligon kab/kota yang diwarnai
// (choropleth) menurut pilihan  Kategori → Indikator → Tahun.
//
// Nilainya dihitung LANGSUNG dari database (Google Spreadsheet "Database PIT",
// lewat lib/profil/engine.ts) — tidak ada lagi makro.json. Tahun yang tampil
// = tahun yang benar-benar terisi untuk kab/kota di peta; indikator tanpa data
// kab/kota otomatis disembunyikan.
//
// Menambah indikator = tambah entri di MAKRO_CATEGORIES dengan `src`:
//   fromSheet("Nama Sheet", "Item", (tahun) => "label periode")  atau  fungsi turunan.

import type { Engine } from "@/lib/profil/engine";

export type IndKind = "numeric" | "categorical";
export type Sense = "high" | "low"; // arah "baik": high = makin besar makin baik
export type ValFormat = "int" | "ribu" | "persen" | "rasio" | "tahun" | "milyar" | "juta" | "jiwakm2" | "rupiah" | "skor";

export interface ClassDef {
  value: string;
  color: string;
}
type Val = number | string | null;

export interface IndicatorSrc {
  /** nilai untuk kab/kota `c` pada tahun `y` */
  get: (E: Engine, c: string, y: number) => Val;
  /** tahun kandidat (sebelum disaring menurut ketersediaan data) */
  years: (E: Engine) => number[];
}

export interface Indicator {
  id: string;
  label: string;
  unit?: string;
  kind?: IndKind; // default "numeric"
  sense?: Sense; // default "high"
  format?: ValFormat;
  classes?: ClassDef[]; // untuk kind "categorical"
  /** warna peta; default: sense "low" → merah, selain itu palet kategorinya */
  palette?: PaletteId;
  note?: string;
  src: IndicatorSrc;
  /** diisi saat runtime: tahun yang punya data (urut naik) */
  years?: number[];
  hasRank?: boolean;
}

export interface MakroCategory {
  id: string;
  label: string;
  icon: string;
  /** palet default indikator di kategori ini (lihat PALETTES) */
  palette?: PaletteId;
  indicators: Indicator[];
}

// ── pembantu sumber data ─────────────────────────────────────────────────────
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const yearOf = (p: string) => Number(p.match(/(19|20)\d{2}/)?.[0] ?? NaN);

/** Ambil nilai dari sheet database; `per(y)` = label periode untuk tahun y (default "2024"). */
function fromSheet(sheet: string, item = "", per: (y: number) => string = String): IndicatorSrc {
  return {
    get: (E, c, y) => {
      const v = E.ser(sheet, c, item)?.[E.sheet(sheet)?.p.indexOf(per(y)) ?? -1];
      return v == null ? null : typeof v === "string" ? v.trim() || null : v;
    },
    years: (E) => [...new Set((E.sheet(sheet)?.p ?? []).filter((p) => per(yearOf(p)) === p).map(yearOf))].sort((a, b) => a - b),
  };
}
const agu = (y: number) => `Agu ${y}`;
const mar = (y: number) => `Mar ${y}`;

/** Penduduk (ribu jiwa) = PDRB ADHB (miliar Rp) ÷ PDRB per kapita ADHB (ribu Rp) × 1000. */
const pendAt = (E: Engine, c: string, y: number): number | null => {
  const a = fromSheet("ADHB", "Produk Domestik Bruto").get(E, c, y);
  const k = fromSheet("ADHB Per Kapita").get(E, c, y);
  return isNum(a) && isNum(k) && k > 0 ? (a / k) * 1000 : null;
};
const pdrbYears = fromSheet("ADHB", "Produk Domestik Bruto").years;
const luas = (E: Engine, c: string) => E.latestOf("Luas Wilayah", c, "Luas Wilayah (km2)")?.v ?? null;

const titleCase = (v: Val) => (typeof v === "string" ? v.trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) : null);

// kelas kualitatif
const KELAS_FISKAL: ClassDef[] = [
  { value: "Sangat Rendah", color: "#b91c1c" },
  { value: "Rendah", color: "#ef6c4d" },
  { value: "Sedang", color: "#f4b400" },
  { value: "Tinggi", color: "#74c476" },
  { value: "Sangat Tinggi", color: "#1a7e3e" },
];
const KELAS_IRBI: ClassDef[] = [
  { value: "Rendah", color: "#74c476" },
  { value: "Sedang", color: "#f4b400" },
  { value: "Tinggi", color: "#d9482b" },
];

export const MAKRO_CATEGORIES: MakroCategory[] = [
  {
    id: "kependudukan",
    label: "Kependudukan",
    icon: "users",
    palette: "ungu",
    indicators: [
      { id: "jumlah_penduduk", label: "Jumlah Penduduk", unit: "Ribu Jiwa", format: "ribu", note: "Dihitung: PDRB ADHB ÷ PDRB per kapita ADHB (BPS).", src: { get: pendAt, years: pdrbYears } },
      {
        id: "persentase_penduduk", label: "Persentase Penduduk terhadap Provinsi", unit: "%", format: "persen", note: "Jumlah penduduk kab/kota ÷ provinsi.",
        src: {
          get: (E, c, y) => {
            const p = pendAt(E, c, y), q = pendAt(E, E.provOf(c), y);
            return isNum(p) && isNum(q) && q > 0 ? (p / q) * 100 : null;
          },
          years: pdrbYears,
        },
      },
      {
        id: "kepadatan", label: "Kepadatan Penduduk", unit: "Jiwa/km²", format: "jiwakm2", note: "Jumlah penduduk ÷ luas wilayah.",
        src: {
          get: (E, c, y) => {
            const p = pendAt(E, c, y), l = luas(E, c);
            return isNum(p) && isNum(l) && l > 0 ? (p * 1000) / l : null;
          },
          years: pdrbYears,
        },
      },
    ],
  },
  {
    id: "ketenagakerjaan",
    label: "Ketenagakerjaan",
    icon: "briefcase",
    palette: "hijau",
    indicators: [
      { id: "tpt", label: "Tingkat Pengangguran Terbuka (TPT)", unit: "% · Agustus", sense: "low", format: "persen", src: fromSheet("TPT", "Tingkat Pengangguran Terbuka (TPT)", agu) },
      { id: "tpak", label: "Tingkat Partisipasi Angkatan Kerja (TPAK)", unit: "% · Agustus", format: "persen", src: fromSheet("TPT", "Tingkat Partisipasi Angkatan Kerja (TPAK)", agu) },
    ],
  },
  {
    id: "kemiskinan",
    label: "Kemiskinan & Ketimpangan",
    icon: "trending",
    palette: "merah",
    indicators: [
      { id: "ppm", label: "Persentase Penduduk Miskin", unit: "% · Maret", sense: "low", format: "persen", src: fromSheet("Kemiskinan", "Persentase Penduduk Miskin", mar) },
      { id: "jpm", label: "Jumlah Penduduk Miskin", unit: "Ribu Jiwa · Maret", sense: "low", format: "ribu", src: fromSheet("Kemiskinan", "Jumlah Penduduk Miskin", mar) },
      { id: "garis_kemiskinan", label: "Garis Kemiskinan", unit: "Rp/kapita/bulan · Maret", format: "rupiah", palette: "biru", src: fromSheet("Kemiskinan", "Garis Kemiskinan", mar) },
      { id: "gini", label: "Rasio Gini", sense: "low", format: "rasio", src: fromSheet("Rasio Gini") },
    ],
  },
  {
    id: "ekonomi",
    label: "Ekonomi & PDRB",
    icon: "chart",
    palette: "biru",
    indicators: [
      { id: "lpe", label: "Laju Pertumbuhan Ekonomi (LPE)", unit: "%", format: "persen", palette: "divergen", src: fromSheet("LPE", "Produk Domestik Bruto") },
      { id: "pdrb_adhb", label: "PDRB ADHB", unit: "Miliar Rp", format: "milyar", src: fromSheet("ADHB", "Produk Domestik Bruto") },
      { id: "pdrb_perkapita", label: "PDRB per Kapita ADHB", unit: "Ribu Rp/Tahun", format: "ribu", src: fromSheet("ADHB Per Kapita") },
      { id: "kontribusi_pdrb", label: "Kontribusi PDRB terhadap Provinsi", unit: "%", format: "persen", src: fromSheet("Kontribusi PDRB") },
      { id: "investasi", label: "Realisasi Investasi (PMA + PMDN)", unit: "Juta Rp", format: "juta", src: fromSheet("Realisasi Investasi", "Realisasi Investasi (Juta Rupiah)") },
    ],
  },
  {
    id: "pembangunan_manusia",
    label: "Pembangunan Manusia",
    icon: "users",
    palette: "hijau",
    indicators: [
      { id: "ipm", label: "Indeks Pembangunan Manusia (IPM)", format: "rasio", src: fromSheet("IPM") },
      { id: "hls", label: "Harapan Lama Sekolah (HLS)", unit: "Tahun", format: "tahun", src: fromSheet("HLS") },
      { id: "rls", label: "Rata-rata Lama Sekolah (RLS)", unit: "Tahun", format: "tahun", src: fromSheet("RLS") },
      { id: "uhh", label: "Umur Harapan Hidup (UHH)", unit: "Tahun", format: "tahun", src: fromSheet("UHH") },
    ],
  },
  {
    id: "kesehatan",
    label: "Kesehatan",
    icon: "heart",
    palette: "hijau",
    indicators: [
      { id: "stunting", label: "Prevalensi Stunting", unit: "%", sense: "low", format: "persen", src: fromSheet("Stunting", "Stunting") },
      {
        id: "puskesmas_dokter", label: "Puskesmas dengan Dokter", unit: "%", format: "persen",
        src: { get: (E, c, y) => { const v = fromSheet("Puskesmas dg Dok", "% Puskesmas dengan Dokter").get(E, c, y); return isNum(v) ? v * 100 : null; }, years: fromSheet("Puskesmas dg Dok", "% Puskesmas dengan Dokter").years },
      },
      {
        id: "puskesmas_lengkap", label: "Puskesmas dengan Nakes Lengkap", unit: "%", format: "persen",
        src: { get: (E, c, y) => { const v = fromSheet("Kelengkapan Nakes Puskes", "% Puskesmas Lengkap").get(E, c, y); return isNum(v) ? v * 100 : null; }, years: fromSheet("Kelengkapan Nakes Puskes", "% Puskesmas Lengkap").years },
      },
      { id: "pou", label: "Ketidakcukupan Konsumsi Pangan (PoU)", unit: "%", sense: "low", format: "persen", src: fromSheet("Prev Pangan", "Tidak ada") },
    ],
  },
  {
    id: "layanan",
    label: "Layanan Dasar & Infrastruktur",
    icon: "bolt",
    palette: "toska",
    indicators: [
      { id: "air_minum", label: "RT dengan Air Minum Layak", unit: "%", format: "persen", src: fromSheet("RT Air Minum Layak") },
      { id: "sanitasi", label: "RT dengan Sanitasi Layak", unit: "%", format: "persen", src: fromSheet("RT Sanitasi Layak") },
      { id: "hunian", label: "RT dengan Hunian Layak", unit: "%", format: "persen", src: fromSheet("RT Hunian Layak") },
      { id: "sinyal_permukiman", label: "Jangkauan 4G — Permukiman", unit: "%", format: "persen", src: fromSheet("Jangkauan 4G", "Permukiman(%)") },
      { id: "sinyal_wilayah", label: "Jangkauan 4G — Wilayah", unit: "%", format: "persen", src: fromSheet("Jangkauan 4G", "Wilayah (%)") },
    ],
  },
  {
    id: "desa",
    label: "Indeks Desa",
    icon: "home",
    palette: "hijau",
    indicators: [
      { id: "desa_skor", label: "Rata-rata Skor Indeks Desa", format: "skor", src: fromSheet("Desa", "Skor") },
      { id: "desa_maju", label: "Desa Maju & Mandiri", unit: "% desa", format: "persen", src: fromSheet("Desa", "Mandiri+Maju") },
      { id: "desa_tertinggal", label: "Desa Tertinggal & Sangat Tertinggal", unit: "% desa", sense: "low", format: "persen", src: fromSheet("Desa", "Tertinggal") },
    ],
  },
  {
    id: "fiskal",
    label: "Fiskal & APBD",
    icon: "wallet",
    palette: "biru",
    indicators: [
      { id: "kapasitas_fiskal", label: "Rasio Kapasitas Fiskal Daerah", format: "rasio", palette: "hijau", src: fromSheet("Kapasitas Fiskal", "RFKD") },
      {
        id: "kapasitas_fiskal_kategori", label: "Kategori Kapasitas Fiskal", kind: "categorical", classes: KELAS_FISKAL,
        src: { get: (E, c, y) => titleCase(fromSheet("Kapasitas Fiskal", "Kategori RKFD").get(E, c, y)), years: fromSheet("Kapasitas Fiskal", "Kategori RKFD").years },
      },
      { id: "rasio_pad", label: "Porsi PAD dalam Pendapatan Daerah", unit: "%", format: "persen", palette: "hijau", src: fromSheet("Rasio Fiskal", "PAD/Pendapatan") },
      { id: "rasio_belanja_pegawai", label: "Porsi Belanja Pegawai dalam Belanja Daerah", unit: "%", sense: "low", format: "persen", src: fromSheet("Rasio Fiskal", "Pegawai/Belanja") },
      { id: "apbd_pendapatan", label: "Pendapatan Daerah", unit: "Miliar Rp", format: "milyar", src: fromSheet("Postur APBD", "Pendapatan Daerah") },
      { id: "apbd_pad", label: "Pendapatan Asli Daerah (PAD)", unit: "Miliar Rp", format: "milyar", src: fromSheet("Postur APBD", "PAD") },
      { id: "apbd_tkd", label: "Transfer ke Daerah (TKD)", unit: "Miliar Rp", format: "milyar", src: fromSheet("Postur APBD", "TKD") },
      { id: "apbd_belanja", label: "Belanja Daerah", unit: "Miliar Rp", format: "milyar", src: fromSheet("Postur APBD", "Belanja Daerah") },
      { id: "apbd_belanja_pegawai", label: "Belanja Pegawai", unit: "Miliar Rp", sense: "low", format: "milyar", palette: "biru", src: fromSheet("Postur APBD", "Belanja Pegawai") },
    ],
  },
  {
    id: "risiko_lingkungan",
    label: "Risiko & Lingkungan",
    icon: "shield",
    palette: "hijau",
    indicators: [
      { id: "irbi", label: "Indeks Risiko Bencana (IRBI)", sense: "low", format: "rasio", palette: "oranye", src: fromSheet("IRBI", "IRBI") },
      {
        id: "irbi_kelas", label: "Kelas Risiko Bencana (IRBI)", kind: "categorical", classes: KELAS_IRBI, note: "Kelas BNPB dari skor IRBI: rendah ≤ 72, sedang 72–144, tinggi > 144.",
        src: {
          get: (E, c, y) => {
            const v = fromSheet("IRBI", "IRBI").get(E, c, y);
            return isNum(v) ? (v <= 72 ? "Rendah" : v <= 144 ? "Sedang" : "Tinggi") : null;
          },
          years: fromSheet("IRBI", "IRBI").years,
        },
      },
      { id: "iklh", label: "Indeks Kualitas Lingkungan Hidup (IKLH)", format: "rasio", src: fromSheet("Lingkungan", "IKLH") },
      { id: "ika", label: "Indeks Kualitas Air (IKA)", format: "rasio", src: fromSheet("Lingkungan", "IKA") },
      { id: "iku", label: "Indeks Kualitas Udara (IKU)", format: "rasio", src: fromSheet("Lingkungan", "IKU") },
      { id: "ikl", label: "Indeks Kualitas Lahan (IKL)", format: "rasio", src: fromSheet("Lingkungan", "IKL") },
      { id: "ikp", label: "Indeks Ketahanan Pangan (IKP)", format: "rasio", src: fromSheet("IKP", "IKP") },
    ],
  },
  {
    id: "tatakelola",
    label: "Tata Kelola",
    icon: "landmark",
    palette: "hijau",
    indicators: [
      { id: "integritas", label: "Indeks Integritas (SPI KPK)", format: "rasio", src: fromSheet("Indeks Integritas") },
      { id: "ipei", label: "Indeks Pembangunan Ekonomi Inklusif (IPEI)", format: "rasio", src: fromSheet("IPEI") },
    ],
  },
];

// ── pencarian indikator ──────────────────────────────────────────────────────
export function findIndicator(id: string, catalog: MakroCategory[] = MAKRO_CATEGORIES): { cat: MakroCategory; ind: Indicator } | null {
  for (const cat of catalog) {
    const ind = cat.indicators.find((i) => i.id === id);
    if (ind) return { cat, ind };
  }
  return null;
}

// ── kunci data ───────────────────────────────────────────────────────────────
//   nilai  → `${id}_${tahun}`         (mis. "tpt_2025")
//   peringkat provinsi → + "__rank"   (mis. "tpt_2025__rank")
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

/**
 * Hitung nilai + peringkat semua indikator untuk kab/kota `codes` (poligon peta)
 * dari database. Peringkat = urutan di antara SEMUA kab/kota se-provinsi di
 * database (1 = terbaik menurut `sense`), sama dengan halaman Profil Daerah.
 * Mengembalikan juga katalog yang sudah disaring: hanya indikator & tahun berdata.
 */
export function buildMakro(E: Engine, codes: string[]): { data: MakroData; catalog: MakroCategory[] } {
  const data: MakroData = Object.fromEntries(codes.map((c) => [c, {}]));
  const provs = [...new Set(codes.map((c) => E.provOf(c)))];
  const peersByProv = new Map(provs.map((p) => [p, E.kabsOf(p)]));
  const onMap = new Set(codes);

  const catalog: MakroCategory[] = [];
  for (const cat of MAKRO_CATEGORIES) {
    const inds: Indicator[] = [];
    for (const ind of cat.indicators) {
      const numeric = (ind.kind ?? "numeric") === "numeric";
      const years: number[] = [];
      for (const y of ind.src.years(E)) {
        let any = false;
        for (const [p, peers] of peersByProv) {
          const vals: { c: string; v: Val }[] = [];
          for (const c of peers) {
            let v: Val = null;
            try {
              v = ind.src.get(E, c, y);
            } catch {}
            if (v == null) continue;
            vals.push({ c, v });
            if (onMap.has(c)) {
              data[c][valueKey(ind.id, y)] = typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v;
              any = true;
            }
          }
          if (numeric) {
            const nums = vals.filter((x): x is { c: string; v: number } => isNum(x.v));
            nums.sort((a, b) => (ind.sense === "low" ? a.v - b.v : b.v - a.v));
            for (const x of nums) if (onMap.has(x.c)) data[x.c][rankKey(ind.id, y)] = 1 + nums.findIndex((z) => z.v === x.v);
          }
          void p;
        }
        if (any) years.push(y);
      }
      if (years.length) inds.push({ ...ind, years, hasRank: numeric });
    }
    if (inds.length) catalog.push({ ...cat, indicators: inds });
  }
  return { data, catalog };
}

// ── klasifikasi & warna (choropleth numerik) ─────────────────────────────────
// Warna mengikuti KONTEKS indikator (bukan semuanya biru):
//   hijau  = capaian/kesejahteraan — makin tinggi makin baik (IPM, air minum, indeks desa…)
//   merah  = masalah — makin tinggi makin buruk (kemiskinan, TPT, stunting, desa tertinggal…)
//   oranye = risiko bencana (IRBI)
//   biru   = besaran ekonomi & keuangan (PDRB, investasi, APBD…)
//   ungu   = kependudukan (jumlah, persentase, kepadatan)
//   toska  = layanan dasar & infrastruktur (sanitasi, hunian, sinyal 4G…)
//   divergen = pertumbuhan (LPE): negatif merah, positif hijau
// Tiap palet = 6 tingkat satu warna, terang→pekat (nilai besar = pekat), lolos uji
// keterbacaan (kecerahan monoton, beda antartingkat terlihat, ujung terang kontras
// terhadap latar putih). Arah "baik" untuk peringkat tetap ditentukan `sense`.
export type PaletteId = "biru" | "hijau" | "merah" | "oranye" | "ungu" | "toska" | "divergen";
export const PALETTES: Record<Exclude<PaletteId, "divergen">, string[]> = {
  biru: ["#85b6e9", "#559ade", "#1d7dcf", "#0362aa", "#024981", "#00315a"],
  hijau: ["#88c28a", "#5ea968", "#2f904a", "#047437", "#02572b", "#013b1e"],
  merah: ["#ea998b", "#dd7063", "#cb4740", "#b21621", "#8a0318", "#600110"],
  oranye: ["#e79f5c", "#d57b2f", "#bd5a01", "#9c4103", "#7c2801", "#5b1200"],
  ungu: ["#baa4e2", "#a083d7", "#8662c7", "#6d44b2", "#532796", "#3c007a"],
  toska: ["#6fc1c5", "#3aa7ae", "#0b8b93", "#036e75", "#015258", "#02383d"],
};
const DIV_NEG = PALETTES.merah;
const DIV_POS = PALETTES.hijau;
export const RAMP = PALETTES.biru; // kompatibilitas
export const NODATA = "rgba(150,160,175,0.25)";
export const NODATA_SOLID = "#e3e7ee";
const N_CLASSES = 6;

/** Palet untuk indikator: `palette` eksplisit → sense "low" (merah) → palet kategori → biru. */
export function paletteOf(ind: Indicator, cat?: MakroCategory): PaletteId {
  if (ind.palette) return ind.palette;
  if (ind.sense === "low") return "merah";
  return cat?.palette ?? "biru";
}

/** Pilihan palet oleh pengguna: "auto" = sesuai konteks indikator (paletteOf). */
export type PaletteChoice = "auto" | PaletteId;
export const PALETTE_OPTIONS: { id: PaletteId; label: string }[] = [
  { id: "biru", label: "Biru" },
  { id: "hijau", label: "Hijau" },
  { id: "merah", label: "Merah" },
  { id: "oranye", label: "Oranye" },
  { id: "ungu", label: "Ungu" },
  { id: "toska", label: "Toska" },
  { id: "divergen", label: "Merah–Hijau (divergen)" },
];

/** Palet yang dipakai: pilihan pengguna, atau otomatis sesuai konteks indikator. */
export function resolvePalette(ind: Indicator, cat: MakroCategory | undefined, choice: PaletteChoice = "auto"): PaletteId {
  return choice === "auto" ? paletteOf(ind, cat) : choice;
}

/** Contoh warna palet (untuk ikon/legenda kecil). */
export function paletteSwatch(p: PaletteId): string[] {
  return p === "divergen" ? [DIV_NEG[3], DIV_NEG[1], DIV_POS[1], DIV_POS[3]] : PALETTES[p];
}

/** Batas kelas kuantil (k−1 batas dalam) dari nilai. */
export function quantileBreaks(values: number[], classes = N_CLASSES): number[] {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return [];
  const inner = Math.max(1, classes - 1);
  const breaks: number[] = [];
  for (let i = 1; i <= inner; i++) {
    const idx = Math.min(v.length - 1, Math.floor((i / classes) * v.length));
    breaks.push(v[idx]);
  }
  const uniq: number[] = [];
  for (const b of breaks) if (uniq.length === 0 || b > uniq[uniq.length - 1]) uniq.push(b);
  return uniq;
}

/** n warna tersebar merata dari palet (kelas sedikit tetap memakai rentang terang→pekat). */
function spread(ramp: string[], n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [ramp[Math.floor(ramp.length / 2)]];
  return Array.from({ length: n }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / (n - 1))]);
}

export interface NumericScale {
  breaks: number[]; // batas dalam (k−1)
  colors: string[]; // k warna, satu per kelas
}

/** Kelas + warna untuk sekumpulan nilai menurut palet. */
export function numericScale(values: number[], palette: PaletteId, reverse = false): NumericScale {
  const sc = numericScaleBase(values, palette);
  return reverse ? { breaks: sc.breaks, colors: [...sc.colors].reverse() } : sc;
}

function numericScaleBase(values: number[], palette: PaletteId): NumericScale {
  let breaks = quantileBreaks(values);
  if (palette !== "divergen") return { breaks, colors: spread(PALETTES[palette], breaks.length + 1) };
  // divergen: 0 selalu jadi batas kelas; kelas < 0 merah (makin negatif makin pekat), ≥ 0 hijau
  const min = Math.min(...values), max = Math.max(...values);
  if (min < 0 && max > 0 && !breaks.includes(0)) breaks = [...breaks, 0].sort((a, b) => a - b);
  const nNeg = max <= 0 ? breaks.length + 1 : min < 0 ? breaks.filter((b) => b <= 0).length : 0;
  const nPos = breaks.length + 1 - nNeg;
  const neg = spread(DIV_NEG.slice(0, 5), nNeg).reverse();
  const pos = spread(DIV_POS.slice(0, 5), nPos);
  return { breaks, colors: [...neg, ...pos] };
}

/** Warna kelas untuk satu nilai. */
export function colorOf(v: number, sc: NumericScale): string {
  let i = 0;
  while (i < sc.breaks.length && v >= sc.breaks[i]) i++;
  return sc.colors[Math.min(i, sc.colors.length - 1)];
}

/** Kelas legenda: warna + rentang [dari, sampai). */
export function legendClasses(sc: NumericScale, min: number | null, max: number | null): { color: string; from: number | null; to: number | null }[] {
  if (min == null || max == null) return [];
  const { breaks, colors } = sc;
  if (!breaks.length) return [{ color: colors[0], from: min, to: max }];
  const out = [{ color: colors[0], from: min, to: breaks[0] }];
  breaks.forEach((b, i) => out.push({ color: colors[i + 1], from: b, to: i + 1 < breaks.length ? breaks[i + 1] : max }));
  return out;
}

/** Ekspresi MapLibre fill-color dari skala kelas, baca properti "__v". */
export function stepColorExpression(sc: NumericScale, nodata = NODATA): unknown {
  if (sc.breaks.length === 0) return ["case", ["has", "__v"], sc.colors[0], nodata];
  const step: unknown[] = ["step", ["get", "__v"], sc.colors[0]];
  sc.breaks.forEach((b, i) => step.push(b, sc.colors[i + 1]));
  return ["case", ["has", "__v"], step, nodata];
}

/** Ekspresi fill-color untuk indikator kategorikal (match string). */
export function categoricalColorExpression(classes: ClassDef[], nodata = NODATA): unknown {
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
    case "skor":
      return ID.format(v);
    case "ribu":
      return `${ID.format(v)} rb`;
    case "milyar":
      return v >= 1000 ? `Rp ${ID.format(v / 1000)} T` : `Rp ${ID0.format(v)} M`;
    case "juta":
      return v >= 1e6 ? `Rp ${ID.format(v / 1e6)} T` : v >= 1000 ? `Rp ${ID.format(v / 1000)} M` : `Rp ${ID0.format(v)} jt`;
    case "rupiah":
      return `Rp ${ID0.format(v)}`;
    case "jiwakm2":
      return `${ID0.format(v)} jiwa/km²`;
    case "int":
    default:
      return ID0.format(v);
  }
}
