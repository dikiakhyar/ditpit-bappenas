// Bangun ulang data peta dari sumber resmi:
//   public/data/maluku_nusra.geojson  (batas 53 kab/kota, properti: nama, prov)
//   public/data/profil.json           (Database PIT — sama dengan halaman Profil Daerah)
// → public/data/kabkota.geojson       (poligon + kode BPS yang benar)
// → public/data/makro.json            (nilai indikator + peringkat provinsi, lihat lib/makro.ts)
//
// Jalankan:  node scripts/build-map-data.mjs
// (ulangi setiap kali profil.json atau maluku_nusra.geojson diperbarui)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const PROVS = { "5200": "Nusa Tenggara Barat", "5300": "Nusa Tenggara Timur", "8100": "Maluku", "8200": "Maluku Utara" };
const P = read("profil.json");
const R = P.regions, S = P.sheets;
const isN = (v) => typeof v === "number" && Number.isFinite(v);

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

// ── 2. makro.json dari profil.json ────────────────────────────────────────────
const codes = features.map((f) => f.properties.kode);
const at = (sheet, code, item, per) => {
  const s = S[sheet];
  const i = s?.p.indexOf(per) ?? -1;
  const v = i >= 0 ? s.r[code]?.[item]?.[i] : null;
  return v ?? null;
};
const num = (sheet, item, per) => (c) => {
  const v = at(sheet, c, item, per);
  return isN(v) ? v : null;
};
// penduduk (ribu jiwa) = PDRB ADHB (miliar Rp) ÷ PDRB per kapita ADHB (ribu Rp) × 1000
const pend = (c) => {
  const a = at("ADHB", c, "Produk Domestik Bruto", "2025"), k = at("ADHB Per Kapita", c, "", "2025");
  return isN(a) && isN(k) && k > 0 ? (a / k) * 1000 : null;
};
const apbd = (item) => num("Postur APBD", item, "2025");
const ratio = (a, b) => (c) => {
  const x = apbd(a)(c), y = apbd(b)(c);
  return isN(x) && isN(y) && y > 0 ? (x / y) * 100 : null;
};
const titleCase = (s) => (typeof s === "string" ? s.trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) : null);
// kelas IRBI menurut BNPB: rendah ≤ 72, sedang 72–144, tinggi > 144
const irbiKelas = (c) => {
  const v = at("IRBI", c, "IRBI", "2024");
  return isN(v) ? (v <= 72 ? "Rendah" : v <= 144 ? "Sedang" : "Tinggi") : null;
};
const round = (v, d = 4) => (isN(v) ? Math.round(v * 10 ** d) / 10 ** d : v);

/** [key, getter, sense]  sense: "high" | "low" | null (null = tanpa peringkat / kategorikal) */
const COLS = [];
const add = (key, get, sense = "high") => COLS.push([key, get, sense]);
const years = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

add("jumlah_penduduk", pend, "high");
add("persentase_penduduk", (c) => {
  const p = pend(c), q = pend(c.slice(0, 2) + "00");
  return isN(p) && isN(q) && q > 0 ? (p / q) * 100 : null;
});
add("kepadatan", (c) => {
  const p = pend(c), l = at("Luas Wilayah", c, "Luas Wilayah (km2)", "2025");
  return isN(p) && isN(l) && l > 0 ? (p * 1000) / l : null;
});
for (const y of years(2020, 2025)) add(`tpt_${y}`, num("TPT", "Tingkat Pengangguran Terbuka (TPT)", `Agu ${y}`), "low");
for (const y of years(2021, 2025)) add(`tpak_${y}`, num("TPT", "Tingkat Partisipasi Angkatan Kerja (TPAK)", `Agu ${y}`), "high");
for (const y of years(2020, 2025)) add(`ppm_${y}`, num("Kemiskinan", "Persentase Penduduk Miskin", `Mar ${y}`), "low");
for (const y of years(2020, 2025)) add(`gini_${y}`, (c) => num("Rasio Gini", "", `Mar ${y}`)(c) ?? num("Rasio Gini", "", `${y}`)(c), "low");
for (const y of years(2020, 2025)) add(`lpe_${y}`, num("LPE", "Produk Domestik Bruto", `${y}`), "high");
for (const id of ["ipm", "hls", "rls", "uhh"])
  for (const y of years(2020, 2025)) add(`${id}_${y}`, num(id.toUpperCase(), "", `${y}`), "high");
for (const y of years(2021, 2024)) add(`stunting_${y}`, num("Stunting", "Stunting", `${y}`), "low");
for (const y of [2024, 2025]) {
  add(`kapasitas_fiskal_${y}`, num("Kapasitas Fiskal", "RFKD", `${y}`), "high");
  add(`kapasitas_fiskal_kategori_${y}`, (c) => titleCase(at("Kapasitas Fiskal", c, "Kategori RKFD", `${y}`)), null);
}
add("rasio_pad_2025", ratio("PAD", "Pendapatan Daerah"), "high");
add("rasio_belanja_pegawai_2025", ratio("Belanja Pegawai", "Belanja Daerah"), "low");
add("apbd_pendapatan", apbd("Pendapatan Daerah"));
add("apbd_pad", apbd("PAD"));
add("apbd_tkd", apbd("TKD"));
add("apbd_belanja", apbd("Belanja Daerah"));
add("apbd_belanja_pegawai", apbd("Belanja Pegawai"));
const inv = (y) => num("Realisasi Investasi", "Realisasi Investasi (Juta Rupiah)", `${y}`);
for (const y of years(2021, 2025)) add(`investasi_${y}`, inv(y), "high");
add("investasi_total", (c) => {
  const vs = years(2021, 2025).map((y) => inv(y)(c)).filter(isN);
  return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
});
add("pdrb_adhb", num("ADHB", "Produk Domestik Bruto", "2025"));
add("kontribusi_pdrb", num("Kontribusi PDRB", "", "2025"));
add("pdrb_perkapita", num("ADHB Per Kapita", "", "2025"));
add("irbi", num("IRBI", "IRBI", "2024"), null); // tanpa peringkat (sesuai katalog)
add("irbi_kelas", irbiKelas, null);
for (const k of ["iku", "ika", "ikl", "iklh"]) add(k, num("Lingkungan", k.toUpperCase(), "2025"));
for (const y of [2024, 2025]) add(`ikp_${y}`, num("IKP", "IKP", `${y}`), "high");

const out = Object.fromEntries(codes.map((c) => [c, {}]));
for (const [key, get, sense] of COLS) {
  const vals = codes.map((c) => [c, get(c)]).filter(([, v]) => v != null);
  for (const [c, v] of vals) out[c][key] = typeof v === "number" ? round(v) : v;
  if (!sense) continue;
  // peringkat di antara kab/kota se-provinsi (1 = terbaik menurut arah "sense")
  for (const p of Object.keys(PROVS)) {
    const grp = vals.filter(([c, v]) => c.slice(0, 2) === p.slice(0, 2) && isN(v));
    grp.sort((a, b) => (sense === "low" ? a[1] - b[1] : b[1] - a[1]));
    grp.forEach(([c, v]) => (out[c][`${key}__rank`] = 1 + grp.findIndex(([, w]) => w === v)));
  }
}
writeFileSync(join(DATA, "makro.json"), JSON.stringify(out));

const filled = COLS.map(([k]) => [k, codes.filter((c) => out[c][k] != null).length]);
console.log(`kabkota.geojson: ${features.length} kab/kota`);
console.log(`makro.json: ${COLS.length} kolom; terisi →`, filled.filter(([, n]) => n < codes.length).map(([k, n]) => `${k}:${n}`).join(" ") || "semua lengkap");
