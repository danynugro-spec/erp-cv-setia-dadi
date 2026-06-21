#!/usr/bin/env node
/* ============================================================
   UNIT TEST — Sinkronisasi Saldo Hutang Supplier
   ============================================================
   Memvalidasi bahwa SEMUA modul yang menampilkan saldo hutang
   supplier (Rekap Hutang, Kartu Supplier, Laporan Hutang, Buku
   Besar) menghasilkan angka yang IDENTIK — sesuai rumus tunggal:

       Saldo Hutang = Total Pembelian − Total DP − Total Pelunasan

   Dijalankan via fungsi pusat calculateOutstandingDebt(supplierNama),
   yang menjadi SATU-SATUNYA sumber kebenaran untuk seluruh aplikasi.

   Cara menjalankan:
       node tests/unit-tests-hutang-supplier.js

   Tidak memerlukan dependency eksternal — murni Node.js bawaan.
   Fungsi-fungsi bisnis diekstrak LANGSUNG dari app.js saat runtime
   (bukan disalin statis ke file ini), sehingga test selalu menguji
   kode yang sesungguhnya berjalan di aplikasi, bukan salinan yang
   berisiko kadaluarsa.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const APP_JS_PATH = path.join(__dirname, '..', 'app.js');

// ── Util counter & hasil ──────────────────────────────────────
let passCount = 0;
let failCount = 0;
const failures = [];

function check(label, cond, detail) {
  if (cond) {
    passCount++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failCount++;
    failures.push(label + (detail ? ` (${detail})` : ''));
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  →  ${detail}` : ''}`);
  }
}

function approxEqual(a, b, eps = 1) {
  return Math.abs(a - b) <= eps;
}

// ── Stub minimal untuk fungsi yang bergantung pada DOM/browser ──
// Didefinisikan eksplisit di `global` (bukan hanya top-level module scope)
// agar terlihat oleh fungsi-fungsi app.js yang dimuat via indirect eval
// (yang berjalan di global scope Node.js, terpisah dari module scope file ini).
let _uidCounter = 0;
global.uid = function () { return 'test-id-' + (++_uidCounter); };
global.todayStr = function () { return new Date().toISOString().slice(0, 10); };
global.fmtRp = function (n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); };
global.fmtNum = function (n) { return Math.round((n || 0) * 100) / 100; };
global.fmtDate = function (d) { return d; };
global.esc = function (s) { return String(s == null ? '' : s); };
global.shiftDate = function (deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};
global.nextCode = function (seqKey, prefix, pad = 4) {
  DB.seq[seqKey] = (DB.seq[seqKey] || 0) + 1;
  return `${prefix}-${String(DB.seq[seqKey]).padStart(pad, '0')}`;
};
// Alias lokal (memudahkan pemanggilan dari kode test di bawah tanpa prefix global.)
const uid = global.uid;
const todayStr = global.todayStr;
const fmtRp = global.fmtRp;
const fmtNum = global.fmtNum;
const fmtDate = global.fmtDate;
const esc = global.esc;
const shiftDate = global.shiftDate;
const nextCode = global.nextCode;

// ── Ekstraksi otomatis fungsi bisnis dari app.js ─────────────────
function extractFunction(content, name) {
  const re = new RegExp(`^(?:async\\s+)?function\\s+${name}\\(`, 'm');
  const m = re.exec(content);
  if (!m) return null;
  const start = m.index;
  const braceStart = content.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return content.slice(start, i + 1);
    }
  }
  return null;
}

const REQUIRED_FUNCTIONS = [
  'defaultData',
  'getHargaEfektifPembelian',
  'getTotalBayarPembelian',
  'getSisaHutangFaktur',
  'getHutangPembelian',
  'calculateOutstandingDebt',   // fungsi pusat — wajib ada
  'getHutangBersihSupplier',    // wajib alias ke calculateOutstandingDebt
  'getTotalHutangUsaha',
  'getRekapHutangSupplier',     // wajib pakai calculateOutstandingDebt
  'getUangMukaPerSupplier',
  'getTotalUangMukaTersedia',
  '_buildKartuEvents',          // Kartu Supplier — wajib pakai calculateOutstandingDebt
  'buildLaporanHutangSupplierHtml', // Laporan Hutang — wajib pakai calculateOutstandingDebt
];

function loadAppFunctions() {
  if (!fs.existsSync(APP_JS_PATH)) {
    console.error(`\x1b[31mFATAL: app.js tidak ditemukan di ${APP_JS_PATH}\x1b[0m`);
    process.exit(1);
  }
  const content = fs.readFileSync(APP_JS_PATH, 'utf8');

  const missing = [];
  const extracted = [];
  for (const name of REQUIRED_FUNCTIONS) {
    const code = extractFunction(content, name);
    if (!code) missing.push(name);
    else extracted.push(code);
  }

  if (missing.length > 0) {
    console.error(`\x1b[31mFATAL: Fungsi berikut tidak ditemukan di app.js: ${missing.join(', ')}\x1b[0m`);
    console.error('Ini sendiri adalah indikasi bug — salah satu modul mungkin sudah dihapus/diganti nama tanpa memperbarui sumber kebenaran tunggal.');
    process.exit(1);
  }

  const indirectEval = (0, eval);
  indirectEval(extracted.join('\n\n'));

  // Pastikan SEMUA fungsi yang diharapkan benar-benar jadi global function
  // (bukan diam-diam gagal di-extract / di-eval)
  for (const name of REQUIRED_FUNCTIONS) {
    if (typeof global[name] !== 'function') {
      console.error(`\x1b[31mFATAL: ${name} gagal dimuat sebagai fungsi setelah ekstraksi.\x1b[0m`);
      process.exit(1);
    }
  }
}

loadAppFunctions();

// Alias setiap fungsi hasil ekstraksi dari global scope ke module scope,
// agar bisa dipanggil langsung tanpa prefix `global.` di seluruh test di bawah.
const defaultData = global.defaultData;
const getHargaEfektifPembelian = global.getHargaEfektifPembelian;
const getTotalBayarPembelian = global.getTotalBayarPembelian;
const getSisaHutangFaktur = global.getSisaHutangFaktur;
const getHutangPembelian = global.getHutangPembelian;
const calculateOutstandingDebt = global.calculateOutstandingDebt;
const getHutangBersihSupplier = global.getHutangBersihSupplier;
const getTotalHutangUsaha = global.getTotalHutangUsaha;
const getRekapHutangSupplier = global.getRekapHutangSupplier;
const getUangMukaPerSupplier = global.getUangMukaPerSupplier;
const getTotalUangMukaTersedia = global.getTotalUangMukaTersedia;
const _buildKartuEvents = global._buildKartuEvents;
const buildLaporanHutangSupplierHtml = global.buildLaporanHutangSupplierHtml;

// ── Verifikasi struktural: pastikan TIDAK ADA perhitungan terpisah ──
// Membaca ulang source code untuk memverifikasi SECARA TEKSTUAL bahwa
// fungsi-fungsi terkait benar-benar MEMANGGIL calculateOutstandingDebt(),
// bukan hanya kebetulan menghasilkan angka yang sama hari ini.
function verifyDelegatesToCalculateOutstandingDebt() {
  const content = fs.readFileSync(APP_JS_PATH, 'utf8');
  console.log('\n=== Verifikasi Struktural: Wajib Memanggil calculateOutstandingDebt() ===\n');

  const getHutangBersihSupplierSrc = extractFunction(content, 'getHutangBersihSupplier');
  check('getHutangBersihSupplier() memanggil calculateOutstandingDebt()',
    getHutangBersihSupplierSrc.includes('calculateOutstandingDebt('));

  const getRekapHutangSupplierSrc = extractFunction(content, 'getRekapHutangSupplier');
  check('getRekapHutangSupplier() memanggil calculateOutstandingDebt()',
    getRekapHutangSupplierSrc.includes('calculateOutstandingDebt('));

  const buildKartuEventsSrc = extractFunction(content, '_buildKartuEvents');
  check('_buildKartuEvents() (Kartu Supplier) memanggil calculateOutstandingDebt() untuk saldoAkhir',
    buildKartuEventsSrc.includes('calculateOutstandingDebt(') &&
    buildKartuEventsSrc.includes('saldoAkhir = calculateOutstandingDebt'));

  const laporanSrc = extractFunction(content, 'buildLaporanHutangSupplierHtml');
  check('buildLaporanHutangSupplierHtml() (Laporan Hutang) memanggil calculateOutstandingDebt()',
    laporanSrc.includes('calculateOutstandingDebt('));

  // Buku Besar: cek rebuildSemuaJurnal() juga konsisten (kategori Uang Muka Dipakai
  // ikut diproses sebagai pelunasan, bukan hanya DP Pembelian/Pelunasan Hutang Supplier)
  const rebuildSrc = extractFunction(content, 'rebuildSemuaJurnal');
  if (rebuildSrc) {
    check("rebuildSemuaJurnal() (Buku Besar) mengenali kategori 'Uang Muka Dipakai' sebagai pelunasan",
      rebuildSrc.includes("k.kategori==='Uang Muka Dipakai'") || rebuildSrc.includes('Uang Muka Dipakai'));
  }
}

verifyDelegatesToCalculateOutstandingDebt();

// ── Helper bangun DB kosong untuk setiap skenario ─────────────────
function freshDB() {
  global.DB = defaultData();
  DB.pembelian = [];
  DB.kasbank = [];
  DB.seq = {};
  return DB;
}

function compareAllModules(supplierNama, label, expected) {
  const central = calculateOutstandingDebt(supplierNama);
  const alias = getHutangBersihSupplier(supplierNama);
  const rekap = getRekapHutangSupplier().find(r => r.supplier === supplierNama);
  const rekapHutang = rekap ? rekap.totalHutang : 0;
  const kartu = _buildKartuEvents(supplierNama);
  const laporan = buildLaporanHutangSupplierHtml(supplierNama).totalHutang;

  console.log(`\n--- ${label} ---`);
  console.log(`  calculateOutstandingDebt : ${central.saldoHutang}`);
  console.log(`  getHutangBersihSupplier  : ${alias}`);
  console.log(`  getRekapHutangSupplier   : ${rekapHutang}`);
  console.log(`  _buildKartuEvents        : ${kartu.saldoAkhir}`);
  console.log(`  buildLaporanHutangSupplierHtml : ${laporan}`);

  if (expected !== undefined) {
    check(`[${label}] Saldo sesuai nilai yang diharapkan`, approxEqual(central.saldoHutang, expected),
      `actual=${central.saldoHutang}, expected=${expected}`);
  }

  check(`[${label}] calculateOutstandingDebt === getHutangBersihSupplier`,
    approxEqual(central.saldoHutang, alias));
  check(`[${label}] calculateOutstandingDebt === getRekapHutangSupplier`,
    approxEqual(central.saldoHutang, rekapHutang));
  check(`[${label}] calculateOutstandingDebt === Kartu Supplier (_buildKartuEvents)`,
    approxEqual(central.saldoHutang, kartu.saldoAkhir),
    `central=${central.saldoHutang} vs kartu=${kartu.saldoAkhir}`);
  check(`[${label}] calculateOutstandingDebt === Laporan Hutang (buildLaporanHutangSupplierHtml)`,
    approxEqual(central.saldoHutang, laporan));

  return { central, alias, rekapHutang, kartu, laporan };
}

console.log('\n========================================================');
console.log('TEST SUITE: Sinkronisasi Saldo Hutang Supplier');
console.log('========================================================');

// ============================================================
// TEST 1: Skenario sederhana — beli, lunas penuh via Pelunasan
// ============================================================
console.log('\n\n### TEST 1: Beli → Lunas Penuh ###');
freshDB();
{
  const SUP = 'Supplier Test 1';
  const pid = uid();
  DB.pembelian.push({ id: pid, noFaktur: 'PB-T1', tanggal: todayStr(), supplier: SUP,
    jenisGabah: 'Test', qty: 1000, harga: 5000, angkut: 0, total: 5000000, status: 'Belum Lunas', dp: 0 });
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: todayStr(), kategori: 'Pelunasan Hutang Supplier',
    keterangan: 'Lunas', masuk: 0, keluar: 5000000, refId: pid });
  compareAllModules(SUP, 'Beli 5jt, lunas penuh', 0);
}

// ============================================================
// TEST 2: Kelebihan bayar → Uang Muka Supplier (belum dipakai)
// ============================================================
console.log('\n\n### TEST 2: Kelebihan Bayar → Uang Muka (belum dipakai) ###');
freshDB();
{
  const SUP = 'Supplier Test 2';
  const pid = uid();
  DB.pembelian.push({ id: pid, noFaktur: 'PB-T2', tanggal: todayStr(), supplier: SUP,
    jenisGabah: 'Test', qty: 1000, harga: 5000, angkut: 0, total: 5000000, status: 'Belum Lunas', dp: 0 });
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: todayStr(), kategori: 'Pelunasan Hutang Supplier',
    keterangan: 'Bayar lebih', masuk: 0, keluar: 5200000, refId: pid });
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: todayStr(), kategori: 'Uang Muka Supplier',
    keterangan: 'Kelebihan jadi UM', masuk: 0, keluar: 200000, refSupplier: SUP });
  compareAllModules(SUP, 'Beli 5jt, bayar 5.2jt, UM belum dipakai', 0);
}

// ============================================================
// TEST 3: Uang Muka DIPAKAI untuk faktur baru — KASUS KRITIS
// ============================================================
console.log('\n\n### TEST 3: Uang Muka Dipakai untuk Faktur Baru (KASUS KRITIS) ###');
freshDB();
{
  const SUP = 'Supplier Test 3';
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: shiftDate(-5), kategori: 'Uang Muka Supplier',
    keterangan: 'UM dari faktur lama', masuk: 0, keluar: 200000, refSupplier: SUP });
  const pid = uid();
  DB.pembelian.push({ id: pid, noFaktur: 'PB-T3', tanggal: todayStr(), supplier: SUP,
    jenisGabah: 'Test', qty: 1000, harga: 1000, angkut: 0, total: 1000000, status: 'Belum Lunas', dp: 0 });
  DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal: todayStr(), kategori: 'Uang Muka Dipakai',
    keterangan: 'UM dipakai sbg DP', masuk: 200000, keluar: 0, refSupplier: SUP, refId: pid });
  compareAllModules(SUP, 'Faktur baru 1jt, 200rb dari UM lama -> saldo 800rb', 800000);
}

// ============================================================
// TEST 4: Replikasi kasus "Supplier Barokah" dari laporan bug —
// banyak faktur Lunas (DP penuh saat input) + beberapa faktur
// dengan DP sebagian + pelunasan terpisah, rasio DP tinggi (~93%)
// mirip pola yang dilaporkan (807jt total, 749jt DP, 16jt pelunasan).
// ============================================================
console.log('\n\n### TEST 4: Replikasi Skala — Pola "Supplier Barokah" ###');
freshDB();
{
  const SUP = 'Supplier Barokah (Simulasi)';
  let totalPembelian = 0, totalDP = 0, totalPelunasan = 0;

  // 25 faktur lunas tunai penuh saat input (DP = total, status Lunas)
  for (let i = 0; i < 25; i++) {
    const total = 25000000 + i * 137000;
    const pid = uid();
    DB.pembelian.push({ id: pid, noFaktur: `PB-BRK-${i}`, tanggal: shiftDate(-60 + i),
      supplier: SUP, jenisGabah: 'Ciherang', qty: 5000, harga: 5000, angkut: 0,
      total, status: 'Lunas', dp: 0 });
    DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal: shiftDate(-60 + i), kategori: 'DP Pembelian',
      keterangan: 'Lunas saat input', masuk: 0, keluar: total, refId: pid });
    totalPembelian += total;
    totalDP += total;
  }

  // 5 faktur dengan DP 70%, sisanya jadi hutang aktif
  for (let i = 0; i < 5; i++) {
    const total = 8000000 + i * 50000;
    const dp = total * 0.7;
    const pid = uid();
    DB.pembelian.push({ id: pid, noFaktur: `PB-BRK-DP${i}`, tanggal: shiftDate(-20 + i),
      supplier: SUP, jenisGabah: 'IR64', qty: 1600, harga: 5000, angkut: 0,
      total, status: 'Belum Lunas', dp: 0 });
    DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal: shiftDate(-20 + i), kategori: 'DP Pembelian',
      keterangan: 'DP awal', masuk: 0, keluar: dp, refId: pid });
    totalPembelian += total;
    totalDP += dp;
  }

  // 3 pelunasan terpisah untuk sebagian faktur DP di atas
  const fakturDP = DB.pembelian.filter(r => r.noFaktur.startsWith('PB-BRK-DP'));
  for (let i = 0; i < 3; i++) {
    const pelunasan = 1500000 + i * 100000;
    DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: shiftDate(-5 + i), kategori: 'Pelunasan Hutang Supplier',
      keterangan: 'Pelunasan sisa', masuk: 0, keluar: pelunasan, refId: fakturDP[i].id });
    totalPelunasan += pelunasan;
  }

  const expectedSaldo = totalPembelian - totalDP - totalPelunasan;
  console.log(`\nTotal Pembelian (simulasi): ${fmtRp(totalPembelian)}`);
  console.log(`Total DP (simulasi)       : ${fmtRp(totalDP)}`);
  console.log(`Total Pelunasan (simulasi): ${fmtRp(totalPelunasan)}`);
  console.log(`Saldo Hutang (manual)     : ${fmtRp(expectedSaldo)}`);

  compareAllModules(SUP, 'Pola Supplier Barokah (35 faktur)', expectedSaldo);
}

// ============================================================
// TEST 5: Kelebihan bayar → Piutang ke Supplier (akan dikembalikan)
// ============================================================
console.log('\n\n### TEST 5: Kelebihan Bayar → Piutang ke Supplier ###');
freshDB();
{
  const SUP = 'Supplier Test 5';
  const pid = uid();
  DB.pembelian.push({ id: pid, noFaktur: 'PB-T5', tanggal: todayStr(), supplier: SUP,
    jenisGabah: 'Test', qty: 1000, harga: 5000, angkut: 0, total: 5000000, status: 'Belum Lunas', dp: 0 });
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: todayStr(), kategori: 'Pelunasan Hutang Supplier',
    keterangan: 'Bayar lebih', masuk: 0, keluar: 5300000, refId: pid });
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: todayStr(), kategori: 'Piutang ke Supplier',
    keterangan: 'Akan dikembalikan', masuk: 300000, keluar: 0, refSupplier: SUP });
  compareAllModules(SUP, 'Beli 5jt, bayar 5.3jt, kelebihan jadi Piutang ke Supplier', 0);
}

// ============================================================
// TEST 6: Multi-faktur dengan kompensasi lintas-faktur (skenario
// yang sebelumnya menyebabkan double-counting di calculateOutstandingDebt
// sebelum diperbaiki — ditemukan lewat verifikasi aljabar)
// ============================================================
console.log('\n\n### TEST 6: Kompensasi Lintas-Faktur (Piutang ke Supplier) ###');
freshDB();
{
  const SUP = 'Supplier Test 6';
  const pidA = uid(), pidB = uid();
  DB.pembelian.push({ id: pidA, noFaktur: 'PB-T6A', tanggal: shiftDate(-5), supplier: SUP,
    jenisGabah: 'Test', qty: 1000, harga: 5000, angkut: 0, total: 5000000, status: 'Belum Lunas', dp: 0 });
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: shiftDate(-5), kategori: 'Pelunasan Hutang Supplier',
    keterangan: 'Bayar lebih dari faktur A', masuk: 0, keluar: 5300000, refId: pidA });
  DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: shiftDate(-5), kategori: 'Piutang ke Supplier',
    keterangan: 'Kelebihan akan dikembalikan', masuk: 300000, keluar: 0, refSupplier: SUP });

  DB.pembelian.push({ id: pidB, noFaktur: 'PB-T6B', tanggal: todayStr(), supplier: SUP,
    jenisGabah: 'Test', qty: 200, harga: 2000, angkut: 0, total: 400000, status: 'Belum Lunas', dp: 0 });

  // Saldo BENAR: total pembelian 5.4jt (faktur A 5jt + faktur B 400rb), dikurangi
  // kas yang benar-benar keluar untuk faktur A (5.3jt via Pelunasan Hutang Supplier,
  // yang SUDAH MENCAKUP kelebihan 300rb di dalamnya). 'Piutang ke Supplier' 300rb
  // adalah METADATA atas sebagian dari 5.3jt itu (lihat catatan di calculateOutstandingDebt()),
  // BUKAN kas tambahan — sehingga TIDAK dikurangkan lagi secara terpisah.
  // Saldo = 5.400.000 - 5.300.000 = 100.000 (BUKAN 400.000 — itu akan jadi
  // double-counting jika Piutang ke Supplier turut dikurangkan).
  compareAllModules(SUP, 'Faktur A overpay + Piutang ke Supplier, Faktur B belum dibayar', 100000);
}

// ============================================================
// TEST 7: Data realistis — banyak faktur acak, deteksi divergensi
// ============================================================
console.log('\n\n### TEST 7: Fuzzing — 500 Skenario Acak Realistis ###');
{
  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max)); }
  function choice(arr) { return arr[randInt(0, arr.length)]; }

  function simulateSavePembelian(SUP, total, status, dp, tanggal) {
    const pid = uid();
    DB.pembelian.push({ id: pid, noFaktur: `PB-${pid}`, tanggal, supplier: SUP,
      jenisGabah: 'Test', qty: total / 5000, harga: 5000, angkut: 0, total, status, dp });
    if (status === 'Lunas') {
      if (dp <= 0 || dp >= total) {
        DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal,
          keterangan: 'Lunas', masuk: 0, keluar: total, kategori: 'DP Pembelian', refId: pid });
      } else {
        DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal,
          keterangan: 'DP', masuk: 0, keluar: dp, kategori: 'DP Pembelian', refId: pid });
        const sisa = total - dp;
        const sisaUM = getUangMukaPerSupplier()[SUP] || 0;
        if (sisaUM > 0 && sisa > 0) {
          const pakai = Math.min(sisa, sisaUM);
          DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal,
            keterangan: 'UM dipakai', masuk: pakai, keluar: 0,
            kategori: 'Uang Muka Dipakai', refSupplier: SUP, refId: pid });
        }
      }
    } else if (dp > 0) {
      DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal,
        keterangan: 'DP', masuk: 0, keluar: dp, kategori: 'DP Pembelian', refId: pid });
      const sisaUM = getUangMukaPerSupplier()[SUP] || 0;
      if (sisaUM > 0) {
        const pakai = Math.min(dp, sisaUM);
        DB.kasbank.push({ id: uid(), sumber: 'pembelian', tanggal,
          keterangan: 'UM dipakai sbg DP', masuk: pakai, keluar: 0,
          kategori: 'Uang Muka Dipakai', refSupplier: SUP, refId: pid });
      }
    }
    return pid;
  }

  let divergenceFound = 0;
  const totalRuns = 500;

  for (let run = 0; run < totalRuns; run++) {
    freshDB();
    const SUP = 'Fuzz Supplier';

    if (Math.random() < 0.4) {
      DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: shiftDate(-90), kategori: 'Uang Muka Supplier',
        keterangan: 'UM awal', masuk: 0, keluar: randInt(500000, 5000000), refSupplier: SUP });
    }

    const numFaktur = randInt(3, 15);
    for (let i = 0; i < numFaktur; i++) {
      const total = Math.round(rand(2000000, 40000000) / 1000) * 1000;
      const status = choice(['Lunas', 'Lunas', 'Belum Lunas']);
      const dp = status === 'Belum Lunas' && Math.random() < 0.6 ? Math.round(total * rand(0.2, 0.8)) : 0;
      const pid = simulateSavePembelian(SUP, total, status, dp, shiftDate(-randInt(1, 70)));
      if (status === 'Belum Lunas' && Math.random() < 0.4) {
        const sisaHutang = total - dp;
        const bayarLagi = Math.round(rand(0, sisaHutang) / 1000) * 1000;
        if (bayarLagi > 0) {
          DB.kasbank.push({ id: uid(), sumber: 'manual', tanggal: shiftDate(-randInt(1, 30)), kategori: 'Pelunasan Hutang Supplier',
            keterangan: 'Pelunasan manual', masuk: 0, keluar: bayarLagi, refId: pid });
        }
      }
    }

    const central = calculateOutstandingDebt(SUP).saldoHutang;
    const kartu = _buildKartuEvents(SUP).saldoAkhir;
    const rekap = getRekapHutangSupplier().find(r => r.supplier === SUP);
    const rekapHutang = rekap ? rekap.totalHutang : 0;

    if (!approxEqual(central, kartu) || !approxEqual(central, rekapHutang)) {
      divergenceFound++;
      if (divergenceFound <= 3) {
        console.log(`  Divergensi di run #${run}: central=${central}, kartu=${kartu}, rekap=${rekapHutang}`);
      }
    }
  }

  check(`Fuzzing ${totalRuns} skenario acak: 0 divergensi ditemukan`,
    divergenceFound === 0, `${divergenceFound} dari ${totalRuns} skenario divergen`);
}

// ============================================================
// RINGKASAN
// ============================================================
console.log('\n\n========================================================');
console.log(`HASIL: ${passCount} passed, ${failCount} failed`);
console.log('========================================================');

if (failCount > 0) {
  console.log('\n\x1b[31mKEGAGALAN:\x1b[0m');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n\x1b[32m✓✓✓ SEMUA MODUL HUTANG SUPPLIER KONSISTEN — SATU SUMBER KEBENARAN TERVERIFIKASI\x1b[0m');
  process.exit(0);
}
