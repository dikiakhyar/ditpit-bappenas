# Data Makro — choropleth kab/kota

Tab **Makro** di Peta Tematik mewarnai poligon kab/kota menurut pilihan **Kategori → Indikator → Tahun**.

**Sumber nilai: database Google Spreadsheet** (lihat `DATABASE.md`) — dihitung langsung saat situs dibuka,
tidak ada lagi `makro.json`. Katalog indikator ada di `lib/makro.ts`:

- Tahun yang tampil = tahun yang benar-benar terisi untuk kab/kota di peta.
- Indikator tanpa data kab/kota otomatis disembunyikan (mis. listrik PLN & imunisasi yang hanya tingkat provinsi).
- Peringkat = urutan di antara seluruh kab/kota se-provinsi di database (1 = terbaik menurut arah "baik"),
  sama dengan halaman Profil Daerah.
- Legenda memakai kelas kuantil (6 kelas) + "Tidak ada data".

Indikator turunan: jumlah penduduk = PDRB ADHB ÷ PDRB per kapita ADHB (per tahun); persentase & kepadatan
penduduk dihitung darinya; kelas IRBI memakai ambang BNPB (rendah ≤ 72, sedang 72–144, tinggi > 144).

## Menambah indikator
Tambah satu entri di `MAKRO_CATEGORIES` (`lib/makro.ts`):

```ts
{ id: "air_minum", label: "RT dengan Air Minum Layak", unit: "%", format: "persen",
  src: fromSheet("RT Air Minum Layak") }                         // sheet tanpa item
{ id: "tpt", label: "TPT", sense: "low", format: "persen",
  src: fromSheet("TPT", "Tingkat Pengangguran Terbuka (TPT)", (y) => `Agu ${y}`) }  // item + label periode
```

## Poligon kab/kota
`public/data/kabkota.geojson` (53 kab/kota NTB, NTT, Maluku, Maluku Utara, berkode BPS) dibangkitkan dari
`public/data/maluku_nusra.geojson` dengan `node scripts/build-map-data.mjs`. Nanti diganti SHP se-wilayah timur.
