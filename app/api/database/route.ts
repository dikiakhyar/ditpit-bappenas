// GET /api/database — seluruh data Profil Daerah & Peta, dibaca langsung dari
// Google Spreadsheet (lib/db/source.ts). Server menyimpan hasilnya ±5 menit;
// edit spreadsheet → tampil di situs paling lambat ±5 menit, tanpa git push.
//
// Supaya ringan: respons dikompres gzip (±3 MB → ±0,5 MB), memakai ETag, dan saat
// server baru bangun langsung menjawab dengan salinan lokal sambil membaca
// spreadsheet di latar belakang (pengunjung tidak menunggu unduhan Google).

import { after } from "next/server";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { getDatabaseFast, REFRESH_SECONDS, type Database } from "@/lib/db/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// hasil serialisasi + kompresi di-cache per objek database (dibuat sekali, dipakai semua pengunjung)
const packed = new WeakMap<Database, { json: string; gz: Buffer; etag: string }>();
function pack(db: Database) {
  let p = packed.get(db);
  if (!p) {
    const json = JSON.stringify(db);
    p = { json, gz: gzipSync(json, { level: 6 }), etag: `"${createHash("sha1").update(json).digest("base64url").slice(0, 20)}"` };
    packed.set(db, p);
  }
  return p;
}

export async function GET(req: Request) {
  const { db, pending } = await getDatabaseFast();
  if (pending) after(() => pending); // biarkan pembacaan spreadsheet selesai walau respons sudah dikirim

  const { json, gz, etag } = pack(db);
  const live = db.source.kind === "spreadsheet";
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "x-data-source": db.source.kind,
    etag,
    vary: "accept-encoding",
    // data spreadsheet boleh disimpan CDN ±5 menit; salinan sementara jangan disimpan
    "cache-control": live ? `public, s-maxage=${REFRESH_SECONDS}, stale-while-revalidate=3600` : "no-store",
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  if (/\bgzip\b/.test(req.headers.get("accept-encoding") ?? "")) {
    return new Response(new Uint8Array(gz), { headers: { ...headers, "content-encoding": "gzip" } });
  }
  return new Response(json, { headers });
}
