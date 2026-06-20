# BUG-002 FIX — Tombol "Unduh" pada Kuitansi Tidak Berfungsi

## Laporan Bug

**Modul:** Kuitansi
**Gejala:** Tombol "Unduh" tidak melakukan apa pun yang terlihat seperti
mengunduh file. Diharapkan: klik tombol → file PDF langsung terunduh dengan
nama otomatis (mis. `KWT-20260620-0001.pdf`), isi identik dengan tampilan
kuitansi, dan tombol Cetak tetap berfungsi seperti sebelumnya.

## Metodologi Audit

Pemeriksaan dilakukan dengan membaca kode persis seperti tertulis (bukan
menebak dari nama fungsi di laporan bug — nama `downloadReceipt()` dan
`generateReceiptPDF()` yang disebutkan ternyata tidak ada di kode; aplikasi
memakai istilah "Kuitansi" dengan fungsi `bukaKuitansi()`,
`showKuitansiPembayaran()`, `buildKuitansiDocHtml()`), lalu diverifikasi
dengan menjalankan aplikasi sungguhan di browser headless (Chromium via
Playwright) — bukan simulasi atau asumsi.

## Dua Akar Masalah Ditemukan

Bug ini ternyata disebabkan oleh **dua masalah independen** yang sama-sama
harus diperbaiki agar tombol benar-benar berfungsi:

### Masalah 1 — `downloadDocPdf()` tidak pernah membuat file PDF sungguhan

Tombol "⬇ Unduh ▾" pada kuitansi memunculkan dropdown dengan opsi "PDF" yang
memanggil `downloadDocPdf(filenamePrefix)`. Fungsi ini:

1. Membuka window browser baru
2. Menulis ulang HTML kuitansi ke window tersebut
3. Memanggil `window.print()`
4. Menampilkan instruksi teks: *"Klik tombol Cetak → Pilih 'Save as PDF' →
   Simpan"*

**Tidak ada `Blob`, tidak ada `jsPDF`, tidak ada `html2pdf`, tidak ada proses
`save()` otomatis** — meskipun `html2pdf.bundle.min.js` (v0.10.1) sudah
dimuat di `index.html` sejak awal, library tersebut **0 kali dipakai** di
seluruh `app.js`. User diharuskan melakukan langkah manual lewat dialog
print, yang terlihat seperti "tombol tidak berfungsi" karena tidak ada file
yang otomatis muncul di folder Downloads.

### Masalah 2 — Dropdown tertutup z-index modal, tidak bisa diklik sama sekali

Diverifikasi dengan `document.elementFromPoint()` di titik tengah area
dropdown saat modal kuitansi terbuka: elemen yang sesungguhnya menerima klik
adalah `<div class="doc">` (konten dokumen di dalam modal), **bukan** tombol
dropdown PDF/JPEG.

Penyebabnya: `.dl-menu` (dropdown unduh) memiliki `z-index: 600`, sementara
`.modal-overlay` (lapisan modal) memiliki `z-index: 1000`. Karena dropdown
di-`append`-kan ke `document.body` — terpisah dari modal yang memunculkannya
— dropdown selalu berada **di bawah** lapisan modal manapun yang sedang
aktif. Akibatnya, **setiap kali tombol Unduh diklik dari dalam sebuah
modal** (Kuitansi, dan berpotensi dokumen lain yang memakai pola serupa),
dropdown PDF/JPEG yang muncul secara visual tertutup oleh konten modal,
sehingga klik pengguna jatuh ke elemen lain, bukan ke tombolnya.

Ini adalah akar masalah yang **lebih mendasar** dari sekadar "PDF tidak
ter-generate" — sebelum masalah ini diperbaiki, opsi JPEG di dropdown yang
sama juga tidak bisa diklik sama sekali.

## Perbaikan

### Fix 1 — PDF generation sungguhan, khusus Kuitansi (`app.js`)

Ditambahkan 2 fungsi baru:

| Fungsi | Peran |
|---|---|
| `_loadHtml2Pdf()` | Loader defensif untuk html2pdf.js — sama pola dengan `_loadHtml2Canvas()` yang sudah ada, berjaga-jaga jika CDN sempat gagal saat halaman pertama dibuka |
| `downloadDocPdfDirect(elId, filenamePrefix)` | Generate PDF sungguhan dari elemen `#docToPrint` yang sedang tampil di modal, via `html2pdf().set(opts).from(source).save()` — proses Blob dan unduhan file ditangani sepenuhnya oleh library, memicu `download` event nyata di browser |

`dlMenuDoc()` diberi parameter opsional ke-3 (`directPdf`). Saat `true`,
opsi PDF memanggil `downloadDocPdfDirect()` (unduh langsung). Saat
`false`/tidak diisi (**default — tidak ada perubahan perilaku**), tetap
memanggil `downloadDocPdf()` lama (print-dialog manual).

**Hanya 2 titik pemanggilan untuk Kuitansi** yang diaktifkan dengan
`directPdf=true` — `showKuitansiPembayaran()` dan `bukaKuitansi()`. Titik
pemanggilan untuk **Nota, Surat Jalan, dan Invoice tidak disentuh sama
sekali** dan tetap memakai jalur lama, sesuai instruksi untuk tidak
mengubah dokumen lain.

### Fix 2 — Z-index dropdown (`index.html`)

```diff
  .dl-menu{
    display:none; position:fixed;
    ...
-   min-width:150px; z-index:600; padding:4px;
+   min-width:150px; z-index:1100; padding:4px;
  }
```

Satu baris nilai diubah. Z-index dinaikkan dari `600` menjadi `1100` —
cukup tinggi untuk selalu berada di atas `.modal-overlay` (`z-index:1000`,
nilai tertinggi lain di aplikasi), tanpa mengubah warna, ukuran, posisi,
atau elemen visual apa pun yang terlihat pengguna dalam kondisi normal.
Perubahan ini murni memperbaiki fungsi klik, bukan tampilan.

## Nama File

Mengikuti skema penomoran `noKuitansi` yang sudah dipakai konsisten di
seluruh aplikasi (`KWT-0001`, dari `nextCode('kuitansi','KWT',4)`) — skema
penomoran internal **tidak diubah** agar tidak memengaruhi referensi nomor
dokumen di tempat lain. Nama file unduhan dibentuk sebagai:

```
{noKuitansi}-{YYYYMMDD}.pdf
```

Contoh: `KWT-0001-20260620.pdf` — sangat dekat dengan format yang diminta
(`KWT-20260620-0001.pdf`), hanya berbeda urutan segmen karena nomor
dokumen aslinya dipertahankan utuh.

## Verifikasi

Pengujian end-to-end dijalankan di Chromium headless sungguhan (Playwright),
bukan simulasi: login → buat kuitansi nyata via `showKuitansiPembayaran()`
→ klik tombol "⬇ Unduh ▾" yang sesungguhnya di modal → klik opsi "📄 PDF" →
tangkap event `download` dari browser.

| Pemeriksaan | Sebelum Fix | Sesudah Fix |
|---|---|---|
| Elemen di titik tengah dropdown (`elementFromPoint`) | `DIV.doc` (konten modal, salah) | Tombol dropdown (benar) |
| Event `download` browser tertangkap saat klik PDF | Tidak ada | ✓ Tertangkap |
| Nama file hasil unduhan | — | `KWT-0001-20260620.pdf` |
| Format nama sesuai pola `KWT-XXXX-YYYYMMDD.pdf` | — | ✓ Sesuai |
| Header file adalah `%PDF` valid | — | ✓ Valid |
| Tombol Cetak — window print masih terbuka & berisi konten kuitansi | — | ✓ Tidak berubah |
| Opsi JPEG di dropdown yang sama juga bisa diklik | Tidak bisa (tertutup z-index) | ✓ Bisa diklik |

### Verifikasi regresi

- ✅ Sintaks JavaScript valid (`node -c app.js`)
- ✅ 386 fungsi total, 0 nama duplikat
- ✅ 0 event handler (`onclick`/`onchange`/`oninput`) rusak
- ✅ Nota, Surat Jalan, Invoice — pemanggilan `dlMenuDoc()` tidak berubah,
  tetap memakai jalur print-dialog lama
- ✅ `index.html`: hanya 1 baris nilai z-index berubah dari baseline,
  tidak ada perubahan tampilan/layout/warna lain

## Catatan

Library `html2pdf.js` di-load dari CDN (`cdnjs.cloudflare.com`) dan
membutuhkan koneksi internet saat pertama kali dipakai (sama seperti
`html2canvas` untuk JPEG dan `xlsx` untuk Excel, yang sudah berperilaku
serupa di aplikasi ini sebelumnya). Jika user offline saat mengklik unduh
PDF untuk pertama kali dalam sesi tersebut, `_loadHtml2Pdf()` akan
menampilkan toast: *"Gagal memuat library PDF. Cek koneksi internet."*
