# SPRINT STABILIZATION — Modul Produksi

## Ringkasan

Sprint ini **tidak menambah fitur baru** — murni penyesuaian business
logic dan UX terhadap dua requirement eksplisit yang sebelumnya belum
diimplementasikan secara ketat di BUG-009, ditambah verifikasi menyeluruh
bahwa seluruh requirement business process yang sudah ada (BUG-007,
BUG-009) tetap stabil.

## Perubahan

### 1. Gabah Masuk Giling — sekarang benar-benar READONLY

Sebelumnya (BUG-009) field ini sudah **selalu mengikuti** Total Qty
Dipakai secara logic, tapi elemen `<input>` itu sendiri masih bisa
diketik secara teknis (nilai apa pun yang diketik akan tertimpa lagi
pada perubahan berikutnya). Requirement Sprint Stabilization ini eksplisit
meminta field benar-benar tidak bisa diketik:

```diff
  <input type="number" id="pr_gabah" value="${row.gabah||0}" min="0"
-   oninput="calcRendemenPreview(); validateSumberGabah(); calcPKSekamSisa();">
+   readonly style="background:#F9FAFB;cursor:not-allowed;">
+ <p class="help-text">Otomatis = Total Qty Dipakai dari sumber gabah di bawah.</p>
```

Nilainya tetap di-update programatik via `.value =` dari
`autoFillGabahMasukGiling()` setiap qty sumber gabah berubah — `readonly`
hanya mencegah **input manual operator**, tidak menghalangi update
otomatis dari JavaScript.

### 2. Tombol "Isi Otomatis (FIFO)" dan "Gunakan Semua Stok" → menu "Aksi Lanjutan"

Dipindahkan ke container `#aksiLanjutanProduksiBox` yang default
`display:none`, dengan tombol toggle "⋯ Aksi Lanjutan" — memakai pola
toggle visibility via `style.display` yang sudah konsisten dipakai di
tempat lain pada aplikasi (bukan komponen UI baru). "+ Tambah Sumber
Gabah" dan "🧹 Reset Qty" tetap terlihat langsung (operasional
sehari-hari, bukan "aksi khusus").

### 3. `isiOtomatisFIFO()` — sumber nilai target diperbaiki

Karena `pr_gabah` sekarang readonly, fungsi ini tidak bisa lagi membaca
target alokasi dari field tersebut (akan selalu sama dengan Total Qty
saat ini, bukan target baru). Diperbaiki memakai `prompt()` bawaan
browser untuk meminta target — pilihan paling minimal-invasif yang tidak
menambah elemen HTML baru ke form, sesuai instruksi "jangan menambah
fitur baru" / "jangan redesign UI".

## Verifikasi Requirement (Bug List)

Delapan item bug list diverifikasi dengan eksekusi nyata di Chromium
headless (Playwright):

| # | Item | Verifikasi |
|---|---|---|
| 1 | Jenis Gabah jangan otomatis ambil semua stok | ✓ (sudah benar sejak BUG-009, diverifikasi ulang) |
| 2 | Qty Dipakai semua baris harus editable | ✓ 3 baris diuji dengan keystroke nyata, semua tersimpan utuh |
| 3 | Tidak boleh scroll saat edit Qty | ✓ diuji langsung: `scrollTop` sebelum/sesudah ketik identik (353→353) |
| 4 | Gabah Masuk harus sinkron Total Qty | ✓ + sekarang readonly, tidak bisa "lepas sinkron" oleh input manual |
| 5 | Semua perhitungan realtime | ✓ Total Qty, HPP, Rata-rata Harga semua ter-update tanpa delay |
| 6 | Tidak boleh render ulang seluruh tabel | ✓ (event delegation dari BUG-007, diverifikasi masih utuh) |
| 7 | Cursor tetap di input yang sedang diedit | ✓ `document.activeElement` tetap `INPUT` setelah keystroke, bukan `BODY` |
| 8 | Semua row memiliki state sendiri | ✓ `data-row-idx` unik + `ctx.sumberGabah[idx]` independen per baris |

Item #2, #3, #6, #7, #8 secara teknis sudah diperbaiki di BUG-007
(event delegation, patch DOM bertarget) — sprint ini memverifikasi ulang
bahwa perbaikan tersebut **tetap utuh** setelah perubahan readonly dan
restrukturisasi tombol, bukan mengimplementasikan ulang dari nol.

## QA — Simulasi Skenario Persis Sesuai Permintaan

**Batch 1**: PB0004 (10.000 kg) + PB0013 (5.000 kg) + PB0072 (12.500 kg)

| Pemeriksaan | Target | Hasil |
|---|---|---|
| Tabel kosong setelah pilih Jenis Gabah | kosong | ✓ `[]` |
| Gabah Masuk awal | 0 | ✓ kosong/0 |
| Gabah Masuk setelah pilih 3 faktur | 27.500 kg | ✓ **27.500 kg** |
| HPP (rata-rata tertimbang) | sesuai data | ✓ Rp 4.995/kg (manual: Rp 4.995,45/kg) |
| Field readonly | ya | ✓ `readOnly: true` |
| Faktur lain (PB0080) tidak ikut terpakai | tetap 8.000 kg | ✓ tetap 8.000 kg |
| Qty supplier berkurang setelah simpan | PB0004/13/72 → 0 | ✓ semua 0 |
| Tidak ada stok negatif | — | ✓ tidak ditemukan satu pun |
| Tidak ada scroll jump | — | ✓ `scrollTop` identik sebelum/sesudah |
| Tidak ada render ulang tabel saat ketik | — | ✓ `document.activeElement` tetap `INPUT` |

**Catatan teknis**: simulasi pertama sempat menghasilkan `30.000 kg` —
diselidiki dan dikonfirmasi sebagai **kesalahan data uji saya sendiri**
(salah mengetik stok PB0072 sebagai 15.000 kg, bukan 12.500 kg sesuai
skenario), bukan bug aplikasi. Setelah data uji diperbaiki sesuai
skenario persis, hasil **27.500 kg** tercapai tepat.

## Dampak Terhadap Test Suite yang Sudah Ada

Tiga file test Playwright dari sprint-sprint sebelumnya diperbarui agar
sesuai dengan field readonly dan tombol yang dipindah ke menu
tersembunyi — esensi pengujian masing-masing **dipertahankan penuh**,
hanya cara berinteraksi dengan UI yang disesuaikan:

- `qa-part2.js`: tambah langkah klik "Aksi Lanjutan" sebelum mengakses
  tombol FIFO/Semua Stok; ganti `fill('#pr_gabah', ...)` dengan dialog
  handler untuk `prompt()`
- `qa-bug007.js` / `tests/e2e-bug007-qty-dipakai.js`: ganti skenario
  "manual override Gabah Masuk Giling" (sudah tidak mungkin terjadi lagi
  karena readonly) dengan assertion `readOnly === true` + verifikasi
  tetap sinkron realtime

| Suite | Hasil |
|---|---|
| Sprint QA Part 1 | 15/15 ✓ |
| Sprint QA Part 2 (diperbarui) | 14/14 ✓ |
| Sprint QA Part 3 | 28/28 ✓ |
| BUG-007/BUG-009 Regression (diperbarui) | 15/15 ✓ |
| Unit test `ProductionCalculationService` | 32/32 ✓ |
| Unit test Hutang Supplier (fuzzing 500 skenario) | 36/36 ✓ |
| **Total** | **140/140 ✓** |

## Verifikasi Regresi Kode

- ✅ Sintaks JavaScript valid (`node -c app.js`)
- ✅ 406 fungsi total, 0 nama duplikat
- ✅ 0 event handler (`onclick`/`onchange`/`oninput`) rusak
- ✅ `index.html` **tidak tersentuh sama sekali** (diverifikasi via
  timestamp file)
- ✅ Tidak ada fitur baru ditambahkan — tombol "Aksi Lanjutan" murni
  reorganisasi tombol yang sudah ada, bukan kapabilitas baru
- ✅ `ProductionCalculationService` (rumus inti FIFO/HPP/validasi) **tidak
  diubah** — perubahan murni di lapisan DOM/UX form
