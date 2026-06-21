#!/usr/bin/env node
/* ============================================================
   E2E REGRESSION TEST — BUG-007: Kolom "Qty Dipakai" Bermasalah
   ============================================================
   Memverifikasi (dengan keystroke nyata via Playwright, BUKAN fill()
   instan) bahwa SEMUA baris pada tabel Sumber Gabah di form Produksi
   Batch dapat diedit, bukan hanya baris pertama — dan bahwa Total Qty,
   Estimasi HPP, serta Gabah Masuk Giling ikut terhitung ulang realtime.

   PRASYARAT: server lokal harus jalan di http://localhost:8765
   menyajikan folder aplikasi ini (mis. `python3 -m http.server 8765`),
   dan PLAYWRIGHT_BROWSERS_PATH harus menunjuk ke instalasi Chromium
   yang valid.

   Cara menjalankan:
       export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers   # sesuaikan path
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

  console.log('=== BUG-007 REGRESSION SUITE ===\n');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', 'BUG007 Regression');
  await page.waitForTimeout(300);

  const inputs = page.locator('#sumberGabahBox input[type="number"]');
  check('3 baris ter-render', await inputs.count() === 3);

  // ── Bug 1 & 2: semua baris bisa diketik karakter-demi-karakter ──
  console.log('\n--- Bug #1/#2: Edit setiap baris dengan keystroke nyata ---');
  for (const [idx, val] of [[0, '700'], [1, '350'], [2, '1500']]) {
    await inputs.nth(idx).click();
    await inputs.nth(idx).fill('');
    await page.keyboard.type(val, { delay: 60 });
    await page.waitForTimeout(250);
    const actual = await inputs.nth(idx).inputValue();
    check(`Baris ${idx+1}: ketik "${val}" karakter-demi-karakter -> tersimpan utuh`, actual === val, `actual="${actual}"`);
  }

  // ── Bug 3: Qty otomatis = Sisa Tersedia ──
  console.log('\n--- Bug #3: Qty otomatis dari Sisa Tersedia ---');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', 'BUG007 Regression');
  await page.waitForTimeout(300);
  const inputs2 = page.locator('#sumberGabahBox input[type="number"]');
  check('Baris 1 qty auto = sisa tersedia (1000)', await inputs2.nth(0).inputValue() === '1000');
  check('Baris 2 qty auto = sisa tersedia (500)', await inputs2.nth(1).inputValue() === '500');

  // ── Bug 4 & 5: Total Qty dan HPP terhitung ulang realtime ──
  console.log('\n--- Bug #4/#5: Total Qty & HPP realtime ---');
  await inputs2.nth(0).click();
  await inputs2.nth(0).fill('');
  await page.keyboard.type('600', { delay: 60 });
  await page.waitForTimeout(300);
  // Form ini punya 3 baris (1000+500+2000=3500 awal). Setelah baris 1 diubah
  // ke 600: total = 600+500+2000 = 3100.
  const ringkasan = await page.locator('#ringkasanSumberGabahBox').innerText();
  check('Total Qty Dipakai terhitung ulang (600+500+2000=3100, bukan 3500 awal)',
    ringkasan.includes('3.100 kg') || ringkasan.includes('3100'), `ringkasan: ${ringkasan.slice(0,60)}`);
  const hpp = await page.locator('#pr_hpp_gabah_display').inputValue();
  check('HPP berubah dari nilai default (terhitung ulang)', hpp !== '-' && hpp.includes('Rp'));

  // ── Bug 6: Gabah Masuk Giling mengikuti Total Qty jika 0/kosong ──
  console.log('\n--- Bug #6: Gabah Masuk Giling mengikuti Total Qty ---');
  const gabahValue = await page.locator('#pr_gabah').inputValue();
  check('Gabah Masuk Giling = 3100 (600+500+2000), bukan nilai lama 3500', gabahValue === '3100', `actual="${gabahValue}"`);

  // ── Business rule: manual override tidak ditimpa ──
  console.log('\n--- Business Rule: input manual operator di Gabah Masuk Giling tidak ditimpa ---');
  await page.locator('#pr_gabah').click();
  await page.locator('#pr_gabah').fill('');
  await page.keyboard.type('9999', { delay: 60 });
  await page.waitForTimeout(200);
  await inputs2.nth(1).click();
  await inputs2.nth(1).fill('');
  await page.keyboard.type('100', { delay: 60 });
  await page.waitForTimeout(300);
  const gabahAfterManual = await page.locator('#pr_gabah').inputValue();
  check('Gabah Masuk Giling TETAP nilai manual (9999) setelah qty sumber berubah', gabahAfterManual === '9999', `actual="${gabahAfterManual}"`);

  // ── Business rule: qty tidak boleh melebihi sisa ──
  console.log('\n--- Business Rule: validasi qty melebihi Sisa Tersedia ---');
  await page.evaluate(() => editProduksi(null));
  await page.waitForTimeout(300);
  await page.selectOption('#pr_jenis', 'BUG007 Regression');
  await page.waitForTimeout(300);
  const inputs3 = page.locator('#sumberGabahBox input[type="number"]');
  await inputs3.nth(0).click();
  await inputs3.nth(0).fill('');
  await page.keyboard.type('99999', { delay: 60 });
  await page.waitForTimeout(300);
  const errText = await page.locator('#sumberGabahBox').innerText();
  check('Pesan error muncul untuk qty melebihi stok', errText.includes('melebihi') || errText.includes('Sisa Tersedia'));
  check('Indikator merah muncul', errText.includes('🔴'));

  console.log('\nErrors:', errs.length);
  errs.forEach(e => console.log(' ', e));

  await browser.close();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BUG-007 Regression: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));
  process.exit(failCount > 0 ? 1 : 0);
})();
