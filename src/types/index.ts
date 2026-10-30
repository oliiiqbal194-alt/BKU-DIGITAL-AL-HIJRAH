export type JenisTransaksi = 'Masuk' | 'Keluar' | 'SA' | 'masuk' | 'keluar';
export type MetodePembayaran = 'Tunai' | 'Bank / Non-Tunai';

export type JenisKas = 'Kas Sekolah' | 'Kas Yayasan' | 'Kas Orang Tua';
export type SumberDana = 'Dana Yayasan' | 'Dana Orangtua' | 'Dana Sekolah';

export type PosKategori = 
  | 'Penerimaan Dana Yayasan'
  | 'Penerimaan Dana Orangtua (SPP/Iuran)'
  | 'Penerimaan Dana Sekolah (Mandiri/Unit Usaha)'
  | 'Gaji & Honorarium Guru / Karyawan'
  | 'Belanja Sarana Belajar & ATK'
  | 'Belanja Modal & Fasilitas'
  | 'Operasional (Listrik, Air, Wifi)'
  | 'Kegiatan Kesiswaan & Ekstrakurikuler'
  | 'Pajak & Administrasi Bank'
  | 'Lain-lain';

export interface PajakDetail {
  ppnPersen?: number;
  ppnNominal?: number;
  pph21Persen?: number;
  pph21Nominal?: number;
  pph22Persen?: number;
  pph22Nominal?: number;
  pph23Persen?: number;
  pph23Nominal?: number;
  totalPotongan: number;
}

export interface FileLampiran {
  id: string;
  nama: string;
  ukuran: string;
  tipe: string;
  dataUrl?: string;
}

export interface TransaksiBKU {
  id: string;
  tanggal: string; // YYYY-MM-DD
  bulan: number; // 1 - 12
  tahun: number;
  nomorBukti: string; // e.g. 001/BKU-KAS/IX/2026
  uraian: string;
  kodeRekening?: string;
  posKategori?: PosKategori;
  sumberDana?: SumberDana; // Dana Yayasan | Dana Orangtua | Dana Sekolah
  jenisKas: JenisKas; // "Kas Sekolah" | "Kas Yayasan" | "Kas Orang Tua"
  jenisTransaksi: JenisTransaksi; // "Masuk" | "Keluar" | "SA"
  metodePembayaran: MetodePembayaran;
  nominal: number; // nilai nominal kotor / bruto
  kegiatanId?: string; // relasi ke BKU Kegiatan
  kegiatanNama?: string;
  penerima?: string; // pihak penerima / penyedia
  penanggungJawab?: string; // nama penanggung jawab transaksi
  pajak?: PajakDetail;
  lampiran?: FileLampiran[];
  catatan?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KegiatanAnggaran {
  id: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  penanggungJawab: string;
  paguAnggaran: number;
  sumberDana: SumberDana;
  tahun: number;
  targetWaktu?: string;
  deskripsi?: string;
  createdAt: string;
}

export interface ProfilInstansi {
  namaInstansi: string; // e.g. "SD ISLAM AL HIJRAH GORONTALO"
  tahunAjaran: string; // e.g. "T.A 2026 / 2027"
  unitPengelola: string;
  alamat: string;
  telepon: string;
  email: string;
  namaKepala: string;
  nipKepala: string;
  jabatanKepala: string;
  namaBendahara: string;
  nipBendahara: string;
  jabatanBendahara: string;
  kotaTandaTangan: string;
  tahunAnggaran: number;
  saldoAwalTahun: number; // Saldo awal per 1 Januari
  saldoAwalBulanCustom?: Record<number, number>; // Penyesuaian Saldo Awal per Bulan (1-12)
  nomorRekeningBank: string;
  namaBank: string;
  logoUrl?: string;
}

export interface EnkripsiStatus {
  isEncrypted: boolean;
  hasCustomKey: boolean;
  lastEncryptedAt?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export interface RekapBulananItem {
  bulan: number;
  namaBulan: string;
  saldoAwal: number;
  totalPenerimaan: number;
  totalPengeluaran: number;
  saldoAkhir: number;
  sumberDanaPenerimaan: {
    yayasan: number;
    orangtua: number;
    sekolah: number;
  };
  rincianBelanja: {
    pegawai: number;
    barangJasa: number;
    modal: number;
    pemeliharaan: number;
    kesiswaan: number;
    pajak: number;
    lainnya: number;
  };
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
  status?: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

