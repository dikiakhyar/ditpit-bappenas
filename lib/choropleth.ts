// Logika murni choropleth Data Makro — dipakai bersama oleh peta (warna +
// legenda) dan panel (daftar peringkat). Tidak menyentuh DOM/MapLibre.

import {
  findIndicator,
  valueKey,
  rankKey,
  getNumber,
  getRaw,
  quantileBreaks,
  stepColorExpression,
  categoricalColorExpression,
  type MakroData,
  type Indicator,
} from "@/lib/makro";

// tipe GeoJSON longgar
interface Geo {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: unknown;
  }>;
}

export const CODE_PROP = "kode";
export const NAME_PROP = "nama";
export const PROV_PROP = "provinsi";

export interface Baked {
  geo: Geo; // FeatureCollection dengan properti __v/__c/__rank
  ind: Indicator;
  numeric: boolean;
  breaks: number[]; // batas kuantil (numeric)
  min: number | null;
  max: number | null;
  colorExpr: unknown; // ekspresi fill-color MapLibre
  count: number; // jumlah KabKota berdata
}

export interface RankItem {
  kode: string;
  nama: string;
  prov: string;
  value: number;
}

/** Susun ulang GeoJSON + hitung warna/legenda untuk pilihan indikator/tahun. */
export function bake(
  kabkota: Geo | null,
  data: MakroData | null,
  indId: string,
  year: number | null
): Baked | null {
  const found = findIndicator(indId);
  if (!found || !kabkota) return null;
  const { ind } = found;
  const numeric = (ind.kind ?? "numeric") === "numeric";
  const vKey = valueKey(indId, year);
  const rKey = rankKey(indId, year);

  const nums: number[] = [];
  const features = kabkota.features.map((f) => {
    const kode = String(f.properties?.[CODE_PROP] ?? "");
    const row = data?.[kode];
    const props: Record<string, unknown> = {
      ...f.properties,
      __kode: kode,
      __nama: f.properties?.[NAME_PROP] ?? kode,
      __prov: f.properties?.[PROV_PROP] ?? "",
    };
    if (numeric) {
      const v = getNumber(row, vKey);
      if (v !== null) {
        props.__v = v;
        nums.push(v);
      }
    } else {
      const c = getRaw(row, vKey);
      if (typeof c === "string" && c) props.__c = c;
    }
    const rank = getRaw(row, rKey);
    if (rank !== null && rank !== undefined && rank !== "") props.__rank = rank;
    return { ...f, properties: props };
  });

  const breaks = numeric ? quantileBreaks(nums) : [];
  const colorExpr = numeric
    ? stepColorExpression(breaks)
    : categoricalColorExpression(ind.classes ?? []);

  return {
    geo: { type: "FeatureCollection", features },
    ind,
    numeric,
    breaks,
    min: nums.length ? Math.min(...nums) : null,
    max: nums.length ? Math.max(...nums) : null,
    colorExpr,
    count: numeric ? nums.length : features.filter((f) => f.properties.__c).length,
  };
}

/** Daftar peringkat KabKota untuk indikator numerik terpilih. */
export function ranking(
  kabkota: Geo | null,
  data: MakroData | null,
  indId: string,
  year: number | null
): RankItem[] {
  const found = findIndicator(indId);
  if (!found || !kabkota || (found.ind.kind ?? "numeric") !== "numeric") return [];
  const vKey = valueKey(indId, year);
  const items: RankItem[] = [];
  for (const f of kabkota.features) {
    const kode = String(f.properties?.[CODE_PROP] ?? "");
    const v = getNumber(data?.[kode], vKey);
    if (v === null) continue;
    items.push({
      kode,
      nama: String(f.properties?.[NAME_PROP] ?? kode),
      prov: String(f.properties?.[PROV_PROP] ?? ""),
      value: v,
    });
  }
  // urut menurun; "sense" menentukan ujung terbaik saat ditampilkan
  items.sort((a, b) => b.value - a.value);
  return items;
}
