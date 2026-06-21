# BUG-004 FIX — Hasil Unduh JPEG Terpotong

## Laporan Bug

**Modul:** Unduh JPEG
**Gejala:** Hasil JPEG terpotong — tidak mencakup seluruh dashboard/dokumen
dari atas sampai bawah, tidak mendukung halaman panjang/lebar dengan baik.

**Fungsi yang diminta untuk diaudit:** `exportJPEG()`, `downloadJPEG()`,
`html2canvas()`.

## Metodologi Audit

Nama fungsi yang disebut di laporan bug ternyata tidak ada secara harfiah
di kode — aplikasi memakai `downloadJpegFromEl()` (Kuitansi/Invoice/Surat
Jalan), `downloadJpegReport()` (27+ halaman laporan tabel), dan
`downloadDashboardJpeg()` (Dashboard). Ketiganya dibaca persis seperti
tertulis, lalu **dijalankan sungguhan** di Chromium headless (Playwright)
dengan mock `html2canvas` yang menangkap parameter persis yang dikirim —
bukan menyimpulkan dari pembacaan kode statis saja, karena pembacaan awal
sempat terlihat sudah benar (memakai `scrollWidth`/`scrollHeight`, bukan
`clientWidth`/`clientHeight`) padahal bug tetap ada di tempat lain.

## Tiga Bug Konkret Ditemukan

### Bug 1 — `downloadJpegReport()`: lebar tetap 900px memotong tabel lebar

Dipakai oleh seluruh 27+ halaman laporan (Pembelian, Produksi, Penjualan,
Gudang, Distribusi, Hutang/Piutang, Laba Rugi, Neraca, Rekap
Mingguan/Bulanan/Tahunan, Jurnal Umum, Business Intelligence, Maintenance,
Stock Opname, Purchase Order, dst). Elemen clone off-screen (`tmp` div)
dipaksa `width:900px` secara tetap di CSS **dan** di opsi `html2canvas`.

Diverifikasi langsung di browser sungguhan: Laporan Pembelian punya tabel
dengan `scrollWidth: 1108px` — **208px lebih lebar** dari batas 900px yang
dipaksakan. Kolom-kolom di sisi kanan tabel terpotong dari hasil JPEG.

### Bug 2 — `downloadDashboardJpeg()`: pola sama (lebar tetap 1100px)

Diperbaiki secara proaktif sebagai langkah pengamanan, walau konten
Dashboard saat ini masih muat dalam 1100px — agar tidak diam-diam
terpotong jika di masa depan ada penambahan kartu/grafik yang membuat
lebar konten bertambah.

### Bug 3 — `downloadJpegFromEl()`: `windowWidth` tidak konsisten dengan `width`

Lebih halus dari dua bug di atas. Kode ini *sudah* memakai
`width: el.scrollWidth` (benar), tapi `windowWidth` dipaksa minimal 800px
(`Math.max(el.scrollWidth + 40, 800)`) — **berbeda** dari `width`.

`html2canvas` memakai `windowWidth`/`windowHeight` sebagai ukuran viewport
virtual untuk menghitung layout (termasuk responsivitas elemen) **sebelum**
hasilnya dipotong ke `width`/`height`. Untuk dokumen yang lebih sempit dari
800px (Kuitansi diukur `638px`), elemen di-layout ulang seolah viewport-nya
800px (berpotensi melebar mengisi ruang ekstra), lalu hasil yang sudah
melebar itu dipotong kembali ke 638px — bagian yang melebar akibat
viewport virtual yang salah jadi hilang dari gambar akhir.

Diverifikasi langsung: `width: 638` vs `windowWidth: 800` — selisih 162px.

## Perbaikan

### Strategi: ukur dimensi aktual setelah elemen ter-attach ke DOM

Untuk `downloadJpegReport()` dan `downloadDashboardJpeg()`, `tmp` div clone
diberi `width:max-content` (melebar otomatis mengikuti konten terlebar,
termasuk tabel dengan jumlah kolom bervariasi), dibatasi `min-width` agar
laporan pendek tetap proporsional, dan `max-width:2400px` sebagai pengaman
kasus ekstrem. `scrollWidth`/`scrollHeight` diukur **setelah** `tmp`
ter-attach ke `document.body` — mengukur ukuran sesungguhnya, bukan
menebak angka di awal.

```diff
- tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;...';
+ tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:max-content;min-width:900px;max-width:2400px;...';

  setTimeout(()=>{
+   const fullW = tmp.scrollWidth;
    const fullH = tmp.scrollHeight;
    html2canvas(tmp, {
-     width: 900, height: fullH,
-     windowWidth: 900, windowHeight: fullH,
+     width: fullW, height: fullH,
+     windowWidth: fullW, windowHeight: fullH,
```

Untuk `downloadJpegFromEl()`, `windowWidth`/`windowHeight` disamakan persis
dengan `width`/`height` — tidak ada lagi mismatch antara ukuran saat
elemen di-layout dan ukuran area yang dipotong.

```diff
- windowWidth: Math.max(el.scrollWidth + 40, 800),
- windowHeight: el.scrollHeight,
+ windowWidth: el.scrollWidth,
+ windowHeight: el.scrollHeight,
```

## Checklist Requirement — Status di Ketiga Fungsi

| Requirement | `downloadJpegFromEl` | `downloadJpegReport` | `downloadDashboardJpeg` |
|---|---|---|---|
| Memakai `scrollWidth`/`scrollHeight`, bukan `clientWidth`/`clientHeight` | ✓ | ✓ | ✓ |
| Clone ke container sementara sebelum render (untuk elemen dalam container scroll/modal) | — *(render langsung dari elemen modal, sudah di luar scroll constraint)* | ✓ | ✓ |
| `scale: 2` | ✓ | ✓ | ✓ |
| `backgroundColor: "#..."` | ✓ | ✓ | ✓ |
| `useCORS: true` | ✓ | ✓ | ✓ |
| `windowWidth`/`windowHeight` konsisten dengan `width`/`height` | ✓ *(fix)* | ✓ *(fix)* | ✓ *(fix)* |
| Lebar dinamis mengikuti konten, bukan angka tetap | — *(sudah dinamis sejak awal)* | ✓ *(fix)* | ✓ *(fix)* |

## Verifikasi

Pengujian dilakukan dengan menjalankan aplikasi nyata di Chromium headless
(Playwright), bukan simulasi — login, navigasi ke halaman sesungguhnya,
klik tombol Unduh → JPEG, tangkap parameter persis yang dikirim ke
`html2canvas()`.

### Sebelum fix

| Dokumen | Lebar konten aktual | Lebar dikirim ke html2canvas | Status |
|---|---|---|---|
| Laporan Pembelian (tabel) | 1108px | 900px | ✗ Terpotong 208px |
| Kuitansi (`windowWidth` mismatch) | 638px | width=638, windowWidth=800 | ✗ Berisiko layout salah |

### Sesudah fix

| Dokumen | Lebar konten aktual | Lebar dikirim | Status |
|---|---|---|---|
| Laporan Pembelian | 1108px | 1165px | ✓ Tidak terpotong |
| Laporan Produksi | 998px | 1055px | ✓ Tidak terpotong |
| Laporan Penjualan | 905px | 962px | ✓ Tidak terpotong |
| Kuitansi | 638px | width=638, windowWidth=638 | ✓ Konsisten |
| Dashboard | bervariasi | otomatis menyesuaikan (`max-content`) | ✓ Tidak terpotong |

JPEG sungguhan diunduh dan diperiksa dimensinya: `2330×730` piksel untuk
Laporan Pembelian — persis `1165×365` (lebar/tinggi konten penuh) dikali
`scale:2`, dikonfirmasi secara visual tidak ada bagian terpotong di tepi
manapun (border test image memenuhi seluruh kanvas tanpa terpotong).

### Verifikasi regresi

- ✅ Sintaks JavaScript valid (`node -c app.js`) di setiap tahap perbaikan
- ✅ 387 fungsi total, 0 nama duplikat
- ✅ 0 event handler (`onclick`/`onchange`/`oninput`) rusak
- ✅ `index.html` **tidak tersentuh sama sekali** (diverifikasi via timestamp
  file — modifikasi terakhir `index.html` mendahului seluruh sesi perbaikan
  ini) — sesuai instruksi "Jangan mengubah UI"
- ✅ Tidak ada lagi lebar tetap (`width:900px`/`width:1100px`) dipakai
  sebagai batas keras untuk capture JPEG di ketiga fungsi
