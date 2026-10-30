import * as XLSX from 'xlsx';
import { TransaksiBKU, JenisKas, JenisTransaksi, PosKategori, SumberDana } from '../types';

export interface ParsedImportResult {
  transaksi: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[];
  totalMasuk: number;
  totalKeluar: number;
  detectedTahun?: number;
  detectedBulan?: number[];
  errors: string[];
}

/**
 * Normalisasi tanggal dari berbagai format Excel:
 * - Nomor serial Excel (misal: 45566)
 * - String tanggal Indonesia / umum: "01/09/2026", "2026-09-01", "1 September 2026", "01-Sep-26"
 */
function parseExcelDate(val: any): { isoDate: string; bulan: number; tahun: number } | null {
  if (!val) return null;

  // Jika berupa Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    return {
      isoDate: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
      bulan: m,
      tahun: y
    };
  }

  // Jika berupa Excel serial date number
  if (typeof val === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(val);
    if (parsedDate && parsedDate.y && parsedDate.m && parsedDate.d) {
      return {
        isoDate: `${parsedDate.y}-${parsedDate.m.toString().padStart(2, '0')}-${parsedDate.d.toString().padStart(2, '0')}`,
        bulan: parsedDate.m,
        tahun: parsedDate.y
      };
    }
  }

  // Jika string
  const str = String(val).trim();
  if (!str) return null;

  // Cek format YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    return {
      isoDate: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
      bulan: m,
      tahun: y
    };
  }

  // Cek format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;
    return {
      isoDate: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
      bulan: m,
      tahun: y
    };
  }

  // Cek format DD-Mmm-YY (misal: 01-Sep-26 atau 1 Okt 2026)
  const monthNames: Record<string, number> = {
    jan: 1, januari: 1,
    feb: 2, februari: 2,
    mar: 3, maret: 3,
    apr: 4, april: 4,
    mei: 5, may: 5,
    jun: 6, juni: 6,
    jul: 7, juli: 7,
    agu: 8, ags: 8, agustus: 8, aug: 8,
    sep: 9, september: 9,
    okt: 10, oct: 10, oktober: 10,
    nov: 11, november: 11,
    des: 12, dec: 12, desember: 12
  };

  const textMatch = str.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s-]+(\d{2,4})/);
  if (textMatch) {
    const d = parseInt(textMatch[1], 10);
    const mStr = textMatch[2].toLowerCase();
    let y = parseInt(textMatch[3], 10);
    if (y < 100) y += 2000;
    const m = monthNames[mStr] || monthNames[mStr.substring(0, 3)];
    if (m) {
      return {
        isoDate: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
        bulan: m,
        tahun: y
      };
    }
  }

  // Fallback parsing JS Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    return {
      isoDate: `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`,
      bulan: m,
      tahun: y
    };
  }

  return null;
}

/**
 * Normalisasi nominal angka dari string/number
 */
function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let cleaned = String(val).trim().replace(/Rp/gi, '').replace(/\s+/g, '');
  // Jika format Indonesia: 1.000.000,00 atau 1000000
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.') && !cleaned.includes(',')) {
    // Bisa jadi 1.500.000 atau 1500.50
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1 || /\.\d{3}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalisasi Jenis Kas
 */
function normalizeJenisKas(val: any): { jenisKas: JenisKas; sumberDana: SumberDana } {
  const str = String(val || '').toLowerCase();
  if (str.includes('yayasan')) {
    return { jenisKas: 'Kas Yayasan', sumberDana: 'Dana Yayasan' };
  }
  if (str.includes('orang tua') || str.includes('orangtua') || str.includes('spp') || str.includes('iuran')) {
    return { jenisKas: 'Kas Orang Tua', sumberDana: 'Dana Orangtua' };
  }
  return { jenisKas: 'Kas Sekolah', sumberDana: 'Dana Sekolah' };
}

/**
 * Parser utama untuk file Excel (.xlsx, .xls, .csv)
 */
export async function parseExcelBKUFile(file: File): Promise<ParsedImportResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Berkas Excel kosong atau tidak memiliki lembar kerja (sheet).');
  }

  // Pilih sheet pertama atau sheet bernama "BKU Umum" / "BKU"
  let targetSheetName = workbook.SheetNames[0];
  const bkuSheet = workbook.SheetNames.find((s) => s.toLowerCase().includes('bku') || s.toLowerCase().includes('kas'));
  if (bkuSheet) targetSheetName = bkuSheet;

  const sheet = workbook.Sheets[targetSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawRows.length === 0) {
    throw new Error('Lembar kerja spreadsheet tidak memiliki data baris.');
  }

  // Temukan baris header tabel
  let headerRowIndex = -1;
  let colMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r].map((cell) => String(cell || '').trim().toLowerCase());
    
    // Cari kemunculan kata kunci kolom
    const tglIdx = row.findIndex((c) => c.includes('tanggal') || c.includes('tgl') || c === 'date');
    const uraianIdx = row.findIndex((c) => c.includes('uraian') || c.includes('keterangan') || c.includes('deskripsi'));
    const debetIdx = row.findIndex((c) => c.includes('debet') || c.includes('debit') || c.includes('masuk') || c.includes('penerimaan'));
    const kreditIdx = row.findIndex((c) => c.includes('kredit') || c.includes('keluar') || c.includes('pengeluaran'));

    if ((tglIdx !== -1 && uraianIdx !== -1) || (debetIdx !== -1 && kreditIdx !== -1)) {
      headerRowIndex = r;
      row.forEach((cellText, cIdx) => {
        if (!cellText) return;
        if (cellText.includes('tanggal') || cellText.includes('tgl') || cellText === 'date') colMap['tanggal'] = cIdx;
        else if (cellText.includes('nomor bukti') || cellText.includes('no bukti') || cellText.includes('no. bukti') || cellText === 'bukti') colMap['nomorBukti'] = cIdx;
        else if (cellText === 'transaksi' || cellText === 'jenis' || cellText === 'tipe') colMap['transaksi'] = cIdx;
        else if (cellText.includes('uraian') || cellText.includes('keterangan') || cellText.includes('deskripsi')) colMap['uraian'] = cIdx;
        else if (cellText.includes('kas') || cellText.includes('jenis kas')) colMap['jenisKas'] = cIdx;
        else if (cellText.includes('saldo awal') || cellText.includes('sa')) colMap['saldoAwal'] = cIdx;
        else if (cellText.includes('debet') || cellText.includes('debit') || cellText.includes('masuk') || cellText.includes('penerimaan')) colMap['debet'] = cIdx;
        else if (cellText.includes('kredit') || cellText.includes('keluar') || cellText.includes('pengeluaran')) colMap['kredit'] = cIdx;
        else if (cellText.includes('jumlah') || cellText.includes('saldo') || cellText.includes('total')) colMap['jumlah'] = cIdx;
        else if (cellText.includes('penanggung') || cellText.includes('pj') || cellText.includes('pic')) colMap['penanggungJawab'] = cIdx;
        else if (cellText.includes('penerima') || cellText.includes('rekanan')) colMap['penerima'] = cIdx;
        else if (cellText.includes('kategori') || cellText.includes('pos')) colMap['posKategori'] = cIdx;
        else if (cellText.includes('rekening') || cellText.includes('kode')) colMap['kodeRekening'] = cIdx;
        else if (cellText.includes('kegiatan')) colMap['kegiatanNama'] = cIdx;
      });
      break;
    }
  }

  // Jika tidak ditemukan header baris standar, gunakan fallback kolom posisi lazim
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colMap = {
      tanggal: 1,
      transaksi: 2,
      uraian: 3,
      jenisKas: 4,
      debet: 6,
      kredit: 7,
      jumlah: 8
    };
  }

  const resultItems: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: string[] = [];
  let totalMasuk = 0;
  let totalKeluar = 0;
  const detectedBulanSet = new Set<number>();
  let detectedTahun = 2026;

  // Baca baris data setelah header
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawTanggal = colMap['tanggal'] !== undefined ? row[colMap['tanggal']] : row[1];
    const rawUraian = colMap['uraian'] !== undefined ? row[colMap['uraian']] : row[3];
    const rawTransaksiType = colMap['transaksi'] !== undefined ? String(row[colMap['transaksi']] || '').trim() : '';
    const rawDebet = colMap['debet'] !== undefined ? row[colMap['debet']] : 0;
    const rawKredit = colMap['kredit'] !== undefined ? row[colMap['kredit']] : 0;
    const rawKas = colMap['jenisKas'] !== undefined ? row[colMap['jenisKas']] : '';
    const rawBukti = colMap['nomorBukti'] !== undefined ? String(row[colMap['nomorBukti']] || '').trim() : '';
    const rawPJ = colMap['penanggungJawab'] !== undefined ? String(row[colMap['penanggungJawab']] || '').trim() : '';
    const rawPenerima = colMap['penerima'] !== undefined ? String(row[colMap['penerima']] || '').trim() : '';

    const uraianStr = String(rawUraian || '').trim();

    // Lewati baris kosong atau baris rekapitulasi/total/saldo awal
    if (!uraianStr && !rawTanggal) continue;
    if (
      uraianStr.toLowerCase() === 'saldo awal' ||
      rawTransaksiType.toLowerCase() === 'sa' ||
      uraianStr.toLowerCase().startsWith('total') ||
      uraianStr.toLowerCase().startsWith('jumlah') ||
      uraianStr.toLowerCase().startsWith('rekap')
    ) {
      continue;
    }

    const dateInfo = parseExcelDate(rawTanggal);
    if (!dateInfo) {
      // Jika baris ada uraian tapi tanggal tidak terbaca, catat jika relevan
      if (uraianStr.length > 3) {
        errors.push(`Baris ${r + 1}: Tanggal "${rawTanggal}" tidak dapat diuraikan.`);
      }
      continue;
    }

    detectedBulanSet.add(dateInfo.bulan);
    detectedTahun = dateInfo.tahun;

    const debetVal = parseNumber(rawDebet);
    const kreditVal = parseNumber(rawKredit);

    let jenis: 'Masuk' | 'Keluar' = 'Keluar';
    let nominal = 0;

    if (debetVal > 0 && kreditVal === 0) {
      jenis = 'Masuk';
      nominal = debetVal;
    } else if (kreditVal > 0 && debetVal === 0) {
      jenis = 'Keluar';
      nominal = kreditVal;
    } else if (rawTransaksiType.toLowerCase().includes('masuk') || rawTransaksiType.toLowerCase().includes('trm')) {
      jenis = 'Masuk';
      nominal = debetVal || kreditVal || 0;
    } else {
      jenis = 'Keluar';
      nominal = kreditVal || debetVal || 0;
    }

    if (nominal <= 0) {
      // Abaikan baris nol jika bukan transaksi nyata
      continue;
    }

    if (jenis === 'Masuk') totalMasuk += nominal;
    else totalKeluar += nominal;

    const { jenisKas, sumberDana } = normalizeJenisKas(rawKas);

    const txItem: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'> = {
      tanggal: dateInfo.isoDate,
      bulan: dateInfo.bulan,
      tahun: dateInfo.tahun,
      nomorBukti: rawBukti || `${(resultItems.length + 1).toString().padStart(3, '0')}/BKU-${jenis === 'Masuk' ? 'TRM' : 'KAS'}/${dateInfo.bulan}/${dateInfo.tahun}`,
      uraian: uraianStr || `Transaksi kas ${jenis.toLowerCase()}`,
      kodeRekening: colMap['kodeRekening'] !== undefined ? String(row[colMap['kodeRekening']] || '') : (jenis === 'Masuk' ? '1.1.03' : '5.1.02'),
      posKategori: (colMap['posKategori'] !== undefined ? row[colMap['posKategori']] : (jenis === 'Masuk' ? 'Penerimaan Dana Sekolah (Mandiri/Unit Usaha)' : 'Belanja Sarana Belajar & ATK')) as PosKategori,
      sumberDana,
      jenisKas,
      jenisTransaksi: jenis,
      metodePembayaran: 'Tunai',
      nominal,
      penerima: rawPenerima || 'SD ISLAM AL HIJRAH',
      penanggungJawab: rawPJ || undefined,
      kegiatanNama: colMap['kegiatanNama'] !== undefined ? String(row[colMap['kegiatanNama']] || '') : undefined
    };

    resultItems.push(txItem);
  }

  return {
    transaksi: resultItems,
    totalMasuk,
    totalKeluar,
    detectedTahun,
    detectedBulan: Array.from(detectedBulanSet).sort((a, b) => a - b),
    errors
  };
}
