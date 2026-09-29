# Database — Google Spreadsheet "Database PIT"

Situs membaca data **langsung dari spreadsheet** — tidak perlu git push setiap kali data berubah.

```
Google Spreadsheet  ──(unduh .xlsx, maks. sekali/5 menit)──▶  /api/database  ──▶  Profil Daerah + Peta Tematik (Makro)
                                              └─ gagal? ──▶  salinan lokal public/data/profil.json
```

## Syarat (sekali saja)
1. Spreadsheet dibagikan **"Siapa saja yang memiliki link" → Pelihat** (Bagikan → Akses umum).
   Tanpa ini server tidak bisa membacanya dan situs menampilkan label **"Database: salinan lokal"**.
2. Situs di-hosting di server yang menjalankan Next.js (Vercel, Netlify, VPS dengan `npm start`, dll.) —
   bukan hosting statis — karena `/api/database` berjalan di server.

## Cara kerja sehari-hari
- Edit angka di spreadsheet → tampil di situs **paling lambat ±5 menit**.
- Mau langsung? Klik **"Perbarui sekarang"** (panel Makro atau bagian bawah halaman Profil).
- Label hijau **"Database: Google Spreadsheet · dibaca …"** = data langsung dari spreadsheet.
  Label kuning **"salinan lokal"** = spreadsheet sedang tak terbaca (izin berbagi / jaringan).

## Bila muncul "salinan lokal" karena timeout
Spreadsheet ini **Google Sheets asli**: setiap dibaca, Google harus merakit .xlsx dari seluruh sheet dulu.
Makin besar spreadsheet (terutama sheet **Indeks Desa**, sheet-sheet yang diabaikan, dan rumus berat seperti
IMPORTRANGE/pivot), makin lama. Situs menunggu ±48 detik. Bila masih sering gagal:
1. Rampingkan spreadsheet — hapus/pindahkan sheet yang tidak dipakai (daftar "Diabaikan" di bawah) dan ganti
   rumus berat dengan nilai (Salin → Tempel khusus → Nilai saja).
2. Tahap berikutnya: baca lewat Google Sheets API (butuh API key) — lebih cepat dari unduh .xlsx.
Error `500 drive.usercontent…` / `500 drive.google.com` wajar untuk Google Sheets asli (jalur itu khusus berkas .xlsx di Drive).
Log server mencatat lama unduhan: `[database] spreadsheet terunduh … dalam N dtk`.

## Kecepatan
- Server menyimpan hasil baca spreadsheet di memori (±5 menit) dan mengirim data **terkompresi gzip** (±0,7 MB).
- Saat server baru "bangun" (cold start), situs **langsung** tampil memakai salinan lokal, sementara spreadsheet
  dibaca di latar belakang; beberapa detik kemudian data terbaru otomatis menggantikannya (label
  "Memuat data terbaru dari spreadsheet…"). Pengunjung tidak perlu menunggu unduhan Google.
- Kunjungan ulang memakai ETag → bila data belum berubah, tidak ada yang diunduh ulang.

## Aturan format sheet
Setiap sheet data memakai kolom: `region_code | province | regency | item | units | <periode…>`
- `region_code` = kode BPS (4 digit); **9999 atau 0 = Indonesia (nasional)**.
- Header periode boleh angka (`2024`), teks (`T1 2025`), atau tanggal (tampil sebagai `Agu 2025`;
  pada sheet triwulanan → `T1 2025`; tanggal Januari → tahun saja).
- Angka yang terketik sebagai teks (mis. `580.370,29`) otomatis dibaca sebagai angka;
  `N/A`, `-`, dan sel kosong = tidak ada data.
- Sheet **baru** dengan format di atas otomatis ikut terbaca. Agar tampil sebagai kartu di Profil
  atau sebagai indikator Makro, tambahkan entrinya di `lib/profil/config.tsx` / `lib/makro.ts`.
- Sheet **Metadata**: `nama_sheet` → judul (`nama_data`) & `sumber` yang tampil di kartu.
- Sheet **Indeks Desa** (data per desa): diringkas otomatis per kab/kota & provinsi. Kode desa di sheet ini
  memakai kode **Kemendagri** yang sering berbeda dari kode BPS, jadi kab/kota dipasangkan lewat **nama**.
- Diabaikan: Metadata, Metadata Non-BPS, Pivot Table 2, Sheet61, Sheet36, Progres, LPE_PDB_Unpivot, IDSD.

## Nilai kosong ≠ 0
Sel kosong, `N/A`, `-` di spreadsheet dibaca sebagai **tidak ada data** dan tampil sebagai "Tidak ada data" di situs
(kartu, tabel, tooltip peta, panel). Angka 0 hanya tampil bila selnya memang berisi 0. Jadi bila di spreadsheet sebuah
nilai belum diketahui, **kosongkan selnya — jangan diisi 0**.

## Indonesia Timur (agregat kawasan)
Wilayah virtual kode `KTI` = gabungan seluruh provinsi di database (`lib/profil/kawasan.ts`), dihitung di browser saat
data dimuat (±50 ms). Muncul di Profil Daerah (pilihan provinsi paling atas), tab Wilayah, tab Makro, dan pencarian.
- Besaran (rupiah, jiwa, unit, ton, desa, luas, …) **dijumlahkan** — hanya bila SEMUA provinsi berdata.
- PDRB per kapita = Σ PDRB ÷ Σ penduduk; LPE = rata-rata tertimbang PDRB ADHK periode sebelumnya (= pertumbuhan PDRB gabungan);
  distribusi PDRB = Σ sektor ÷ Σ total; % penduduk miskin = Σ miskin ÷ Σ (miskin ÷ %).
- Persen/indeks/rasio lain = rata-rata tertimbang jumlah penduduk (penduduk = PDRB ADHB ÷ per kapita ADHB),
  bila provinsi berdata mencakup ≥ 90% penduduk kawasan.
- Kurang dari itu → "Tidak ada data" (tidak dijumlah/dirata-rata sebagian).
- Postur APBD kawasan = gabungan APBD **pemerintah provinsi** (tanpa APBD kab/kota).
- Tampilan "Peringkat" untuk Indonesia Timur = perbandingan seluruh provinsi, garis = nilai kawasan.

## Pengaturan (opsional, lewat environment variable)
| Variabel | Fungsi |
|---|---|
| `DATABASE_SHEET_ID` | Ganti ke spreadsheet lain (ID dari URL). Default: spreadsheet Database PIT saat ini. |
| `DATABASE_XLSX_URL` | Pakai URL `.xlsx` langsung (bila database dipindah dari Google Drive). |
| `DATABASE_TIMEOUT_MS` | Batas tunggu Google merakit .xlsx (default 48000 ms; fungsi server maks. 60 dtk). |
| `DATABASE_REFRESH_TOKEN` | Bila diisi, tombol "Perbarui sekarang" wajib token (`/api/database/refresh?token=…`). |

## Memperbarui salinan lokal (cadangan)
Buka `http://localhost:3000/api/database` saat situs berjalan, simpan hasilnya sebagai
`public/data/profil.json`, lalu commit. Ini hanya cadangan saat Google tak terjangkau — tidak wajib rutin.

## Kode
- `lib/db/xlsx.ts` — pembaca .xlsx ringan (streaming untuk sheet raksasa Indeks Desa).
- `lib/db/build.ts` — aturan konversi sheet → data situs.
- `lib/db/source.ts` — unduh spreadsheet, cache 5 menit, cadangan salinan lokal.
- `app/api/database/route.ts`, `app/api/database/refresh/route.ts` — endpoint.
