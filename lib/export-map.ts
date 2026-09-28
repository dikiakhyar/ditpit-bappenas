// Ekspor peta → PNG, APA ADANYA: tangkapan kanvas MapLibre persis seperti di
// layar (basemap + choropleth + layer aktif), ditambah panel LEGENDA berisi
// simbol & keterangannya di sisi kanan. Tanpa judul, kop, atau tata letak lain.
// Canvas 2D murni — tanpa dependensi tambahan.

import { GROUPS, SUBGROUPS, type LayerDef } from "@/lib/layers";

export interface LegendClass {
  color: string;
  label: string;
  outline?: boolean; // gambar sebagai garis tepi (mis. wilayah terpilih)
}
export interface LegendModel {
  /** choropleth Data Makro */
  makro?: { title: string; sub?: string; classes: LegendClass[] };
  /** layer tematik/administrasi yang aktif */
  layers: LayerDef[];
  /** wilayah yang sedang disorot */
  selected?: string;
  /** atribusi basemap (wajib menurut lisensi OSM/CARTO/Esri) */
  attribution?: string;
}

const INK = "#182433";
const SUBTLE = "#5d6b80";
const HAIR = "#e3e7ee";
const FONT = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';

// ── swatch di canvas (cermin komponen Swatch.tsx) ─────────────────────────
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

// ── legenda ──────────────────────────────────────────────────────────────
const LW = 260; // lebar logis panel legenda
const PAD = 16;

interface Op {
  h: number;
  draw: (ctx: CanvasRenderingContext2D, y: number) => void;
}

function legendOps(ctx: CanvasRenderingContext2D, m: LegendModel): Op[] {
  const ops: Op[] = [];
  const inner = LW - PAD * 2;
  const text = (t: string, font: string, color: string, lh: number) => {
    ctx.font = font;
    for (const line of wrap(ctx, t, inner)) {
      ops.push({
        h: lh,
        draw: (c, y) => {
          c.font = font;
          c.fillStyle = color;
          c.textBaseline = "top";
          c.fillText(line, PAD, y);
        },
      });
    }
  };
  const gap = (h: number) => ops.push({ h, draw: () => {} });
  const row = (sw: (c: CanvasRenderingContext2D, x: number, y: number) => void, label: string) => {
    ctx.font = `12px ${FONT}`;
    const lines = wrap(ctx, label, inner - 26);
    const h = Math.max(18, lines.length * 15 + 3);
    ops.push({
      h,
      draw: (c, y) => {
        sw(c, PAD, y + 1);
        c.font = `12px ${FONT}`;
        c.fillStyle = INK;
        c.textBaseline = "top";
        lines.forEach((ln, i) => c.fillText(ln, PAD + 26, y + 2 + i * 15));
      },
    });
  };

  text("LEGENDA", `600 11px ${FONT}`, SUBTLE, 18);
  gap(4);

  if (m.makro) {
    text(m.makro.title, `600 12.5px ${FONT}`, INK, 16);
    if (m.makro.sub) text(m.makro.sub, `11.5px ${FONT}`, SUBTLE, 15);
    gap(6);
    for (const k of m.makro.classes)
      row((c, x, y) => {
        c.fillStyle = k.color;
        roundRect(c, x, y, 18, 14, 2);
        c.fill();
        c.strokeStyle = "rgba(24,36,51,0.18)";
        c.lineWidth = 1;
        c.stroke();
      }, k.label);
    gap(10);
  }

  if (m.selected) {
    row((c, x, y) => {
      c.strokeStyle = "#0b2540";
      c.lineWidth = 2.2;
      roundRect(c, x + 1, y + 1, 16, 12, 2);
      c.stroke();
    }, `Wilayah terpilih: ${m.selected}`);
    gap(10);
  }

  for (const g of groupActive(m.layers)) {
    text(g.heading, `600 11.5px ${FONT}`, SUBTLE, 16);
    gap(2);
    for (const l of g.items) row((c, x, y) => drawSwatch(c, l, x + 1, y - 1, 16), l.name);
    gap(8);
  }

  if (m.attribution) {
    gap(4);
    ops.push({
      h: 1,
      draw: (c, y) => {
        c.fillStyle = HAIR;
        c.fillRect(PAD, y, inner, 1);
      },
    });
    gap(6);
    text(`Peta dasar: ${m.attribution}`, `10.5px ${FONT}`, SUBTLE, 14);
  }
  return ops;
}

/** Tinggi logis legenda (untuk menyesuaikan tinggi gambar). */
function legendHeight(ops: Op[]) {
  return PAD + ops.reduce((a, o) => a + o.h, 0) + PAD;
}

/** Gambar legenda saja ke `canvas` (dipakai pratinjau & unduhan "legenda saja"). */
export function renderLegend(canvas: HTMLCanvasElement, model: LegendModel, pxRatio = 2): void {
  const probe = canvas.getContext("2d")!;
  const ops = legendOps(probe, model);
  const H = Math.ceil(legendHeight(ops));
  canvas.width = LW * pxRatio;
  canvas.height = H * pxRatio;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LW, H);
  let y = PAD;
  for (const o of legendOps(ctx, model)) {
    o.draw(ctx, y);
    y += o.h;
  }
}

/**
 * Peta (kanvas MapLibre apa adanya) + legenda di kanan → satu PNG.
 * `mapCanvas` harus dari peta dengan preserveDrawingBuffer:true.
 */
export function composeMapExport(mapCanvas: HTMLCanvasElement, model: LegendModel, dpr: number): HTMLCanvasElement {
  const legend = document.createElement("canvas");
  renderLegend(legend, model, dpr);
  const mw = mapCanvas.width, mh = mapCanvas.height;
  const out = document.createElement("canvas");
  out.width = mw + legend.width;
  out.height = Math.max(mh, legend.height);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(mapCanvas, 0, 0);
  ctx.drawImage(legend, mw, 0);
  // garis pemisah tipis antara peta & legenda
  ctx.fillStyle = HAIR;
  ctx.fillRect(mw, 0, Math.max(1, Math.round(dpr)), out.height);
  return out;
}

/** Unduh kanvas sebagai PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, "image/png");
}
