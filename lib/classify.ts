// Simbolisasi choropleth: metode pembagian kelas + warna per kelas.
// Dipakai bersama peta, legenda, daftar peringkat, dan ekspor PNG.

import { BREWER, brewerById } from "./brewer";
import {
  PALETTES,
  numericScale,
  quantileBreaks,
  resolvePalette,
  spread,
  type Indicator,
  type MakroCategory,
  type NumericScale,
  type PaletteChoice,
} from "./makro";

export type ClassMethod = "kuantil" | "interval" | "jenks" | "manual";
export const CLASS_METHODS: { id: ClassMethod; label: string; hint: string }[] = [
  { id: "kuantil", label: "Kuantil", hint: "Jumlah kab/kota tiap kelas kira-kira sama" },
  { id: "jenks", label: "Natural breaks (Jenks)", hint: "Mengikuti jeda alami data (seperti ArcGIS/QGIS)" },
  { id: "interval", label: "Interval sama", hint: "Rentang minimum–maksimum dibagi rata" },
  { id: "manual", label: "Batas manual", hint: "Tentukan sendiri batas tiap kelas" },
];

export interface Symbology {
  palette: PaletteChoice;
  reverse: boolean;
  method: ClassMethod;
  classes: number; // 3–6
  custom: string[]; // warna kelas (terendah → tertinggi) untuk palet "custom"
  labels: string[]; // nama kelas opsional (terendah → tertinggi), mis. Rendah/Sedang/Tinggi
  manual: Record<string, number[]>; // batas manual per indikator (batas bawah kelas ke-2 … ke-n)
  border: { width: number; color: string }; // garis batas poligon; width 0 = tidak ditampilkan
}

export const DEFAULT_SYMB: Symbology = {
  palette: "auto",
  reverse: false,
  method: "kuantil",
  classes: 6,
  custom: BREWER[0].k[6].slice(),
  labels: [],
  manual: {},
  border: { width: 0.45, color: "#8c98aa" },
};

/** Batas dalam (k−1 nilai, naik) menurut metode. Kelas i+1 dimulai pada breaks[i] (nilai ≥ batas). */
export function breaksFor(values: number[], method: ClassMethod, n: number, manual?: number[]): number[] {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return [];
  let b: number[];
  switch (method) {
    case "manual":
      b = (manual ?? []).filter(Number.isFinite).sort((x, y) => x - y);
      if (!b.length) b = quantileBreaks(v, n);
      break;
    case "interval": {
      const lo = v[0], hi = v[v.length - 1];
      b = hi > lo ? Array.from({ length: n - 1 }, (_, i) => lo + ((hi - lo) * (i + 1)) / n) : [];
      break;
    }
    case "jenks":
      b = jenksBreaks(v, n);
      break;
    default:
      b = quantileBreaks(v, n);
  }
  const uniq: number[] = [];
  for (const x of b) if (!uniq.length || x > uniq[uniq.length - 1]) uniq.push(x);
  return uniq;
}

/** Jenks natural breaks (Fisher–Jenks, pemrograman dinamis). `v` terurut naik. */
function jenksBreaks(v: number[], k: number): number[] {
  const n = v.length;
  if (n <= k) return v.slice(1);
  const lower: number[][] = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  const vari: number[][] = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) {
    lower[1][j] = 1;
    vari[1][j] = 0;
  }
  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1;
      const val = v[i3 - 1];
      s2 += val * val;
      s1 += val;
      w++;
      const vr = s2 - (s1 * s1) / w;
      if (i3 > 1) {
        for (let j = 2; j <= k; j++) {
          const c = vr + vari[i3 - 1][j - 1];
          if (vari[l][j] >= c) {
            lower[l][j] = i3;
            vari[l][j] = c;
          }
        }
      }
    }
    lower[l][1] = 1;
    vari[l][1] = s2 - (s1 * s1) / w;
  }
  const out: number[] = [];
  let kk = n;
  for (let j = k; j >= 2; j--) {
    const start = lower[kk][j]; // indeks (1-based) awal kelas ke-j
    out.unshift(v[start - 1]);
    kk = start - 1;
  }
  return out;
}

const DIV_RAMP = [...PALETTES.merah.slice(0, 5).reverse(), ...PALETTES.hijau.slice(0, 5)];

/** k warna untuk pilihan palet. */
export function colorsFor(k: number, choice: PaletteChoice, ind: Indicator, cat: MakroCategory | undefined, s: Symbology): string[] {
  if (k <= 0) return [];
  if (choice === "custom") return spread(s.custom.slice(0, Math.max(s.classes, 1)), k);
  if (choice.startsWith("cb:")) {
    const b = brewerById(choice.slice(3));
    if (b) {
      if (k >= 3 && k <= 6) return b.k[k].slice();
      if (k > 6) return spread(b.k[6], k);
      return spread(b.k[3], k);
    }
  }
  const p = resolvePalette(ind, cat, choice);
  return p === "divergen" ? spread(DIV_RAMP, k) : spread(PALETTES[p], k);
}

export interface ClassScale extends NumericScale {
  labels?: string[]; // nama kelas (terendah → tertinggi) bila diisi pengguna & jumlahnya cocok
}

/** Skala kelas + warna untuk nilai-nilai indikator menurut simbolisasi pengguna. */
export function makeScale(values: number[], ind: Indicator, cat: MakroCategory | undefined, s: Symbology): ClassScale {
  if (!values.length) return { breaks: [], colors: [] };
  const n = Math.min(6, Math.max(2, s.classes));
  const auto = s.palette === "auto" ? resolvePalette(ind, cat, "auto") : null;
  let sc: NumericScale;
  // palet divergen + kuantil: pertahankan aturan lama (0 selalu jadi batas kelas)
  if ((s.palette === "divergen" || auto === "divergen") && s.method === "kuantil") {
    sc = numericScale(values, "divergen", false, n);
  } else {
    const breaks = breaksFor(values, s.method, n, s.manual[ind.id]);
    sc = { breaks, colors: colorsFor(breaks.length + 1, s.palette, ind, cat, s) };
  }
  if (s.reverse) sc = { breaks: sc.breaks, colors: [...sc.colors].reverse() };
  const k = sc.colors.length;
  const labs = s.labels.slice(0, k).map((x) => (x ?? "").trim());
  return labs.length === k && labs.some(Boolean) ? { ...sc, labels: labs } : sc;
}

// ── warna dari teks pengguna: "49, 163, 84" / "rgb(49 163 84)" / "#31a354" / "31a354" ──
export function parseColor(txt: string): string | null {
  const t = txt.trim();
  const hex = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(t);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return "#" + h.toLowerCase();
  }
  const nums = t.match(/\d{1,3}/g);
  if (nums && nums.length === 3 && /^(rgb\s*)?\(?\s*\d{1,3}\s*[,;\s]\s*\d{1,3}\s*[,;\s]\s*\d{1,3}\s*\)?$/i.test(t)) {
    const [r, g, b] = nums.map(Number);
    if ([r, g, b].every((x) => x <= 255)) return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return null;
}
export const toRgbText = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};
