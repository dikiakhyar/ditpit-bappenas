// Bangun data batas wilayah peta dari SHP kab/kota se-wilayah timur.
//
//   Masukan : components/KabKotaPIT.shp (+ .dbf/.shx/.prj) — kolom WADMKK (kab/kota), WADMPR (provinsi)
//             public/data/profil.json                       — daftar wilayah & kode BPS (Database PIT)
//   Keluaran: public/data/wilayah.topo.json  — TopoJSON ringan: objek "kabkota" (kode, nama, provinsi)
//                                              dan "provinsi" (kode, nama), batas bersama disimpan sekali
//             public/data/darat.geojson      — daratan sangat sederhana untuk basemap offline
//             lib/peta-wilayah.ts            — daftar kode yang ada di peta (dipakai situs)
//
// Jalankan:  node scripts/build-map-data.mjs [path/ke/file.shp]
// (butuh internet sekali untuk mengunduh alat `mapshaper` via npx)
//
// SHP asli (±200 MB) TIDAK di-commit ke Git (melebihi batas GitHub 100 MB) — cukup hasil di atas.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "public", "data");
const SHP = resolve(process.argv[2] ?? join(ROOT, "components", "KabKotaPIT.shp"));

// Tingkat penyederhanaan: titik-titik yang berjarak < INTERVAL meter dilebur.
// 250 m tetap rapi hingga zoom ±9 (skala kab/kota) dan membuat file ±0,6 MB (±0,2 MB gzip).
const INTERVAL = 250;

const tmp = mkdtempSync(join(tmpdir(), "peta-"));
const mapshaper = (...args) =>
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "mapshaper@0.7", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
const q = (p) => (process.platform === "win32" ? `"${p}"` : p); // spasi pada path Windows

try {
  // ── 1. sederhanakan geometri (topologis: batas antarwilayah tetap berimpit) ──
  const raw = join(tmp, "raw.json");
  mapshaper(
    q(SHP), "-proj", "wgs84", "-clean",
    "-simplify", `interval=${INTERVAL}`, "weighting=0.7", "keep-shapes",
    "-filter-islands", "min-area=0.2km2",
    "-o", "format=geojson", q(raw)
  );

  // ── 2. cocokkan nama kab/kota → kode BPS ──
  const P = JSON.parse(readFileSync(join(DATA, "profil.json"), "utf8"));
  const R = P.regions;
  const provByName = new Map(
    Object.entries(R).filter(([c]) => c !== "0" && Number(c) % 100 === 0).map(([c, r]) => [key(r.n), c])
  );
  // variasi ejaan: "Fak Fak"="Fakfak", "Toli Toli"="Toli-Toli", "Kep. Siau…"="Siau…"
  function key(s) {
    return s.toLowerCase().normalize("NFKD")
      .replace(/^(kab\.?|kabupaten|kota)\s+/, "")
      .replace(/\bkep\.\s*/g, "kepulauan ")
      .replace(/[^a-z]/g, "");
  }
  const noKep = (k) => k.replace(/^kepulauan/, "");

  const src = JSON.parse(readFileSync(raw, "utf8"));
  const used = new Map();
  const errors = [];
  for (const f of src.features) {
    const nama = String(f.properties.WADMKK ?? "").trim();
    const prov = String(f.properties.WADMPR ?? "").trim();
    const pk = provByName.get(key(prov));
    if (!pk) {
      errors.push(`Provinsi "${prov}" tidak ada di database`);
      continue;
    }
    const kota = /^kota\b/i.test(nama);
    // hanya kode yang berawalan kode provinsinya (kode lama sebelum pemekaran Papua otomatis terlewati)
    const cands = Object.entries(R).filter(
      ([c, r]) => c.slice(0, 2) === pk.slice(0, 2) && !c.endsWith("00") && r.n.startsWith("Kota") === kota
    );
    let hits = cands.filter(([, r]) => key(r.n) === key(nama));
    if (!hits.length) hits = cands.filter(([, r]) => noKep(key(r.n)) === noKep(key(nama)));
    if (hits.length !== 1) {
      errors.push(`"${nama}" (${prov}) → ${hits.length ? hits.map((h) => h[0]).join("/") : "tidak ditemukan"}`);
      continue;
    }
    const [kode, r] = hits[0];
    if (used.has(kode)) errors.push(`Kode ${kode} dipakai dua kali ("${used.get(kode)}" & "${nama}")`);
    used.set(kode, nama);
    f.properties = { kode, nama: r.n, provinsi: R[pk].n, pk };
  }
  if (errors.length) throw new Error("Gagal mencocokkan nama wilayah:\n  " + errors.join("\n  "));
  src.features.sort((a, b) => a.properties.kode.localeCompare(b.properties.kode));
  const kab = join(tmp, "kab.json");
  writeFileSync(kab, JSON.stringify(src));

  // ── 3. TopoJSON: kab/kota + provinsi (hasil peleburan) dalam satu file ──
  const topo = join(DATA, "wilayah.topo.json");
  mapshaper(
    "-i", q(kab), "name=kabkota",
    "-dissolve", "pk", "copy-fields=provinsi", "+", "name=provinsi",
    "-rename-fields", "target=provinsi", "kode=pk,nama=provinsi",
    "-filter-fields", "target=kabkota", "kode,nama,provinsi",
    "-o", "target=kabkota,provinsi", "format=topojson", "quantization=100000", q(topo)
  );

  // ── 4. daratan untuk basemap offline (tanpa batas kab/kota, sangat ringan) ──
  const darat = join(DATA, "darat.geojson");
  mapshaper(
    "-i", q(kab), "-dissolve", "-simplify", "interval=1500", "keep-shapes",
    "-o", "format=geojson", "precision=0.001", q(darat)
  );

  // ── 5. daftar kode untuk situs ──
  const provs = [...new Set(src.features.map((f) => f.properties.pk))].sort();
  const kabs = src.features.map((f) => f.properties.kode);
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === "number") {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]);
    } else c.forEach(walk);
  };
  src.features.forEach((f) => walk(f.geometry.coordinates));
  const r2 = (x) => Math.round(x * 100) / 100;
  writeFileSync(
    join(ROOT, "lib", "peta-wilayah.ts"),
    `// DIBUAT OTOMATIS oleh scripts/build-map-data.mjs — jangan diedit manual.
// Wilayah yang punya batas di public/data/wilayah.topo.json.
export const MAP_PROV_CODES = ${JSON.stringify(provs)} as const;
export const MAP_KAB_CODES: readonly string[] = ${JSON.stringify(kabs)};
/** Batas cakupan peta [[barat, selatan], [timur, utara]]. */
export const MAP_BOUNDS: [[number, number], [number, number]] = [[${r2(w)}, ${r2(s)}], [${r2(e)}, ${r2(n)}]];
`
  );

  const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;
  console.log(`\n✓ ${kabs.length} kab/kota · ${provs.length} provinsi`);
  console.log(`  wilayah.topo.json ${kb(topo)} · darat.geojson ${kb(darat)} (dari SHP ${(statSync(SHP).size / 1048576).toFixed(0)} MB)`);
  const missing = Object.entries(R)
    .filter(([c]) => provs.includes(c.slice(0, 2) + "00") && !c.endsWith("00") && !used.has(c))
    .map(([c, r]) => `${c} ${r.n}`);
  if (missing.length) console.log(`  Kode di database tanpa poligon (umumnya kode lama sebelum pemekaran): ${missing.join(", ")}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
