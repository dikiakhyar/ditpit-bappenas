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

## Pengaturan (opsional, lewat environment variable)
| Variabel | Fungsi |
|---|---|
| `DATABASE_SHEET_ID` | Ganti ke spreadsheet lain (ID dari URL). Default: spreadsheet Database PIT saat ini. |
| `DATABASE_XLSX_URL` | Pakai URL `.xlsx` langsung (bila database dipindah dari Google Drive). |
| `DATABASE_REFRESH_TOKEN` | Bila diisi, tombol "Perbarui sekarang" wajib token (`/api/database/refresh?token=…`). |

## Memperbarui salinan lokal (cadangan)
Buka `http://localhost:3000/api/database` saat situs berjalan, simpan hasilnya sebagai
`public/data/profil.json`, lalu commit. Ini hanya cadangan saat Google tak terjangkau — tidak wajib rutin.

## Kode
- `lib/db/xlsx.ts` — pembaca .xlsx ringan (streaming untuk sheet raksasa Indeks Desa).
- `lib/db/build.ts` — aturan konversi sheet → data situs.
- `lib/db/source.ts` — unduh spreadsheet, cache 5 menit, cadangan salinan lokal.
- `app/api/database/route.ts`, `app/api/database/refresh/route.ts` — endpoint.
