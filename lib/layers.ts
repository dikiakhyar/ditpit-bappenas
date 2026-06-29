// Sumber tunggal definisi layer dashboard DITPIT.
// Menambah / mengubah layer = ubah entri di LAYERS — panel, legenda peta,
// dan ekspor PNG semua ikut otomatis. Setiap layer punya warna & simbol
// kartografis sendiri (bukan sekadar warna per-geometri) supaya peta tematik
// terbaca dan legenda hasil-generate bermakna.

export type Geometry = "area" | "line" | "point";
export type GroupId = "admin" | "tematik";
export type PointSymbol = "circle" | "square" | "triangle" | "diamond" | "cross";
export type LineDash = "solid" | "dashed" | "dotted";

export interface LayerDef {
  id: string;
  name: string;
  group: GroupId;
  subgroup?: string; // id sub-grup (lihat SUBGROUPS)
  geometry: Geometry;
  color: string; // warna utama (hex) — dipakai panel, legenda, peta, PNG

  // area
  outline?: boolean; // gambar sebagai garis batas saja (untuk batas administrasi)
  hatch?: boolean; // arsiran diagonal (mis. kawasan konservasi)

  // line
  dash?: LineDash;
  weight?: number; // tebal garis (px)

  // point
  symbol?: PointSymbol;
  size?: number; // diameter simbol (px)

  defaultVisible?: boolean;
  defaultOpacity?: number; // 0..1
  source?: string; // path GeoJSON/PMTiles — diisi saat data siap
}

export interface GroupDef {
  id: GroupId;
  name: string;
}
export interface SubgroupDef {
  id: string;
  group: GroupId;
  name: string;
}

// ── Wilayah ────────────────────────────────────────────────────────────────
export const PROVINCES = [
  "Maluku",
  "Maluku Utara",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
] as const;
export type Province = (typeof PROVINCES)[number];

export const GROUPS: GroupDef[] = [
  { id: "admin", name: "Batas Administrasi" },
  { id: "tematik", name: "Tematik" },
];

export const SUBGROUPS: SubgroupDef[] = [
  { id: "lahan", group: "tematik", name: "Penggunaan Lahan" },
  { id: "jalan", group: "tematik", name: "Jaringan Jalan" },
  { id: "pendidikan", group: "tematik", name: "Fasilitas Pendidikan" },
  { id: "kesehatan", group: "tematik", name: "Fasilitas Kesehatan" },
  { id: "transportasi", group: "tematik", name: "Transportasi" },
];

// label keluarga geometri (key bentuk pada panel & legenda)
export const GEOMETRY_META: Record<Geometry, { label: string }> = {
  area: { label: "Poligon / Kawasan" },
  line: { label: "Garis / Jaringan" },
  point: { label: "Titik / Lokasi" },
};

export const LAYERS: LayerDef[] = [
  // ── Batas Administrasi (batas wilayah, digambar sebagai garis) ──────────
  { id: "prov",    name: "Provinsi",          group: "admin", geometry: "area", outline: true, color: "#334155", weight: 2.6, defaultVisible: true, defaultOpacity: 1 },
  { id: "kabkota", name: "Kabupaten / Kota",  group: "admin", geometry: "area", outline: true, color: "#64748b", weight: 1.7, dash: "solid",  defaultOpacity: 1 },
  { id: "kec",     name: "Kecamatan",         group: "admin", geometry: "area", outline: true, color: "#94a3b8", weight: 1.1, dash: "dashed", defaultOpacity: 1 },

  // ── Tematik · Penggunaan Lahan (area) ───────────────────────────────────
  { id: "perkebunan", name: "Perkebunan",                          group: "tematik", subgroup: "lahan", geometry: "area", color: "#2d6a4f", defaultOpacity: 0.78 },
  { id: "ladang",     name: "Ladang",                              group: "tematik", subgroup: "lahan", geometry: "area", color: "#d4a373", defaultOpacity: 0.78 },
  { id: "sawah",      name: "Sawah",                               group: "tematik", subgroup: "lahan", geometry: "area", color: "#95d5b2", defaultOpacity: 0.82 },
  { id: "garam",      name: "Garam",                               group: "tematik", subgroup: "lahan", geometry: "area", color: "#cbd5e1", defaultOpacity: 0.85 },
  { id: "tambak",     name: "Tambak",                              group: "tematik", subgroup: "lahan", geometry: "area", color: "#48cae4", defaultOpacity: 0.78 },
  { id: "permukiman", name: "Permukiman",                          group: "tematik", subgroup: "lahan", geometry: "area", color: "#bc4749", defaultOpacity: 0.8  },
  { id: "konservasi", name: "Kawasan Konservasi & Taman Nasional", group: "tematik", subgroup: "lahan", geometry: "area", color: "#1b4332", hatch: true, defaultOpacity: 0.7 },

  // ── Tematik · Jaringan Jalan (garis) ────────────────────────────────────
  { id: "jln_nasional", name: "Jalan Nasional",         group: "tematik", subgroup: "jalan", geometry: "line", color: "#e63946", weight: 3.0, dash: "solid"  },
  { id: "jln_provinsi", name: "Jalan Provinsi",         group: "tematik", subgroup: "jalan", geometry: "line", color: "#f3722c", weight: 2.5, dash: "solid"  },
  { id: "jln_kabkota",  name: "Jalan Kabupaten / Kota", group: "tematik", subgroup: "jalan", geometry: "line", color: "#f9c74f", weight: 2.1, dash: "solid"  },
  { id: "jln_lokal",    name: "Jalan Lokal",            group: "tematik", subgroup: "jalan", geometry: "line", color: "#6c757d", weight: 1.6, dash: "solid"  },
  { id: "jln_lain",     name: "Jalan Lain",             group: "tematik", subgroup: "jalan", geometry: "line", color: "#adb5bd", weight: 1.3, dash: "dashed" },
  { id: "jln_setapak",  name: "Jalan Setapak",          group: "tematik", subgroup: "jalan", geometry: "line", color: "#8d6e63", weight: 1.2, dash: "dotted" },

  // ── Tematik · Fasilitas Pendidikan (titik) ──────────────────────────────
  { id: "edu_tinggi",   name: "Pendidikan Tinggi",   group: "tematik", subgroup: "pendidikan", geometry: "point", color: "#3a0ca3", symbol: "square", size: 13, defaultOpacity: 1 },
  { id: "edu_menengah", name: "Pendidikan Menengah", group: "tematik", subgroup: "pendidikan", geometry: "point", color: "#4361ee", symbol: "square", size: 11, defaultOpacity: 1 },
  { id: "edu_dasar",    name: "Pendidikan Dasar",    group: "tematik", subgroup: "pendidikan", geometry: "point", color: "#4cc9f0", symbol: "square", size: 9,  defaultOpacity: 1 },

  // ── Tematik · Fasilitas Kesehatan (titik) ───────────────────────────────
  { id: "kes_rs",            name: "Rumah Sakit",        group: "tematik", subgroup: "kesehatan", geometry: "point", color: "#d00000", symbol: "cross", size: 13, defaultOpacity: 1 },
  { id: "kes_pusk_utama",    name: "Puskesmas Utama",    group: "tematik", subgroup: "kesehatan", geometry: "point", color: "#e85d04", symbol: "cross", size: 11, defaultOpacity: 1 },
  { id: "kes_pusk_pembantu", name: "Puskesmas Pembantu", group: "tematik", subgroup: "kesehatan", geometry: "point", color: "#faa307", symbol: "cross", size: 9,  defaultOpacity: 1 },

  // ── Tematik · Transportasi (titik) ──────────────────────────────────────
  { id: "trs_pelabuhan", name: "Pelabuhan", group: "tematik", subgroup: "transportasi", geometry: "point", color: "#7209b7", symbol: "diamond",  size: 13, defaultOpacity: 1 },
  { id: "trs_bandara",   name: "Bandara",   group: "tematik", subgroup: "transportasi", geometry: "point", color: "#3f37c9", symbol: "triangle", size: 13, defaultOpacity: 1 },
];
