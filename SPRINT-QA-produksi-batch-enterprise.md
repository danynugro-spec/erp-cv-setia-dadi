# Sprint QA — Penyempurnaan Modul Produksi Batch Enterprise

## Ringkasan

Seluruh 13 requirement diimplementasikan dan diverifikasi dengan eksekusi
nyata di browser headless (Playwright) — bukan hanya pembacaan kode.
Selama proses ini ditemukan dan diperbaiki **6 bug konkret**, beberapa di
antaranya cukup serius (silent data corruption, modal macet tanpa pesan
error yang jelas ke pengguna).

**Total verifikasi: 100/100 pemeriksaan passed**
(55 end-to-end Playwright + 32 unit test `ProductionCalculationService` +
13 unit test arsitektur murni di awal pengembangan).

Desain UI utama **tidak diubah** — seluruh pekerjaan murni business logic,
penambahan tombol/elemen baru mengikuti pola visual (`btn-secondary`,
`kpi`, `section-divider`) yang sudah ada di aplikasi.

---

## Daftar File yang Diubah

| File | Perubahan |
|---|---|
| `app.js` | +818 baris ditambahkan, ~60 baris diganti. Seluruh logika baru (`ProductionCalculationService` dan integrasinya ke form produksi) |
| `tests/unit-tests-produksi-batch.js` | **Baru** — 32 unit test permanen untuk `ProductionCalculationService` |
| `index.html` | **Tidak diubah** (diverifikasi via timestamp file) |

---

## Bug yang Diperbaiki

Ditemukan melalui pengujian end-to-end nyata di Chromium headless, bukan
asumsi dari membaca kode:

### 1. Indikator warna merah tidak pernah muncul (Requirement #7)
`getIndicatorColor(qty, sisaTampil + qty)` dipanggil dengan parameter kedua
yang **selalu ≥ qty itu sendiri** (karena `sisaTampil ≥ 0`), membuat kondisi
"qty melebihi stok" matematis mustahil terpenuhi. Diperbaiki dengan
memanggil `getIndicatorColor(qty, sisaTampil)` — `sisaTampil` sendiri sudah
representasi stok tersedia yang benar.

### 2. Data Gabah Masuk Giling korup secara diam-diam untuk nilai ≥ 1000kg
`autoFillGabahMasukGiling()` dan `gunakanSemuaStok()` mengisi
`<input type="number">` dengan `fmtNum(newValue)` — format Indonesia
(`"1.000"`, titik sebagai pemisah ribuan). Browser menerima string ini
tanpa keluhan, tapi `Number("1.000")` di JavaScript menghasilkan **`1`**
(titik dibaca sebagai pemisah desimal), bukan `1000`. Setiap pembacaan
nilai berikutnya (validasi, ringkasan, konfirmasi, simpan) jadi salah
total untuk batch dengan gabah ≥1000kg — bug ini *silent*, tidak melempar
error apa pun, hanya menghasilkan angka yang salah. Diperbaiki dengan
mengisi `<input type="number">` dengan angka polos, bukan string berformat.

### 3. Modal macet setelah "Kembali Edit" lalu "Lanjutkan" kedua kalinya
`konfirmasiSimpanProduksi()` mengganti seluruh `modalBody` dengan layar
ringkasan, menghapus elemen form (`pr_mulai`, `pr_jenis`, dst) dari DOM.
Tombol "✓ Lanjutkan" memanggil `saveProduksi()` yang langsung mencoba
`document.getElementById('pr_mulai').value` — elemen sudah tidak ada,
`null.value` melempar exception, eksekusi berhenti, modal macet di layar
konfirmasi tanpa pesan apa pun ke pengguna. Diperbaiki dengan
mengembalikan form ke DOM dari snapshot data (bukan HTML statis) secara
sinkron sebelum memanggil `saveProduksi()` — pengguna tidak melihat
"flash" form karena browser tidak sempat me-repaint di antara dua
pemanggilan fungsi sinkron.

### 4. "Kembali Edit" kehilangan nilai form (akar dari bug #3)
Percobaan perbaikan pertama menyimpan snapshot sebagai string
`modalBody.innerHTML`. Setelah dipulihkan, `<select>`/`<input>` yang
nilainya di-set lewat JavaScript (`element.value = X`, bukan markup HTML
statis hasil render awal) kembali kosong — karena `.innerHTML` hanya
menangkap markup, bukan DOM state dinamis. Diperbaiki dengan snapshot
**data** (memakai mekanisme yang sama dengan draft recovery Requirement
#9, bukan string HTML).

### 5. Gap nomor batch (BTC-003 dibuat tapi tidak pernah dipakai)
Setiap kali `editProduksi(null)` dipanggil (termasuk dari alur internal
"Kembali Edit" yang sekarang membuka ulang form), nomor batch baru
dikonsumsi dari sequence (`nextCode('batch','BTC',3)`) untuk ditampilkan
di judul form, tapi `saveProduksi()` memanggil `nextCode()` **lagi** saat
benar-benar menyimpan. Siklus Konfirmasi → Kembali Edit → Lanjutkan
menyebabkan satu nomor batch "terbakar" tanpa pernah dipakai. Diperbaiki
dengan menyimpan nomor batch yang sudah di-generate di context edit
(`window._produksiEdit.batch`), dipakai ulang konsisten sampai batch
benar-benar tersimpan.

### 6. `getHppBatch()` (sebelum sprint ini, sudah benar) tidak dipakai konsisten di preview form
`updateHppPreview()` (preview HPP saat input) menghitung ulang rumus HPP
secara independen dari `getHppBatch()` (fungsi pusat yang sudah dipakai
jurnal akuntansi dan laporan sejak sprint sebelumnya) — berisiko preview
menyimpang dari angka final tersimpan. Diperbaiki dengan mendelegasikan
sepenuhnya ke `ProductionCalculationService.computeHppPreview()`, yang
murni memanggil `getHppBatch()`.

---

## Fitur Baru

### 1. `ProductionCalculationService` — satu sumber kebenaran (Requirement #12)
Object service terpusat dengan 11 method murni (tidak menyentuh DOM):
`getAvailableSourcesFIFO`, `buildAutoSumberGabah`, `autoAllocateFIFO`,
`useAllStock`, `resetQty`, `computeGabahMasukGiling`, `computeSummary`,
`validateRows`, `getIndicatorColor`, `computeHppPreview`,
`validateBeforeSave`. Seluruh form, preview, dan konfirmasi produksi
memanggil method-method ini — tidak ada rumus FIFO/HPP/validasi yang
ditulis ulang di tempat lain.

### 2. Auto Complete Sumber Gabah — FIFO (Requirement #1)
Memilih Jenis Gabah otomatis menampilkan seluruh stok tersedia, diurutkan
tanggal pembelian tertua dulu. Tidak perlu klik "+ Tambah Sumber Gabah"
berulang kali.

### 3. Auto Isi Qty Dipakai (Requirement #2)
Qty Dipakai otomatis = Sisa Tersedia saat sumber dipilih. Operator tetap
bebas mengubah di kolom yang sama.

### 4. Auto Hitung Gabah Masuk Giling (Requirement #3)
Realtime, mengikuti total seluruh Qty Dipakai — hanya jika field belum
diisi manual oleh operator.

### 5. Tiga tombol cepat (Requirement #4)
- **⚡ Isi Otomatis (FIFO)** — alokasi qty FIFO sampai target tercapai
- **🎯 Gunakan Semua Stok** — semua qty = sisa tersedia
- **🧹 Reset Qty** — kosongkan qty tanpa menghapus daftar sumber

### 6. Ringkasan realtime (Requirement #5)
Jumlah Supplier, Jumlah Batch Pembelian, Total Qty Dipakai, Total Nilai
Gabah, Estimasi HPP Gabah, Rata-rata Harga, Sisa Selisih — update
otomatis setiap perubahan.

### 7. Validasi qty per baris (Requirement #6)
Pesan error spesifik untuk qty melebihi stok, negatif, atau kosong.

### 8. Indikator warna (Requirement #7)
🟢 sesuai · 🟡 sisa stok <10% · 🔴 melebihi stok — tampil langsung di
samping input qty tiap baris.

### 9. HPP realtime tanpa tombol Hitung (Requirement #8)
Setiap perubahan qty langsung memicu kalkulasi ulang Total Nilai Gabah,
harga rata-rata tertimbang, dan estimasi HPP/kg.

### 10. Auto Simpan Draft (Requirement #9)
Form batch baru disimpan otomatis ke `localStorage` (debounce 2 detik
sejak perubahan terakhir). Saat modul produksi dibuka kembali, draft
yang belum tersimpan ditawarkan untuk dipulihkan. Draft otomatis
dibersihkan begitu batch berhasil disimpan.

### 11. Konfirmasi Produksi (Requirement #10)
Sebelum batch tersimpan, tampilkan ringkasan (Jenis Gabah, Total Gabah
Masuk, Jumlah Supplier, Rata-rata Harga, Estimasi HPP) dengan pilihan
"✓ Lanjutkan" atau "✖ Kembali Edit" (kembali ke form persis seperti
sebelumnya, termasuk seluruh isian).

### 12. Lihat Detail Batch (Requirement #11)
Tombol baru di riwayat batch produksi menampilkan: supplier yang
digunakan (qty, harga, nilai per supplier), HPP Batch, rendemen tiap
tahap, dan seluruh output (PK, Beras, Menir, Bekatul, Sekam).

---

## Hasil QA (Requirement #13)

### Verifikasi end-to-end (Playwright, Chromium headless — 55 pemeriksaan)

| Bagian | Cakupan | Hasil |
|---|---|---|
| Part 1 | FIFO, auto-fill qty, auto-hitung gabah masuk, edit manual semua baris, ringkasan realtime | 13/13 ✓ |
| Part 2 | 3 tombol cepat, validasi qty, indikator merah/hijau, HPP realtime tanpa tombol | 14/14 ✓ |
| Part 3 | Indikator kuning, draft autosave & recovery, konfirmasi produksi (termasuk siklus Kembali Edit → Lanjutkan), detail batch | 28/28 ✓ |

### Unit test permanen (`tests/unit-tests-produksi-batch.js` — 32 pemeriksaan)

Verifikasi struktural (memastikan kode benar-benar mendelegasikan ke
`ProductionCalculationService`/`getHppBatch()`, bukan kebetulan
menghasilkan angka sama) + 7 skenario matematis: FIFO, tombol cepat,
validasi & indikator, ringkasan, HPP realtime, validateBeforeSave, dan
pencegahan stok minus.

### Checklist eksplisit user

| Item | Status |
|---|---|
| ✓ Qty otomatis | Terverifikasi — auto = sisa tersedia saat sumber dipilih |
| ✓ Qty bisa diedit di semua baris | Terverifikasi — diuji edit manual baris pertama dari 3 baris auto-fill |
| ✓ FIFO berjalan | Terverifikasi — urutan tanggal tertua diproses lebih dulu, di service maupun end-to-end |
| ✓ HPP realtime | Terverifikasi — berubah otomatis tanpa tombol, delegasi murni ke `getHppBatch()` |
| ✓ Tidak ada stok minus | Terverifikasi — sumber FIFO otomatis mengecualikan pembelian yang sudah habis terpakai |
| ✓ Tidak ada Qty melebihi stok | Terverifikasi — validasi error + indikator merah, dicegah sejak alokasi FIFO |
| ✓ Draft berjalan | Terverifikasi — tersimpan otomatis, dipulihkan dengan konfirmasi, dibersihkan setelah simpan sukses |

### Verifikasi regresi

- ✅ Sintaks JavaScript valid (`node -c app.js`) di setiap tahap perbaikan
- ✅ 403 fungsi total, 0 nama duplikat
- ✅ 0 event handler (`onclick`/`onchange`/`oninput`) rusak
- ✅ Unit test sprint sebelumnya (`unit-tests-hutang-supplier.js`, 36
  pemeriksaan, termasuk fuzzing 500 skenario) tetap 100% passed — modul
  Hutang Supplier tidak terpengaruh perubahan di modul Produksi
- ✅ `index.html` **tidak tersentuh sama sekali** (diverifikasi via
  timestamp file) — sesuai instruksi "jangan mengubah desain utama
  aplikasi"

---

## Catatan untuk Developer

Jalankan kedua suite test setelah perubahan apa pun pada logika
produksi/pembelian/HPP:

```
node tests/unit-tests-produksi-batch.js
node tests/unit-tests-hutang-supplier.js
```

Jika menambah kategori transaksi atau field baru ke batch produksi yang
memengaruhi HPP/validasi/ringkasan, tambahkan penanganannya **hanya** di
`ProductionCalculationService` — seluruh titik pemanggil (form input,
preview, konfirmasi, riwayat detail) akan otomatis ikut konsisten.
