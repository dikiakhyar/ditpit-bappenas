// Bangun ulang poligon kab/kota untuk choropleth:
//   public/data/maluku_nusra.geojson  (batas 53 kab/kota, properti: nama, prov)
//   public/data/profil.json           (daftar wilayah & kode BPS dari Database PIT)
// → public/data/kabkota.geojson       (poligon + kode BPS yang benar)
//
// Nilai indikator (Data Makro) TIDAK lagi dibuat di sini — dihitung langsung dari
// database spreadsheet saat situs dibuka (lihat lib/makro.ts).
// Jalankan:  node scripts/build-map-data.mjs
// (ulangi bila file batas wilayah diganti — mis. SHP baru se-wilayah timur)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const PROVS = { "5200": "Nusa Tenggara Barat", "5300": "Nusa Tenggara Timur", "8100": "Maluku", "8200": "Maluku Utara" };
const P = read("profil.json");
const R = P.regions;

// ── 1. kabkota.geojson: cocokkan nama poligon → kode BPS ──────────────────────
const norm = (s) => s.toLowerCase().replace(/^(kab\.?|kabupaten|kota)\s+/, "").trim();
const cands = Object.entries(R).filter(([c]) => PROVS[c.slice(0, 2) + "00"] && !c.endsWith("00"));
const src = read("maluku_nusra.geojson");
const used = new Set();
const features = src.features.map((f) => {
  const { nama, prov } = f.properties;
  const pc = Object.keys(PROVS).find((k) => PROVS[k] === prov);
  if (!pc) throw new Error(`Provinsi tidak dikenal: ${prov}`);
  const kota = nama.toLowerCase().startsWith("kota");
  const hits = cands.filter(([c, r]) => c.slice(0, 2) === pc.slice(0, 2) && norm(r.n) === norm(nama) && r.n.startsWith("Kota") === kota);
  if (hits.length !== 1) throw new Error(`Tidak bisa memetakan "${nama}" (${prov}) ke satu kode BPS: ${JSON.stringify(hits)}`);
  const [kode, r] = hits[0];
  if (used.has(kode)) throw new Error(`Kode ganda ${kode}`);
  used.add(kode);
  return { type: "Feature", properties: { kode, nama: r.n, provinsi: prov }, geometry: f.geometry };
});
features.sort((a, b) => a.properties.kode.localeCompare(b.properties.kode));
const missing = cands.filter(([c]) => !used.has(c)).map(([c, r]) => `${c} ${r.n}`);
if (missing.length) console.warn("Kab/kota tanpa poligon:", missing.join(", "));
writeFileSync(join(DATA, "kabkota.geojson"), JSON.stringify({ type: "FeatureCollection", features }));

console.log(`kabkota.geojson: ${features.length} kab/kota`);
