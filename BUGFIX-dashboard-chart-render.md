# BUG FIX KRITIS — Cetak Dashboard Hanya Menampilkan Judul Section

## Laporan Bug (Revisi)

Perbaikan sebelumnya (penggantian `printReport()` generik dengan
`printDashboard()`/`buildDashboardPrintHtml()` khusus) **tidak menyelesaikan
masalah**. Hasil cetak tetap hanya menampilkan judul section, isi card tidak
ikut tercetak.

## Metodologi Investigasi Ulang

Audit sebelumnya murni membaca kode secara statis dan **salah menyimpulkan**
akar masalah ada di stylesheet (`REPORT_STYLES` menyembunyikan `.kpi`/`.grid`).
Itu memang masalah nyata dan sudah diperbaiki, tapi **bukan satu-satunya**, dan
ternyata bukan yang dilaporkan user di sini.

Kali ini investigasi dilakukan dengan **menjalankan aplikasi sungguhan** di
browser headless (Chromium via Playwright): login, navigasi ke Dashboard,
klik tombol "Cetak Dashboard" yang sebenarnya, lalu menangkap window baru
yang terbuka dan menginspeksi DOM serta nilai pixel canvas secara langsung —
bukan menebak dari pembacaan kode.

## Akar Masalah Sesungguhnya

`renderDashboard()` memanggil 7 fungsi render chart secara berurutan:

```js
renderChartKas();
renderChartProduk();
renderChartRendemen();        // ← BUG DI SINI
renderChartPvP();
renderChartProfitBatch();
renderChartRendemenBulan();
renderChartForecastGabah();
```

`renderChartRendemen()` mencari `document.getElementById('chartRendemen')` —
**sebuah ID yang tidak pernah ada di HTML manapun**. Canvas yang sungguhan
ada di template dashboard bernama `chartRendemenBulan` (dengan akhiran
"Bulan"), bukan `chartRendemen`.

Fungsi ini **tidak punya pengecekan** `if(!ctx) return;` sebelum memanggil
`new Chart(ctx, ...)`. Saat `ctx` bernilai `null`, Chart.js melempar:

```
Cannot read properties of null (reading 'canvas')
```

Karena ketujuh pemanggilan di atas bersifat **sinkron berurutan**, exception
yang dilempar oleh `renderChartRendemen()` (panggilan ke-3) **menghentikan
seluruh sisa pemanggilan setelahnya**. Akibatnya `renderChartPvP()`,
`renderChartProfitBatch()`, `renderChartRendemenBulan()`, dan
`renderChartForecastGabah()` **tidak pernah dieksekusi sama sekali** —
canvas-canvas itu kosong/putih sejak sebelum tombol cetak diklik, baik di
layar maupun saat dicetak.

Ini dibuktikan dengan inspeksi pixel langsung (`getImageData`): keempat
canvas tersebut menunjukkan 0 pixel berwarna sebelum print dipicu, sementara
2 canvas pertama (`chartKas`, `chartProduk` — yang berhasil dipanggil sebelum
exception terjadi) menunjukkan puluhan ribu pixel berwarna seperti
seharusnya.

## Mengapa Diagnosis Sebelumnya Tidak Lengkap

`printDashboard()` dan `buildDashboardPrintHtml()` **sebenarnya sudah benar**
sejak perbaikan sebelumnya — mekanisme `cloneNode(true)`, snapshot
`<canvas>` menjadi `<img>` via `toDataURL()`, dan pemuatan CSS aplikasi asli
semuanya terbukti bekerja sempurna untuk chart yang berhasil digambar (`img`
hasil clone punya ukuran byte yang identik dengan canvas sumbernya).

Masalahnya murni di hulu: sebagian besar canvas memang **tidak pernah berisi
gambar apa pun** akibat exception tersembunyi di `renderDashboard()`, jauh
sebelum proses cetak dimulai. Tidak ada jumlah perbaikan pada fungsi cetak
yang bisa menyelesaikan ini, karena fungsi cetak hanya menyalin apa yang
sudah ada di layar — dan yang ada di layar untuk 4 dari 6 grafik memang
kosong.

## Perbaikan

**Dua baris perubahan kode fungsional**, di `renderDashboard()`:

```diff
  renderChartKas();
  renderChartProduk();
- renderChartRendemen();
  renderChartPvP();
  renderChartProfitBatch();
  renderChartRendemenBulan();
  renderChartForecastGabah();
```

Pemanggilan yang rusak dihapus dari chain — bukan diganti dengan apa pun,
karena fungsi tersebut menargetkan canvas yang memang tidak ada di template
HTML manapun (tidak ada elemen yang perlu "diperbaiki targetnya"; fungsi ini
adalah sisa kode dari versi dashboard sebelumnya yang sudah diganti oleh
`renderChartRendemenBulan()`).

Sebagai pertahanan berlapis, guard pengaman juga ditambahkan di dalam
`renderChartRendemen()` itu sendiri:

```diff
  const ctx = document.getElementById('chartRendemen');
+ if(!ctx) return;
  const datasets = [];
```

Fungsi ini sekarang orphan (tidak dipanggil dari mana pun), tapi jika suatu
saat dipanggil kembali di masa depan, tidak akan lagi mematahkan chain
render lain.

## Verifikasi

Pengujian dilakukan dengan menjalankan aplikasi nyata di Chromium headless
(bukan simulasi/asumsi):

| Pemeriksaan | Sebelum Fix | Sesudah Fix |
|---|---|---|
| Page errors saat load dashboard | `Cannot read properties of null (reading 'canvas')` | 0 errors |
| Canvas dengan pixel terisi (dari 6 total) | 2 dari 6 | **6 dari 6** |
| Gambar di hasil cetak dengan ukuran sesuai canvas asli | 2 dari 6 | **6 dari 6** |
| Jumlah kartu `.kpi` (live vs cetak) | 20 vs 20 (sudah benar dari fix sebelumnya) | 20 vs 20 |
| Stabilitas setelah navigasi bolak-balik (re-render berulang) | Tidak diuji | 0 errors, semua canvas tetap terisi |

`index.html` tidak disentuh sama sekali (diverifikasi `diff`) — tidak ada
HTML dashboard baru, tidak ada array section baru, tidak ada fungsi render
dashboard khusus print baru. Mekanisme clone-DOM dan snapshot-canvas dari
perbaikan sebelumnya (`buildDashboardPrintHtml()`, `printDashboard()`)
dipertahankan sepenuhnya tanpa perubahan — keduanya memang sudah benar.

### Ringkasan delta kode

- 1 baris dihapus (pemanggilan fungsi rusak)
- 1 baris kode fungsional ditambahkan (guard `if(!ctx) return;`)
- Sisanya komentar penjelasan untuk pemeliharaan jangka panjang
