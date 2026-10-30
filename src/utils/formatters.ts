export const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const NAMA_BULAN_PENDEK = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Format angka ke format Rupiah dengan pemisah ribuan titik (.)
 * Contoh: 300000 -> "300.000" atau "Rp 300.000"
 */
export function formatRupiah(amount: number | null | undefined, withPrefix: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return withPrefix ? 'Rp 0' : '0';
  }
  const isNegative = amount < 0;
  const absVal = Math.round(Math.abs(amount));
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  const sign = isNegative ? '-' : '';
  if (withPrefix) {
    return `${sign}Rp ${formatted}`;
  }
  return `${sign}${formatted}`;
}

/**
 * Mengubah string format Rupiah berpemisah titik menjadi angka murni
 * Contoh: "300.000" -> 300000, "Rp 1.500.000" -> 1500000
 */
export function parseRupiah(raw: string): number {
  if (!raw) return 0;
  // Hapus semua karakter kecuali angka dan minus di depan
  const isNeg = raw.trim().startsWith('-');
  const cleaned = raw.replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  const num = parseInt(cleaned, 10);
  return isNeg ? -num : num;
}

/**
 * Konversi angka ke kata Terbilang Bahasa Indonesia
 * Sangat penting bagi bendahara untuk memverifikasi digit nominal (mencegah salah ketik nol)
 * Contoh: 300000 -> "Tiga Ratus Ribu Rupiah"
 * Contoh: 1545000 -> "Satu Juta Lima Ratus Empat Puluh Lima Ribu Rupiah"
 */
export function angkaKeTerbilang(angka: number): string {
  if (isNaN(angka) || angka === 0) return 'Nol Rupiah';
  if (angka < 0) return `Minus ${angkaKeTerbilang(Math.abs(angka))}`;

  const satuan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];

  function bilang(n: number): string {
    let hasil = '';
    n = Math.floor(n);

    if (n < 12) {
      hasil = satuan[n];
    } else if (n < 20) {
      hasil = `${bilang(n - 10)} Belas`;
    } else if (n < 100) {
      hasil = `${bilang(Math.floor(n / 10))} Puluh ${bilang(n % 10)}`;
    } else if (n < 200) {
      hasil = `Seratus ${bilang(n - 100)}`;
    } else if (n < 1000) {
      hasil = `${bilang(Math.floor(n / 100))} Ratus ${bilang(n % 100)}`;
    } else if (n < 2000) {
      hasil = `Seribu ${bilang(n - 1000)}`;
    } else if (n < 1000000) {
      hasil = `${bilang(Math.floor(n / 1000))} Ribu ${bilang(n % 1000)}`;
    } else if (n < 1000000000) {
      hasil = `${bilang(Math.floor(n / 1000000))} Juta ${bilang(n % 1000000)}`;
    } else if (n < 1000000000000) {
      hasil = `${bilang(Math.floor(n / 1000000000))} Miliar ${bilang(n % 1000000000)}`;
    } else if (n < 1000000000000000) {
      hasil = `${bilang(Math.floor(n / 1000000000000))} Triliun ${bilang(n % 1000000000000)}`;
    }
    return hasil.replace(/\s+/g, ' ').trim();
  }

  const teks = bilang(angka);
  return `${teks} Rupiah`;
}

/**
 * Format tanggal YYYY-MM-DD ke format Indonesia (e.g. 26 Oktober 2026 atau 26/10/2026)
 */
export function formatTanggalIndo(dateStr: string, options: { short?: boolean; withDay?: boolean } = {}): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const tahun = parseInt(parts[0], 10);
  const bulan = parseInt(parts[1], 10) - 1;
  const tgl = parseInt(parts[2], 10);

  if (options.short) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(tgl)}/${pad(bulan + 1)}/${tahun}`;
  }

  const namaBln = NAMA_BULAN[bulan] || '';
  return `${tgl} ${namaBln} ${tahun}`;
}

/**
 * Format tanggal khusus BKU seperti pada gambar (e.g. 1-Sep-26)
 */
export function formatTanggalBKU(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const tahun = parts[0].slice(-2);
  const bulan = parseInt(parts[1], 10) - 1;
  const tgl = parseInt(parts[2], 10);

  const namaBln = NAMA_BULAN_PENDEK[bulan] || '';
  return `${tgl}-${namaBln}-${tahun}`;
}

/**
 * Mengubah angka Romawi untuk nomor surat/bukti (e.g. bulan 10 -> X)
 */
export function angkaKeRomawi(num: number): string {
  const lookup: { [key: string]: number } = {
    M: 1000, CM: 900, D: 500, CD: 400,
    C: 100, XC: 90, L: 50, XL: 40,
    X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let roman = '';
  for (const i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}
