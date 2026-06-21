#!/usr/bin/env node
/* ============================================================
   E2E REGRESSION TEST — BUG-007 & BUG-009 (Modul Produksi Batch)
   ============================================================
   BUG-007: "Qty Dipakai" hanya baris pertama yang bisa diedit, baris
   lain rusak (kehilangan fokus saat mengetik), qty tidak otomatis,
   Total Qty/HPP/Gabah Masuk Giling tidak ter-update realtime.

   BUG-009: Business process diubah — Jenis Gabah hanya FILTER (tidak
   lagi auto-fill semua stok), operator memilih sendiri faktur via
   "+ Tambah Sumber Gabah", dan Gabah Masuk Giling SELALU mengikuti
   Total Qty Dipakai (tidak ada lagi mode "manual override").

   File ini diperbarui mengikuti BUG-009 — setiap skenario sekarang
   memilih sumber gabah secara EKSPLISIT lewat helper
   pilihSumberGabahManual(), bukan mengandalkan auto-fill yang sudah
   dihapus.

   PRASYARAT: server lokal harus jalan di http://localhost:8765,
   dan PLAYWRIGHT_BROWSERS_PATH harus menunjuk ke instalasi Chromium
   yang valid.

   Cara menjalankan:
       export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
       python3 -m http.server 8765 &
       node tests/e2e-bug007-qty-dipakai.js
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

  // Helper BUG-009: pilih N faktur secara eksplisit lewat tombol
  // "+ Tambah Sumber Gabah" + dropdown, sesuai business process baru
  // (Jenis Gabah hanya filter, tidak ada auto-fill).
  async function pilihSumberGabahManual(noFakturList) {
    for (const noFaktur of noFakturList) {
      await page.locator('button:has-text("+ Tambah Sumber Gabah")').click();
      await page.waitForTimeout(150);
      const pid = await page.evaluate((nf) => DB.pembelian.find(p => p.noFaktur === nf).id, noFaktur);
      const selects = page.locator('#sumberGabahBox select');
      const lastIdx = await selects.count() - 1;
      await selects.nth(lastIdx).selectOption(pid);
      await page.waitForTimeout(150);
    }
  }

  await page.evaluate(() => {
    if (!DB.jenisGabah.includes('BUG007 Regression')) DB.jenisGabah.push('BUG007 Regression');
    DB.pembelian.push({ id: uid(), noFaktur: 'PB-B007R-1', tanggal: shiftDate(-10), supplier: 'Sup A',
      jenisGabah: 'BUG007 Regression', kategori: 'Gabah', qty: 1000, harga: 5000, angkut: 0, status: 'Lunas', dp: 0, total: 5000000 });
    DB.pembelian.push({ id: uid(), noFaktur: 'PB-B007R-2', tanggal: shiftDate(-5), supplier: 'Sup B',
      jenisGabah: 'BUG007 Regression', kategori: 'Gabah', qty: 500, harga: 5200, angkut: 0, status: 'Lunas', dp: 0, total: 2600000 });
    DB.pembelian.push({ id: uid(), noFaktur: 'PB-B007R-3', tanggal: shiftDate(-1), supplier: 'Sup C',
      jenisGabah: 'BUG007 Regression', kategori: 'Gabah', qty: 2000, harga: 5100, angkut: 0, status: 'Lunas', dp: 0, total: 10200000 });
    saveDB();
  });

  console.log('=== BUG-007/BUG-009 REGRESSION SUITE ===\n');

  console.log('--- BUG-009: Jenis Gabah hanya filter (tabel tetap kosong) ---');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', 'BUG007 Regression');
  await page.waitForTimeout(300);
  const sumberKosong = await page.evaluate(() => window._produksiEdit.sumberGabah);
  check('Tabel TETAP KOSONG setelah pilih Jenis Gabah (bukan auto-fill)', sumberKosong.length === 0);

  await pilihSumberGabahManual(['PB-B007R-1', 'PB-B007R-2', 'PB-B007R-3']);
  const inputs = page.locator('#sumberGabahBox input[type="number"]');
  check('3 baris ter-render setelah dipilih manual', await inputs.count() === 3);

  console.log('\n--- BUG-007 #1/#2: Edit setiap baris dengan keystroke nyata ---');
  for (const [idx, val] of [[0, '700'], [1, '350'], [2, '1500']]) {
    await inputs.nth(idx).click();
    await inputs.nth(idx).fill('');
    await page.keyboard.type(val, { delay: 60 });
    await page.waitForTimeout(250);
    const actual = await inputs.nth(idx).inputValue();
    check(`Baris ${idx+1}: ketik "${val}" karakter-demi-karakter -> tersimpan utuh`, actual === val, `actual="${actual}"`);
  }

  console.log('\n--- BUG-007 #3 / BUG-009 #4: Qty otomatis dari Sisa Tersedia saat faktur dipilih ---');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', 'BUG007 Regression');
  await page.waitForTimeout(300);
  await pilihSumberGabahManual(['PB-B007R-1', 'PB-B007R-2', 'PB-B007R-3']);
  const inputs2 = page.locator('#sumberGabahBox input[type="number"]');
  check('Baris 1 qty auto = sisa tersedia (1000)', await inputs2.nth(0).inputValue() === '1000');
  check('Baris 2 qty auto = sisa tersedia (500)', await inputs2.nth(1).inputValue() === '500');

  console.log('\n--- BUG-007 #4/#5: Total Qty & HPP realtime ---');
  await inputs2.nth(0).click();
  await inputs2.nth(0).fill('');
  await page.keyboard.type('600', { delay: 60 });
  await page.waitForTimeout(300);
  const ringkasan = await page.locator('#ringkasanSumberGabahBox').innerText();
  check('Total Qty Dipakai terhitung ulang (600+500+2000=3100, bukan 3500 awal)',
    ringkasan.includes('3.100 kg') || ringkasan.includes('3100'), `ringkasan: ${ringkasan.slice(0,60)}`);
  const hpp = await page.locator('#pr_hpp_gabah_display').inputValue();
  check('HPP berubah dari nilai default (terhitung ulang)', hpp !== '-' && hpp.includes('Rp'));

  console.log('\n--- BUG-007 #6 / BUG-009 #5: Gabah Masuk Giling mengikuti Total Qty ---');
  const gabahValue = await page.locator('#pr_gabah').inputValue();
  check('Gabah Masuk Giling = 3100 (600+500+2000), bukan nilai lama 3500', gabahValue === '3100', `actual="${gabahValue}"`);

  console.log('\n--- BUG-009: Gabah Masuk Giling SELALU mengikuti Total Qty (tidak ada manual override) ---');
  await page.locator('#pr_gabah').click();
  await page.locator('#pr_gabah').fill('');
  await page.keyboard.type('9999', { delay: 60 });
  await page.waitForTimeout(200);
  await inputs2.nth(1).click();
  await inputs2.nth(1).fill('');
  await page.keyboard.type('100', { delay: 60 });
  await page.waitForTimeout(300);
  const gabahAfterQtyChange = await page.locator('#pr_gabah').inputValue();
  check('Gabah Masuk Giling TERTIMPA jadi 2700 (mengikuti Total Qty, bukan tetap 9999)',
    gabahAfterQtyChange === '2700', `actual="${gabahAfterQtyChange}"`);

  console.log('\n--- Business Rule: validasi qty melebihi Sisa Tersedia ---');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', 'BUG007 Regression');
  await page.waitForTimeout(300);
  await pilihSumberGabahManual(['PB-B007R-1']);
  const inputs3 = page.locator('#sumberGabahBox input[type="number"]');
  await inputs3.nth(0).click();
  await inputs3.nth(0).fill('');
  await page.keyboard.type('99999', { delay: 60 });
  await page.waitForTimeout(300);
  const errText = await page.locator('#sumberGabahBox').innerText();
  check('Pesan error muncul untuk qty melebihi stok', errText.includes('melebihi') || errText.includes('Sisa Tersedia'));
  check('Indikator merah muncul', errText.includes('🔴'));

  console.log('\n--- BUG-009 #6: HPP dihitung dari faktur dipilih saja ---');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', 'BUG007 Regression');
  await page.waitForTimeout(300);
  await pilihSumberGabahManual(['PB-B007R-2']);
  await page.waitForTimeout(300);
  const hppSingleFaktur = await page.locator('#pr_hpp_gabah_display').inputValue();
  check('HPP = Rp 5.200/kg (harga PB-B007R-2 saja, bukan rata-rata semua stok)',
    hppSingleFaktur.includes('5.200') || hppSingleFaktur.includes('5200'), `actual="${hppSingleFaktur}"`);

  console.log('\nErrors:', errs.length);
  errs.forEach(e => console.log(' ', e));

  await browser.close();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BUG-007/BUG-009 Regression: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));
  process.exit(failCount > 0 ? 1 : 0);
})();
