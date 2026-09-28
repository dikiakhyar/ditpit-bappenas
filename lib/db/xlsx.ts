// Pembaca .xlsx minimal & cepat (tanpa SheetJS) khusus untuk Database PIT.
// - Sheet biasa di-unzip sekaligus lalu diurai per baris.
// - Sheet raksasa (mis. "Indeks Desa", ±200 MB XML) diurai secara STREAMING
//   sehingga memori tetap kecil: baris diproses satu per satu lalu dibuang.

import { Unzip, UnzipInflate, unzipSync, strFromU8 } from "fflate";

export type CellValue = number | string | boolean | null;
export type Row = CellValue[];

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function decodeXml(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] ?? m;
  });
}

function colIndex(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export interface Workbook {
  names: string[];
  /** path zip untuk tiap nama sheet, mis. "xl/worksheets/sheet12.xml" */
  paths: Record<string, string>;
  shared: string[];
  dateStyles: Set<number>;
}

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function parseShared(xml: string): string[] {
  const out: string[] = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    let t = "";
    const rt = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let k: RegExpExecArray | null;
    while ((k = rt.exec(m[1]))) t += k[1];
    out.push(decodeXml(t));
  }
  return out;
}

function parseDateStyles(xml: string | undefined): Set<number> {
  const set = new Set<number>();
  if (!xml) return set;
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt [^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) custom.set(+m[1], decodeXml(m[2]));
  const xfs = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  let i = 0;
  for (const m of xfs.matchAll(/<xf\b([^>]*)\/?>/g)) {
    const id = +(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    const code = custom.get(id);
    const isDate = BUILTIN_DATE.has(id) || (!!code && /[dmy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]/g, "")));
    if (isDate) set.add(i);
    i++;
  }
  return set;
}

/** Baca struktur workbook + semua sheet kecuali yang disebut `streamOnly`. */
export function openWorkbook(buf: Uint8Array, streamOnly: string[] = []) {
  // pertama: metadata saja (workbook, rels, sharedStrings, styles)
  const meta = unzipSync(buf, {
    filter: (f) => ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml", "xl/styles.xml"].includes(f.name),
  });
  const wbXml = strFromU8(meta["xl/workbook.xml"]);
  const rels = strFromU8(meta["xl/_rels/workbook.xml.rels"]);
  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = m[1].match(/Id="([^"]+)"/)?.[1];
    const t = m[1].match(/Target="([^"]+)"/)?.[1];
    if (id && t) target.set(id, t.startsWith("/") ? t.slice(1) : "xl/" + t);
  }
  const names: string[] = [];
  const paths: Record<string, string> = {};
  for (const m of wbXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decodeXml(m[1].match(/name="([^"]*)"/)?.[1] ?? "");
    const rid = m[1].match(/r:id="([^"]+)"/)?.[1] ?? "";
    const p = target.get(rid);
    if (name && p) {
      names.push(name);
      paths[name] = p;
    }
  }
  const wb: Workbook = {
    names,
    paths,
    shared: meta["xl/sharedStrings.xml"] ? parseShared(strFromU8(meta["xl/sharedStrings.xml"])) : [],
    dateStyles: parseDateStyles(meta["xl/styles.xml"] ? strFromU8(meta["xl/styles.xml"]) : undefined),
  };
  const skip = new Set(streamOnly.map((n) => paths[n]).filter(Boolean));
  const want = new Set(Object.values(paths).filter((p) => !skip.has(p)));
  const files = unzipSync(buf, { filter: (f) => want.has(f.name) });
  return {
    wb,
    /** Semua baris sebuah sheet (non-streaming). */
    rows(name: string): Row[] {
      const p = paths[name];
      const f = p ? files[p] : undefined;
      if (!f) return [];
      const out: Row[] = [];
      parseRows(strFromU8(f), wb, (r) => out.push(r));
      return out;
    },
    /** Proses sheet besar baris demi baris langsung dari zip (hemat memori). */
    streamRows(name: string, onRow: (r: Row, rowNum: number) => void): Promise<void> {
      const p = paths[name];
      if (!p) return Promise.resolve();
      return streamSheet(buf, p, wb, onRow);
    },
  };
}

// ── pengurai baris ────────────────────────────────────────────────────────
const ROW_RE = /<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g;
const CELL_RE = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

function cellValue(attrs: string, inner: string | undefined, wb: Workbook): { col: number; v: CellValue; date: boolean } {
  const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1] ?? "";
  const t = attrs.match(/\bt="(\w+)"/)?.[1];
  const s = attrs.match(/\bs="(\d+)"/)?.[1];
  const col = colIndex(ref);
  let v: CellValue = null;
  if (inner) {
    if (t === "inlineStr") {
      const m = inner.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g);
      v = m ? decodeXml(m.map((x) => x.replace(/<[^>]+>/g, "")).join("")) : "";
    } else {
      const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (raw != null) {
        if (t === "s") v = wb.shared[+raw] ?? null;
        else if (t === "str") v = decodeXml(raw);
        else if (t === "b") v = raw === "1";
        else if (t === "e") v = null;
        else {
          const n = Number(raw);
          v = Number.isFinite(n) ? n : decodeXml(raw);
        }
      }
    }
  }
  return { col, v, date: s != null && wb.dateStyles.has(+s) && typeof v === "number" };
}

/** Baris sebagai array; sel bergaya tanggal dikembalikan sebagai "\u0001<serial>" (lihat DATE_MARK). */
function parseRows(xml: string, wb: Workbook, onRow: (r: Row, rowNum: number) => void) {
  ROW_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROW_RE.exec(xml))) {
    const attrs = m[1] ?? m[3] ?? "";
    const rowNum = +(attrs.match(/\br="(\d+)"/)?.[1] ?? 0);
    onRow(parseRowInner(m[2] ?? "", wb), rowNum);
  }
}

function parseRowInner(inner: string, wb: Workbook): Row {
  const r: Row = [];
  CELL_RE.lastIndex = 0;
  let c: RegExpExecArray | null;
  while ((c = CELL_RE.exec(inner))) {
    const cv = cellValue(c[1], c[2], wb);
    if (cv.col < 0) continue;
    // tanggal di baris header ditandai "\u0001<serial>" → diformat oleh pemanggil
    r[cv.col] = cv.date ? DATE_MARK + String(cv.v) : cv.v;
  }
  for (let i = 0; i < r.length; i++) if (r[i] === undefined) r[i] = null;
  return r;
}

export const DATE_MARK = "\u0001";
export const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** Serial tanggal Excel → {tahun, bulan 1–12}. */
export function excelDate(serial: number): { y: number; m: number; d: number } {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function streamSheet(buf: Uint8Array, path: string, wb: Workbook, onRow: (r: Row, rowNum: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const dec = new TextDecoder();
    let carry = "";
    let done = false;
    const uz = new Unzip((file) => {
      if (file.name !== path) return;
      file.ondata = (err, chunk, final) => {
        if (err) return reject(err);
        carry += dec.decode(chunk, { stream: !final });
        const end = carry.lastIndexOf("</row>");
        if (end >= 0) {
          parseRows(carry.slice(0, end + 6), wb, onRow);
          carry = carry.slice(end + 6);
        }
        if (final) {
          done = true;
          resolve();
        }
      };
      file.start();
    });
    uz.register(UnzipInflate);
    try {
      // umpankan per potongan agar tidak menahan seluruh XML di memori
      const STEP = 1 << 20;
      for (let i = 0; i < buf.length; i += STEP) uz.push(buf.subarray(i, Math.min(buf.length, i + STEP)), i + STEP >= buf.length);
      if (!done) resolve();
    } catch (e) {
      reject(e);
    }
  });
}
