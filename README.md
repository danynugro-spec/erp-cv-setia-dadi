# ERP Penggilingan Padi PRO+
## CV. SETIA DADI — Version 1.0.0 (RC Final)

> Sistem Manajemen ERP lengkap untuk operasional penggilingan padi,
> mencakup pembelian gabah, produksi, penjualan, akuntansi double-entry,
> LOT traceability, dan laporan keuangan.

---

## CARA MENJALANKAN

### Persyaratan
- Browser: **Google Chrome 90+** atau **Microsoft Edge 90+** (direkomendasikan)
- Sistem Operasi: Windows 7/8/10/11, macOS, Linux
- Tidak memerlukan koneksi internet setelah pertama kali dibuka
- Tidak memerlukan instalasi server atau database

### Langkah Menjalankan
1. **Ekstrak** file `ERP_SetiaDadi_v1.0.0.zip` ke folder manapun di komputer
2. **Buka** file `index.html` menggunakan Google Chrome atau Microsoft Edge
   - Klik kanan → "Buka Dengan" → Google Chrome
   - Atau seret file `index.html` ke jendela browser
3. **Login** menggunakan akun yang telah dikonfigurasi
   - Default: `admin` / `admin123` (ganti segera setelah pertama login)
4. Aplikasi siap digunakan!

### Install sebagai Aplikasi Desktop (PWA)
1. Buka `index.html` di Chrome/Edge
2. Klik ikon 🖥 di address bar (kanan atas)
3. Pilih "Install ERP Setia Dadi"
4. Aplikasi akan tersedia di desktop / Start Menu

---

## CARA BACKUP DATA

### Metode 1: Backup Enterprise (Direkomendasikan)
1. Buka menu **Administrasi → Backup Enterprise**
2. Klik tombol **"Download Backup"**
3. File JSON akan diunduh otomatis ke folder Downloads
4. Simpan file backup di lokasi aman (Google Drive, USB, dll.)
5. **Lakukan backup minimal 1x per hari**

### Metode 2: Backup Manual Browser
1. Buka Chrome → Tekan `F12` (Developer Tools)
2. Pilih tab **Application**
3. Klik **Local Storage** → pilih alamat file
4. Salin nilai key `erp_padi_pro_plus_v1`

### Jadwal Backup yang Disarankan
| Frekuensi | Waktu |
|---|---|
| Harian | Setiap akhir hari kerja |
| Mingguan | Setiap Jumat sore |
| Bulanan | Akhir bulan, simpan di lokasi berbeda |

---

## CARA RESTORE DATA

### Dari File Backup Enterprise
1. Buka menu **Administrasi → Backup Enterprise**
2. Klik tombol **"Restore dari File"**
3. Pilih file backup `.json` yang ingin dipulihkan
4. Sistem akan memvalidasi file terlebih dahulu
5. Konfirmasi restore — **perhatian: data saat ini akan digantikan**
6. Tunggu hingga proses selesai, refresh browser

### Pindah ke Komputer Lain
1. Lakukan backup di komputer lama (Metode 1)
2. Copy file `ERP_SetiaDadi_v1.0.0.zip` ke komputer baru
3. Ekstrak dan buka `index.html` di komputer baru
4. Restore dari file backup

---

## BROWSER YANG DIDUKUNG

| Browser | Versi | Status |
|---|---|---|
| Google Chrome | 90+ | ✅ Direkomendasikan |
| Microsoft Edge | 90+ | ✅ Direkomendasikan |
| Mozilla Firefox | 88+ | ✅ Didukung |
| Opera | 76+ | ✅ Didukung |
| Safari | 14+ | ⚠ Sebagian didukung |
| Internet Explorer | Semua | ❌ Tidak didukung |

> **Catatan:** Selalu gunakan versi browser terbaru untuk performa dan keamanan optimal.

---

## SPESIFIKASI MINIMUM

| Komponen | Minimum | Direkomendasikan |
|---|---|---|
| Processor | Intel Core i3 / AMD Ryzen 3 | Intel Core i5 / AMD Ryzen 5 |
| RAM | 4 GB | 8 GB |
| Storage | 500 MB tersedia | 1 GB tersedia |
| Layar | 1280 × 720 px | 1920 × 1080 px |
| Browser | Chrome 90 | Chrome terbaru |
| OS | Windows 7 | Windows 10/11 |

> **Penyimpanan Data:** Menggunakan localStorage browser (~5MB).
> Untuk data >3MB, sistem akan menampilkan peringatan agar segera backup.

---

## MODUL YANG TERSEDIA

| No | Modul | Deskripsi |
|---|---|---|
| 01 | Dashboard | KPI, grafik produksi, ringkasan keuangan |
| 02 | Pembelian Gabah | Faktur, DP, kredit, pelunasan hutang |
| 03 | Produksi | 3 mode: Gabah→Beras, Gabah→PK, PK→Beras |
| 04 | Penjualan | Tunai, piutang, kirim bertahap, invoice |
| 05 | Inventori | Stock opname, LOT tracking, Kartu LOT |
| 06 | Distribusi | Surat jalan, armada, pengiriman |
| 07 | Maklon | Jasa giling (Tipe A/B/C) |
| 08 | Kas & Bank | Pencatatan kas masuk/keluar |
| 09 | Hutang & Piutang | Kartu supplier, kartu pelanggan |
| 10 | Laporan Keuangan | Laba Rugi, Neraca, Arus Kas |
| 11 | Akuntansi | Jurnal, Buku Besar, Neraca Saldo |
| 12 | Master Data | Supplier, pelanggan, produk, kendaraan |
| 13 | Administrasi | User, backup, restore, audit trail |

---

## CARA UPDATE VERSI

> **Penting:** Update tidak menghapus data yang ada.

1. **Backup data** menggunakan fitur Backup Enterprise (WAJIB sebelum update)
2. Dapatkan file ZIP versi terbaru
3. Ekstrak ke folder baru (jangan timpa folder lama)
4. Buka `index.html` versi baru di browser
5. Data lama akan otomatis termigrasikan
6. Verifikasi data masih lengkap

---

## AKUN DEFAULT

| Role | Username | Password | Akses |
|---|---|---|---|
| OWNER | `owner` | `owner123` | Semua fitur |
| ADMIN | `admin` | `admin123` | Operasional (tanpa manajemen user) |
| KASIR | `kasir` | `kasir123` | Penjualan, Kas, Laporan dasar |

> ⚠ **Ganti password default segera setelah pertama login!**
> Menu: Administrasi → Manajemen User

---

## SHORTCUT KEYBOARD

| Shortcut | Fungsi |
|---|---|
| `Alt + D` | Dashboard |
| `Alt + P` | Pembelian |
| `Alt + R` | Produksi |
| `Alt + J` | Penjualan |
| `Esc` | Tutup modal |

---

## TROUBLESHOOTING

**Data tidak tersimpan / hilang:**
- Jangan gunakan mode Incognito/Private
- Jangan hapus data browser
- Aktifkan penyimpanan site di pengaturan browser

**Aplikasi lambat:**
- Lakukan backup lalu hapus data lama via Stock Opname
- Gunakan Chrome terbaru
- Tutup tab browser lain yang berat

**Error saat buka:**
- Pastikan file diekstrak sempurna (tidak corrupt)
- Coba browser lain
- Clear cache browser (Ctrl+Shift+Delete)

---

## INFORMASI VERSI

```
Aplikasi  : ERP Penggilingan Padi PRO+
Perusahaan: CV. SETIA DADI
Versi     : 1.0.0
Build     : 20260623
Codename  : RC-FINAL
Status    : PRODUCTION READY
```

---

*Dikembangkan khusus untuk CV. SETIA DADI — Penggilingan Padi*
