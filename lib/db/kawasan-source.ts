// Sumber data Kawasan Prioritas Provinsi RPJMN 2025–2029 (tab Layer peta tematik).
// Dibaca LANGSUNG dari Google Spreadsheet/Drive seperti Database PIT: edit spreadsheet →
// tampil di situs dalam ±5 menit, tanpa git push. Bila Google tak terjangkau, dipakai
// salinan lokal public/data/kawasan-prioritas.json.
//
// Syarat: berkas dibagikan "Siapa saja yang memiliki link → Pelihat".
// Ganti berkas tanpa mengubah kode: set env KAWASAN_SHEET_ID.

import { openWorkbook } from "./xlsx";
// salinan lokal di-import (bukan dibaca dari disk) → otomatis ikut dibundel ke fungsi server Vercel
import SNAPSHOT from "@/public/data/kawasan-prioritas.json";
import { KP_COLUMNS, toCanonical, type KawasanRaw } from "@/lib/kawasan-prioritas";

export const KAWASAN_SHEET_ID = process.env.KAWASAN_SHEET_ID || "1yGudSOtfKJ1qwDDHciuXbBYyov5hNoje";
export const KAWASAN_REFRESH_SECONDS = 300;
/** nama sheet data; bila tak ada, dipakai sheet pertama yang punya header "Kode" & "Kabupaten/Kota" */
const SHEET_NAME = "Daftar Kawasan";

// Berkas ini .xlsx yang disimpan di Drive (bukan Google Sheets asli) → jalur unduh berkas
// langsung biasanya paling cepat; jalur export dicoba juga bila berkas dikonversi ke Sheets.
const downloadUrls = (id: string) => [
  `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
  `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
  `https://drive.google.com/uc?export=download&id=${id}`,
];

async function download(): Promise<Uint8Array> {
  const errors: string[] = [];
  for (const url of downloadUrls(KAWASAN_SHEET_ID)) {
    try {
      const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        errors.push(`${res.status} ${new URL(url).host}`);
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf[0] === 0x50 && buf[1] === 0x4b) return buf; // zip = .xlsx
      errors.push(`bukan .xlsx dari ${new URL(url).host} (periksa izin berbagi)`);
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join("; "));
}

function readSheet(buf: Uint8Array): string[][] {
  const book = openWorkbook(buf);
  const asText = (name: string) => book.rows(name).map((r) => r.map((c) => (c == null ? "" : String(c))));
  const names = [SHEET_NAME, ...book.wb.names.filter((n) => n !== SHEET_NAME)];
  for (const n of names) {
    if (!book.wb.names.includes(n)) continue;
    const rows = toCanonical(asText(n));
    if (rows.length) return rows;
  }
  throw new Error(`sheet "${SHEET_NAME}" tidak ditemukan / header tidak dikenali`);
}

async function readSnapshot(): Promise<KawasanRaw> {
  return SNAPSHOT as unknown as KawasanRaw;
}

async function load(): Promise<KawasanRaw> {
  try {
    const rows = readSheet(await download());
    return { source: { kind: "spreadsheet", fetchedAt: new Date().toISOString() }, columns: KP_COLUMNS, rows };
  } catch (e) {
    const snap = await readSnapshot();
    return {
      ...snap,
      source: {
        kind: "snapshot",
        fetchedAt: new Date().toISOString(),
        note: `Spreadsheet tidak dapat dibaca (${(e as Error).message}). Menampilkan salinan lokal.`,
      },
    };
  }
}

// cache memori server (stale-while-revalidate), sama seperti Database PIT
type Mem = { raw: KawasanRaw; at: number };
const g = globalThis as unknown as { __ditpitKp?: Mem; __ditpitKpInflight?: Promise<KawasanRaw> | null };

function rebuild(): Promise<KawasanRaw> {
  if (g.__ditpitKpInflight) return g.__ditpitKpInflight;
  g.__ditpitKpInflight = load()
    .then((raw) => {
      const prev = g.__ditpitKp;
      // spreadsheet sedang gagal → pertahankan hasil spreadsheet terakhir
      if (raw.source.kind === "snapshot" && prev?.raw.source.kind === "spreadsheet") {
        prev.at = Date.now();
        return prev.raw;
      }
      g.__ditpitKp = { raw, at: Date.now() };
      return raw;
    })
    .finally(() => {
      g.__ditpitKpInflight = null;
    });
  return g.__ditpitKpInflight;
}

export async function getKawasan(opts: { force?: boolean } = {}): Promise<KawasanRaw> {
  const mem = g.__ditpitKp;
  if (opts.force || !mem) return rebuild();
  if (Date.now() - mem.at > KAWASAN_REFRESH_SECONDS * 1000) void rebuild().catch(() => {});
  return mem.raw;
}
