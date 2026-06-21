# BUG-009 FIX — Business Logic Produksi Tidak Sesuai Operasional

## Latar Belakang

Sprint sebelumnya (Sprint QA Produksi Batch Enterprise) dan BUG-007
mengimplementasikan **auto-complete FIFO**: memilih Jenis Gabah otomatis
mengisi seluruh stok yang tersedia ke tabel Sumber Gabah, diurutkan
tanggal pembelian tertua dulu. Setelah ditinjau ulang terhadap
operasional nyata, model ini **tidak sesuai**: operator perlu memilih
sendiri faktur pembelian mana yang dipakai untuk batch tertentu (mis.
hanya `PB-0004`, `PB-0062`, `PB-0064`, melewati `PB-0008`) — bukan selalu
seluruh stok yang ada di gudang.

Laporan ini membalik business process secara eksplisit:

> Jenis Gabah hanya berfungsi sebagai FILTER. Operator memilih sendiri
> sumber gabah. Jangan otomatis mengambil semua stok.

## Perubahan Business Logic

### 1. `onJenisGabahChange()` — Jenis Gabah murni FILTER

```diff
  function onJenisGabahChange(){
    const ctx = window._produksiEdit;
    const jenisGabah = document.getElementById('pr_jenis').value;
-   if(!jenisGabah){ ctx.sumberGabah = []; renderSumberGabahPicker(); return; }
-   ctx.sumberGabah = ProductionCalculationService.buildAutoSumberGabah(jenisGabah, ctx.id);
+   ctx.sumberGabah = [];
    renderSumberGabahPicker();
    autoFillGabahMasukGiling();
  }
```

Memilih (atau mengganti) Jenis Gabah sekarang **selalu** mengosongkan
tabel sumber gabah — termasuk saat operator mengganti pilihan jenis di
tengah jalan (sumber dari jenis lama dibersihkan; tidak relevan lagi
untuk jenis baru, dan dropdown `getPembelianOptionsForSumber()` — yang
**tidak diubah**, sudah benar memfilter `jenisGabah` sama + sisa>0 sejak
awal — tidak akan menampilkannya lagi).

### 2–4. Operator memilih sendiri via "+ Tambah Sumber Gabah"

`addSumberGabahRow()` dan `getPembelianOptionsForSumber()` **tidak
diubah** — keduanya sudah benar secara mekanis sejak sebelumnya: tombol
menambah baris kosong, dropdown memfilter faktur dengan jenis gabah sama
dan sisa qty > 0. Bug-nya murni di `onJenisGabahChange()` yang
"mendahului" operator dengan auto-fill — sekarang dihapus, sehingga
operator benar-benar memilih satu per satu, bebas kombinasi
(`PB-0004` + `PB-0062` + `PB-0064`, melewati `PB-0008`, dst).

`updateSumberGabah()` (dipanggil saat dropdown faktur diganti) **tidak
diubah** — Qty Dipakai otomatis = Sisa Tersedia sejak baris pertama kali
dipilih, operator tetap bebas mengedit.

### 5. Gabah Masuk Giling SELALU mengikuti Total Qty Dipakai

Sebelumnya (BUG-007), field ini punya mekanisme "manual override": sekali
operator mengetik manual, perubahan qty sumber gabah selanjutnya tidak
lagi memperbarui nilainya. BUG-009 **membalik total** aturan ini — field
sekarang murni turunan, tidak pernah "lepas" jadi nilai independen.

```diff
- window._produksiEdit = {..., gabahManualSet: ..., ...};
+ window._produksiEdit = {..., ...}; // flag dihapus

  function autoFillGabahMasukGiling(){
    const ctx = window._produksiEdit;
    const gabahInput = document.getElementById('pr_gabah');
-   if(ctx && ctx.gabahManualSet) return;
-   const newValue = ProductionCalculationService.computeGabahMasukGiling(ctx.sumberGabah, 0);
+   const total = (ctx.sumberGabah||[]).reduce((s,r)=> s + (Number(r.qty)||0), 0);
-   gabahInput.value = newValue > 0 ? newValue : '';
+   gabahInput.value = total > 0 ? total : '';
    ...
  }
```

`_markGabahManualInput()` (dipanggil dari `oninput` field `pr_gabah`)
dihapus sepenuhnya. Field `<input type="number" id="pr_gabah">` itu
sendiri **tidak diubah jadi `readonly`** (instruksi: jangan ubah UI) —
operator secara teknis masih bisa mengetik di sana, tapi nilai apa pun
yang diketik akan langsung tertimpa lagi pada perubahan qty sumber gabah
berikutnya, sesuai business rule baru.

### 6. HPP dihitung dari faktur yang dipilih saja

**Tidak ada perubahan kode** — `getHppBatch()` (fungsi pusat HPP, dipakai
jurnal akuntansi dan laporan) sudah sejak awal menghitung `totalNilai`
dan `totalQtySumber` murni dari `batch.sumberGabah`, bukan dari "seluruh
stok". Requirement ini otomatis terpenuhi begitu requirement #1
diperbaiki — `sumberGabah` sekarang **hanya** berisi faktur yang
benar-benar dipilih operator.

## Dampak Turunan yang Diperbaiki

### `isiOtomatisFIFO()` — disesuaikan agar tetap konsisten

Tombol "⚡ Isi Otomatis (FIFO)" (alokasi cepat sampai target tercapai)
tetap dipertahankan sebagai jalan pintas opsional (operator mengetik
target di `pr_gabah`, klik tombol, sistem alokasikan FIFO sampai target
tercapai). Ditambahkan pemanggilan `autoFillGabahMasukGiling()` di akhir
agar field tetap konsisten dengan total yang **sungguh-sungguh**
teralokasi (mis. jika stok tidak mencukupi target, field akan
mencerminkan jumlah yang benar-benar teralokasi, bukan target awal yang
mungkin lebih besar).

### `gunakanSemuaStok()` — dibersihkan dari referensi flag yang dihapus

Tombol "🎯 Gunakan Semua Stok" tetap berfungsi sebagai jalan pintas
opsional yang **sengaja** diklik operator (bukan auto-fill diam-diam) —
tidak melanggar requirement #1/#3. Kode dibersihkan dari referensi
`ctx.gabahManualSet` yang sudah tidak ada.

### Pesan teks informatif disesuaikan

Dua `<div class="help-text">`/`<p class="help-text">` yang isi teksnya
masih menyebut "otomatis (FIFO)" dari model bisnis lama diperbarui
kontennya agar akurat — **elemen HTML dan strukturnya tidak diubah**,
murni isi teks di dalamnya.

## Verifikasi

Seluruh perubahan diverifikasi dengan eksekusi nyata di Chromium headless
(Playwright), termasuk skenario persis dari laporan bug (`PB-0004`,
`PB-0008`, `PB-0062`, `PB-0064`).

| Requirement | Verifikasi |
|---|---|
| #1 Jenis Gabah hanya filter, tabel tetap kosong | ✓ `sumberGabah.length === 0` setelah pilih jenis |
| #2 Klik "+ Tambah Sumber Gabah" memunculkan dropdown terfilter | ✓ dropdown menampilkan PB-0004/0008/0062 (jenis sama, sisa>0) |
| #3 Operator bebas pilih kombinasi (bukan semua stok) | ✓ pilih PB-0004+PB-0062+PB-0064 (skip PB-0008) — hanya 3 baris, Gabah Masuk Giling = 3800 (bukan total 4 faktur) |
| #4 Qty Dipakai otomatis = Sisa Tersedia, tetap bisa diedit | ✓ qty auto-terisi sisa penuh per faktur dipilih |
| #5 Gabah Masuk Giling otomatis dari Total Qty, realtime | ✓ berubah seketika saat qty diedit; nilai manual (9999) tertimpa lagi begitu qty sumber berubah |
| #6 HPP dari faktur dipilih saja | ✓ HPP = harga faktur tunggal yang dipilih (Rp 5.200/kg), bukan rata-rata seluruh stok |

### Regression suite `tests/e2e-bug007-qty-dipakai.js` (diperbarui — 14/14 passed)

Diperbarui dari versi BUG-007 dengan helper `pilihSumberGabahManual()`
yang mensimulasikan alur operator memilih faktur secara eksplisit lewat
tombol — esensi pengujian asli (semua baris bisa diketik tanpa kehilangan
fokus) dipertahankan penuh, sekaligus menambahkan verifikasi business
rule baru (Gabah Masuk Giling tertimpa kembali setelah override manual,
HPP dari faktur tunggal).

### Test Sprint sebelumnya — diperbarui, tidak ada regresi tersisa

`tests` Playwright dari Sprint QA Produksi Batch (`qa-part1.js`,
`qa-part3.js`) yang sebelumnya mengasumsikan auto-fill diperbarui agar
mencerminkan alur "pilih manual via tombol" — esensi pengujian lain
(ringkasan realtime, draft, konfirmasi produksi, detail batch) tetap
dipertahankan dan diverifikasi ulang.

| Suite | Hasil |
|---|---|
| Sprint QA Part 1 (diperbarui) | 15/15 ✓ |
| Sprint QA Part 2 | 14/14 ✓ |
| Sprint QA Part 3 (diperbarui) | 28/28 ✓ |
| BUG-007/BUG-009 Regression (diperbarui) | 14/14 ✓ |
| Unit test `ProductionCalculationService` | 32/32 ✓ |
| Unit test Hutang Supplier (fuzzing 500 skenario) | 36/36 ✓ |
| **Total** | **139/139 ✓** |

### Verifikasi regresi kode

- ✅ Sintaks JavaScript valid (`node -c app.js`)
- ✅ 405 fungsi total, 0 nama duplikat
- ✅ 0 event handler (`onclick`/`onchange`/`oninput`) rusak
- ✅ Tidak ada sisa referensi fungsional ke mekanisme `gabahManualSet`
  (BUG-007) yang sudah dihapus
- ✅ `index.html` **tidak tersentuh sama sekali** (diverifikasi via
  timestamp file) — sesuai instruksi "jangan mengubah UI"
- ✅ `getPembelianOptionsForSumber()`, `getHppBatch()`,
  `ProductionCalculationService` (rumus inti) **tidak diubah** — sudah
  benar sejak awal, bug murni di titik pemanggilan auto-fill
