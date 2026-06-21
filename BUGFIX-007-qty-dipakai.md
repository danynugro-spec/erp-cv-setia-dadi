# BUG-007 (KRITIS) FIX — Kolom "Qty Dipakai" Bermasalah

## Laporan Bug

**Modul:** Produksi Batch

1. Hanya baris pertama yang dapat diedit
2. Baris berikutnya tidak dapat diedit
3. Qty tidak otomatis terisi dari Sisa Tersedia
4. Perubahan Qty tidak menghitung ulang Total Qty
5. Perubahan Qty tidak menghitung ulang Estimasi HPP
6. Gabah Masuk Giling tidak mengikuti Total Qty jika nilainya 0 atau kosong

## Metodologi Audit

Nama fungsi yang disebut di laporan bug (`renderSourceRow`, `addSourceRow`,
`bindEvents`, `calculateBatch`, `updateHPP`, `updateTotalQty`) ternyata
tidak ada secara harfiah di kode — nama sesungguhnya dari sprint
sebelumnya adalah `renderSumberGabahPicker()`, `addSumberGabahRow()`,
`updateSumberGabah()`, `updateHppPreview()`. Pembacaan kode statis pada
fungsi-fungsi ini sempat **terlihat benar** (setiap input punya index `i`
yang berbeda per baris, bukan hardcoded `0`) — kontradiksi dengan laporan
bug mendorong investigasi lebih dalam lewat eksekusi nyata di Chromium
headless (Playwright), termasuk simulasi keystroke karakter-demi-karakter
(bukan `fill()` yang men-set value instan), untuk mereproduksi kondisi
sesungguhnya yang dialami operator saat mengetik.

## Akar Masalah

### Bug Utama — Full Re-render Menghancurkan Fokus Input

Setiap kali `updateSumberGabah(idx, 'qty', value)` dipanggil (dari
`oninput` inline pada setiap `<input>` qty), fungsi tersebut memanggil
`renderSumberGabahPicker()` di akhir — yang menulis ulang **seluruh**
`box.innerHTML` tabel sumber gabah.

Dibuktikan lewat instrumentasi langsung: menekan **satu** tombol angka di
input qty memicu render ulang, dan `document.activeElement` berubah dari
elemen `<input>` yang sedang difokus menjadi **`<body>`** — fokus browser
benar-benar lepas karena elemen yang sedang diketik dihancurkan dan
dibuat ulang di tengah interaksi. Karakter kedua dan seterusnya tidak
pernah sampai ke input manapun.

Reproduksi nyata: mengetik `"300"` karakter-demi-karakter di baris kedua
menghasilkan value akhir `"0"`. **Pengujian membuktikan ini bukan masalah
"hanya baris pertama"** — baris pertama mengalami kerusakan identik;
laporan awal kemungkinan mencerminkan pengalaman interaktif (paste/auto-
fill terlihat baik-baik saja, kerusakan baru terasa nyata saat mengetik
manual berurutan di baris-baris berikutnya).

### Bug Requirement #6 — Flag "Sudah Diisi Manual" Tidak Ada

`autoFillGabahMasukGiling()` memeriksa `if(Number(gabahInput.value)||0) return;`
— begitu field `pr_gabah` terisi **apa pun** (termasuk hasil auto-fill
sistem sendiri di pemanggilan sebelumnya), kondisi ini selalu `true`,
sehingga auto-update lanjutan dari Total Qty Dipakai **terblokir
permanen**. Tidak ada cara membedakan "nilai yang sistem isi sendiri"
dari "nilai yang operator ketik manual".

## Perbaikan

### 1. Event Delegation menggantikan inline `oninput` per elemen

Sesuai instruksi arsitektur eksplisit, satu listener `input`/`change`/`click`
dipasang pada container tabel (`#sumberGabahBox`), bukan atribut
`oninput`/`onclick` inline pada setiap elemen:

```js
function _bindSumberGabahEvents(){
  const box = document.getElementById('sumberGabahBox');
  if(!box || box.dataset.eventsBound === '1') return;
  box.dataset.eventsBound = '1';
  box.addEventListener('input', (e)=>{
    const target = e.target.closest('[data-role="qty-input"]');
    if(!target) return;
    _handleQtyInputDelegated(Number(target.dataset.rowIdx), target.value);
  });
  box.addEventListener('change', (e)=>{ /* pembelianId */ });
  box.addEventListener('click', (e)=>{ /* hapus baris */ });
}
```

Setiap `<tr>` dan elemen di dalamnya kini punya `data-row-idx` — id unik
per baris yang stabil selama baris tidak dihapus/diurutkan ulang.

### 2. Qty diketik TIDAK memicu full re-render

`_handleQtyInputDelegated()` meng-update data di `ctx.sumberGabah[idx]`,
lalu melakukan **patch DOM bertarget**: indikator warna dan pesan error
hanya untuk baris yang diketik, sel "Sisa Tersedia" untuk baris lain yang
memakai sumber sama — tanpa pernah menyentuh `box.innerHTML`. Elemen
`<input>` yang sedang difokus tidak pernah dihancurkan, sehingga fokus
dan kursor tetap utuh untuk **semua** baris, bukan hanya baris pertama.

`renderSumberGabahPicker()` (full re-render) tetap dipertahankan untuk
kasus yang memang membutuhkannya: baris ditambah/dihapus, atau pilihan
sumber pembelian (`<select>`) diganti — event `change` pada dropdown
tidak rawan kehilangan fokus karakter-demi-karakter seperti input angka.

### 3. Flag `gabahManualSet` — bedakan input manual vs auto-fill sistem

```diff
+ window._produksiEdit = {..., gabahManualSet: false, ...};

  function autoFillGabahMasukGiling(){
-   if(Number(gabahInput.value)||0) return;
+   if(ctx && ctx.gabahManualSet) return;
    ...
  }
```

Flag ini **hanya** di-set `true` lewat `_markGabahManualInput()`, dipasang
di `oninput` field `pr_gabah` itu sendiri — terpicu murni oleh keystroke
nyata operator. Assignment `.value = X` lewat JavaScript (oleh
`autoFillGabahMasukGiling()`/`gunakanSemuaStok()`) tidak memicu event DOM
`input`, sehingga flag ini tidak pernah ter-set oleh sistem sendiri.
`gunakanSemuaStok()` (Requirement #4b, sengaja override manual) me-reset
flag ini ke `false` setelah override, agar auto-follow tetap berfungsi
untuk perubahan berikutnya.

## Verifikasi

Seluruh perbaikan diverifikasi dengan **keystroke nyata** (Playwright
`page.keyboard.type()` per karakter, bukan `fill()` instan) di Chromium
headless.

| Skenario | Sebelum Fix | Sesudah Fix |
|---|---|---|
| Ketik "700" di baris 1 | `"0"` | `"700"` ✓ |
| Ketik "350" di baris 2 | `"0"` | `"350"` ✓ |
| Ketik "1500" di baris 3 | `"0"` | `"1500"` ✓ |
| `document.activeElement` setelah 1 keystroke | `<body>` (fokus hilang) | tetap `<input>` ✓ |
| Total Qty Dipakai setelah qty diubah | Tidak update | Terhitung ulang realtime ✓ |
| Estimasi HPP setelah qty diubah | Tidak update | Terhitung ulang realtime ✓ |
| Gabah Masuk Giling (sudah ter-auto-fill, lalu qty diubah) | Tetap nilai lama | Mengikuti Total Qty baru ✓ |
| Gabah Masuk Giling setelah operator ketik manual | — | Tetap nilai manual operator (tidak ditimpa) ✓ |
| Qty melebihi Sisa Tersedia | — | Pesan error + indikator merah tetap muncul ✓ |

### Regression suite baru: `/home/claude/qa8/qa-bug007.js` (12/12 passed)

Mencakup keenam poin bug yang dilaporkan plus dua business rule (input
manual tidak ditimpa, validasi qty melebihi stok).

### Verifikasi tidak ada regresi terhadap pekerjaan sebelumnya

| Suite | Hasil |
|---|---|
| Sprint QA Produksi Batch (end-to-end, 3 bagian) | 55/55 ✓ |
| BUG-007 regression (end-to-end) | 12/12 ✓ |
| Unit test `ProductionCalculationService` | 32/32 ✓ |
| Unit test Hutang Supplier (fuzzing 500 skenario) | 36/36 ✓ |
| **Total** | **135/135 ✓** |

### Verifikasi regresi kode

- ✅ Sintaks JavaScript valid (`node -c app.js`)
- ✅ 406 fungsi total, 0 nama duplikat
- ✅ 0 event handler (`onclick`/`onchange`/`oninput`) rusak
- ✅ `index.html` **tidak tersentuh sama sekali** (diverifikasi via
  timestamp file) — sesuai instruksi "Jangan mengubah UI"
- ✅ Tidak ada fitur baru ditambahkan — murni perbaikan business logic
  dan bug sesuai instruksi "Jangan menambah fitur baru"

## Checklist Arsitektur (sesuai instruksi eksplisit)

| Item | Status |
|---|---|
| Setiap baris memiliki id unik | ✓ `data-row-idx` pada `<tr>` dan setiap elemen anak |
| Setiap baris memiliki event listener sendiri (fungsional) | ✓ via event delegation — listener tunggal menangani semua baris berdasarkan `data-row-idx`, bukan listener terpisah per baris yang rawan duplikasi |
| Setiap baris memiliki state sendiri | ✓ `ctx.sumberGabah[idx]` — array of object terpisah, tidak ada shared state antar baris |
| Event delegation dipakai agar baris baru otomatis berfungsi | ✓ listener dipasang sekali pada container; baris baru (dari `addSumberGabahRow()`, tombol FIFO, dll) otomatis tertangani tanpa re-binding manual |
| Tidak ada input yang hanya aktif di baris pertama | ✓ diverifikasi nyata — ketiga baris diuji dengan keystroke independen |
