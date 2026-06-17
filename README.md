# KSU Sepakat Jaya — Sistem Keuangan Multi-Cabang

Aplikasi pencatatan keuangan koperasi serba usaha (KSU) dalam **satu berkas `index.html`**.
Tidak ada langkah build, tidak ada `npm install` — cukup buka berkasnya atau unggah ke hosting statis seperti Vercel.

Fitur utama:

- **Multi-cabang (4 cabang):** kelola beberapa cabang KSU di wilayah berbeda dari satu aplikasi. Ada pemilih **Cabang Aktif** di sisi kiri; pilih satu cabang untuk melihat datanya saja, atau **Semua Cabang (Konsolidasi)** untuk gabungan seluruh cabang.
- **Menu Angsuran:** memantau angsuran/cicilan pinjaman per anggota di seluruh cabang — tagihan jatuh tempo, status (mendatang / jatuh tempo / terlambat / lunas), dan pencatatan pembayaran.
- **Pencatatan otomatis:** setiap pinjaman, pembayaran angsuran, dan setoran simpanan otomatis membuat catatan di Buku Kas (diberi tanda "Otomatis") dan langsung tersimpan.
- Modul lengkap: Dasbor, Cabang KSU, Data Anggota, Simpanan, Pinjaman, Angsuran, Kas & Transaksi, Laporan Keuangan (SHU, Neraca, Kas, Simpanan, Pinjaman), dan Pengaturan.

---

## Cara deploy ke Vercel

Pilih salah satu cara berikut. Karena ini berkas statis tunggal, **tidak perlu** `vercel.json` atau konfigurasi apa pun.

### Cara 1 — Drag & drop (paling cepat)
1. Buka https://vercel.com dan masuk.
2. Buat project baru, lalu seret folder yang berisi `index.html` ke jendela unggah Vercel.
3. Vercel langsung memberi URL publik. Selesai.

### Cara 2 — Vercel CLI
```bash
npm i -g vercel        # sekali saja
cd folder-berisi-index-html
vercel                 # ikuti prompt; pilih "static"
vercel --prod          # untuk publish ke domain produksi
```

### Cara 3 — Lewat GitHub
1. Letakkan `index.html` di sebuah repository GitHub.
2. Di Vercel, pilih **Add New → Project → Import** repository tersebut.
3. Framework Preset: **Other** (biarkan kosong). Klik **Deploy**.

> Bisa juga dibuka langsung tanpa hosting: klik dua kali `index.html` agar terbuka di peramban. Untuk dipakai bersama, hosting (Vercel) lebih praktis.

---

## Cara penyimpanan data (PENTING)

Data disimpan di **localStorage peramban**, artinya:

- Data **menempel pada perangkat & peramban** yang dipakai. Membuka aplikasi dari laptop lain atau HP lain **tidak** otomatis menampilkan data yang sama.
- Cabang yang berada di lokasi berbeda **tidak** berbagi data secara realtime hanya karena membuka URL yang sama.

### Solusi berbagi & cadangan: Ekspor / Impor JSON
Di menu **Pengaturan** tersedia:

- **Ekspor Data (JSON)** — mengunduh seluruh data sebagai satu berkas cadangan.
- **Impor Data (JSON)** — memuat kembali berkas cadangan tersebut di perangkat mana pun.

Alur kerja yang disarankan untuk beberapa cabang:
1. Tiap cabang mencatat datanya, lalu **Ekspor** secara berkala.
2. Kirim berkas JSON ke admin pusat.
3. Admin pusat menggabungkan/menyimpan cadangan, atau memuat satu berkas konsolidasi via **Impor**.

> Jika koperasi membutuhkan data tersinkron otomatis antar-cabang secara realtime, langkah berikutnya adalah menambahkan basis data/server (mis. Supabase, Firebase, atau API sederhana). Versi ini sengaja dibuat tanpa server agar mudah dideploy.

---

## Mengelola cabang

- Buka menu **Cabang KSU** untuk menambah, mengganti nama, atau menghapus cabang.
- Aplikasi sudah berisi **4 cabang contoh** (Pusat, Utara, Selatan, Timur) — ini hanya placeholder; ganti nama, wilayah, alamat, penanggung jawab, dan modal awal sesuai kondisi nyata.
- Tiap cabang punya **Modal Awal** sendiri. Mode konsolidasi menjumlahkan modal awal seluruh cabang (ditambah cadangan kantor pusat opsional di Pengaturan).
- Cabang tidak dapat dihapus jika masih memiliki anggota, pinjaman, atau transaksi kas.

---

## Catatan teknis

- **Versi ini sudah diperbaiki agar bisa dibuka tanpa bergantung pada CDN luar.** Versi sebelumnya memuat React, Babel, dan Tailwind dari `unpkg.com`/`cdn.tailwindcss.com` saat aplikasi dibuka — jika jaringan tempat berkas dibuka memblokir, melambat, atau gagal menghubungi domain-domain itu (umum terjadi di jaringan kantor/sekolah yang dibatasi, atau saat koneksi tidak stabil), halaman akan tampil kosong/tidak bisa dibuka. Pada versi ini, **React, ReactDOM, dan seluruh kode aplikasi (sudah dikompilasi dari JSX) ditanam langsung di dalam berkas**, begitu pula seluruh gaya Tailwind yang dipakai aplikasi — sehingga berkas ini berjalan sepenuhnya tanpa koneksi internet setelah diunduh, termasuk saat dibuka langsung dari komputer (klik dua kali) tanpa hosting sama sekali.
- Satu-satunya sumber daya eksternal yang tersisa adalah font dekoratif dari **Google Fonts** (untuk tampilan judul/angka). Jika koneksi tidak tersedia, font ini hanya gagal dimuat secara halus dan aplikasi otomatis memakai font cadangan bawaan sistem — ini **tidak** menghentikan atau merusak fungsi aplikasi.
- **Ikon dan grafik dibuat sendiri** dengan inline SVG (tanpa pustaka ikon/chart eksternal) agar ringan dan andal.
- Ukuran berkas sedikit lebih besar (≈340 KB) dibanding versi awal karena React, ReactDOM, dan seluruh gaya Tailwind kini ikut ditanam di dalamnya — ini wajar dan sebagai gantinya aplikasi jauh lebih andal saat dideploy atau dibuka di berbagai kondisi jaringan.

---

## Struktur berkas
```
index.html     # seluruh aplikasi (HTML + React + style) dalam satu berkas
README.md      # dokumen ini
```
