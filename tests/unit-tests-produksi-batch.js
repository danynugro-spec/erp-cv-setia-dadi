#!/usr/bin/env node
/* ============================================================
   UNIT TEST — ProductionCalculationService
   ============================================================
   Sprint QA Produksi Batch Enterprise — memvalidasi SATU sumber
   kebenaran untuk seluruh kalkulasi produksi: FIFO sumber gabah,
   auto-fill qty, auto-hitung gabah masuk giling, ringkasan
   realtime, validasi qty, indikator warna, dan HPP realtime
   (delegasi ke getHppBatch(), bukan rumus terpisah).

   Cara menjalankan:
       node tests/unit-tests-produksi-batch.js

   Tidak memerlukan dependency eksternal — murni Node.js bawaan.
   ProductionCalculationService dan dependensinya diekstrak
   LANGSUNG dari app.js saat runtime (bukan salinan statis),
   sehingga test selalu menguji kode yang sesungguhnya berjalan
   di aplikasi.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const APP_JS_PATH = path.join(__dirname, '..', 'app.js');

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
function approxEqual(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }

// ── Stub helper, eksplisit di global (lihat catatan di unit-tests-hutang-supplier.js) ──
let _uidCounter = 0;
global.uid = function () { return 'test-id-' + (++_uidCounter); };
global.todayStr = function () { return new Date().toISOString().slice(0, 10); };
global.shiftDate = function (d) { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
global.fmtNum = function (n) { return Math.round((n || 0) * 100) / 100; };
global.fmtRp = function (n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); };
global.fmtDate = function (d) { return d; };
global.esc = function (s) { return String(s == null ? '' : s); };
global.nextCode = function (seqKey, prefix, pad = 4) {
  DB.seq[seqKey] = (DB.seq[seqKey] || 0) + 1;
  return `${prefix}-${String(DB.seq[seqKey]).padStart(pad, '0')}`;
};
const uid = global.uid, todayStr = global.todayStr, shiftDate = global.shiftDate, fmtNum = global.fmtNum;

function extractFunction(content, name) {
  const re = new RegExp(`^(?:async\\s+)?function\\s+${name}\\(`, 'm');
  const m = re.exec(content);
  if (!m) return null;
  const start = m.index;
  const braceStart = content.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') { depth--; if (depth === 0) return content.slice(start, i + 1); }
  }
  return null;
}
function extractConstObject(content, name) {
  const re = new RegExp(`^const\\s+${name}\\s*=\\s*\\{`, 'm');
  const m = re.exec(content);
  if (!m) return null;
  const start = m.index;
  const braceStart = content.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') { depth--; if (depth === 0) return content.slice(start, i + 1); }
  }
  return null;
}

const REQUIRED_FUNCTIONS = [
  'defaultData', 'getHargaEfektifPembelian', 'getQtyTerpakaiPembelian',
  'getSisaPembelian', 'getHppBatch',
];
const REQUIRED_OBJECTS = ['ProductionCalculationService'];

function loadAppCode() {
  if (!fs.existsSync(APP_JS_PATH)) {
    console.error(`\x1b[31mFATAL: app.js tidak ditemukan di ${APP_JS_PATH}\x1b[0m`);
    process.exit(1);
  }
  const content = fs.readFileSync(APP_JS_PATH, 'utf8');

  const pieces = [];
  const missing = [];
  for (const name of REQUIRED_FUNCTIONS) {
    const code = extractFunction(content, name);
    if (!code) missing.push(name); else pieces.push(code);
  }
  for (const name of REQUIRED_OBJECTS) {
    const code = extractConstObject(content, name);
    if (!code) missing.push(name); else pieces.push(code);
  }
  if (missing.length > 0) {
    console.error(`\x1b[31mFATAL: Tidak ditemukan di app.js: ${missing.join(', ')}\x1b[0m`);
    console.error('Ini sendiri adalah indikasi bug — ProductionCalculationService atau fungsi pendukungnya mungkin sudah dihapus/diganti nama.');
    process.exit(1);
  }

  // Tambahkan exposer agar object const bisa diakses dari module scope test ini
  // (const declarations hasil eval menjadi lexical binding di top-level scope
  // hasil eval, BUKAN property global.X seperti function declarations).
  pieces.push('global.__PCS__ = ProductionCalculationService;');
  pieces.push('global.__getHppBatch__ = getHppBatch;');

  const indirectEval = (0, eval);
  indirectEval(pieces.join('\n\n'));
}

loadAppCode();
const getHppBatch = global.__getHppBatch__;
const ProductionCalculationService = global.__PCS__;

// ── Verifikasi struktural: pastikan tidak ada rumus tersebar (Requirement #12) ──
function verifyNoScatteredFormulas() {
  console.log('\n=== Verifikasi Struktural: Tidak Ada Rumus Tersebar (Requirement #12) ===\n');
  const content = fs.readFileSync(APP_JS_PATH, 'utf8');

  const updateHppPreviewSrc = extractFunction(content, 'updateHppPreview');
  check('updateHppPreview() (form produksi) mendelegasikan HPP ke ProductionCalculationService',
    updateHppPreviewSrc && updateHppPreviewSrc.includes('ProductionCalculationService.computeHppPreview'));

  const showDetailSrc = extractFunction(content, 'showDetailBatchProduksi');
  check('showDetailBatchProduksi() (riwayat) mendelegasikan HPP ke ProductionCalculationService',
    showDetailSrc && showDetailSrc.includes('ProductionCalculationService.computeHppPreview'));

  const konfirmasiSrc = extractFunction(content, 'konfirmasiSimpanProduksi');
  check('konfirmasiSimpanProduksi() mendelegasikan validasi ke ProductionCalculationService',
    konfirmasiSrc && konfirmasiSrc.includes('ProductionCalculationService.validateBeforeSave'));

  const computeHppPreviewSrc = ProductionCalculationService.computeHppPreview.toString();
  check('computeHppPreview() di service murni delegasi ke getHppBatch() (bukan rumus baru)',
    computeHppPreviewSrc.includes('getHppBatch'));
}
verifyNoScatteredFormulas();

function freshDB() {
  global.DB = defaultData();
  DB.pembelian = [];
  DB.produksi = [];
  DB.jenisGabah = ['Ciherang', 'IR64'];
  DB.seq = {};
  return DB;
}

console.log('\n========================================================');
console.log('TEST SUITE: ProductionCalculationService');
console.log('========================================================');

// ============================================================
// TEST 1 — Requirement #1: FIFO
// ============================================================
console.log('\n### TEST 1: Auto Complete Sumber Gabah (FIFO) ###');
{
  const DB = freshDB();
  DB.pembelian.push({ id: 'p1', noFaktur: 'PB-001', tanggal: shiftDate(-10), supplier: 'Supplier A',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 1000, harga: 5000, angkut: 0 });
  DB.pembelian.push({ id: 'p2', noFaktur: 'PB-002', tanggal: shiftDate(-5), supplier: 'Supplier B',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 500, harga: 5200, angkut: 0 });
  DB.pembelian.push({ id: 'p3', noFaktur: 'PB-003', tanggal: shiftDate(-1), supplier: 'Supplier A',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 2000, harga: 5100, angkut: 0 });
  DB.pembelian.push({ id: 'p4', noFaktur: 'PB-004', tanggal: shiftDate(-3), supplier: 'Supplier C',
    jenisGabah: 'IR64', kategori: 'Gabah', qty: 800, harga: 4800, angkut: 0 });

  const sources = ProductionCalculationService.getAvailableSourcesFIFO('Ciherang', null);
  check('Jumlah sumber Ciherang = 3 (jenis lain tidak ikut)', sources.length === 3);
  check('Urutan FIFO: tanggal tertua dulu (p1, p2, p3)',
    sources[0].pembelianId === 'p1' && sources[1].pembelianId === 'p2' && sources[2].pembelianId === 'p3');

  const autoRows = ProductionCalculationService.buildAutoSumberGabah('Ciherang', null);
  check('buildAutoSumberGabah: 3 baris otomatis, qty = sisa penuh',
    autoRows.length === 3 && approxEqual(autoRows[0].qty, 1000) && approxEqual(autoRows[1].qty, 500));
}

// ============================================================
// TEST 2 — Requirement #4: Tombol Cepat
// ============================================================
console.log('\n### TEST 2: Tombol Cepat (FIFO / Semua Stok / Reset) ###');
{
  const DB = freshDB();
  DB.pembelian.push({ id: 'p1', noFaktur: 'PB-001', tanggal: shiftDate(-10), supplier: 'A',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 800, harga: 5000, angkut: 0 });
  DB.pembelian.push({ id: 'p2', noFaktur: 'PB-002', tanggal: shiftDate(-3), supplier: 'B',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 1500, harga: 5200, angkut: 0 });

  const alloc = ProductionCalculationService.autoAllocateFIFO('Ciherang', 1000, null);
  check('Isi Otomatis FIFO: target 1000 -> 800(p1)+200(p2), tercukupi',
    alloc.tercukupi && approxEqual(alloc.sumberGabah[0].qty, 800) && approxEqual(alloc.sumberGabah[1].qty, 200));

  const allocKurang = ProductionCalculationService.autoAllocateFIFO('Ciherang', 5000, null);
  check('Isi Otomatis FIFO: target melebihi stok -> tidak tercukupi, kurang dihitung benar',
    !allocKurang.tercukupi && approxEqual(allocKurang.kurang, 5000 - 2300));

  const allUsed = ProductionCalculationService.useAllStock(
    [{ pembelianId: 'p1', qty: 100 }, { pembelianId: 'p2', qty: 100 }], 'Ciherang', null);
  check('Gunakan Semua Stok: qty jadi sisa penuh masing-masing',
    approxEqual(allUsed[0].qty, 800) && approxEqual(allUsed[1].qty, 1500));

  const reset = ProductionCalculationService.resetQty(allUsed);
  check('Reset Qty: baris tetap ada, qty jadi 0',
    reset.length === 2 && reset.every(r => r.qty === 0) && reset[0].pembelianId === 'p1');
}

// ============================================================
// TEST 3 — Requirement #6 & #7: Validasi & Indikator Warna
// ============================================================
console.log('\n### TEST 3: Validasi Qty & Indikator Warna ###');
{
  const DB = freshDB();
  DB.pembelian.push({ id: 'p1', noFaktur: 'PB-001', tanggal: shiftDate(-1), supplier: 'A',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 1000, harga: 5000, angkut: 0 });

  const valOver = ProductionCalculationService.validateRows([{ pembelianId: 'p1', qty: 1500 }], 'Ciherang', null);
  check('Validasi: qty melebihi stok -> error', valOver[0].level === 'error' && valOver[0].message.includes('melebihi'));

  const valNeg = ProductionCalculationService.validateRows([{ pembelianId: 'p1', qty: -10 }], 'Ciherang', null);
  check('Validasi: qty negatif -> error', valNeg[0].level === 'error' && valNeg[0].message.includes('negatif'));

  const valEmpty = ProductionCalculationService.validateRows([{ pembelianId: 'p1', qty: '' }], 'Ciherang', null);
  check('Validasi: qty kosong -> error', valEmpty[0].level === 'error' && valEmpty[0].message.includes('kosong'));

  const valOk = ProductionCalculationService.validateRows([{ pembelianId: 'p1', qty: 500 }], 'Ciherang', null);
  check('Validasi: qty wajar -> ok', valOk[0].level === 'ok');

  check('Indikator: qty 500/1000 (50% terpakai) -> hijau',
    ProductionCalculationService.getIndicatorColor(500, 1000) === 'green');
  check('Indikator: qty 950/1000 (sisa <10%) -> kuning',
    ProductionCalculationService.getIndicatorColor(950, 1000) === 'yellow');
  check('Indikator: qty 1200/1000 (melebihi) -> merah',
    ProductionCalculationService.getIndicatorColor(1200, 1000) === 'red');
  check('Indikator: boundary tepat 10% sisa -> hijau (bukan kuning)',
    ProductionCalculationService.getIndicatorColor(900, 1000) === 'green');
}

// ============================================================
// TEST 4 — Requirement #3 & #5: Auto Gabah Masuk & Ringkasan
// ============================================================
console.log('\n### TEST 4: Auto Hitung Gabah Masuk & Ringkasan Realtime ###');
{
  const rows = [{ pembelianId: 'p1', qty: 700, harga: 5000 }, { pembelianId: 'p2', qty: 300, harga: 5200 }];
  check('Gabah Masuk Giling kosong/0 -> auto total (1000)',
    approxEqual(ProductionCalculationService.computeGabahMasukGiling(rows, 0), 1000));
  check('Gabah Masuk Giling sudah diisi manual -> TIDAK ditimpa',
    approxEqual(ProductionCalculationService.computeGabahMasukGiling(rows, 1234), 1234));

  const DB = freshDB();
  DB.pembelian.push({ id: 'p1', noFaktur: 'PB-001', tanggal: shiftDate(-1), supplier: 'Supplier A',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 1000, harga: 5000, angkut: 0 });
  DB.pembelian.push({ id: 'p2', noFaktur: 'PB-002', tanggal: shiftDate(-1), supplier: 'Supplier B',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 500, harga: 5200, angkut: 0 });

  const summary = ProductionCalculationService.computeSummary(rows, 'Ciherang', null);
  check('Ringkasan: Jumlah Supplier = 2', summary.jumlahSupplier === 2);
  check('Ringkasan: Jumlah Batch Pembelian = 2', summary.jumlahBatchPembelian === 2);
  check('Ringkasan: Total Qty Dipakai = 1000', approxEqual(summary.totalQtyDipakai, 1000));
  const expectedNilai = 700 * 5000 + 300 * 5200;
  check('Ringkasan: Total Nilai Gabah benar', approxEqual(summary.totalNilaiGabah, expectedNilai));
  check('Ringkasan: Rata-rata Harga tertimbang benar', approxEqual(summary.rataRataHarga, expectedNilai / 1000));
}

// ============================================================
// TEST 5 — Requirement #8: HPP Realtime = satu sumber kebenaran
// ============================================================
console.log('\n### TEST 5: HPP Realtime — Konsistensi dengan getHppBatch() ###');
{
  const batchLike = {
    sumberGabah: [{ pembelianId: 'p1', qty: 1000, harga: 5000 }, { pembelianId: 'p2', qty: 500, harga: 5200 }],
    gabah: 1500, pk: 930, sekam: 300, premium: 700, medium: 120, menir: 50, bekatul: 40,
  };
  const viaService = ProductionCalculationService.computeHppPreview(batchLike);
  const viaDirect = getHppBatch(batchLike);
  check('computeHppPreview() === getHppBatch() — TIDAK ADA rumus kedua yang terpisah',
    approxEqual(viaService.totalNilai, viaDirect.totalNilai) &&
    approxEqual(viaService.hppPerKgPK, viaDirect.hppPerKgPK) &&
    approxEqual(viaService.hppPerKgBeras, viaDirect.hppPerKgBeras));
}

// ============================================================
// TEST 6 — validateBeforeSave (Requirement #10 — basis Konfirmasi Produksi)
// ============================================================
console.log('\n### TEST 6: validateBeforeSave — Basis Konfirmasi Produksi ###');
{
  const DB = freshDB();
  DB.pembelian.push({ id: 'p1', noFaktur: 'PB-001', tanggal: shiftDate(-1), supplier: 'Supplier A',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 1000, harga: 5000, angkut: 0 });

  const good = ProductionCalculationService.validateBeforeSave(
    [{ pembelianId: 'p1', qty: 1000 }], 'Ciherang', 1000, null);
  check('validateBeforeSave: data valid -> valid=true, selisih=0', good.valid && approxEqual(good.selisih, 0));

  const bad = ProductionCalculationService.validateBeforeSave(
    [{ pembelianId: 'p1', qty: 1500 }], 'Ciherang', 1500, null);
  check('validateBeforeSave: qty melebihi stok -> valid=false', !bad.valid && bad.errors.length > 0);
}

// ============================================================
// TEST 7 — Tidak ada stok minus (Requirement #13)
// ============================================================
console.log('\n### TEST 7: Tidak Ada Stok Minus / Qty Melebihi Stok ###');
{
  const DB = freshDB();
  DB.pembelian.push({ id: 'p1', noFaktur: 'PB-001', tanggal: shiftDate(-1), supplier: 'A',
    jenisGabah: 'Ciherang', kategori: 'Gabah', qty: 500, harga: 5000, angkut: 0 });
  // Batch produksi LAIN sudah memakai 500kg penuh dari p1
  DB.produksi.push({ id: 'b1', jenisGabah: 'Ciherang', gabah: 500,
    sumberGabah: [{ pembelianId: 'p1', qty: 500, harga: 5000 }] });

  const sisaSetelahTerpakai = getSisaPembelian('p1', null);
  check('Stok p1 sudah habis terpakai batch lain -> sisa = 0', approxEqual(sisaSetelahTerpakai, 0));

  const sourcesKosong = ProductionCalculationService.getAvailableSourcesFIFO('Ciherang', null);
  check('Sumber FIFO TIDAK menampilkan p1 yang sudah habis (mencegah alokasi ganda)',
    sourcesKosong.length === 0);

  const validasiOverAlloc = ProductionCalculationService.validateRows(
    [{ pembelianId: 'p1', qty: 100 }], 'Ciherang', null);
  check('Mencoba alokasi 100kg dari p1 yang sudah habis -> error (cegah stok minus)',
    validasiOverAlloc[0].level === 'error');
}

console.log('\n\n========================================================');
console.log(`HASIL: ${passCount} passed, ${failCount} failed`);
console.log('========================================================');

if (failCount > 0) {
  console.log('\n\x1b[31mKEGAGALAN:\x1b[0m');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n\x1b[32m✓✓✓ ProductionCalculationService TERVERIFIKASI — SATU SUMBER KEBENARAN KALKULASI PRODUKSI\x1b[0m');
  process.exit(0);
}
