// POST /api/database/refresh — baca ulang spreadsheet sekarang juga
// (tombol "Perbarui sekarang"). Bila env DATABASE_REFRESH_TOKEN diisi,
// permintaan wajib menyertakan ?token=<nilai yang sama>.

import { getDatabase } from "@/lib/db/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const need = process.env.DATABASE_REFRESH_TOKEN;
  if (need && new URL(req.url).searchParams.get("token") !== need) {
    return Response.json({ ok: false, error: "token salah" }, { status: 401 });
  }
  const db = await getDatabase({ force: true });
  return Response.json({ ok: true, source: db.source });
}
