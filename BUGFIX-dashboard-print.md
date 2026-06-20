# BUG FIX — Cetak Dashboard Mencetak Elemen Kosong

## Laporan Bug

**Modul:** Dashboard
**Gejala:** Fitur "Cetak Dashboard" hanya mencetak judul section
(`Dashboard Ringkasan`, `Stok Gudang`, `Performa Produksi`, `Forecast`).
Seluruh isi — KPI Pembelian Gabah, Penjualan, Laba Bersih, Saldo Kas, Stok
Gabah/PK/Beras/Bekatul/Sekam/Menir, Forecast, Profit Batch, grafik, dan
seluruh kartu KPI — tidak ikut tercetak.

## Akar Masalah

Tombol "Cetak Dashboard" memanggil fungsi generik `printReport()`, yang
sama dipakai untuk semua laporan tabel (Pembelian, Penjualan, Hutang
Piutang, dll). Fungsi ini memuat stylesheet terpisah bernama
`REPORT_STYLES` di jendela cetak baru — bukan CSS aplikasi utama.

`REPORT_STYLES` memang sengaja berisi aturan:

```css
.kpi, .kpi-grid, .grid, .form-row, .form-actions, .help-text, button, .btn,
.action-sheet, .m-cards, .tag, .section-divider, .dual-scroll-top,
.empty-state .stamp { display: none !important; }
```

Aturan ini masuk akal untuk laporan **berbasis tabel** — KPI ringkas di
atas tabel memang tidak perlu ikut tercetak karena tabelnya sendiri sudah
lengkap. Tapi **Dashboard tidak memiliki tabel sama sekali** — seluruh
isinya berupa `.grid` berisi kartu `.kpi`, dan `.card` berisi `<canvas>`
chart. Karena tombol Dashboard memanggil jalur cetak yang sama, seluruh
`.kpi-grid` ikut disembunyikan — hanya menyisakan judul section (yang
kebetulan ditulis sebagai `<div style="...">` inline, bukan elemen
`.section-divider`, sehingga lolos dari aturan di atas).

## Perbaikan

Dibuat jalur cetak **khusus Dashboard** yang reuse mekanisme clone +
snapshot canvas yang sudah ada, tapi memuat CSS aplikasi yang sesungguhnya
(diambil langsung dari elemen `<style>` di `index.html` saat runtime),
bukan `REPORT_STYLES` yang membatasi.

### Fungsi baru di `app.js`

| Fungsi | Peran |
|---|---|
| `_getAppStylesheetText()` | Ambil CSS aplikasi asli dari DOM (`document.querySelector('style').textContent`) — selalu identik dengan yang dipakai layar, tidak ada salinan CSS yang bisa drift |
| `buildDashboardPrintHtml()` | Clone elemen dashboard apa adanya, snapshot setiap `<canvas>` Chart.js jadi `<img>`, hanya membuang elemen murni interaktif (`button`, `.btn`, `.dl-wrap`, `.action-sheet`) — **tidak** menyembunyikan `.kpi`/`.grid`/`.card`/`.section-divider` |
| `printDashboard()` | Cetak — memuat CSS aplikasi asli + `print-color-adjust: exact` agar warna border/badge tetap tercetak |
| `downloadDashboardPdf()` | Unduh PDF — sama prinsipnya, lewat dialog "Save as PDF" |
| `downloadDashboardJpeg()` | Unduh JPEG — render off-screen lalu screenshot via html2canvas |
| `dlMenuDashboard()` | Menu dropdown unduh (PDF/JPEG) khusus Dashboard |

Tombol di `renderDashboard()` diarahkan dari `printReport()`/`dlMenuReport()`
generik ke `printDashboard()`/`dlMenuDashboard()` yang baru. Tidak ada
perubahan pada `printReport()`, `buildReportHtml()`, `downloadReportPdf()`,
atau `downloadJpegReport()` — laporan tabel lain tetap berperilaku sama
seperti sebelumnya.

### Mengapa warna sempat berisiko hilang

Browser secara default **tidak mencetak warna background** kecuali
diizinkan eksplisit, untuk menghemat tinta printer. CSS aplikasi memakai
`border-left-color` berwarna pada kartu KPI (aman, border selalu tercetak)
tapi beberapa badge dan banner status memakai `background-color`. Fix ini
menambahkan:

```css
* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
```

## Apa yang TIDAK diubah

- **`index.html` tidak disentuh sama sekali** (diverifikasi dengan `diff`) —
  tidak ada halaman HTML baru dibuat.
- Tidak ada versi ringkasan dashboard yang dibuat — yang dicetak adalah
  hasil `cloneNode(true)` dari elemen `#printDashboard` yang sama persis
  dengan yang tampil di layar, hanya dengan `<canvas>` digantikan `<img>`
  (karena canvas tidak bisa dipindah lintas window terpisah) dan tombol
  aksi dihapus (karena tidak relevan di dokumen cetak).
- Fungsi cetak untuk laporan lain (Pembelian, Penjualan, Hutang Piutang,
  Buku Besar, dll) tidak diubah — perilakunya tetap seperti sebelumnya.

## Verifikasi

- ✅ Sintaks JavaScript valid (`node -c app.js`)
- ✅ 384 fungsi total, 0 nama duplikat
- ✅ 135+ event handler (`onclick`/`onchange`/`oninput`) — 0 referensi rusak
- ✅ `index.html` identik sebelum dan sesudah fix (`diff` kosong)
- ✅ Cross-check struktural: seluruh elemen yang dilaporkan hilang
  (Pembelian Gabah, Penjualan, Laba Bersih, Saldo Kas, Stok Gabah/PK/Beras,
  Bekatul, Sekam, Menir, Forecast, Profit, grafik canvas) terkonfirmasi ada
  di dalam `<div id="printDashboard">` dan tidak lagi tertimpa aturan
  `display:none` dari `REPORT_STYLES`
