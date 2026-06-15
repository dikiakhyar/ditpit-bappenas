// Sumber tunggal definisi layer dashboard.
// Menambah layer baru = menambah satu entri di LAYERS — UI & legenda ikut otomatis.
// `source` & `formats` dipakai mulai Sprint 4 (GeoJSON) dan Sprint 8 (unduh).

export type Geometry = "area" | "line" | "point";
export type GroupId = "admin" | "tematik" | "infrastruktur";

export interface LayerDef {
  id: string;
  name: string;
  group: GroupId;
  geometry: Geometry;
  defaultVisible?: boolean;
  defaultOpacity?: number; // 0..1
  source?: string;         // path GeoJSON/PMTiles (diisi nanti)
  downloadable?: boolean;
  formats?: string[];      // contoh: ["GeoJSON", "SHP", "CSV"]
}

export interface GroupDef {
  id: GroupId;
  name: string;
}

export const GROUPS: GroupDef[] = [
  { id: "admin", name: "Batas Administrasi" },
  { id: "tematik", name: "Tematik" },
  { id: "infrastruktur", name: "Infrastruktur" },
];

export const GEOMETRY_META: Record<Geometry, { label: string; varName: string }> = {
  area: { label: "Poligon / Kawasan", varName: "--area" },
  line: { label: "Garis / Jaringan", varName: "--line" },
  point: { label: "Titik / Lokasi", varName: "--point" },
};

export const LAYERS: LayerDef[] = [
  { id: "prov", name: "Provinsi", group: "admin", geometry: "area", defaultVisible: true, defaultOpacity: 0.7, downloadable: true, formats: ["GeoJSON", "SHP"] },
  { id: "kabkota", name: "Kabupaten / Kota", group: "admin", geometry: "area", defaultOpacity: 0.7, downloadable: true, formats: ["GeoJSON", "SHP"] },
  { id: "kec", name: "Kecamatan", group: "admin", geometry: "area", defaultOpacity: 0.7, downloadable: true, formats: ["GeoJSON", "SHP"] },

  { id: "mangrove", name: "Mangrove", group: "tematik", geometry: "area", defaultOpacity: 0.8, downloadable: true, formats: ["GeoJSON"] },
  { id: "sawah", name: "Sawah", group: "tematik", geometry: "area", defaultOpacity: 0.8, downloadable: true, formats: ["GeoJSON"] },
  { id: "lindung", name: "Kawasan Lindung", group: "tematik", geometry: "area", defaultOpacity: 0.8, downloadable: true, formats: ["GeoJSON"] },
  { id: "proyek", name: "Lokasi Proyek", group: "tematik", geometry: "point", defaultVisible: true, downloadable: true, formats: ["GeoJSON", "CSV"] },
  { id: "fasilitas", name: "Fasilitas", group: "tematik", geometry: "point", downloadable: true, formats: ["GeoJSON", "CSV"] },

  { id: "jalan", name: "Jalan", group: "infrastruktur", geometry: "line", downloadable: true, formats: ["GeoJSON"] },
  { id: "sungai", name: "Sungai", group: "infrastruktur", geometry: "line", downloadable: true, formats: ["GeoJSON"] },
];
