import * as XLSX from 'xlsx';
import { TransaksiBKU, ProfilInstansi, KegiatanAnggaran, RekapBulananItem } from '../types';
import { NAMA_BULAN, formatTanggalIndo, formatTanggalBKU } from './formatters';

/**
 * Ekspor BKU Umum Bulanan ke berkas Excel (.xlsx) persis format spreadsheet Al Hijrah
 */
export function exportBKUUmumToExcel(
  transaksiList: TransaksiBKU[],
  saldoAwal: number,
  bulan: number,
  tahun: number,
  instansi: ProfilInstansi
) {
  const namaBulan = NAMA_BULAN[bulan - 1] || `Bulan-${bulan}`;
  const wb = XLSX.utils.book_new();

  // Susun data baris demi baris persis seperti pada gambar spreadsheet
  const rows: (string | number)[][] = [
    ['BUKU KAS UMUM'],
    [instansi.namaInstansi ? instansi.namaInstansi.toUpperCase() : 'SD ISLAM AL HIJRAH GORONTALO'],
    [instansi.tahunAjaran || 'T.A 2026 / 2027'],
    [],
    ['', '', '', '', '', '', '', '', `PERIODE ${namaBulan.toUpperCase()} ${tahun}`],
    ['No', 'Tanggal', 'Transaksi', 'Uraian', 'Jenis KAS', 'Saldo Awal', 'Debet', 'Kredit', 'Jumlah'],
    // Baris Saldo Awal (Baris 1 di tabel)
    [
      1,
      formatTanggalBKU(`${tahun}-${bulan.toString().padStart(2, '0')}-01`),
      'SA',
      'Saldo Awal',
      'Kas Sekolah',
      saldoAwal,
      '',
      '',
      saldoAwal
    ]
  ];

  let currentSaldo = saldoAwal;
  let totalMasuk = 0;
  let totalKeluar = 0;

  transaksiList.forEach((tx, idx) => {
    const isMasuk = tx.jenisTransaksi === 'masuk' || tx.jenisTransaksi === 'Masuk';
    const isKeluar = tx.jenisTransaksi === 'keluar' || tx.jenisTransaksi === 'Keluar';
    const masuk = isMasuk ? tx.nominal : 0;
    const keluar = isKeluar ? tx.nominal : 0;
    currentSaldo = currentSaldo + masuk - keluar;
    totalMasuk += masuk;
    totalKeluar += keluar;

    rows.push([
      idx + 2,
      formatTanggalBKU(tx.tanggal),
      isMasuk ? 'Masuk' : 'Keluar',
      tx.uraian,
      tx.jenisKas || 'Kas Sekolah',
      '',
      isMasuk ? tx.nominal : '',
      isKeluar ? tx.nominal : '',
      currentSaldo
    ]);
  });

  // Baris Summary / Total persis di footer tabel gambar
  rows.push([
    '', '', '', '', '',
    saldoAwal,
    totalMasuk,
    totalKeluar,
    currentSaldo
  ]);

  // Tambahkan Tanda Tangan Resmi
  rows.push([]);
  rows.push([]);
  const tglTtd = `${instansi.kotaTandaTangan || 'Gorontalo'}, ${transaksiList.length > 0 ? formatTanggalIndo(transaksiList[transaksiList.length - 1].tanggal) : `${namaBulan} ${tahun}`}`;
  rows.push(['', '', '', '', '', '', '', tglTtd, '']);
  rows.push(['', 'Mengetahui,', '', '', '', '', '', 'Lunas Dibayar / Bendahara,', '']);
  rows.push(['', instansi.jabatanKepala || 'Kepala Sekolah', '', '', '', '', '', instansi.jabatanBendahara || 'Bendahara Sekolah', '']);
  rows.push([]);
  rows.push([]);
  rows.push([]);
  rows.push(['', instansi.namaKepala || '( ................................... )', '', '', '', '', '', instansi.namaBendahara || '( ................................... )', '']);
  rows.push(['', instansi.nipKepala && instansi.nipKepala !== '-' ? `NIP. ${instansi.nipKepala}` : '', '', '', '', '', '', instansi.nipBendahara && instansi.nipBendahara !== '-' ? `NIP. ${instansi.nipBendahara}` : '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },   // No
    { wch: 14 },  // Tanggal
    { wch: 14 },  // Transaksi
    { wch: 55 },  // Uraian
    { wch: 18 },  // Jenis KAS
    { wch: 18 },  // Saldo Awal
    { wch: 18 },  // Debet
    { wch: 18 },  // Kredit
    { wch: 18 },  // Jumlah
  ];

  XLSX.utils.book_append_sheet(wb, ws, `BKU_${namaBulan}`);
  XLSX.writeFile(wb, `BKU_Umum_${namaBulan}_${tahun}.xlsx`);
}

/**
 * Ekspor Rekapitulasi Tahunan 12 Bulan ke Excel (Sekolah & Yayasan)
 */
export function exportRekapitulasiToExcel(
  rekapList: RekapBulananItem[],
  tahun: number,
  instansi: ProfilInstansi
) {
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    [instansi.namaInstansi.toUpperCase()],
    [`LAPORAN REKAPITULASI KAS & ANGGARAN TAHUN ${tahun}`],
    [`Sumber Dana: Dana Yayasan, Dana Orangtua, Dana Sekolah`],
    [`Unit Pengelola: ${instansi.unitPengelola || '-'}`],
    [],
    [
      'Bulan',
      'Saldo Awal (Rp)',
      'Total Penerimaan (Rp)',
      'Dana Yayasan (Rp)',
      'Dana Orangtua (Rp)',
      'Dana Sekolah (Rp)',
      'Total Pengeluaran (Rp)',
      'Gaji Guru/Staf (Rp)',
      'Sarana/ATK (Rp)',
      'Operasional (Rp)',
      'Kesiswaan (Rp)',
      'Saldo Akhir (Rp)'
    ]
  ];

  let sumMasuk = 0;
  let sumKeluar = 0;
  let sumYayasan = 0;
  let sumOrangtua = 0;
  let sumSekolah = 0;
  let sumGaji = 0;
  let sumSarana = 0;
  let sumOps = 0;
  let sumKesiswaan = 0;

  rekapList.forEach((r) => {
    sumMasuk += r.totalPenerimaan;
    sumKeluar += r.totalPengeluaran;
    sumYayasan += r.sumberDanaPenerimaan.yayasan;
    sumOrangtua += r.sumberDanaPenerimaan.orangtua;
    sumSekolah += r.sumberDanaPenerimaan.sekolah;
    sumGaji += r.rincianBelanja.pegawai;
    sumSarana += r.rincianBelanja.barangJasa;
    sumOps += r.rincianBelanja.pemeliharaan;
    sumKesiswaan += r.rincianBelanja.kesiswaan;

    rows.push([
      r.namaBulan,
      r.saldoAwal,
      r.totalPenerimaan,
      r.sumberDanaPenerimaan.yayasan,
      r.sumberDanaPenerimaan.orangtua,
      r.sumberDanaPenerimaan.sekolah,
      r.totalPengeluaran,
      r.rincianBelanja.pegawai,
      r.rincianBelanja.barangJasa,
      r.rincianBelanja.pemeliharaan,
      r.rincianBelanja.kesiswaan,
      r.saldoAkhir
    ]);
  });

  const saldoAkhirTahun = rekapList[rekapList.length - 1]?.saldoAkhir || 0;
  rows.push([]);
  rows.push([
    'TOTAL TAHUNAN',
    rekapList[0]?.saldoAwal || 0,
    sumMasuk,
    sumYayasan,
    sumOrangtua,
    sumSekolah,
    sumKeluar,
    sumGaji,
    sumSarana,
    sumOps,
    sumKesiswaan,
    saldoAkhirTahun
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 18 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Rekap_${tahun}`);
  XLSX.writeFile(wb, `Laporan_Rekapitulasi_Kas_Sekolah_${tahun}.xlsx`);
}

/**
 * Ekspor BKU Kegiatan ke Excel
 */
export function exportBKUKegiatanToExcel(
  kegiatan: KegiatanAnggaran,
  transaksiKegiatan: TransaksiBKU[],
  instansi: ProfilInstansi
) {
  const wb = XLSX.utils.book_new();
  const totalRealisasi = transaksiKegiatan.reduce((acc, t) => acc + (t.jenisTransaksi === 'keluar' ? t.nominal : 0), 0);
  const sisaPagu = kegiatan.paguAnggaran - totalRealisasi;

  const rows: (string | number)[][] = [
    [instansi.namaInstansi.toUpperCase()],
    [`BUKU PEMBANTU KAS KEGIATAN`],
    [`Kegiatan: [${kegiatan.kodeKegiatan}] ${kegiatan.namaKegiatan}`],
    [`Sumber Pembiayaan: ${kegiatan.sumberDana} | Penanggung Jawab: ${kegiatan.penanggungJawab}`],
    [`Pagu Anggaran: ${kegiatan.paguAnggaran} | Realisasi: ${totalRealisasi} | Sisa Pagu: ${sisaPagu}`],
    [],
    ['No', 'Tanggal', 'No. Bukti', 'Uraian Transaksi', 'Penerima', 'Nilai Belanja (Rp)', 'Potongan Pajak (Rp)', 'Metode']
  ];

  transaksiKegiatan.forEach((tx, idx) => {
    rows.push([
      idx + 1,
      formatTanggalIndo(tx.tanggal, { short: true }),
      tx.nomorBukti,
      tx.uraian,
      tx.penerima || '-',
      tx.nominal,
      tx.pajak?.totalPotongan || 0,
      tx.metodePembayaran
    ]);
  });

  rows.push([]);
  rows.push(['', '', '', 'TOTAL REALISASI KEGIATAN', '', totalRealisasi, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 20 },
    { wch: 40 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Kegiatan_${kegiatan.kodeKegiatan}`);
  const sanitizedName = kegiatan.namaKegiatan.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
  XLSX.writeFile(wb, `BKU_Kegiatan_${sanitizedName}.xlsx`);
}

/**
 * Ekspor Seluruh Sub-Kegiatan BKU ke Excel (Multi-tab atau Master Sheet)
 */
export function exportAllBKUKegiatanToExcel(
  kegiatanList: KegiatanAnggaran[],
  allTransaksi: TransaksiBKU[],
  instansi: ProfilInstansi
) {
  const wb = XLSX.utils.book_new();

  // Master Sheet Ringkasan Semua Kegiatan
  const masterRows: (string | number)[][] = [
    [instansi.namaInstansi.toUpperCase()],
    ['LAPORAN KAS PEMBANTU SUB-KEGIATAN (BKU KEGIATAN)'],
    [`Tahun Anggaran ${instansi.tahunAnggaran || 2026}`],
    [],
    [
      'No',
      'Kode Kegiatan',
      'Nama Sub-Kegiatan',
      'Sumber Dana',
      'Penanggung Jawab',
      'Pagu Anggaran (Rp)',
      'Total Realisasi (Rp)',
      'Sisa Pagu (Rp)',
      'Terserap (%)'
    ]
  ];

  let totalPaguAll = 0;
  let totalRealisasiAll = 0;

  kegiatanList.forEach((keg, idx) => {
    const listTx = allTransaksi.filter((t) => {
      const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
      if (!isKeluar) return false;
      return (
        t.kegiatanId === keg.id ||
        (t.kegiatanNama &&
          keg.namaKegiatan &&
          t.kegiatanNama.trim().toLowerCase() === keg.namaKegiatan.trim().toLowerCase())
      );
    });

    const realisasi = listTx.reduce((acc, t) => acc + (Number(t.nominal) || 0), 0);
    const pagu = Number(keg.paguAnggaran) || 0;
    const sisa = pagu - realisasi;
    const persen = pagu > 0 ? ((realisasi / pagu) * 100).toFixed(1) + '%' : '0.0%';

    totalPaguAll += pagu;
    totalRealisasiAll += realisasi;

    masterRows.push([
      idx + 1,
      keg.kodeKegiatan,
      keg.namaKegiatan,
      keg.sumberDana,
      keg.penanggungJawab || '-',
      pagu,
      realisasi,
      sisa,
      persen
    ]);

    // Buat sheet tersendiri untuk rincian kegiatan ini jika ada transaksi
    const kegRows: (string | number)[][] = [
      [instansi.namaInstansi.toUpperCase()],
      [`RINCIAN BELANJA SUB-KEGIATAN [${keg.kodeKegiatan}]`],
      [`Nama Kegiatan: ${keg.namaKegiatan}`],
      [`Sumber Dana: ${keg.sumberDana} | Penanggung Jawab: ${keg.penanggungJawab}`],
      [`Pagu: ${pagu} | Realisasi: ${realisasi} | Sisa: ${sisa}`],
      [],
      ['No', 'Tanggal', 'No. Bukti', 'Uraian Belanja', 'Penerima', 'Nilai Belanja (Rp)', 'Potongan Pajak (Rp)', 'Metode']
    ];

    listTx.forEach((tx, txIdx) => {
      kegRows.push([
        txIdx + 1,
        formatTanggalIndo(tx.tanggal, { short: true }),
        tx.nomorBukti,
        tx.uraian,
        tx.penerima || '-',
        tx.nominal,
        tx.pajak?.totalPotongan || 0,
        tx.metodePembayaran
      ]);
    });

    kegRows.push([]);
    kegRows.push(['', '', '', 'TOTAL REALISASI', '', realisasi, '', '']);

    const wsKeg = XLSX.utils.aoa_to_sheet(kegRows);
    wsKeg['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 20 },
      { wch: 40 },
      { wch: 22 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 }
    ];

    const safeTitle = keg.kodeKegiatan.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 28);
    XLSX.utils.book_append_sheet(wb, wsKeg, safeTitle);
  });

  const totalSisaAll = totalPaguAll - totalRealisasiAll;
  const totalPersenAll =
    totalPaguAll > 0 ? ((totalRealisasiAll / totalPaguAll) * 100).toFixed(1) + '%' : '0.0%';

  masterRows.push([]);
  masterRows.push([
    'TOTAL',
    '',
    'TOTAL SELURUH SUB-KEGIATAN',
    '',
    '',
    totalPaguAll,
    totalRealisasiAll,
    totalSisaAll,
    totalPersenAll
  ]);

  const wsMaster = XLSX.utils.aoa_to_sheet(masterRows);
  wsMaster['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 36 },
    { wch: 18 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 }
  ];

  // Sisipkan sheet Ringkasan di paling depan
  wb.SheetNames.unshift('Rekap_Kegiatan');
  wb.Sheets['Rekap_Kegiatan'] = wsMaster;

  XLSX.writeFile(wb, `BKU_Seluruh_Kegiatan_${instansi.tahunAnggaran || 2026}.xlsx`);
}
