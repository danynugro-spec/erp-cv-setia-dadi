#!/usr/bin/env node
/* ============================================================
   E2E SIMULATION TEST — Sprint Stabilization, Skenario "Batch 1"
   ============================================================
   Mereplikasi PERSIS skenario QA yang diminta:

       Batch 1
       PB0004   10.000 kg
       PB0013    5.000 kg
       PB0072   12.500 kg
       Total    27.500 kg

   Memverifikasi: Gabah Masuk = 27.500 kg, HPP benar, qty supplier
   berkurang, tidak ada scroll, tidak ada render ulang tabel, tidak
   ada stok negatif.

   PRASYARAT: server lokal harus jalan di http://localhost:8765,
   dan PLAYWRIGHT_BROWSERS_PATH harus menunjuk ke instalasi Chromium
   yang valid.

   Cara menjalankan:
       export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
       python3 -m http.server 8765 &
       node tests/e2e-stabilization-batch1.js
   ============================================================ */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('dialog', async d => { await d.accept(); });

  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(500);
  await page.fill('#loginUser', 'owner');
  await page.fill('#loginPass', 'owner123');
  await page.locator('button:has-text("Masuk")').first().click();
  await page.waitForTimeout(1000);

  let passCount = 0, failCount = 0;
  function check(label, cond, detail) {
    if (cond) { passCount++; console.log(`  ✓ ${label}`); }
    else { failCount++; console.log(`  ✗ ${label}${detail ? '  →  ' + detail : ''}`); }
  }

  console.log('=== SETUP: Data persis sesuai skenario "Batch 1" ===\n');
  await page.evaluate(() => {
    const jenis = 'Stabilization Batch1 ' + Date.now();
    window.__stabJenis = jenis;
    DB.jenisGabah.push(jenis);
    DB.pembelian.push({ id: uid(), noFaktur: 'PB0004', tanggal: shiftDate(-15), supplier: 'Petani Sukamaju',
      jenisGabah: jenis, kategori: 'Gabah', qty: 10000, harga: 5000, angkut: 0, status: 'Lunas', dp: 0, total: 50000000 });
    DB.pembelian.push({ id: uid(), noFaktur: 'PB0013', tanggal: shiftDate(-10), supplier: 'KUD Tani Makmur',
      jenisGabah: jenis, kategori: 'Gabah', qty: 5000, harga: 5100, angkut: 0, status: 'Lunas', dp: 0, total: 25500000 });
    DB.pembelian.push({ id: uid(), noFaktur: 'PB0072', tanggal: shiftDate(-3), supplier: 'Petani Mekarjaya',
      jenisGabah: jenis, kategori: 'Gabah', qty: 12500, harga: 4950, angkut: 0, status: 'Lunas', dp: 0, total: 61875000 });
    DB.pembelian.push({ id: uid(), noFaktur: 'PB0080', tanggal: shiftDate(-1), supplier: 'Petani Lain',
      jenisGabah: jenis, kategori: 'Gabah', qty: 8000, harga: 5200, angkut: 0, status: 'Lunas', dp: 0, total: 41600000 });
    saveDB();
  });
  const jenisGabah = await page.evaluate(() => window.__stabJenis);

  console.log('=== Buka Form, pilih Jenis Gabah (HANYA filter) ===\n');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', jenisGabah);
  await page.waitForTimeout(300);

  const sumberAwal = await page.evaluate(() => window._produksiEdit.sumberGabah);
  check('Tabel sumber gabah KOSONG setelah pilih Jenis Gabah', sumberAwal.length === 0);
  const gabahAwal = await page.locator('#pr_gabah').inputValue();
  check('Gabah Masuk = 0 di awal', gabahAwal === '' || gabahAwal === '0');
  const ringkasanAwal = await page.locator('#ringkasanSumberGabahBox').innerText();
  check('Total Qty = 0 kg di awal', ringkasanAwal.includes('0 kg'));
  const hppAwal = await page.locator('#pr_hpp_gabah_display').inputValue();
  check('HPP = "-" (belum ada data) di awal', hppAwal === '-');

  console.log('\n=== Operator pilih PB0004, PB0013, PB0072 ===\n');
  for (const noFaktur of ['PB0004', 'PB0013', 'PB0072']) {
    await page.locator('button:has-text("+ Tambah Sumber Gabah")').click();
    await page.waitForTimeout(150);
    const pid = await page.evaluate((nf) => DB.pembelian.find(p => p.noFaktur === nf).id, noFaktur);
    const selects = page.locator('#sumberGabahBox select');
    const lastIdx = await selects.count() - 1;
    await selects.nth(lastIdx).selectOption(pid);
    await page.waitForTimeout(150);
  }

  // Cek tidak ada scroll jump & fokus tidak hilang saat memilih sumber
  const modalEl = page.locator('.modal').first();
  const scrollBeforeEdit = await modalEl.evaluate(el => el.scrollTop);

  const inputs = page.locator('#sumberGabahBox input[type="number"]');
  await inputs.last().scrollIntoViewIfNeeded();
  await inputs.last().click();
  const scrollAfterFocus = await modalEl.evaluate(el => el.scrollTop);
  await page.keyboard.press('End');
  await page.waitForTimeout(150);
  const scrollAfterEdit = await modalEl.evaluate(el => el.scrollTop);
  check('Tidak ada scroll jump saat fokus/edit input qty',
    scrollAfterFocus === scrollAfterEdit, `before=${scrollAfterFocus}, after=${scrollAfterEdit}`);
  const activeTag = await page.evaluate(() => document.activeElement.tagName);
  check('Fokus tetap di INPUT (tidak loncat ke BODY)', activeTag === 'INPUT', `actual=${activeTag}`);

  console.log('\n=== VERIFIKASI: Gabah Masuk = 27.500 kg ===\n');
  const gabahMasukFinal = await page.locator('#pr_gabah').inputValue();
  check('Gabah Masuk Giling = 27500', gabahMasukFinal === '27500', `actual="${gabahMasukFinal}"`);
  const isReadonly = await page.evaluate(() => document.getElementById('pr_gabah').readOnly);
  check('Field Gabah Masuk Giling readonly', isReadonly === true);

  console.log('\n=== VERIFIKASI: HPP benar ===\n');
  const hppFinal = await page.locator('#pr_hpp_gabah_display').inputValue();
  const expectedHpp = (10000*5000 + 5000*5100 + 12500*4950) / 27500;
  check(`HPP sesuai perhitungan manual (≈Rp ${Math.round(expectedHpp).toLocaleString('id-ID')}/kg)`,
    hppFinal.includes('4.995') || hppFinal.includes('4995'), `actual="${hppFinal}"`);

  console.log('\n=== VERIFIKASI: PB0080 TIDAK ikut terpakai ===\n');
  const sisaPB0080Before = await page.evaluate(() => {
    const p = DB.pembelian.find(x => x.noFaktur === 'PB0080');
    return getSisaPembelian(p.id, null);
  });
  check('Sisa PB0080 tetap 8000 (tidak otomatis terpakai)', sisaPB0080Before === 8000);

  console.log('\n=== Simpan batch & verifikasi qty supplier berkurang ===\n');
  await page.fill('#pr_pk', '18000');
  await page.fill('#pr_sekam', '6000');
  await page.fill('#pr_premium', '13000');
  await page.fill('#pr_medium', '2500');
  await page.fill('#pr_menir', '1000');
  await page.fill('#pr_bekatul', '700');
  await page.waitForTimeout(300);
  const produksiCountBefore = await page.evaluate(() => DB.produksi.length);
  await page.locator('button:has-text("Simpan Batch")').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Lanjutkan")').click();
  await page.waitForTimeout(500);
  const produksiCountAfter = await page.evaluate(() => DB.produksi.length);
  check('Batch berhasil tersimpan', produksiCountAfter === produksiCountBefore + 1);

  for (const [nf, expected] of [['PB0004', 0], ['PB0013', 0], ['PB0072', 0], ['PB0080', 8000]]) {
    const sisa = await page.evaluate((n) => {
      const p = DB.pembelian.find(x => x.noFaktur === n);
      return getSisaPembelian(p.id, null);
    }, nf);
    check(`Sisa ${nf} setelah simpan = ${expected}`, sisa === expected, `actual=${sisa}`);
  }

  console.log('\n=== VERIFIKASI: Tidak ada stok negatif di manapun ===\n');
  const negatif = await page.evaluate((jenis) => {
    return DB.pembelian.filter(p => p.jenisGabah === jenis)
      .map(p => ({ noFaktur: p.noFaktur, sisa: getSisaPembelian(p.id, null) }))
      .filter(x => x.sisa < 0);
  }, jenisGabah);
  check('Tidak ada faktur dengan sisa negatif', negatif.length === 0, JSON.stringify(negatif));

  console.log('\nErrors:', errs.length);
  errs.forEach(e => console.log(' ', e));

  await browser.close();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Simulasi "Batch 1": ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));
  process.exit(failCount > 0 ? 1 : 0);
})();
