# Data Makro — format & cara isi data asli

Fitur **Data Makro** menampilkan seluruh indikator Kab/Kota sebagai **satu layer choropleth**
(poligon yang berganti warna) yang dikendalikan tiga pemilih di tab **Makro**:
**Kategori → Indikator → Tahun**. Jadi ~150 kolom tidak menjadi ~150 toggle — panel tetap ringkas.

Saat ini berjalan dengan **data contoh** di `public/data/`. Ganti dua file ini dengan data asli;
tidak perlu mengubah kode.

## 1. `public/data/kabkota.geojson` — batas wilayah

`FeatureCollection` poligon Kab/Kota. Tiap feature **wajib** punya properti:

| properti    | contoh                  | keterangan                         |
|-------------|-------------------------|------------------------------------|
| `kode`      | `"5271"`                | kode wilayah BPS (string) — **kunci join** |
| `nama`      | `"Kota Mataram"`        | nama tampil di tooltip/peringkat   |
| `provinsi`  | `"Nusa Tenggara Barat"` | nama provinsi                      |

```json
{ "type":"FeatureCollection","features":[
  { "type":"Feature",
    "properties":{ "kode":"5271","nama":"Kota Mataram","provinsi":"Nusa Tenggara Barat" },
    "geometry":{ "type":"Polygon","coordinates":[ ... ] } }
]}
```

> Ganti geometri contoh (kotak) dengan batas resmi (mis. dari BIG/Indonesia geo-boundaries).
> Nama properti bisa disesuaikan di `lib/choropleth.ts` (`CODE_PROP`, `NAME_PROP`, `PROV_PROP`).

## 2. `public/data/makro.json` — nilai indikator

Objek dengan **kunci = `kode` Kab/Kota**, isinya nilai per indikator. Aturan nama kolom:

- indikator **tanpa tahun** → `id`  (mis. `"sex_ratio"`, `"apbd_pad"`)
- indikator **bertahun** → `id_tahun`  (mis. `"tpt_2023"`, `"ipm_2024"`)
- **Peringkat Provinsi** → kolom di atas + `__rank`  (mis. `"tpt_2023__rank"`)

```json
{
  "5271": {
    "jumlah_penduduk": 437.0,
    "tpt_2023": 2.68,  "tpt_2023__rank": 2,
    "ipm_2024": 78.9,  "ipm_2024__rank": 1,
    "iklh_kategori": "Baik"
  }
}
```

`id` indikator & tahun yang tersedia didefinisikan di **`lib/makro.ts`** (`MAKRO_CATEGORIES`).
Untuk menambah/ubah indikator: edit entri di sana, lalu sediakan kolom datanya — panel, peta,
legenda, dan peringkat ikut otomatis.

## Indikator kualitatif
`kapasitas_fiskal_kategori_2025`, `irbi_kelas`, `iklh_kategori` diwarnai per kelas (bukan gradasi).
Nilai harus sama persis dengan label kelas di `lib/makro.ts` (mis. `"Sangat Tinggi"`, `"Baik"`).

## Tip ekspor dari Excel
Susun satu baris per Kab/Kota, kolom = `kode, nama, provinsi, tpt_2020, tpt_2020__rank, ...`,
lalu pivot ke JSON `{kode: {…}}`. Saya bisa bantu buatkan konverter Excel→JSON bila perlu.
