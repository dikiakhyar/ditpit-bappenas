// GET /api/database — seluruh data Profil Daerah & Peta, dibaca langsung dari
// Google Spreadsheet (lib/db/source.ts). Server menyimpan hasilnya ±5 menit;
// edit spreadsheet → tampil di situs paling lambat ±5 menit, tanpa git push.

import { getDatabase, REFRESH_SECONDS } from "@/lib/db/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const db = await getDatabase();
  return Response.json(db, {
    headers: {
      "x-data-source": db.source.kind,
      // CDN (mis. Vercel) boleh menyimpan respons ±5 menit
      "cache-control": `public, s-maxage=${REFRESH_SECONDS}, stale-while-revalidate=3600`,
    },
  });
}
