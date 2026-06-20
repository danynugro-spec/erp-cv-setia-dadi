# ERP CV. Setia Dadi — Panduan Instalasi sebagai Aplikasi (PWA)

Aplikasi ini sekarang mendukung **instalasi sebagai aplikasi** (Progressive Web App / PWA):
ikon muncul di desktop/HP, terbuka di window sendiri tanpa address bar browser, dan tetap
bisa dipakai **offline** setelah pertama kali dibuka.

## Penting: harus dijalankan lewat server lokal (bukan dobel-klik file)

Browser hanya mengizinkan fitur "Install App" dan mode offline jika halaman dibuka lewat
`http://` atau `https://`, **tidak bisa** langsung dari `file://` (dobel-klik index.html).
Karena itu perlu menjalankan server lokal kecil — caranya sangat mudah dan tidak perlu
instalasi rumit.

### Cara 1: Pakai Python (biasanya sudah terpasang di Windows/Mac)

1. Ekstrak folder `erp_padi` ke lokasi yang mudah diingat, misalnya Desktop.
2. Buka **Command Prompt** (Windows) atau **Terminal** (Mac), lalu masuk ke folder tersebut:
   ```
   cd Desktop/erp_padi
   ```
3. Jalankan:
   ```
   python -m http.server 8080
   ```
   (Jika `python` tidak dikenali, coba `python3 -m http.server 8080`)
4. Buka browser (Chrome/Edge disarankan), akses:
   ```
   http://localhost:8080/index.html
   ```
5. Login seperti biasa. Setelah itu akan muncul tombol **"📲 Install Aplikasi ke Perangkat"**
   di halaman login (atau ikon install di address bar browser, biasanya di sisi kanan).
6. Klik tombol tersebut → pilih **Install**. Ikon aplikasi akan muncul di desktop/menu
   aplikasi, dan bisa dibuka tanpa browser address bar.
7. Biarkan jendela Command Prompt/Terminal tetap berjalan selagi memakai aplikasi
   pertama kali (untuk loading awal). Setelah ter-cache, aplikasi bisa dipakai offline.

### Cara 2: Hosting online (disarankan untuk pemakaian rutin/multi-perangkat)

Untuk dipakai setiap hari tanpa harus menjalankan server lokal setiap kali, unggah seluruh
isi folder `erp_padi` ke layanan hosting statis gratis, misalnya:
- Netlify (drag & drop folder ke app.netlify.com/drop)
- GitHub Pages
- Vercel

Setelah online, buka alamatnya di browser HP/laptop, lalu klik **Install App** — aplikasi
akan terpasang seperti aplikasi biasa, dan data tetap tersimpan lokal di perangkat
masing-masing (localStorage), tidak terkirim ke server manapun.

## Catatan tentang Data

- Data (transaksi, master data, dll) disimpan di **browser tempat aplikasi dibuka**
  (localStorage), bukan di server.
- Jika pindah perangkat atau install ulang, gunakan tombol **Ekspor Data (.json)** di
  sidebar untuk backup, lalu **Impor Data** di perangkat baru.
- Login demo: `owner/owner123`, `admin/admin123`, `kasir/kasir123`.

## Cara Pasang di HP Android

1. Buka **app.netlify.com/drop** di browser laptop/komputer.
2. Drag & drop folder `erp_padi` (atau ekstrak zip ini lalu drag foldernya) ke halaman tersebut.
3. Tunggu beberapa saat, Netlify akan memberikan link, contoh: `https://nama-acak.netlify.app`
4. Buka link tersebut di **Chrome** pada HP Android.
5. Login, lalu akan muncul tombol **"📲 Install Aplikasi ke Perangkat"** (atau notifikasi
   "Tambahkan ke Layar Utama" dari Chrome) — ketuk untuk memasang.
6. Ikon ERP CV. Setia Dadi akan muncul di home screen HP, terbuka full-screen tanpa
   address bar, dan tetap bisa dibuka offline setelah pemakaian pertama.

Tampilan tabel dan form sudah disesuaikan agar nyaman digunakan di layar HP (menu sidebar
menjadi menu geser/hamburger, tabel bisa digeser ke samping bila kolom banyak).


## File dalam paket ini
- `index.html` — halaman utama aplikasi
- `app.js` — seluruh logika aplikasi
- `manifest.json` — konfigurasi PWA (nama, ikon, warna tema)
- `sw.js` — service worker untuk mode offline
- `icon-192.png`, `icon-512.png` — ikon aplikasi
