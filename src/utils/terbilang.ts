/**
 * Utility konversi angka nominal Rupiah menjadi kata baku bahasa Indonesia (Terbilang)
 * Standar tata persuratan dan administrasi keuangan bendahara instansi/sekolah.
 */

const BILANGAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas'
];

function angkaDasar(nilai: number): string {
  nilai = Math.floor(nilai);
  if (nilai < 12) {
    return BILANGAN[nilai];
  } else if (nilai < 20) {
    return angkaDasar(nilai - 10) + ' Belas';
  } else if (nilai < 100) {
    const sisa = nilai % 10;
    return angkaDasar(Math.floor(nilai / 10)) + ' Puluh' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  } else if (nilai < 200) {
    const sisa = nilai - 100;
    return 'Seratus' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  } else if (nilai < 1000) {
    const sisa = nilai % 100;
    return angkaDasar(Math.floor(nilai / 100)) + ' Ratus' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  } else if (nilai < 2000) {
    const sisa = nilai - 1000;
    return 'Seribu' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  } else if (nilai < 1000000) {
    const ribuan = Math.floor(nilai / 1000);
    const sisa = nilai % 1000;
    return angkaDasar(ribuan) + ' Ribu' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  } else if (nilai < 1000000000) {
    const jutaan = Math.floor(nilai / 1000000);
    const sisa = nilai % 1000000;
    return angkaDasar(jutaan) + ' Juta' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  } else if (nilai < 1000000000000) {
    const miliaran = Math.floor(nilai / 1000000000);
    const sisa = nilai % 1000000000;
    return angkaDasar(miliaran) + ' Miliar' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  } else if (nilai < 1000000000000000) {
    const triliunan = Math.floor(nilai / 1000000000000);
    const sisa = nilai % 1000000000000;
    return angkaDasar(triliunan) + ' Triliun' + (sisa > 0 ? ' ' + angkaDasar(sisa) : '');
  }
  return nilai.toString();
}

/**
 * Mengubah nominal rupiah menjadi teks terbilang resmi.
 * Contoh: 831000 -> "Delapan Ratus Tiga Puluh Satu Ribu Rupiah"
 */
export function terbilangRupiah(nominal: number): string {
  if (!nominal || isNaN(nominal) || nominal === 0) {
    return 'Nol Rupiah';
  }
  const absolut = Math.abs(nominal);
  const hasil = angkaDasar(absolut).trim();
  const awalan = nominal < 0 ? 'Minus ' : '';
  return `${awalan}${hasil} Rupiah`;
}

/**
 * Format tanggal formal bahasa Indonesia untuk lembar pengesahan
 * Contoh: "2026-10-14" -> "14 Oktober 2026"
 */
export function formatTanggalFormal(tanggalStr?: string): string {
  if (!tanggalStr) return '';
  const parts = tanggalStr.split('-');
  if (parts.length < 3) return tanggalStr;
  const thn = parts[0];
  const blnIndex = parseInt(parts[1], 10) - 1;
  const tgl = parseInt(parts[2], 10);

  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return `${tgl} ${namaBulan[blnIndex] || ''} ${thn}`;
}
