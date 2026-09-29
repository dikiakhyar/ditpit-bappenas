// Titik label nama wilayah dari poligon GeoJSON — dihitung SEKALI saat batas
// wilayah dimuat (±190 fitur, beberapa milidetik), bukan setiap render.
//
// Untuk tiap wilayah: ambil bagian poligon terluas (pulau utama), lalu cari titik
// yang pasti berada DI DALAM daratan: sapu beberapa garis horizontal melintang,
// dan pilih titik tengah ruas terpanjang. Titik ini lebih "di tengah" daripada
// centroid biasa, yang bisa jatuh di laut untuk wilayah berbentuk bulan sabit/berteluk.

type Ring = number[][];
type Poly = Ring[];

interface Feat {
  properties: Record<string, unknown>;
  geometry: unknown;
}

export interface LabelPoint {
  type: "Feature";
  properties: { kode: string; nama: string; level: "kab" | "prov" };
  geometry: { type: "Point"; coordinates: [number, number] };
}

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}

function polygons(geom: unknown): Poly[] {
  const g = geom as { type?: string; coordinates?: unknown } | null;
  if (!g?.coordinates) return [];
  if (g.type === "Polygon") return [g.coordinates as Poly];
  if (g.type === "MultiPolygon") return g.coordinates as Poly[];
  return [];
}

/** Titik di dalam poligon (dengan lubangnya): tengah ruas horizontal terpanjang. */
function interiorPoint(poly: Poly): [number, number] | null {
  const outer = poly[0];
  if (!outer?.length) return null;
  let s = Infinity, n = -Infinity, w = Infinity, e = -Infinity;
  for (const [x, y] of outer) {
    if (y < s) s = y;
    if (y > n) n = y;
    if (x < w) w = x;
    if (x > e) e = x;
  }
  let best: [number, number] | null = null;
  let bestLen = -1;
  const LINES = 9;
  for (let k = 1; k <= LINES; k++) {
    // utamakan garis dekat tengah: bobot jarak dari tengah sedikit mengurangi panjang
    const t = k / (LINES + 1);
    const y = s + (n - s) * t;
    const xs: number[] = [];
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[i];
        if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    const centerBias = 1 - 0.35 * Math.abs(t - 0.5) * 2;
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const len = (xs[i + 1] - xs[i]) * centerBias;
      if (len > bestLen) {
        bestLen = len;
        best = [(xs[i] + xs[i + 1]) / 2, y];
      }
    }
  }
  return best ?? [(w + e) / 2, (s + n) / 2];
}

/** Satu titik label per fitur (bagian terluasnya). */
export function labelPoints(features: Feat[] | undefined, level: "kab" | "prov"): LabelPoint[] {
  const out: LabelPoint[] = [];
  for (const f of features ?? []) {
    const polys = polygons(f.geometry);
    if (!polys.length) continue;
    let main = polys[0];
    let maxA = -1;
    for (const p of polys) {
      const a = ringArea(p[0] ?? []);
      if (a > maxA) {
        maxA = a;
        main = p;
      }
    }
    const pt = interiorPoint(main);
    if (!pt) continue;
    out.push({
      type: "Feature",
      properties: { kode: String(f.properties?.kode ?? ""), nama: String(f.properties?.nama ?? ""), level },
      geometry: { type: "Point", coordinates: pt },
    });
  }
  return out;
}
