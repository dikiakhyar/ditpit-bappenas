# Data Makro — choropleth kab/kota

Tab **Makro** di Peta Tematik mewarnai poligon kab/kota menurut pilihan **Kategori → Indikator → Tahun**.

**Sumber nilai: database Google Spreadsheet** (lihat `DATABASE.md`) — dihitung langsung saat situs dibuka,
tidak ada lagi `makro.json`. Katalog indikator ada di `lib/makro.ts`:

- Tahun yang tampil = tahun yang benar-benar terisi untuk kab/kota di peta.
- Indikator tanpa data kab/kota otomatis disembunyikan (mis. listrik PLN & imunisasi yang hanya tingkat provinsi).
- Peringkat = urutan di antara seluruh kab/kota se-provinsi di database (1 = terbaik menurut arah "baik"),
  sama dengan halaman Profil Daerah.
- Legenda memakai kelas kuantil (6 kelas) + "Tidak ada data".

## Warna sesuai konteks
Tiap indikator punya palet sendiri (6 tingkat satu warna, terang → pekat = nilai kecil → besar):

| Palet | Dipakai untuk | Contoh |
|---|---|---|
| hijau | capaian/kesejahteraan — makin tinggi makin baik | IPM, HLS, UHH, TPAK, indeks desa, IKLH, integritas |
| merah | masalah — makin tinggi makin buruk (otomatis untuk `sense: "low"`) | % miskin, TPT, stunting, Gini, desa tertinggal |
| oranye | risiko bencana | IRBI |
| biru | besaran ekonomi & keuangan | PDRB, investasi, APBD, garis kemiskinan |
| ungu | kependudukan | jumlah, persentase, kepadatan penduduk |
| toska | layanan dasar & infrastruktur | air minum, sanitasi, hunian, sinyal 4G |
| divergen | pertumbuhan | LPE: negatif merah, positif hijau (0 selalu jadi batas kelas) |

Aturan: `palette` pada indikator → bila tidak ada dan `sense: "low"` → merah → bila tidak, `palette` kategorinya.
Semua palet lolos uji keterbacaan (kecerahan naik rata, beda antarkelas terlihat, kelas paling terang tetap
kontras terhadap latar putih). Daftar warna: `PALETTES` di `lib/makro.ts`.

**Palet pilihan pengguna** (panel Makro → "Palet warna"): *Otomatis* memakai aturan di atas; memilih palet lain
(biru, hijau, merah, oranye, ungu, toska, merah–hijau divergen) berlaku untuk semua indikator numerik sampai
dikembalikan ke Otomatis. "Balik warna" menukar urutan terang ↔ pekat. Legenda, peringkat, dan ekspor PNG ikut
berubah. Indikator kategorikal (mis. kelas IRBI) tetap memakai warna kelas bakunya.

## Fokus wilayah terpilih
Saat kab/kota atau provinsi dipilih (klik peta, tab Wilayah, atau "Fokus" di tab Layer), wilayah lain ditampilkan
menurut pilihan "Wilayah lain saat memilih" (tab Makro & Wilayah):
- **Abu-abu** — wilayah lain diredupkan abu-abu, garisnya disamarkan (tetap bisa di-hover).
- **Sembunyikan** — wilayah lain tidak digambar sama sekali: isi, garis, maupun batas Provinsi/Kab-Kota di tab Layer.
Keduanya hanya mengganti filter/ekspresi gaya MapLibre (tanpa memuat ulang data), jadi tetap ringan.

Indikator turunan: jumlah penduduk = PDRB ADHB ÷ PDRB per kapita ADHB (per tahun); persentase & kepadatan
penduduk dihitung darinya; kelas IRBI memakai ambang BNPB (rendah ≤ 72, sedang 72–144, tinggi > 144).

## Menambah indikator
Tambah satu entri di `MAKRO_CATEGORIES` (`lib/makro.ts`):

```ts
{ id: "air_minum", label: "RT dengan Air Minum Layak", unit: "%", format: "persen",
  src: fromSheet("RT Air Minum Layak") }                         // sheet tanpa item; warna = palet kategori
{ id: "irbi", label: "IRBI", sense: "low", palette: "oranye",
  src: fromSheet("IRBI", "IRBI") }                               // warna ditentukan manual
{ id: "tpt", label: "TPT", sense: "low", format: "persen",
  src: fromSheet("TPT", "Tingkat Pengangguran Terbuka (TPT)", (y) => `Agu ${y}`) }  // item + label periode
```

## Batas wilayah (poligon)
Sumber: `components/KabKotaPIT.shp` — 176 kab/kota di 16 provinsi (Sulawesi, NTB, NTT, Maluku, Maluku Utara,
seluruh Papua). SHP ±200 MB itu dikonversi menjadi file ringan yang dipakai situs:

| File | Isi | Ukuran |
|---|---|---|
| `public/data/wilayah.topo.json` | TopoJSON: `kabkota` (kode BPS, nama, provinsi) + `provinsi` (hasil peleburan) | ±0,6 MB (±180 KB terkompresi) |
| `public/data/darat.geojson` | daratan sederhana untuk basemap offline | ±90 KB |
| `lib/peta-wilayah.ts` | daftar kode provinsi/kab/kota di peta + batas cakupan | — |

Bila SHP diganti/diperbarui, jalankan ulang lalu commit ketiga file di atas:

```
node scripts/build-map-data.mjs
```

Skrip menyederhanakan garis (titik berjarak < 250 m dilebur, batas antarwilayah tetap berimpit), membuang pulau
< 0,2 km², lalu mencocokkan nama `WADMKK`/`WADMPR` ke kode BPS di database (ejaan seperti "Fak Fak"/"Fakfak",
"Toli Toli"/"Toli-Toli", "Kep. Siau…" ditangani otomatis). Bila ada nama yang tak cocok, skrip berhenti dan
menyebutkannya. Kode lama sebelum pemekaran Papua (91xx/94xx lama) sengaja tidak dipetakan.

**SHP tidak di-commit** (melebihi batas 100 MB GitHub; sudah di `.gitignore`) — cukup hasil konversinya.
