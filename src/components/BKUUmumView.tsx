import React, { useState } from 'react';
import { useBKU } from '../context/BKUContext';
import { ReceiptViewerModal } from './ReceiptViewerModal';
import { LPJTransactionModal } from './LPJTransactionModal';
import { EditSaldoAwalModal } from './EditSaldoAwalModal';
import { DatabaseImportModal } from './DatabaseImportModal';
import {
  NAMA_BULAN,
  formatRupiah,
  formatTanggalIndo,
  formatTanggalBKU
} from '../utils/formatters';
import { exportBKUUmumToExcel } from '../utils/excelExport';
import { TransaksiBKU, SumberDana } from '../types';
import {
  Calendar,
  Search,
  Filter,
  Plus,
  Printer,
  FileSpreadsheet,
  FileText,
  Trash2,
  Edit2,
  Paperclip,
  Receipt,
  Eye,
  X,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building,
  Database,
  Upload,
  RefreshCw,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';

interface BKUUmumViewProps {
  onOpenNewTransaction: () => void;
  onOpenBatchModal: () => void;
  onEditTransaction: (tx: TransaksiBKU) => void;
  onOpenPrintPreview: (bulan: number) => void;
}

export const BKUUmumView: React.FC<BKUUmumViewProps> = ({
  onOpenNewTransaction,
  onOpenBatchModal,
  onEditTransaction,
  onOpenPrintPreview
}) => {
  const {
    selectedBulan,
    setSelectedBulan,
    selectedTahun,
    setSelectedTahun,
    getTransaksiBulan,
    getSaldoAwalBulan,
    getSaldoAkhirBulan,
    isCustomSaldoAwalBulan,
    deleteTransaksi,
    purgeMonthTransaksi,
    instansi,
    loadSampleTemplate
  } = useBKU();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSumberDana, setFilterSumberDana] = useState<string>('all');
  const [filterKategori, setFilterKategori] = useState<string>('all');
  const [filterMetode, setFilterMetode] = useState<string>('all');
  const [filterAlokasi, setFilterAlokasi] = useState<string>('all');
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<TransaksiBKU | null>(null);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<TransaksiBKU | null>(null);
  const [selectedTxForLPJ, setSelectedTxForLPJ] = useState<TransaksiBKU | null>(null);
  const [txToDelete, setTxToDelete] = useState<TransaksiBKU | null>(null);
  const [isEditSaldoAwalOpen, setIsEditSaldoAwalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [showPurgeMonthConfirm, setShowPurgeMonthConfirm] = useState<boolean>(false);
  const [isPurgingMonth, setIsPurgingMonth] = useState<boolean>(false);

  const namaBulan = NAMA_BULAN[selectedBulan - 1] || '';
  const transaksiList = getTransaksiBulan(selectedBulan);
  const saldoAwal = getSaldoAwalBulan(selectedBulan);

  // Hitung running balances dan breakdown per sumber dana
  let runningSaldo = saldoAwal;
  let totalMasukBulan = 0;
  let totalKeluarBulan = 0;
  let masukYayasan = 0;
  let masukOrangtua = 0;
  let masukSekolah = 0;

  const processedRows = transaksiList.map((tx, idx) => {
    const isMasuk = tx.jenisTransaksi === 'masuk' || tx.jenisTransaksi === 'Masuk';
    const isKeluar = tx.jenisTransaksi === 'keluar' || tx.jenisTransaksi === 'Keluar';
    const masuk = isMasuk ? tx.nominal : 0;
    const keluar = isKeluar ? tx.nominal : 0;
    runningSaldo = runningSaldo + masuk - keluar;
    totalMasukBulan += masuk;
    totalKeluarBulan += keluar;

    if (isMasuk) {
      if (tx.jenisKas === 'Kas Yayasan' || tx.sumberDana === 'Dana Yayasan') masukYayasan += tx.nominal;
      else if (tx.jenisKas === 'Kas Orang Tua' || tx.sumberDana === 'Dana Orangtua') masukOrangtua += tx.nominal;
      else masukSekolah += tx.nominal;
    }

    return {
      tx,
      noUrut: idx + 2, // No 1 khusus untuk Saldo Awal baris pertama
      masuk,
      keluar,
      saldo: runningSaldo
    };
  });

  const saldoAkhir = runningSaldo;

  // Filter Search & Sumber Dana & Alokasi BKU Kegiatan
  const filteredRows = processedRows.filter(({ tx }) => {
    const q = searchQuery.toLowerCase();
    const matchQuery =
      !q ||
      tx.uraian.toLowerCase().includes(q) ||
      tx.nomorBukti.toLowerCase().includes(q) ||
      (tx.penerima && tx.penerima.toLowerCase().includes(q)) ||
      (tx.kegiatanNama && tx.kegiatanNama.toLowerCase().includes(q)) ||
      (tx.kodeRekening && tx.kodeRekening.toLowerCase().includes(q));

    const matchSumberDana = filterSumberDana === 'all' || tx.sumberDana === filterSumberDana;
    const matchKategori = filterKategori === 'all' || tx.posKategori === filterKategori;
    const matchMetode = filterMetode === 'all' || tx.metodePembayaran === filterMetode;

    const hasKeg = Boolean(tx.kegiatanId || (tx.kegiatanNama && tx.kegiatanNama.trim().length > 0));
    const matchAlokasi =
      filterAlokasi === 'all' ||
      (filterAlokasi === 'kegiatan' && hasKeg) ||
      (filterAlokasi === 'umum' && !hasKeg);

    return matchQuery && matchSumberDana && matchKategori && matchMetode && matchAlokasi;
  });

  const handleExportExcel = () => {
    exportBKUUmumToExcel(transaksiList, saldoAwal, selectedBulan, selectedTahun, instansi);
  };

  const confirmDelete = async () => {
    if (txToDelete) {
      await deleteTransaksi(txToDelete.id);
      setTxToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Buku Kas Umum (BKU) Sekolah & Yayasan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pencatatan kas mandiri khusus Dana Yayasan, Dana Orangtua (SPP/Iuran), dan Dana Sekolah.
          </p>
        </div>

        {/* Toolbar & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year select */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Tahun:</span>
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(parseInt(e.target.value, 10))}
              className="bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Unggah file Excel (.xlsx / .csv) atau Cadangan Vault (.json / .bku)"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-200" />
            <span>Unggah Database</span>
          </button>

          <button
            type="button"
            onClick={onOpenBatchModal}
            className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-slate-600" />
            <span>Form Input Cepat</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white hover:bg-emerald-50 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Unduh</span> Excel
          </button>

          <button
            type="button"
            onClick={() => onOpenPrintPreview(selectedBulan)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak / PDF</span>
          </button>

          {transaksiList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPurgeMonthConfirm(true)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
              title={`Kosongkan transaksi bulan ${namaBulan} ini`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 12-Month Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs overflow-x-auto">
        <div className="flex items-center min-w-max gap-1">
          {NAMA_BULAN.map((nama, idx) => {
            const bulanNum = idx + 1;
            const isSelected = selectedBulan === bulanNum;
            const txCount = getTransaksiBulan(bulanNum).length;

            return (
              <button
                key={bulanNum}
                type="button"
                onClick={() => setSelectedBulan(bulanNum)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{nama}</span>
                {txCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-slate-800 text-emerald-400' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {txCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards with Source Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Saldo Awal */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Saldo Awal Bulan</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
            {formatRupiah(saldoAwal, true)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Bawaan dari akhir {selectedBulan === 1 ? 'tahun lalu' : NAMA_BULAN[selectedBulan - 2]}
          </p>
        </div>

        {/* Total Penerimaan */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Penerimaan (Debet)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono text-emerald-700 tabular-nums">
            {formatRupiah(totalMasukBulan, true)}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 truncate">
            <span>Yys: {formatRupiah(masukYayasan, false)}</span>
            <span>·</span>
            <span>Ortu: {formatRupiah(masukOrangtua, false)}</span>
          </div>
        </div>

        {/* Total Pengeluaran */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Pengeluaran (Kredit)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono text-rose-700 tabular-nums">
            {formatRupiah(totalKeluarBulan, true)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Total belanja kas di {namaBulan}
          </p>
        </div>

        {/* Sisa Saldo Akhir */}
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-300 mb-1">
            <span className="text-xs font-medium">Saldo Kas Akhir Bulan</span>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg sm:text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {formatRupiah(saldoAkhir, true)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Posisi kas riil per akhir {namaBulan}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari uraian transaksi, nomor bukti, rekanan, atau kode rekening..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter Sumber Dana (Yayasan, Orangtua, Sekolah) */}
          <select
            value={filterSumberDana}
            onChange={(e) => setFilterSumberDana(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">Semua Sumber Dana</option>
            <option value="Dana Yayasan">Dana Yayasan</option>
            <option value="Dana Orangtua">Dana Orangtua</option>
            <option value="Dana Sekolah">Dana Sekolah</option>
          </select>

          {/* Filter Pos Kategori */}
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">Semua Pos Kas</option>
            <option value="Penerimaan Dana Yayasan">Penerimaan Dana Yayasan</option>
            <option value="Penerimaan Dana Orangtua (SPP/Iuran)">Penerimaan Dana Orangtua</option>
            <option value="Penerimaan Dana Sekolah (Mandiri/Unit Usaha)">Penerimaan Dana Sekolah</option>
            <option value="Gaji & Honorarium Guru / Karyawan">Gaji & Honor Guru/Staf</option>
            <option value="Belanja Sarana Belajar & ATK">Sarana Belajar & ATK</option>
            <option value="Belanja Modal & Fasilitas">Belanja Modal & Fasilitas</option>
            <option value="Operasional (Listrik, Air, Wifi)">Operasional (Listrik, Wifi)</option>
            <option value="Kegiatan Kesiswaan & Ekstrakurikuler">Kesiswaan & Ekskul</option>
            <option value="Pajak & Administrasi Bank">Pajak & Administrasi</option>
          </select>

          {/* Filter Metode */}
          <select
            value={filterMetode}
            onChange={(e) => setFilterMetode(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">Semua Cara Bayar</option>
            <option value="Tunai">Kas Tunai</option>
            <option value="Bank / Non-Tunai">Transfer Bank</option>
          </select>

          {/* Filter Alokasi BKU Kegiatan */}
          <select
            value={filterAlokasi}
            onChange={(e) => setFilterAlokasi(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600"
          >
            <option value="all">Semua Jenis Belanja</option>
            <option value="kegiatan">Belanja Ber-Kegiatan (BKU Kegiatan)</option>
            <option value="umum">Belanja Operasional Rutin</option>
          </select>
        </div>
      </div>

      {/* Main Ledger Table or Modern Empty State */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {transaksiList.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-6 text-center max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
              <FileText className="w-7 h-7 text-slate-400 stroke-1" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Belum Ada Transaksi di Bulan {namaBulan} {selectedTahun}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Buku Kas Umum untuk bulan ini masih kosong. Catat transaksi kas pertama dari Dana Yayasan, Dana Orangtua (SPP), atau Dana Sekolah.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-200" />
                <span>Unggah Database (Excel / JSON)</span>
              </button>
              <button
                type="button"
                onClick={onOpenNewTransaction}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Transaksi Baru</span>
              </button>
              <button
                type="button"
                onClick={loadSampleTemplate}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors"
                title="Muat contoh format simulasi sekolah & yayasan"
              >
                Muat Contoh Simulasi
              </button>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-xs text-slate-500">
              Tidak ditemukan transaksi yang cocok dengan kata kunci atau filter sumber dana tersebut.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterSumberDana('all');
                setFilterKategori('all');
                setFilterMetode('all');
              }}
              className="mt-3 text-xs text-emerald-700 font-semibold hover:underline"
            >
              Reset Filter Pencarian
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header Instansi & Periode persis format spreadsheet */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black tracking-wider text-slate-950 uppercase font-sans">
                  BUKU KAS UMUM
                </h2>
                <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
                  {instansi.namaInstansi || 'SD ISLAM AL HIJRAH GORONTALO'}
                </h3>
                <p className="text-xs font-semibold text-slate-600 font-mono">
                  {instansi.tahunAjaran || 'T.A 2026 / 2027'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="inline-block px-3 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-slate-900 uppercase shadow-xs">
                  PERIODE {namaBulan.toUpperCase()} {selectedTahun}
                </div>
              </div>
            </div>

            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-left">
                  <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200">No</th>
                  <th className="py-2.5 px-3 w-24 border-r border-slate-200">Tanggal</th>
                  <th className="py-2.5 px-3 w-24 text-center border-r border-slate-200">Transaksi</th>
                  <th className="py-2.5 px-4 min-w-[260px] border-r border-slate-200">Uraian</th>
                  <th className="py-2.5 px-3 w-28 border-r border-slate-200">Jenis KAS</th>
                  <th className="py-2.5 px-3 w-32 text-right border-r border-slate-200">Saldo Awal</th>
                  <th className="py-2.5 px-3 w-32 text-right border-r border-slate-200">Debet</th>
                  <th className="py-2.5 px-3 w-32 text-right border-r border-slate-200">Kredit</th>
                  <th className="py-2.5 px-3 w-32 text-right border-r border-slate-200">Jumlah</th>
                  <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Baris Saldo Awal (Row 1 persis di gambar) */}
                <tr className="bg-slate-50/70 font-semibold border-b border-slate-200">
                  <td className="py-2.5 px-3 text-center text-slate-500 font-mono border-r border-slate-200">1</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {formatTanggalBKU(`${selectedTahun}-${selectedBulan.toString().padStart(2, '0')}-01`)}
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-mono font-bold text-[11px]">
                      SA
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-200">
                    <div className="flex items-center gap-2">
                      <span>Saldo Awal</span>
                      {isCustomSaldoAwalBulan(selectedBulan) && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-semibold">
                          Disesuaikan
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    Kas Sekolah
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200 tabular-nums whitespace-nowrap">
                    {formatRupiah(saldoAwal, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400 border-r border-slate-200">-</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400 border-r border-slate-200">-</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200 tabular-nums whitespace-nowrap">
                    {formatRupiah(saldoAwal, true)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => setIsEditSaldoAwalOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-300 transition-colors cursor-pointer"
                      title="Ubah atau sesuaikan saldo awal bulan ini"
                    >
                      <Edit2 className="w-3 h-3 text-emerald-600" />
                      <span>Ubah</span>
                    </button>
                  </td>
                </tr>

                {filteredRows.map(({ tx, noUrut, masuk, keluar, saldo }) => {
                  const isMasuk = tx.jenisTransaksi === 'masuk' || tx.jenisTransaksi === 'Masuk';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 border-r border-slate-100">{noUrut}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap border-r border-slate-100">
                        {formatTanggalBKU(tx.tanggal)}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-100 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                          isMasuk
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isMasuk ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-100">
                        <div className="font-medium text-slate-900">
                          {tx.uraian}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                          <span className="font-mono text-slate-400">{tx.nomorBukti}</span>
                          {tx.kegiatanNama ? (
                            <span className="px-1.5 py-0.2 rounded font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
                              BKU Kegiatan: {tx.kegiatanNama}
                            </span>
                          ) : (
                            !isMasuk && (
                              <span className="px-1.5 py-0.2 rounded font-medium text-slate-500 bg-slate-100">
                                Belanja Rutin Umum
                              </span>
                            )
                          )}
                          {tx.penerima && (
                            <span className="text-slate-400">· {tx.penerima}</span>
                          )}
                          {tx.penanggungJawab && (
                            <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              PJ: {tx.penanggungJawab}
                            </span>
                          )}
                          {tx.lampiran && tx.lampiran.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTxForReceipt(tx);
                              }}
                              className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-900 font-semibold bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                              title="Klik untuk melihat foto kwitansi/nota"
                            >
                              <Paperclip className="w-3 h-3 text-emerald-600" />
                              <span>{tx.lampiran.length} Foto Nota</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTxForLPJ(tx);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                            title="Unduh / Cetak Dokumen LPJ (Kwitansi & Lampiran Nota)"
                          >
                            <FileText className="w-3 h-3 text-emerald-700" />
                            <span>Unduh LPJ</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-100 text-slate-700">
                        {tx.jenisKas || 'Kas Sekolah'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300 border-r border-slate-100">-</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 border-r border-slate-100 tabular-nums whitespace-nowrap">
                        {masuk > 0 ? formatRupiah(masuk, true) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700 border-r border-slate-100 tabular-nums whitespace-nowrap">
                        {keluar > 0 ? formatRupiah(keluar, true) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-100 tabular-nums whitespace-nowrap">
                        {formatRupiah(saldo, true)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedTxForLPJ(tx)}
                            className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors"
                            title="Unduh / Cetak LPJ (Kwitansi & Nota)"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-700" />
                          </button>
                          {tx.lampiran && tx.lampiran.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedTxForReceipt(tx)}
                              className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                              title="Lihat Foto Kwitansi Nota"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedTxForDetail(tx)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                            title="Lihat Detail Transaksi"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 text-slate-400 hover:text-emerald-700 rounded transition-colors"
                            title="Ubah Transaksi"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTxToDelete(tx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-right border-r border-slate-300 font-bold">
                    TOTAL PERIODE {namaBulan.toUpperCase()} {selectedTahun}:
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-950 tabular-nums border-r border-slate-300">
                    {formatRupiah(saldoAwal, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-800 tabular-nums border-r border-slate-300">
                    {formatRupiah(totalMasukBulan, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-800 tabular-nums border-r border-slate-300">
                    {formatRupiah(totalKeluarBulan, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-950 tabular-nums border-r border-slate-300 bg-emerald-50/60">
                    {formatRupiah(saldoAkhir, true)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Transaksi & Lampiran Bukti */}
      {selectedTxForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Rincian Bukti Transaksi Kas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] text-slate-500 font-medium">Nominal Transaksi</p>
                <p className="text-2xl font-bold font-mono text-slate-950 mt-0.5">
                  {formatRupiah(selectedTxForDetail.nominal, true)}
                </p>
                <p className="text-xs text-slate-600 italic mt-1 font-sans">
                  "{selectedTxForDetail.nominal > 0 ? formatRupiah(selectedTxForDetail.nominal) : 'Nol'} Rupiah"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[11px]">Nomor Bukti</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedTxForDetail.nomorBukti}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Tanggal Transaksi</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatTanggalIndo(selectedTxForDetail.tanggal)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Sumber Dana</span>
                  <span className="font-semibold text-slate-900">
                    {selectedTxForDetail.sumberDana || 'Dana Sekolah'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Arus Kas</span>
                  <span className={`font-semibold ${selectedTxForDetail.jenisTransaksi === 'masuk' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {selectedTxForDetail.jenisTransaksi === 'masuk' ? 'Penerimaan (Debet)' : 'Pengeluaran (Kredit)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Metode Pembayaran</span>
                  <span className="font-medium text-slate-900">{selectedTxForDetail.metodePembayaran}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Kode Rekening</span>
                  <span className="font-mono text-slate-900">{selectedTxForDetail.kodeRekening || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">Pos Kategori</span>
                  <span className="font-medium text-slate-900">{selectedTxForDetail.posKategori}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-1">Uraian Transaksi</span>
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed">
                  {selectedTxForDetail.uraian}
                </p>
              </div>

              {selectedTxForDetail.penerima && (
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">Penerima / Pihak Terkait</span>
                  <p className="font-medium text-slate-900">{selectedTxForDetail.penerima}</p>
                </div>
              )}

              {/* Rincian Pajak jika ada */}
              {selectedTxForDetail.pajak && selectedTxForDetail.pajak.totalPotongan > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1">
                  <span className="font-bold text-amber-900 block">Potongan Pajak / Administrasi:</span>
                  <div className="flex justify-between text-slate-700 font-mono text-[11px]">
                    <span>Total Potongan:</span>
                    <span className="font-bold text-rose-700">
                      {formatRupiah(selectedTxForDetail.pajak.totalPotongan, true)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700 font-mono text-[11px]">
                    <span>Diterima Bersih:</span>
                    <span className="font-bold text-emerald-800">
                      {formatRupiah(selectedTxForDetail.nominal - selectedTxForDetail.pajak.totalPotongan, true)}
                    </span>
                  </div>
                </div>
              )}

              {/* Berkas Lampiran Bukti */}
              <div>
                <span className="text-slate-400 block text-[11px] mb-1.5">
                  Lampiran Bukti Struk / Kuitansi ({selectedTxForDetail.lampiran?.length || 0})
                </span>
                {selectedTxForDetail.lampiran && selectedTxForDetail.lampiran.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTxForDetail.lampiran.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {f.dataUrl && f.tipe.startsWith('image/') ? (
                            <img src={f.dataUrl} alt="lampiran" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <FileText className="w-5 h-5 text-slate-400" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900">{f.nama}</p>
                            <p className="text-[10px] text-slate-400">{f.ukuran}</p>
                          </div>
                        </div>
                        {f.dataUrl && (
                          <a
                            href={f.dataUrl}
                            download={f.nama}
                            className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                          >
                            Unduh File
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Tidak ada lampiran berkas fisik pada transaksi ini.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const tx = selectedTxForDetail;
                  setSelectedTxForDetail(null);
                  setSelectedTxForLPJ(tx);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
                title="Cetak kwitansi resmi, SPTB, dan lampiran nota"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span>Unduh / Cetak LPJ Transaksi</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxForDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Transaksi */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Konfirmasi Hapus Transaksi
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus transaksi bukti{' '}
              <strong className="text-slate-900 font-mono">{txToDelete.nomorBukti}</strong> ({txToDelete.sumberDana}) senilai{' '}
              <strong className="text-slate-900 font-mono">{formatRupiah(txToDelete.nominal, true)}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Ya, Hapus Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt / Kwitansi Viewer Modal */}
      <ReceiptViewerModal
        isOpen={!!selectedTxForReceipt}
        onClose={() => setSelectedTxForReceipt(null)}
        transaksi={selectedTxForReceipt}
      />

      {/* Modal LPJ Transaksi (Kwitansi Resmi, SPTB & Lampiran Nota) */}
      <LPJTransactionModal
        isOpen={!!selectedTxForLPJ}
        onClose={() => setSelectedTxForLPJ(null)}
        transaksi={selectedTxForLPJ}
      />

      {/* Modal Edit / Penyesuaian Saldo Awal Bulan */}
      <EditSaldoAwalModal
        isOpen={isEditSaldoAwalOpen}
        onClose={() => setIsEditSaldoAwalOpen(false)}
        bulan={selectedBulan}
        tahun={selectedTahun}
      />

      {/* Modal Konfirmasi Kosongkan Bulan Ini */}
      {showPurgeMonthConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Kosongkan Bulan {namaBulan} {selectedTahun}?</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan <strong>menghapus permanen seluruh {transaksiList.length} transaksi pada bulan {namaBulan}</strong> dari Cloud Firestore database dan penyimpanan lokal. Data bulan lainnya tetap aman.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPurgingMonth}
                onClick={() => setShowPurgeMonthConfirm(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPurgingMonth}
                onClick={async () => {
                  setIsPurgingMonth(true);
                  await purgeMonthTransaksi(selectedBulan);
                  setIsPurgingMonth(false);
                  setShowPurgeMonthConfirm(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isPurgingMonth ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Ya, Hapus Semua Bulan Ini</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pusat Unggah Database BKU */}
      <DatabaseImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
