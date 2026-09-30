// GET /api/kawasan-prioritas — Daftar Kawasan Prioritas Provinsi RPJMN 2025–2029,
// dibaca langsung dari spreadsheet (lib/db/kawasan-source.ts), cache server ±5 menit.
// ?refresh=1 → baca ulang spreadsheet sekarang (wajib ?token= bila DATABASE_REFRESH_TOKEN diisi).
//
// Memperbarui salinan lokal: buka endpoint ini saat situs berjalan, simpan hasilnya sebagai
// public/data/kawasan-prioritas.json, lalu commit (hanya cadangan saat Google tak terjangkau).

import { getKawasan, KAWASAN_REFRESH_SECONDS } from "@/lib/db/kawasan-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const need = process.env.DATABASE_REFRESH_TOKEN;
  const force = q.get("refresh") === "1" && (!need || q.get("token") === need);
  const raw = await getKawasan({ force });
  const live = raw.source.kind === "spreadsheet";
  return Response.json(raw, {
    headers: {
      "x-data-source": raw.source.kind,
      "cache-control": live && !force ? `public, s-maxage=${KAWASAN_REFRESH_SECONDS}, stale-while-revalidate=3600` : "no-store",
    },
  });
}
