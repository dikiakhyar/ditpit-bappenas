// Jalan Nasional (tab Layer peta tematik).
// Sumber: components/JalanNasionalPIT.gpkg (1.017 ruas, atribut kd_ruas/nm_ruas/fungsi/panjang),
// diolah oleh scripts/build-jalan-nasional.py → public/data/jalan-nasional.geojson:
//  - tiap ruas dipotong menurut batas kab/kota peta (potongan kecil di garis pantai yang jatuh
//    di luar poligon dimasukkan ke kab/kota terdekat), satu fitur = satu ruas × satu kab/kota;
//  - `km` = panjang RESMI ruas × porsi geometri ruas di kab/kota tsb → total per wilayah tetap
//    sama dengan jumlah panjang resmi (18.520 km).
// Berkas ±1,8 MB (±0,5 MB terkompresi) — baru diunduh saat layer dinyalakan.

export const JALAN_URL = "/data/jalan-nasional.geojson";
export const JALAN_LAYER_ID = "jalan_nasional";
export const JALAN_COLOR = "#e0141e";
export const JALAN_DEFAULT_WIDTH = 2;

export interface JalanProps {
  /** kode ruas (kd_ruas) */
  r: string;
  /** nama ruas */
  n: string;
  /** fungsi jalan: "A" arteri, "K1" kolektor primer 1 */
  f: string;
  /** panjang resmi seluruh ruas (km) */
  pj: number;
  /** kode BPS kab/kota potongan ini */
  k: string;
  /** panjang ruas di kab/kota ini (km) */
  km: number;
}
export interface JalanFC {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: JalanProps; geometry: unknown }[];
}

export const FUNGSI: Record<string, string> = { A: "Arteri", K1: "Kolektor-1", K2: "Kolektor-2", K3: "Kolektor-3", K4: "Kolektor-4", L: "Lokal" };
export const fungsiNama = (f: string) => FUNGSI[f] ?? f;

/** Tampilkan jalan di kab/kota terpilih saja, atau di seluruh provinsi induknya. */
export type JalanCakupan = "kab" | "prov";

/**
 * Wilayah yang jalannya ditampilkan: null = seluruh wilayah peta; kode provinsi; atau kode kab/kota.
 * `isKawasan` = pilihan "Indonesia Timur" (seluruh wilayah).
 */
export function jalanScope(selected: string | null, cakupan: JalanCakupan, isKawasan: boolean): string | null {
  if (!selected || isKawasan) return null;
  const n = Number(selected);
  if (n % 100 === 0) return selected;
  return cakupan === "prov" ? selected.slice(0, 2) + "00" : selected;
}

/** Filter MapLibre untuk cakupan di atas. */
export function jalanFilter(scope: string | null): unknown {
  if (!scope) return null;
  if (Number(scope) % 100 === 0) return ["==", ["slice", ["get", "k"], 0, 2], scope.slice(0, 2)];
  return ["==", ["get", "k"], scope];
}

const inScope = (k: string, scope: string | null) => !scope || (Number(scope) % 100 === 0 ? k.slice(0, 2) === scope.slice(0, 2) : k === scope);

export interface JalanStats {
  km: number;
  ruas: number;
  perFungsi: { f: string; km: number; ruas: number }[];
  /** ruas terpanjang di cakupan (panjang di dalam cakupan) */
  top: { r: string; n: string; f: string; km: number; pj: number }[];
}

export function jalanStats(fc: JalanFC | null, scope: string | null, topN = 5): JalanStats | null {
  if (!fc) return null;
  const perRuas = new Map<string, { r: string; n: string; f: string; km: number; pj: number }>();
  for (const { properties: p } of fc.features) {
    if (!inScope(p.k, scope)) continue;
    const cur = perRuas.get(p.r);
    if (cur) cur.km += p.km;
    else perRuas.set(p.r, { r: p.r, n: p.n, f: p.f, km: p.km, pj: p.pj });
  }
  const all = [...perRuas.values()];
  const fungsi = new Map<string, { f: string; km: number; ruas: number }>();
  for (const x of all) {
    const g = fungsi.get(x.f) ?? { f: x.f, km: 0, ruas: 0 };
    g.km += x.km;
    g.ruas += 1;
    fungsi.set(x.f, g);
  }
  return {
    km: all.reduce((a, x) => a + x.km, 0),
    ruas: all.length,
    perFungsi: [...fungsi.values()].sort((a, b) => b.km - a.km),
    top: all.sort((a, b) => b.km - a.km).slice(0, topN),
  };
}

export const fmtKm = (v: number) => v.toLocaleString("id-ID", { minimumFractionDigits: v < 10 ? 2 : 1, maximumFractionDigits: v < 10 ? 2 : 1 });
