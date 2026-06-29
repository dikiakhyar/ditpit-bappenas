// Penyusun ekspor peta -> PNG memakai Canvas 2D (tanpa dependensi tambahan).
// Menggambar satu komposisi rapi: kepala berjudul (deskriptif, dari input),
// panel peta, dan LEGENDA hasil-generate dari layer yang sedang aktif.
//
// Dipakai dua kali oleh ExportPanel: render kecil untuk pratinjau live, dan
// render resolusi penuh saat diunduh. Saat MapLibre aktif (Sprint 3), cukup
// oper `mapImage = map.getCanvas()` (map perlu preserveDrawingBuffer:true).

import {
  GROUPS,
  SUBGROUPS,
  type LayerDef,
} from "@/lib/layers";

export interface ExportOptions {
  title: string;
  province: string;
  layers: LayerDef[]; // layer aktif (urutan registry)
  date?: Date;
  pxRatio?: number; // piksel perangkat per 1 unit logis (default 2)
  mapImage?: CanvasImageSource | null; // tangkapan peta asli (opsional)
  width?: number; // lebar logis, default 860
}

const INK = "#0f1b2d";
const SUBTLE = "#5b6b85";
const HAIR = "#dfe5ee";
const ACCENT = "#1683c2";
const PANEL_BG = "#f4f6fa";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
function formatDate(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── swatch di canvas (mirror dari komponen Swatch.tsx) ──────────────────────
function drawSwatch(ctx: CanvasRenderingContext2D, l: LayerDef, x: number, y: number, s: number) {
  const mid = s / 2;
  ctx.save();
  ctx.translate(x, y);

  if (l.geometry === "area") {
    if (l.outline) {
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 2;
      roundRect(ctx, 1.5, 1.5, s - 3, s - 3, 2);
      ctx.stroke();
    } else if (l.hatch) {
      ctx.fillStyle = l.color;
      ctx.globalAlpha = 0.25;
      roundRect(ctx, 1, 1, s - 2, s - 2, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save();
      roundRect(ctx, 1, 1, s - 2, s - 2, 2);
      ctx.clip();
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 1.4;
      for (let i = -s; i < s * 2; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, -1);
        ctx.lineTo(i + s, s + 1);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 1.1;
      roundRect(ctx, 1, 1, s - 2, s - 2, 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = l.color;
      roundRect(ctx, 1, 1, s - 2, s - 2, 2);
      ctx.fill();
    }
  } else if (l.geometry === "line") {
    ctx.strokeStyle = l.color;
    ctx.lineWidth = Math.min(l.weight ?? 2, 3.4);
    ctx.lineCap = "round";
    if (l.dash === "dashed") ctx.setLineDash([5, 3]);
    else if (l.dash === "dotted") ctx.setLineDash([1.5, 3]);
    ctx.beginPath();
    ctx.moveTo(1, mid);
    ctx.lineTo(s - 1, mid);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const r = Math.min((l.size ?? 10) / 2, mid - 1.5);
    ctx.fillStyle = l.color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.2;
    const sym = l.symbol ?? "circle";
    if (sym === "circle") {
      ctx.beginPath();
      ctx.arc(mid, mid, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (sym === "square") {
      roundRect(ctx, mid - r, mid - r, r * 2, r * 2, 1);
      ctx.fill();
      ctx.stroke();
    } else if (sym === "diamond") {
      poly(ctx, [[mid, mid - r], [mid + r, mid], [mid, mid + r], [mid - r, mid]]);
      ctx.fill();
      ctx.stroke();
    } else if (sym === "triangle") {
      poly(ctx, [[mid, mid - r], [mid + r, mid + r], [mid - r, mid + r]]);
      ctx.fill();
      ctx.stroke();
    } else if (sym === "cross") {
      ctx.strokeStyle = l.color;
      ctx.lineWidth = r * 0.9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(mid - r, mid);
      ctx.lineTo(mid + r, mid);
      ctx.moveTo(mid, mid - r);
      ctx.lineTo(mid, mid + r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function poly(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// kelompokkan layer aktif: [judul subgrup, daftar layer]
function groupActive(layers: LayerDef[]): { heading: string; items: LayerDef[] }[] {
  const out: { heading: string; items: LayerDef[] }[] = [];
  for (const g of GROUPS) {
    const inGroup = layers.filter((l) => l.group === g.id);
    if (inGroup.length === 0) continue;
    const noSub = inGroup.filter((l) => !l.subgroup);
    if (noSub.length) out.push({ heading: g.name, items: noSub });
    for (const sg of SUBGROUPS.filter((s) => s.group === g.id)) {
      const items = inGroup.filter((l) => l.subgroup === sg.id);
      if (items.length) out.push({ heading: sg.name, items });
    }
  }
  return out;
}

// wrap teks -> array baris sesuai lebar maksimum
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Render komposisi ekspor ke `canvas`. Mengembalikan tinggi logis terpakai.
 */
export function renderMapExport(canvas: HTMLCanvasElement, opts: ExportOptions): void {
  const W = opts.width ?? 860;
  const pr = opts.pxRatio ?? 2;
  const P = 30;
  const date = opts.date ?? new Date();

  const ctx = canvas.getContext("2d")!;
  // font util
  const sans = (size: number, weight = "400") =>
    `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  const mono = (size: number, weight = "400") =>
    `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;

  // ── ukur kepala ──
  const titleText = opts.title.trim() || `Peta Tematik — Provinsi ${opts.province}`;
  const contentW = W - P * 2;
  ctx.font = sans(26, "700");
  const titleLines = wrap(ctx, titleText, contentW);
  const headTop = P + 30; // di bawah eyebrow
  const titleLH = 32;
  const headerH = headTop + titleLines.length * titleLH + 16 + 22; // judul + subjudul
  const dividerY = P + headerH - 8;

  // ── ukur legenda ──
  const groups = groupActive(opts.layers);
  const legendW = 250;
  const mapW = contentW - legendW - 22;
  const itemH = 22;
  const headingH = 24;
  let legendBodyH = 30; // judul "LEGENDA"
  for (const g of groups) {
    legendBodyH += headingH;
    ctx.font = sans(12.5);
    for (const l of g.items) {
      const lines = wrap(ctx, l.name, legendW - 28);
      legendBodyH += Math.max(itemH, lines.length * 16 + 6);
    }
    legendBodyH += 6;
  }
  if (groups.length === 0) legendBodyH += 22;

  const bodyTop = dividerY + 20;
  const mapH = 420;
  const bodyH = Math.max(mapH, legendBodyH);
  const footerH = 40;
  const H = bodyTop + bodyH + footerH;

  // ── set ukuran canvas (device px) ──
  canvas.width = Math.round(W * pr);
  canvas.height = Math.round(H * pr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(pr, 0, 0, pr, 0, 0);

  // ── latar kartu ──
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 14);
  ctx.stroke();
  // aksen atas
  ctx.fillStyle = ACCENT;
  roundRect(ctx, 0, 0, W, 5, 0);
  ctx.fill();

  // ── kepala: eyebrow + tanggal ──
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ACCENT;
  ctx.font = sans(11, "700");
  ctx.fillText("DITPIT · BAPPENAS", P, P + 12);
  ctx.fillStyle = SUBTLE;
  ctx.font = mono(11);
  const dStr = formatDate(date);
  ctx.textAlign = "right";
  ctx.fillText(dStr, W - P, P + 12);
  ctx.textAlign = "left";

  // judul
  ctx.fillStyle = INK;
  ctx.font = sans(26, "700");
  titleLines.forEach((ln, i) => ctx.fillText(ln, P, headTop + 22 + i * titleLH));
  // subjudul
  ctx.fillStyle = SUBTLE;
  ctx.font = sans(13);
  const sub = `Provinsi ${opts.province} · ${opts.layers.length} layer aktif`;
  ctx.fillText(sub, P, headTop + titleLines.length * titleLH + 14);

  // divider
  ctx.strokeStyle = HAIR;
  ctx.beginPath();
  ctx.moveTo(P, dividerY);
  ctx.lineTo(W - P, dividerY);
  ctx.stroke();

  // ── panel peta ──
  const mx = P;
  const my = bodyTop;
  ctx.fillStyle = "#0c1422";
  roundRect(ctx, mx, my, mapW, mapH, 10);
  ctx.fill();
  ctx.save();
  roundRect(ctx, mx, my, mapW, mapH, 10);
  ctx.clip();
  if (opts.mapImage) {
    // cover-fit tangkapan peta asli
    const iw = (opts.mapImage as HTMLCanvasElement).width || mapW;
    const ih = (opts.mapImage as HTMLCanvasElement).height || mapH;
    const scale = Math.max(mapW / iw, mapH / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(opts.mapImage, mx + (mapW - dw) / 2, my + (mapH - dh) / 2, dw, dh);
  } else {
    // grid placeholder (sama gaya dengan kanvas di dashboard)
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let gx = mx; gx < mx + mapW; gx += 34) {
      ctx.beginPath(); ctx.moveTo(gx, my); ctx.lineTo(gx, my + mapH); ctx.stroke();
    }
    for (let gy = my; gy < my + mapH; gy += 34) {
      ctx.beginPath(); ctx.moveTo(mx, gy); ctx.lineTo(mx + mapW, gy); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = sans(12, "600");
    ctx.textAlign = "center";
    ctx.fillText("PRATINJAU PETA", mx + mapW / 2, my + mapH / 2 + 4);
    ctx.font = sans(10);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText("kanvas peta tampil di sini saat layer dirender", mx + mapW / 2, my + mapH / 2 + 22);
    ctx.textAlign = "left";
  }
  ctx.restore();
  // bingkai peta
  ctx.strokeStyle = HAIR;
  roundRect(ctx, mx, my, mapW, mapH, 10);
  ctx.stroke();

  // panah utara
  const nx = mx + mapW - 24, ny = my + 26;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  poly(ctx, [[nx, ny - 12], [nx + 6, ny + 6], [nx, ny + 1], [nx - 6, ny + 6]]);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = sans(10, "700");
  ctx.textAlign = "center";
  ctx.fillText("U", nx, ny - 15);
  ctx.textAlign = "left";

  // skala bar (placeholder visual)
  const sbx = mx + 18, sby = my + mapH - 20, sbw = 88;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sbx, sby); ctx.lineTo(sbx, sby - 5);
  ctx.moveTo(sbx, sby); ctx.lineTo(sbx + sbw, sby);
  ctx.moveTo(sbx + sbw, sby); ctx.lineTo(sbx + sbw, sby - 5);
  ctx.stroke();
  ctx.font = sans(9.5);
  ctx.fillText("skala", sbx, sby - 8);

  // ── legenda ──
  const lx = mx + mapW + 22;
  let ly = bodyTop + 4;
  ctx.fillStyle = PANEL_BG;
  roundRect(ctx, lx, bodyTop, legendW, bodyH, 10);
  ctx.fill();
  ctx.strokeStyle = HAIR;
  roundRect(ctx, lx, bodyTop, legendW, bodyH, 10);
  ctx.stroke();

  const padX = lx + 14;
  ly = bodyTop + 22;
  ctx.fillStyle = INK;
  ctx.font = sans(11, "700");
  ctx.fillText("LEGENDA", padX, ly);
  ly += 16;

  if (groups.length === 0) {
    ctx.fillStyle = SUBTLE;
    ctx.font = sans(12);
    ctx.fillText("Belum ada layer aktif.", padX, ly + 6);
  }

  for (const g of groups) {
    ctx.fillStyle = ACCENT;
    ctx.font = sans(10.5, "700");
    ctx.fillText(g.heading.toUpperCase(), padX, ly + 10);
    ly += headingH;
    for (const l of g.items) {
      drawSwatch(ctx, l, padX, ly - 13, 16);
      ctx.fillStyle = INK;
      ctx.font = sans(12.5);
      const lines = wrap(ctx, l.name, legendW - 28);
      lines.forEach((ln, i) => ctx.fillText(ln, padX + 24, ly - 1 + i * 15));
      ly += Math.max(itemH, lines.length * 16 + 6);
    }
    ly += 6;
  }

  // ── footer ──
  const fy = bodyTop + bodyH + 22;
  ctx.strokeStyle = HAIR;
  ctx.beginPath();
  ctx.moveTo(P, fy - 12);
  ctx.lineTo(W - P, fy - 12);
  ctx.stroke();
  ctx.fillStyle = SUBTLE;
  ctx.font = sans(10.5);
  ctx.fillText("Sumber: Direktorat (DITPIT) · Kementerian PPN/Bappenas", P, fy + 2);
  ctx.textAlign = "right";
  ctx.font = mono(10.5);
  ctx.fillText(`Dibuat ${dStr}`, W - P, fy + 2);
  ctx.textAlign = "left";
}
