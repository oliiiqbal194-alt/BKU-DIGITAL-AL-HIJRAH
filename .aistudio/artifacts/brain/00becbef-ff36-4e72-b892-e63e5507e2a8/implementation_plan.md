# Rencana Implementasi: Perbaikan Masalah Data Muncul Kembali, Pembersihan Tuntas Database, dan Modul Unggah Database Siap Pakai

## 1. Analisis Akar Masalah (Mengapa Data Oktober Tetap Muncul Setelah Dihapus)
Setelah memeriksa kode sumber sinkronisasi di `src/context/BKUContext.tsx`:
1. **Fungsi Pembersihan Tidak Menghapus ke Cloud Firestore**:
   - Fungsi `resetAllData()` sebelumnya hanya membersihkan state RAM (`setTransaksi([])`) dan menghapus kunci `localStorage`. Dokumen di koleksi cloud Firestore (`db, 'transaksi'`) **tidak pernah dihapus**.
   - Ketika halaman dimuat ulang atau listener Firestore mendeteksi koneksi, Firestore mengunduh kembali dokumen transaksi dari cloud dan menampilkannya kembali ke layar.
2. **Kondisi Guard `onSnapshot` yang Mengunci State Kosong**:
   - Di `BKUContext.tsx` baris 214:
     ```typescript
     if (items.length > 0) {
       setTransaksi(items);
     }
     ```
     Jika semua data di cloud terhapus (sehingga `items.length === 0`), `setTransaksi` tidak pernah dipanggil dengan array kosong `[]`, sehingga UI tetap menahan data lama.
3. **Race Condition dengan Cache Lokal Browser (`loadLocalData`)**:
   - `loadLocalData()` membaca arsip terenkripsi lama di `localStorage` secara asynchronous bersamaan dengan listener Firestore tanpa pengecekan versi/timestamp, sehingga data yang sudah dihapus bisa tertimpa kembali oleh arsip cache browser.
4. **Penghapusan Individual Tidak Menunggu Konfirmasi Firestore**:
   - Pada saat menghapus data individu atau beberapa transaksi sekaligus, kegagalan batch/jaringan tidak memberikan fallback penanganan yang konsisten.

---

## 2. Rencana Tindakan & Solusi

### Tahap 1: Pembersihan Tuntas Database Cloud & Lokal (Aplikasi Siap Pakai)
- Menulis fungsi `purgeAllDatabase()` di `BKUContext.tsx` yang secara nyata:
  1. Melakukan batch deletion terhadap seluruh dokumen di koleksi Firestore `transaksi` dan `kegiatan`.
  2. Mereset custom saldo awal per bulan (`saldoAwalBulanCustom`) di dokumen `instansi/profil`.
  3. Mengosongkan `localStorage` vault (`bku_data_vault_v1`).
  4. Mengosongkan state aktif di React (`transaksi: []`, `kegiatan: []`).
- Memperbaiki listener Firestore `onSnapshot` agar selalu memperbarui state secara presisi (`setTransaksi(items)` dan `setKegiatan(items)` tanpa memblokir array kosong).
- Menghilangkan race condition pada pemuatan cache lokal.

### Tahap 2: Pembuatan Modul "Pusat Unggah & Pemulihan Database" (Database Import Center)
Menyediakan antarmuka unggah database yang komprehensif dan mudah digunakan:
1. **Dukungan Format File Ganda**:
   - **File Cadangan Vault (.bku.enc / .json / .bku)**: Cadangan sistem terenkripsi atau data mentah BKU.
   - **File Excel / Spreadsheet (.xlsx / .xls / .csv)**: Membaca tabel transaksi dari Excel dengan pemetaan kolom otomatis (Tanggal, Nomor Bukti, Uraian, Masuk/Penerimaan, Keluar/Pengeluaran, Jenis Kas, Sumber Dana, Penanggung Jawab).
2. **Pratinjau Sebelum Disimpan (Preview & Validasi)**:
   - Menampilkan jumlah baris data yang terbaca, total uang masuk, total uang keluar, dan contoh data.
3. **Penyimpanan Permanen ke Cloud Firestore & Lokal (Batch Write)**:
   - Data yang diunggah langsung ditulis ke koleksi Firestore (`transaksi` & `kegiatan`) menggunakan batch write Firestore.
   - Disimpan ke penyimpanan lokal terenkripsi sebagai redundansi.
   - Disinkronkan ke Google Spreadsheet (jika pengguna mengaktifkan integrasi Google Drive).
   - Dijamin tidak akan hilang saat browser di-refresh atau ditutup.

### Tahap 3: Penyediaan Tombol Aksi di Antarmuka
- Menambahkan tombol **"Unggah / Pulihkan Database"** dan **"Kosongkan Seluruh Data"** di:
  1. Halaman **Pengaturan & Keamanan** (`SettingsSecurityView.tsx`).
  2. Tampilan status kosong (Empty State) di halaman Buku Kas Umum agar pengguna baru atau pengguna yang baru mengosongkan data bisa langsung mengunggah file databasenya dengan satu klik.
- Menambahkan fitur opsi untuk menghapus mutasi transaksi khusus bulan tertentu atau menghapus total seluruh tahun.

---

## 3. Rencana Verifikasi & Pengujian
1. Verifikasi kode menggunakan `compile_applet` dan `lint_applet` (memastikan tidak ada error TypeScript atau build).
2. Uji fungsi pengosongan total: pastikan setelah dikosongkan, di-refresh berkali-kali data bulan Oktober dan bulan lainnya **tidak akan pernah muncul lagi**.
3. Uji fungsi unggah database (baik file JSON maupun Excel .xlsx): pastikan data langsung muncul di tabel BKU, saldo terhitung akurat, dan data tersimpan permanen di cloud Firestore.
