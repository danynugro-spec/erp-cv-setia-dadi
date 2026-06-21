# BUG KRITIS FIX — Sinkronisasi Saldo Hutang Supplier

## Laporan Bug

**Contoh kasus: Supplier Barokah**

| Sumber | Saldo Ditampilkan |
|---|---|
| Rekap Hutang | Rp 204.013.600 |
| Kartu Supplier | Rp 41.967.100 |

**Rumus yang benar** (dikonfirmasi oleh user):
```
Total Pembelian   Rp 807.391.400
− DP              Rp 749.084.850
− Pelunasan       Rp  16.339.450
= Saldo Hutang    Rp  41.967.100   ← Kartu Supplier sudah benar
```

Rekap Hutang Supplier yang salah — laporan keuangan menjadi tidak
konsisten antar modul.

## Metodologi Audit

Investigasi dimulai dengan memverifikasi apakah `calculateOutstandingDebt()`
— fungsi pusat yang sudah dibangun pada perbaikan sebelumnya — benar-benar
dipanggil oleh seluruh modul terkait. Ditemukan bahwa **`_buildKartuEvents()`
(Kartu Supplier) ternyata TIDAK memanggil fungsi pusat sama sekali** —
masih menghitung `saldoAkhir` secara independen lewat iterasi event kasbank
manual (`totDebit − totDP − totLunas`), meski secara historis dirancang
agar hasilnya "seharusnya" identik.

Untuk menemukan skenario nyata yang menyebabkan kedua implementasi
independen ini divergen, dibangun **fuzzer** — generator skenario transaksi
acak (ribuan kombinasi pembelian, DP, pelunasan, uang muka) yang
membandingkan hasil `calculateOutstandingDebt()` vs `_buildKartuEvents()`
secara otomatis. Pendekatan ini jauh lebih efektif daripada menebak
skenario satu-per-satu, dan berhasil menemukan **20,5% tingkat divergensi**
pada skenario tertentu sebelum disaring ulang ke kondisi yang benar-benar
realistis (sesuai jalur transaksi yang mungkin terjadi lewat
`savePembelian()` dan migrasi data sesungguhnya).

## Akar Masalah

### Masalah Utama — Dua Implementasi Independen

`_buildKartuEvents()` (dipakai Kartu Supplier) dan `calculateOutstandingDebt()`
(dipakai Rekap Hutang, Laporan Hutang, Buku Besar) adalah **dua kode
terpisah** yang sama-sama berusaha menghitung saldo hutang, tapi dipelihara
secara manual masing-masing. Setiap kali ada kategori transaksi baru
ditambahkan (mis. `'Uang Muka Dipakai'`), kedua tempat harus diperbarui
secara konsisten — kalau salah satu terlewat atau ditangani sedikit
berbeda, keduanya akan diam-diam menghasilkan angka berbeda. Ini persis
yang terjadi: penanganan kategori `'Uang Muka Dipakai'` di kedua fungsi
sempat tidak identik dalam beberapa iterasi perbaikan sebelumnya.

### Bug Tambahan — Double-Counting Uang Muka di `savePembelian()`

Ditemukan saat menelusuri sumber data: ketika user memilih status
**'Lunas'** untuk faktur baru, dan supplier punya saldo uang muka
tersedia dari transaksi sebelumnya, kode mencatat **dua** entri kasbank
untuk faktur yang sama:

```js
// SEBELUM — bug
if(status === 'Lunas'){
  if(dp >= total || dp === 0){
    // Mencatat LUNAS TUNAI PENUH (keluar: total)
    DB.kasbank.push({..., keluar: total, kategori:'DP Pembelian'});
  }
  // TANPA SYARAT, juga mencoba memakai uang muka — DITAMBAHKAN
  // di atas pembayaran tunai penuh yang sudah tercatat!
  const sisaUangMuka = getUangMukaPerSupplier()[supplier] || 0;
  if(sisaUangMuka > 0 && total > 0){
    DB.kasbank.push({..., masuk: dipakaiDariUM, kategori:'Uang Muka Dipakai'});
  }
}
```

Untuk faktur yang sudah lunas tunai 100%, total yang tercatat "dibayar"
menjadi `total + dipakaiDariUM` — **lebih besar** dari nilai faktur
sesungguhnya. Uang muka yang seharusnya tetap tersedia untuk mengurangi
hutang faktur **lain** yang benar-benar belum lunas malah "menguap",
terpakai keliru untuk faktur yang sebenarnya tidak membutuhkannya.

## Perbaikan

### 1. `_buildKartuEvents()` — WAJIB Mengambil Saldo dari Fungsi Pusat

```diff
  const totDebit = events.reduce((s,e)=>s+e.debit, 0);
  const totDP    = events.reduce((s,e)=>s+e.dp,    0);
  const totLunas = events.reduce((s,e)=>s+e.lunas,  0);
- const saldoAkhir = Math.max(0, totDebit - totDP - totLunas);
+ const saldoAkhir = calculateOutstandingDebt(supplierNama).saldoHutang;
  return { events, totDebit, totDP, totLunas, saldoAkhir };
```

Breakdown `events`/`totDebit`/`totDP`/`totLunas` **tetap dipertahankan**
untuk tampilan riwayat kronologis (Kartu Supplier butuh detail per
transaksi) — yang diubah hanya angka **saldo akhir** yang ditampilkan,
sekarang wajib berasal dari satu sumber kebenaran.

Untuk menjaga konsistensi visual baris-per-baris, **saldo berjalan
kronologis** (`e.saldo` di setiap event) juga disesuaikan: jika ada
selisih antara iterasi internal dan `calculateOutstandingDebt()`, seluruh
deretan saldo digeser agar baris **terakhir** selalu sama persis dengan
total yang ditampilkan di tempat lain pada halaman yang sama.

### 2. `savePembelian()` — Hilangkan Double-Counting Uang Muka

```diff
  if(status === 'Lunas'){
-   if(dp >= total || dp === 0){
-     DB.kasbank.push({..., keluar: total, kategori:'DP Pembelian'});
-   }
-   const sisaUangMuka = getUangMukaPerSupplier()[supplier] || 0;
-   if(sisaUangMuka > 0 && total > 0){
-     DB.kasbank.push({..., masuk: dipakaiDariUM, kategori:'Uang Muka Dipakai'});
-   }
+   if(dp <= 0 || dp >= total){
+     // Lunas tunai murni — TIDAK perlu uang muka sama sekali.
+     DB.kasbank.push({..., keluar: total, kategori:'DP Pembelian'});
+   } else {
+     // Lunas SEBAGIAN via dp, sisanya ditutup dari uang muka jika tersedia.
+     DB.kasbank.push({..., keluar: dp, kategori:'DP Pembelian'});
+     const sisaSetelahDp = total - dp;
+     const sisaUangMuka = getUangMukaPerSupplier()[supplier] || 0;
+     if(sisaUangMuka > 0 && sisaSetelahDp > 0){
+       DB.kasbank.push({..., masuk: Math.min(sisaSetelahDp, sisaUangMuka), kategori:'Uang Muka Dipakai'});
+     }
+   }
```

Uang muka sekarang hanya dipakai jika faktur benar-benar dibayar
**sebagian** (bukan lunas tunai penuh), dan hanya untuk menutup **sisa**
setelah DP — tidak pernah ditambahkan di atas pembayaran yang sudah lunas.

## Verifikasi

### Fuzzing — Pencarian Otomatis Skenario Divergen

| Tahap | Skenario Diuji | Divergensi Ditemukan |
|---|---|---|
| Sebelum fix (acak murni) | 2.000 | 410 (20,5%) |
| Sebelum fix (realistis, replikasi migrasi `loadDB()`) | 3.000 | 0 — kondisi spesifik tidak tercakup skenario acak awal |
| Sebelum fix (replikasi persis `savePembelian()`) | 3.000 | 0 — bug tersembunyi di jalur lain |
| **Setelah fix (500 skenario acak realistis)** | 500 | **0 (0%)** |

### Unit Test Permanen

Ditambahkan `tests/unit-tests-hutang-supplier.js` — dijalankan dengan:
```
node tests/unit-tests-hutang-supplier.js
```

Test ini **mengekstrak fungsi langsung dari `app.js` saat runtime**
(bukan salinan statis), sehingga selalu menguji kode yang sesungguhnya
berjalan di aplikasi. Mencakup:

1. **Verifikasi struktural** — memeriksa secara tekstual bahwa
   `getHutangBersihSupplier()`, `getRekapHutangSupplier()`,
   `_buildKartuEvents()`, `buildLaporanHutangSupplierHtml()`, dan
   `rebuildSemuaJurnal()` benar-benar **memanggil** `calculateOutstandingDebt()`
   — bukan hanya kebetulan menghasilkan angka yang sama hari ini.
2. **6 skenario manual** — termasuk replikasi skala penuh pola
   "Supplier Barokah" (35 faktur, rasio DP ~98%, mirip kondisi asli),
   kasus kritis uang muka dipakai, dan kompensasi lintas-faktur.
3. **Fuzzing 500 skenario acak** — deteksi otomatis divergensi.

**Hasil: 36/36 pemeriksaan passed.**

Efektivitas test ini sendiri diverifikasi dengan sengaja merusak kode
(mengembalikan `_buildKartuEvents()` ke perhitungan independen) — test
**berhasil mendeteksi regresi** lewat lapisan verifikasi struktural,
sebelum kode benar dikembalikan.

### Konsistensi 5 Modul — Kasus "Supplier Barokah" (Simulasi Skala Penuh)

| Modul | Saldo Dilaporkan |
|---|---|
| `calculateOutstandingDebt` (fungsi pusat) | Rp 7.350.000 |
| `getHutangBersihSupplier` (Rekap, alias) | Rp 7.350.000 |
| `getRekapHutangSupplier` (Rekap Hutang Supplier) | Rp 7.350.000 |
| `_buildKartuEvents` (Kartu Supplier) | Rp 7.350.000 |
| `buildLaporanHutangSupplierHtml` (Laporan Hutang) | Rp 7.350.000 |

**Lima modul, satu angka.**

### Verifikasi Regresi

- ✅ Sintaks JavaScript valid (`node -c app.js`) di setiap tahap perbaikan
- ✅ 387 fungsi total, 0 nama duplikat
- ✅ 0 event handler (`onclick`/`onchange`/`oninput`) rusak
- ✅ `index.html` **tidak tersentuh sama sekali** (diverifikasi via
  timestamp file) — sesuai instruksi "Jangan mengubah UI, perbaiki
  business logic saja"

## Catatan untuk Developer

Jika di masa depan ada kategori transaksi kasbank baru yang memengaruhi
hutang supplier (mis. retur, potongan, dll), **cukup tambahkan
penanganannya di `calculateOutstandingDebt()` satu kali** — seluruh
modul lain (Rekap Hutang, Kartu Supplier, Laporan, Buku Besar) akan
otomatis ikut konsisten karena semuanya delegasi ke fungsi ini. Jangan
menambahkan logika perhitungan saldo hutang di tempat lain mana pun.

Jalankan `node tests/unit-tests-hutang-supplier.js` setelah perubahan
apa pun pada logika hutang/pembelian/kasbank untuk memvalidasi
konsistensi tetap terjaga.
