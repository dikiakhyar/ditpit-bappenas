// Sumber tunggal definisi layer dashboard DITPIT.
// Menambah / mengubah layer = ubah entri di LAYERS — panel, legenda peta,
// dan ekspor PNG semua ikut otomatis.
//
// - Grup "admin" (garis batas provinsi) diatur dari tab Makro → "Garis batas & label",
//   bersama garis batas kab/kota & label nama wilayah, agar semua pengaturan tampilan peta
//   ada di satu tempat.
// - Grup "kawasan" = Kawasan Prioritas Provinsi RPJMN 2025–2029 (tab Layer): satu layer per
//   kategori A–E, digambar sebagai bulatan berhuruf di tiap kab/kota (lib/kawasan-prioritas.ts).

import { KATEGORI } from "./kawasan-prioritas";

export type Geometry = "area" | "line" | "point";
export type GroupId = "admin" | "kawasan";
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
  stroke?: string; // garis tepi simbol titik
  letter?: string; // huruf di dalam simbol titik (mis. "A")

  defaultVisible?: boolean;
  defaultOpacity?: number; // 0..1
  source?: string; // path data — layer tanpa source tidak ikut legenda ekspor
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

export const GROUPS: GroupDef[] = [
  { id: "admin", name: "Batas Administrasi" },
  { id: "kawasan", name: "Kawasan Prioritas RPJMN 2025–2029" },
];

export const SUBGROUPS: SubgroupDef[] = [];

// label keluarga geometri (key bentuk pada panel & legenda)
export const GEOMETRY_META: Record<Geometry, { label: string }> = {
  area: { label: "Poligon / Kawasan" },
  line: { label: "Garis / Jaringan" },
  point: { label: "Titik / Lokasi" },
};

/** id layer kategori kawasan: "kp-A" … "kp-E" */
export const kpLayerId = (kat: string) => `kp-${kat}`;

export const LAYERS: LayerDef[] = [
  // ── Batas Administrasi ── sumber: public/data/wilayah.topo.json (SHP KabKotaPIT)
  { id: "prov", name: "Batas provinsi", group: "admin", geometry: "area", outline: true, color: "#334155", weight: 1.3, defaultVisible: true, defaultOpacity: 1, source: "/data/wilayah.topo.json" },

  // ── Kawasan Prioritas RPJMN 2025–2029 (bulatan per kategori) ──
  ...KATEGORI.map(
    (k): LayerDef => ({
      id: kpLayerId(k.id),
      name: `${k.id}. ${k.nama}`,
      group: "kawasan",
      geometry: "point",
      symbol: "circle",
      size: 15,
      color: k.fill,
      stroke: k.stroke,
      letter: k.id,
      defaultVisible: false,
      defaultOpacity: 1,
      source: "/api/kawasan-prioritas",
    })
  ),
];
