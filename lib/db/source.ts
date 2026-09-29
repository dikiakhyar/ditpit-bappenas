// Sumber database: Google Spreadsheet "Database PIT".
// Situs mengunduh spreadsheet ini langsung (tanpa git push); hasilnya di-cache
// beberapa menit oleh route /api/database. Bila Google tak terjangkau,
// situs memakai salinan lokal public/data/profil.json.
//
// Syarat: berkas dibagikan "Siapa saja yang memiliki link → Pelihat".
// Ganti spreadsheet tanpa mengubah kode: set env DATABASE_SHEET_ID
// (atau DATABASE_XLSX_URL untuk URL .xlsx langsung).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProfilData } from "@/lib/profil/engine";
import { buildDataset, type BuildStats } from "./build";

export const SHEET_ID = process.env.DATABASE_SHEET_ID || "1Zq54xcuR-Ma9vGY6mQAdSbDwjUaPPDCezSMmeb6tIP4";
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
/** Umur cache (detik) sebelum spreadsheet dibaca ulang. */
export const REFRESH_SECONDS = 300;

export interface DataSourceInfo {
  kind: "spreadsheet" | "snapshot";
  fetchedAt: string; // ISO
  sheetUrl: string;
  note?: string;
  stats?: BuildStats;
  /** true = salinan lokal sementara; spreadsheet sedang dibaca di latar belakang */
  refreshing?: boolean;
}
export type Database = ProfilData & { source: DataSourceInfo };

// Berkas .xlsx di Drive & Google Sheets asli punya jalur unduh berbeda — coba berurutan.
const downloadUrls = (id: string) => [
  // opsional: URL .xlsx langsung (mis. bila database dipindah dari Google Drive)
  ...(process.env.DATABASE_XLSX_URL ? [process.env.DATABASE_XLSX_URL] : []),
  `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
  `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
  `https://drive.google.com/uc?export=download&id=${id}`,
];

async function downloadWorkbook(): Promise<Uint8Array> {
  const errors: string[] = [];
  for (const url of downloadUrls(SHEET_ID)) {
    try {
      const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(25_000) });
      if (!res.ok) {
        errors.push(`${res.status} ${new URL(url).host}`);
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      // .xlsx = arsip zip → diawali "PK"; halaman login/peringatan Google berupa HTML
      if (buf[0] === 0x50 && buf[1] === 0x4b) return buf;
      errors.push(`bukan .xlsx dari ${new URL(url).host} (periksa izin berbagi)`);
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join("; "));
}

async function readSnapshot(): Promise<ProfilData> {
  const raw = await readFile(join(process.cwd(), "public", "data", "profil.json"), "utf8");
  return JSON.parse(raw) as ProfilData;
}

/** Baca database: spreadsheet langsung, atau salinan lokal bila gagal. */
export async function loadDatabase(): Promise<Database> {
  try {
    const buf = await downloadWorkbook();
    const { data, stats } = await buildDataset(buf);
    return { ...data, source: { kind: "spreadsheet", fetchedAt: new Date().toISOString(), sheetUrl: SHEET_URL, stats } };
  } catch (e) {
    const data = await readSnapshot();
    return {
      ...data,
      source: {
        kind: "snapshot",
        fetchedAt: new Date().toISOString(),
        sheetUrl: SHEET_URL,
        note: `Spreadsheet tidak dapat dibaca (${(e as Error).message}). Menampilkan salinan lokal.`,
      },
    };
  }
}

// ── cache di memori server (stale-while-revalidate) ───────────────────────
// Spreadsheet dibaca paling sering sekali per REFRESH_SECONDS. Pengunjung selalu
// langsung mendapat data terakhir; pembacaan ulang berjalan di latar belakang.
// Bila Google sedang gagal, data spreadsheet terakhir yang berhasil tetap dipakai.
type Mem = { db: Database; at: number };
const g = globalThis as unknown as { __ditpitDb?: Mem; __ditpitInflight?: Promise<Database> | null };

function rebuild(): Promise<Database> {
  if (g.__ditpitInflight) return g.__ditpitInflight;
  g.__ditpitInflight = loadDatabase()
    .then((db) => {
      const prev = g.__ditpitDb;
      if (db.source.kind === "snapshot" && prev?.db.source.kind === "spreadsheet") {
        // pertahankan data spreadsheet terakhir, catat kegagalannya
        prev.db = { ...prev.db, source: { ...prev.db.source, note: db.source.note } };
        prev.at = Date.now();
        return prev.db;
      }
      g.__ditpitDb = { db, at: Date.now() };
      return db;
    })
    .finally(() => {
      g.__ditpitInflight = null;
    });
  return g.__ditpitInflight;
}

/** Database dengan cache: `force` = baca ulang spreadsheet sekarang (menunggu hasilnya). */
export async function getDatabase(opts: { force?: boolean } = {}): Promise<Database> {
  const mem = g.__ditpitDb;
  if (opts.force || !mem) return rebuild();
  if (Date.now() - mem.at > REFRESH_SECONDS * 1000) void rebuild().catch(() => {});
  return mem.db;
}

let snapshot: Promise<Database> | null = null;
/**
 * Versi CEPAT untuk pengunjung: tidak pernah menunggu Google.
 * - Ada data di memori → langsung dikembalikan (dibaca ulang di latar bila > 5 menit).
 * - Server baru bangun (cold start) → langsung kirim salinan lokal bertanda `refreshing`,
 *   sementara spreadsheet dibaca di latar. `pending` = pekerjaan latar tsb (untuk after()).
 */
export async function getDatabaseFast(): Promise<{ db: Database; pending: Promise<unknown> | null }> {
  const mem = g.__ditpitDb;
  if (mem) {
    const stale = Date.now() - mem.at > REFRESH_SECONDS * 1000;
    return { db: mem.db, pending: stale ? rebuild().catch(() => {}) : null };
  }
  const pending = rebuild().catch(() => {});
  snapshot ??= readSnapshot()
    .then((d): Database => ({
      ...d,
      source: { kind: "snapshot", fetchedAt: new Date().toISOString(), sheetUrl: SHEET_URL, refreshing: true, note: "Memuat data terbaru dari spreadsheet…" },
    }))
    .catch((e) => {
      snapshot = null;
      throw e;
    });
  try {
    return { db: await snapshot, pending };
  } catch {
    // salinan lokal tak ada → terpaksa menunggu spreadsheet
    return { db: await rebuild(), pending: null };
  }
}
