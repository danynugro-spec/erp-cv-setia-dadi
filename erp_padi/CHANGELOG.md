# CHANGELOG — CV. Setia Dadi ERP
## Versi Enterprise Final (QA Final / v61-qa-final)
Tanggal rilis: 20 Juni 2026

---

## Ringkasan

Rilis ini menandai status **production-ready** untuk sistem ERP penggilingan padi
CV. Setia Dadi setelah audit menyeluruh, perbaikan bug sistematis, dan validasi
matematis penuh terhadap seluruh alur transaksi: pembelian gabah → produksi
2-tahap (Husker → Polisher) → penjualan → akuntansi double-entry → laporan
keuangan.

**UI tidak pernah diubah sepanjang seluruh proses ini** — `index.html` identik
sejak Sprint 12. Semua perbaikan murni di logika bisnis (`app.js`).

---

## Sprint 1–4 — Fondasi

- **Sprint 1**: Audit awal — pemetaan struktur modul, identifikasi bug, rencana
  refactor tanpa mengubah tampilan.
- **Sprint 2**: Modul Produksi dibangun ulang sesuai proses nyata penggilingan
  padi 2 tahap: Tahap 1 Husker (Gabah → PK + Sekam), Tahap 2 Polisher
  (PK → Beras + Menir + Bekatul). Stok, HPP, rendemen, dan dashboard terhubung
  otomatis ke setiap proses.
- **Sprint 3**: Maklon A/B/C (jasa giling, bekatul-untuk-CV, bagi hasil), dengan
  pemisahan tegas antara Stok CV dan Stok Titipan Maklon.
- **Sprint 4**: Dashboard Owner diperluas — Stok Gabah/PK/Beras/Bekatul/Sekam,
  Profit per Batch, Rendemen Bulanan, Forecast Kebutuhan Gabah.

## Sprint 5 — Akuntansi Double-Entry

- Sistem jurnal otomatis penuh: setiap transaksi (pembelian, produksi, penjualan,
  pembayaran hutang/piutang) menghasilkan entri Debit/Kredit yang balance.
- Chart of Accounts (COA) lengkap: Persediaan per jenis barang, Hutang/Piutang
  Usaha, Pendapatan, HPP, Beban Operasional.
- Laporan otomatis dari jurnal: Buku Besar, Neraca Saldo, Laba Rugi, Neraca,
  Arus Kas.

## Sprint 6–8 — Modul Operasional

- **Sprint 6**: Business Intelligence — Forecast Gabah/Karung/Benang/Cashflow,
  Profit per Batch/Supplier/Pelanggan, Analisa Rendemen, Supplier & Customer
  Ranking — seluruhnya dengan Chart.js dan data real-time.
- **Sprint 7**: Modul Maintenance Mesin — 5 mesin (Husker, Polisher, Separator,
  Elevator, Destoner), jam operasi, jadwal & riwayat service, biaya service
  terjurnal otomatis, alarm jam operasi.
- **Sprint 8**: Modul Gudang Lanjutan — Stock Opname, Lot Number & Batch
  Tracking otomatis, valuasi FIFO, Stok Minimum & Alarm, Kartu Stok per item.

## Sprint 9–11 — Dokumen, Backup, Audit

- **Sprint 9**: Sistem dokumen otomatis — Invoice, Surat Jalan, Purchase Order,
  Kartu Supplier, Kartu Pelanggan, semua sebagai PDF dengan QR Code verifikasi
  dan nomor dokumen otomatis (`PREFIX-YYYYMM-####`).
- **Sprint 10**: Backup Enterprise — Backup/Restore JSON dengan validasi relasi
  penuh (foreign-key check, deteksi ID duplikat), Export/Import Excel, backup
  otomatis berkala, riwayat backup.
- **Sprint 11**: Audit Trail — pencatatan otomatis seluruh aktivitas (Login,
  Tambah, Edit, Hapus, Import, Restore, Backup) dengan Tanggal, Jam, User, IP,
  Browser, Data Lama, dan Data Baru, lewat auto-hook ke seluruh fungsi
  `save*`/`delete*` tanpa menyentuh kode bisnis yang ada.

## Sprint 12 — Audit Production-Ready

Audit menyeluruh terhadap bug, duplikasi kode, performa, memory, responsif,
dark mode, mobile, offline, dan PWA. Tiga bug kritis ditemukan dan diperbaiki:

- 5 fungsi `delete*` tidak membersihkan jurnal terkait → laporan jurnal tidak
  sinkron setelah penghapusan transaksi. Diperbaiki dengan memanggil
  `rebuildSemuaJurnal()` otomatis di setiap fungsi delete.
- Referensi jurnal "Bayar Hutang" memakai ID acak setiap kali, sehingga tidak
  bisa dilacak/dibersihkan ulang. Diperbaiki memakai ID kasbank yang stabil.
- Tombol Dark Mode ada di HTML sejak awal namun fungsi `toggleDarkMode()`
  tidak pernah ditulis — fitur senyap. Diimplementasikan penuh dengan deteksi
  `prefers-color-scheme` dan persistensi preferensi pengguna.

Juga: 17 halaman kehilangan entri breadcrumb (tampil "undefined" di topbar),
dilengkapi menjadi 37/37 halaman.

---

## QA Final — Validasi Matematis Penuh

Audit terakhir ini berbeda dari sprint-sprint sebelumnya: alih-alih membaca
kode, seluruh 97 fungsi kalkulasi bisnis murni (pure functions, tanpa
ketergantungan DOM) diekstrak dan dieksekusi nyata dalam sandbox Node.js,
lalu disimulasikan lewat siklus transaksi lengkap — pembelian gabah,
produksi 2 tahap, penjualan tunai & tempo, pelunasan piutang & hutang —
dengan setiap angka diverifikasi terhadap perhitungan manual.

**33 dari 33 pemeriksaan matematis lulus**, termasuk validasi bahwa Neraca
benar-benar balance (Aktiva = Kewajiban + Ekuitas), jurnal bersifat
deterministik (rebuild berulang tidak menghasilkan drift), dan integritas
tetap terjaga setelah penghapusan transaksi.

### Bug yang ditemukan dan diperbaiki dalam proses ini:

| # | Bug | Dampak | Status |
|---|---|---|---|
| 1 | `getHppBatch()` — HPP per kg beras memakai nilai gabah utuh, bukan porsi yang mengalir ke PK | HPP beras terinflasi ~32% di seluruh laporan, dashboard, dan BI module | ✅ Diperbaiki |
| 2 | `_hppPenjualan()` — HPP per kg dibagi qty *terjual*, bukan qty *diproduksi* | HPP pada jurnal Laba Rugi terinflasi hingga 3x lipat | ✅ Diperbaiki |
| 3 | `_hppPenjualan()` — tidak ada fallback untuk batch lama/seed tanpa data sumber gabah | Laba Rugi melaporkan **HPP = Rp0** untuk data yang sah, menggelembungkan laba secara fiktif | ✅ Diperbaiki |
| 4 | `rebuildSemuaJurnal()` — pencocokan piutang memakai field `sourceId`, padahal field asli yang terisi adalah `refId` | Akun Piutang Usaha di jurnal tidak pernah berkurang meski piutang sudah lunas — Neraca berisiko timpang | ✅ Diperbaiki |
| 5 | `getCustomerRanking()` (BI) — kesalahan field yang sama (`sourceId` vs `refId`) | Sisa piutang per pelanggan di analisa RFM dilaporkan lebih besar dari kondisi sebenarnya | ✅ Diperbaiki |
| 6 | `postKasManual()` — tidak mengecualikan kategori "Pelunasan Hutang Supplier" / "Penerimaan Pelunasan Piutang" | Saat jurnal di-rebuild, entri ini terposting dua kali dengan akun yang salah — saldo Hutang Usaha bisa menjadi minus permanen | ✅ Diperbaiki |
| 7 | `rebuildSemuaJurnal()` — tidak membedakan pembelian "lunas tunai sejak awal" dengan "awalnya hutang, dilunasi belakangan" | Hutang Usaha tercatat lunas dua kali untuk kasus pembayaran hutang yang terjadi setelah input awal | ✅ Diperbaiki |
| 8 | `rebuildSemuaJurnal()` — hanya memproses kasbank `sumber:'manual'`, melewatkan `sumber:'service'` | Biaya Maintenance Mesin (Sprint 7) hilang dari jurnal setiap kali rebuild dipanggil | ✅ Diperbaiki |
| 9 | Data seed/demo — penjualan Bekatul (400kg) melebihi total yang pernah diproduksi (284kg) | Stok Bekatul pada data contoh menampilkan angka **negatif (-116)**, yang mustahil secara fisik | ✅ Diperbaiki |

### Hasil setelah perbaikan (diuji dengan data seed/demo asli aplikasi)

| Metrik | Sebelum QA Final | Sesudah QA Final |
|---|---|---|
| Neraca (Aktiva vs Pasiva) | Tidak diverifikasi | Balance — selisih ~2.8×10⁻⁹ (floating-point) |
| HPP (Laba Rugi jurnal) | Rp 0 | Rp 10.040.738 |
| Stok Bekatul | -116 kg | 34 kg |
| Laba Bersih | Tergelembung secara fiktif | Rp 134.261 (wajar) |
| NaN / Infinity di seluruh struktur data | Tidak diperiksa | Nihil |

---

## Cakupan Pengujian

Pengujian QA Final mencakup 4 skenario simulasi penuh:

1. **Siklus Transaksi Lengkap** (17 pemeriksaan) — pembelian gabah → produksi
   tahap 1 & 2 → penjualan tunai & tempo → pelunasan piutang & hutang,
   memverifikasi stok dan HPP di setiap langkah.
2. **Jurnal & Neraca Balance** (9 pemeriksaan) — validasi setiap entri jurnal
   balance individual, saldo akun Hutang/Piutang/Kas sesuai perhitungan manual,
   dan Neraca balance secara keseluruhan.
3. **FIFO & Stok Lanjutan** (3 pemeriksaan) — lot tracking otomatis dan valuasi
   FIFO untuk pembelian dengan harga berbeda.
4. **Stress Test** (4 pemeriksaan) — rebuild jurnal berulang 5x tanpa drift,
   dan penghapusan transaksi diikuti rebuild tetap menjaga Neraca balance.

## Verifikasi Teknis

- Sintaks JavaScript: **valid** (`node -c app.js`)
- Event handler (`onclick`/`onchange`/`oninput`): **135/135 valid**, tidak ada
  referensi fungsi yang rusak
- Nama fungsi: **378 total, 0 duplikat**
- `index.html`: **tidak berubah** sejak Sprint 12 (UI 100% utuh)
- Service Worker cache: dinaikkan ke `erp-setia-dadi-v61-qa-final` agar
  pengguna PWA yang sudah install menerima pembaruan otomatis

---

## File dalam Rilis Ini

```
erp_padi/
├── app.js           — Seluruh logika aplikasi (13.278 baris)
├── index.html        — Struktur halaman & gaya (tidak berubah sejak Sprint 12)
├── sw.js             — Service Worker (cache v61-qa-final)
├── manifest.json     — Manifest PWA
├── icon-192.png      — Ikon aplikasi
└── icon-512.png      — Ikon aplikasi (resolusi tinggi)
```

## Catatan Pemasangan

Untuk pengguna yang sudah meng-install aplikasi sebagai PWA: tutup dan buka
ulang aplikasi (atau refresh browser jika dijalankan via tab) agar Service
Worker baru mengganti cache lama secara otomatis. Tidak ada migrasi data
manual yang diperlukan — seluruh perbaikan bersifat backward-compatible
dengan data yang sudah tersimpan di perangkat.
