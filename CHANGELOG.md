# CHANGELOG — ERP Penggilingan Padi PRO+
## CV. SETIA DADI

---

## v1.0.0 — RC FINAL (Build 20260623)

**Status:** PRODUCTION READY

### Bug Fixes
- Global error handler mencegah crash diam tanpa notifikasi
- `renderPage()` wrapped try-catch — error ditampilkan dengan friendly UI
- `getHppBatch(null)` null guard — tidak crash jika batch undefined
- `renderProduksi()` null-safe sort
- Division-by-zero guard di `calcRendemenPKBeras()`
- Validasi field-specific di `savePenjualan`, `savePembelian`, `saveKasManual`
- JSON.parse try-catch di semua titik form produksi baru
- Loading state saat proses berat (rebuildJurnal)

### Branding
- Versi ditampilkan di sidebar, page title, dan appVersionBadge
- `APP_VERSION = '1.0.0'`, `APP_BUILD = '20260623'`, `APP_CODENAME = 'RC-FINAL'`

---

## v0.15.0 — Sprint 15: LOT Traceability & Smart Inventory

### Fitur Baru
- **Kartu LOT**: Halaman inventori dengan search, filter, dan detail lengkap
- **LOT Numbering**: Format GBH-YYYYMMDD-0001, PK-YYYYMMDD-0001, dst.
- **Full Traceability**: Beras → PK → Gabah → Supplier (1 klik)
- **LOT Status**: TERSEDIA / SEBAGIAN / HABIS / DIBATALKAN / TERKUNCI
- **Dashboard LOT**: Top 10 lot, lot tertua, hampir habis, distribusi
- **Analisis Supplier**: Ranking, rendemen rata-rata, HPP/kg
- **Global LOT Search**: Multi-field real-time
- **QR Code** per lot menggunakan QRCode.js
- **FIFO**: Keluar berurutan tanggal terlama
- `parentLotId` traceability chain (Beras LOT → PK LOT → Gabah LOT)
- `syncLotStokOtomatis()` memoization ditingkatkan (dirty flag + hash)
- Nav menu baru: Kartu LOT (05c), Dashboard LOT (05d), Analisis Supplier (05e)

---

## v0.14.1 — Sprint 14 Final: UI/UX Produksi Final

### Perubahan
- Form field ID mismatch fix (gb_jenis vs pr_jenis) — bug kritis
- Tabel riwayat produksi: Tanggal | Jenis | Batch | Input | Output | Rendemen | HPP | Status
- Semua "Tahap 1/2" dihapus dari UI operator
- Mode badge berwarna: G→B (hijau), G→PK (ungu), PK→B (kuning)
- `renderSumberGabahPicker` form-agnostic (gb_jenis, gpk_jenis, pr_jenis)
- `updateHppPreview` + `calcRendemenPreview` multi-form IDs

---

## v0.14.0 — Sprint 14: Production Engine Refactor (3-Mode)

### Arsitektur Baru
- Eliminasi "Tahap 1" dan "Tahap 2" dari seluruh UI operator
- **3 Mode Produksi**:
  - 🌾 Gabah → Beras (proses penuh, langsung SELESAI)
  - 🌾 Gabah → PK (husker saja, status MENUNGGU_POLISHER)
  - 🟡 PK → Beras (polisher saja, pilih lot PK)
- Modal pilih mode saat "+ Produksi Baru"
- Form terpisah per mode — tidak ada field tidak relevan
- `MENUNGGU_POLISHER` status menggantikan `HUSKER_SELESAI`
- HPP chain: PK_BERAS → GABAH_PK → Gabah → Supplier (traceability)
- `_inferMode()` / `_inferStatus()` backward compat helpers
- `postProductionJournal(row)` — jurnal per mode
- `postProduksiTahap1` skip jika PK_BERAS
- `postProduksiTahap2` skip jika GABAH_PK
- Section "Menunggu Penyosohan" di list produksi
- `getAvailablePKLots()` — lot PK tersedia untuk Mode 3
- Backward compat: data lama auto-migrate ke mode GABAH_BERAS

---

## v0.13.0 — Sprint 13: Stabilisasi Produksi (RC1, RC2)

### Fitur
- Batch berstatus: PERSIAPAN → HUSKER_SELESAI → SELESAI
- Section collapse/expand pada form produksi (3 section)
- Stok gabah berkurang saat Husker dimulai
- DIBATALKAN excluded dari semua kalkulasi stok
- `_guardSaving` + `_releaseSaving` double-click protection
- `saveDB()` try-catch + storage size warning (>4MB)
- `savePenjualan` stock check sebelum simpan
- JSON.parse try-catch di semua titik
- `syncLotStokOtomatis` memoization (dirty flag)
- `renderProduksi` → `renderProduksi` baru dengan "Sedang Berjalan" section
- `simpanPersiapanBatch`, `simpanHuskerBatch`, `selesaikanPolisherBatch`
- `cancelProduction`, `finishProduction`
- `tglHuskerSelesai`, `catatanHusker`, `lotPKId` fields baru
- Field `status` + migration di `loadDB()`

---

## v0.12.0 — Sprint 12: Terminologi & Desain Baru

### Sprint 12A: Terminologi Refactor
- "Tahap 1" → "Pengupasan Gabah (Husker)"
- "Tahap 2" → "Penyosohan Beras Pecah Kulit (Polisher)"
- 41 label/teks diperbarui konsisten di seluruh UI

### Sprint 12B: Desain Business Process
- Dokumen desain arsitektur produksi baru
- Analisis operasional nyata penggilingan padi CV. Setia Dadi
- Persetujuan: collapse/expand sections, staged batch

---

## v0.11.0 — Sprint 11: Laporan & Business Intelligence

### Fitur
- Dashboard KPI: produksi, HPP, rendemen, laba kotor
- Chart menggunakan Chart.js: rendemen trend, HPP, penjualan
- Laporan lengkap dengan export Excel (SheetJS)
- Cetak PDF menggunakan html2pdf.js
- Dokumen berQR: Invoice, Surat Jalan, Nota Pembelian
- Pusat Dokumen: generate semua dokumen dari satu tempat

---

## v0.10.0 — Sprint 10: Stock Opname & Stok Minimum

### Fitur
- Stock Opname: input fisik vs sistem, selisih otomatis
- Stok Minimum Master: alert jika stok di bawah threshold
- Kartu Stok per item: mutasi lengkap dengan saldo berjalan
- Lot / Batch Tracking: valuasi FIFO per lot
- `syncLotStokOtomatis()`: create/update lots dari semua transaksi

---

## v0.9.0 — Sprint 9: Maklon

### Fitur
- **Tipe A**: Jasa murni — penerima tidak punya gabah, cukup bayar jasa
- **Tipe B**: Titip giling — gabah milik pihak ketiga, diproses di sini
- **Tipe C**: Bagi hasil — hasil dibagi sesuai kesepakatan
- Stok titipan terpisah dari stok sendiri
- Jurnal per tipe maklon
- Surat Jalan maklon

---

## v0.8.0 — Sprint 8: Akuntansi Double-Entry

### Fitur
- **Jurnal Umum**: Debit = Kredit enforced di setiap entri
- **Buku Besar**: Per akun COA, filter periode, ekspor
- **Neraca Saldo**: Otomatis dari jurnal, trial balance
- **Laporan Laba Rugi**: Dari jurnal (bukan dari kalkulasi manual)
- **Neraca**: Aset = Kewajiban + Modal (verified)
- **Arus Kas**: Operasional + Investasi + Pendanaan
- COA (Chart of Accounts) standar Indonesia untuk penggilingan padi
- `jurnalBuat()`: create journal entry dengan ref unik
- `jurnalHapusRef()`: cleanup sebelum re-post
- `rebuildSemuaJurnal()`: rebuild seluruh jurnal dari transaksi

---

## v0.7.0 — Sprint 7: Hutang, Piutang, & Keuangan

### Fitur
- **Hutang Supplier**: Kuitansi pelunasan, riwayat pembayaran
- **Piutang Pelanggan**: Penerimaan bertahap, kartu piutang
- **Kas & Bank**: Multi-akun (Kas Tunai, BRI, BCA, dll.)
- **Jurnal otomatis**: setiap transaksi pembelian/penjualan/kas
- Kartu Supplier: ringkasan pembelian, hutang, rendemen
- Kartu Pelanggan: ringkasan penjualan, piutang

---

## v0.6.0 — Sprint 6: Distribusi & Pengiriman

### Fitur
- Form Pengiriman: order ke pelanggan, tracking armada
- Surat Jalan dengan QR Code
- Manajemen Kendaraan: plat, SIM, STNK, kapasitas
- Kirim Bertahap: penjualan besar dipecah multi-pengiriman
- Update stok otomatis saat pengiriman dikonfirmasi

---

## v0.5.0 — Sprint 5: Produksi & Stok

### Fitur
- **Produksi** (model Tahap 1 + Tahap 2): Husker + Polisher
- HPP tertimbang: FIFO sumber gabah, rata-rata berbobot
- `getStokProduk()`: stok beras/menir/bekatul/sekam/PK real-time
- `getStokGabah()`: stok per jenis gabah real-time
- `ProductionCalculationService`: validasi FIFO sumber gabah
- Preview HPP dan rendemen real-time saat input

---

## v0.4.0 — Sprint 4: Penjualan & Maklon Dasar

### Fitur
- Form Penjualan: produk, qty, harga, diskon
- Status penjualan: Lunas / Piutang
- Cetak invoice dasar
- Nomor invoice otomatis (INV-YYYYMMDD-001)
- Validasi stok sebelum penjualan

---

## v0.3.0 — Sprint 3: Pembelian Gabah

### Fitur
- Form Pembelian: supplier, jenis gabah, qty, harga per kg
- Mode pembayaran: tunai, DP, kredit
- Hutang supplier otomatis
- Nomor faktur otomatis (PB-YYYYMMDD-001)
- Histori pembelian per supplier

---

## v0.2.0 — Sprint 2: Master Data & Auth

### Fitur
- Login multi-role: OWNER / ADMIN / KASIR
- Master Supplier: CRUD lengkap
- Master Pelanggan: CRUD lengkap
- Master Jenis Gabah/Beras/Samping/Bahan Baku
- Master Kendaraan
- Access control per halaman per role

---

## v0.1.0 — Sprint 1: Foundation

### Fitur
- Arsitektur PWA single-file (app.js + index.html)
- localStorage sebagai database (key: erp_padi_pro_plus_v1)
- Responsive UI: sidebar + main content
- Dark mode support
- Service Worker untuk offline capability
- Backup/restore dasar
- Audit Trail dasar
- `loadDB()` + `saveDB()` + `defaultData()`

---

*ERP Penggilingan Padi PRO+ — CV. SETIA DADI*
