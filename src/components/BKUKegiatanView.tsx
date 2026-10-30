import React, { useState } from 'react';
import { useBKU } from '../context/BKUContext';
import { KegiatanAnggaran, SumberDana, TransaksiBKU } from '../types';
import { formatRupiah, formatTanggalIndo, NAMA_BULAN } from '../utils/formatters';
import { exportBKUKegiatanToExcel, exportAllBKUKegiatanToExcel } from '../utils/excelExport';
import { ReceiptViewerModal } from './ReceiptViewerModal';
import { LPJTransactionModal } from './LPJTransactionModal';
import {
  FolderKanban,
  Plus,
  FileSpreadsheet,
  FileText,
  Edit2,
  Trash2,
  ArrowRight,
  ChevronLeft,
  Calendar,
  Clock,
  User,
  Paperclip,
  ArrowRightLeft,
  Info,
  Check,
  X,
  Filter,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';

interface BKUKegiatanViewProps {
  onOpenNewKegiatan: () => void;
  onEditKegiatan: (keg: KegiatanAnggaran) => void;
  onOpenKegiatanTransaction: (keg?: KegiatanAnggaran | null) => void;
}

export const BKUKegiatanView: React.FC<BKUKegiatanViewProps> = ({
  onOpenNewKegiatan,
  onEditKegiatan,
  onOpenKegiatanTransaction
}) => {
  const {
    kegiatan,
    transaksi,
    instansi,
    selectedTahun,
    deleteKegiatan,
    getKegiatanStats,
    allocateTransaksiToKegiatan
  } = useBKU();

  const [filterSumberDana, setFilterSumberDana] = useState<string>('all');
  const [selectedKegiatanDetail, setSelectedKegiatanDetail] = useState<KegiatanAnggaran | null>(null);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<TransaksiBKU | null>(null);
  const [selectedTxForLPJ, setSelectedTxForLPJ] = useState<TransaksiBKU | null>(null);
  const [kegiatanToDelete, setKegiatanToDelete] = useState<KegiatanAnggaran | null>(null);

  // Modal Alokasi Transaksi dari BKU Umum
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState<boolean>(false);
  const [targetKegiatanIdForModal, setTargetKegiatanIdForModal] = useState<string>('');
  const [selectedTxIdsToAllocate, setSelectedTxIdsToAllocate] = useState<string[]>([]);
  const [modalFilterBulan, setModalFilterBulan] = useState<number | 'all'>('all');
  const [modalFilterStatus, setModalFilterStatus] = useState<'all' | 'unallocated' | 'allocated'>('unallocated');

  // Filter kegiatan by sumber dana
  const filteredKegiatan = kegiatan.filter((k) => 
    filterSumberDana === 'all' || k.sumberDana === filterSumberDana
  );

  // Filter transaksi untuk kegiatan yang sedang dibuka detailnya
  const txKegiatan = selectedKegiatanDetail
    ? transaksi
        .filter((t) => {
          const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
          if (!isKeluar) return false;
          const keg = selectedKegiatanDetail;
          const isDirectMatch = t.kegiatanId === keg.id;
          const isNameMatch = (
            t.sumberDana === keg.sumberDana && (
              t.posKategori === keg.namaKegiatan ||
              (t.uraian && keg.namaKegiatan && t.uraian.toLowerCase().includes(keg.namaKegiatan.toLowerCase())) ||
              (t.kodeRekening && keg.kodeKegiatan && t.kodeRekening === keg.kodeKegiatan)
            )
          );
          return isDirectMatch || isNameMatch;
        })
        .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
    : [];

  // Seluruh transaksi yang memiliki alokasi kegiatan
  const allKegiatanTx = transaksi
    .filter((t) => {
      const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
      return isKeluar && Boolean(t.kegiatanId || (t.kegiatanNama && t.kegiatanNama.trim().length > 0));
    })
    .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  // Transaksi pengeluaran umum yang belum dialokasikan ke kegiatan apa pun
  const unallocatedExpenses = transaksi.filter((t) => {
    const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
    return isKeluar && !t.kegiatanId && (!t.kegiatanNama || t.kegiatanNama.trim().length === 0);
  });

  const handleExportSingleExcel = (keg: KegiatanAnggaran) => {
    const list = transaksi.filter((t) => {
      const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
      if (!isKeluar) return false;
      return t.kegiatanId === keg.id || (
        t.sumberDana === keg.sumberDana && (
          t.posKategori === keg.namaKegiatan ||
          (t.uraian && keg.namaKegiatan && t.uraian.toLowerCase().includes(keg.namaKegiatan.toLowerCase())) ||
          (t.kodeRekening && keg.kodeKegiatan && t.kodeRekening === keg.kodeKegiatan)
        )
      );
    });
    exportBKUKegiatanToExcel(keg, list, instansi);
  };

  const handleExportAllExcel = () => {
    exportAllBKUKegiatanToExcel(kegiatan, transaksi, instansi);
  };

  const confirmDeleteKegiatan = async () => {
    if (kegiatanToDelete) {
      await deleteKegiatan(kegiatanToDelete.id);
      if (selectedKegiatanDetail?.id === kegiatanToDelete.id) {
        setSelectedKegiatanDetail(null);
      }
      setKegiatanToDelete(null);
    }
  };

  const openAllocateModal = (preselectedKeg?: KegiatanAnggaran | null) => {
    const targetId = preselectedKeg ? preselectedKeg.id : (kegiatan.length > 0 ? kegiatan[0].id : '');
    setTargetKegiatanIdForModal(targetId);
    setSelectedTxIdsToAllocate([]);
    setIsAllocateModalOpen(true);
  };

  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIdsToAllocate((prev) => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredTx = (filteredIds: string[]) => {
    const allSelected = filteredIds.every(id => selectedTxIdsToAllocate.includes(id));
    if (allSelected) {
      setSelectedTxIdsToAllocate((prev) => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedTxIdsToAllocate((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleSaveAllocation = async () => {
    if (selectedTxIdsToAllocate.length === 0) return;
    const targetKeg = kegiatan.find(k => k.id === targetKegiatanIdForModal);
    if (!targetKeg) return;

    await allocateTransaksiToKegiatan(selectedTxIdsToAllocate, targetKeg.id, targetKeg.namaKegiatan);
    setIsAllocateModalOpen(false);
    setSelectedTxIdsToAllocate([]);
  };

  const handleUnallocateTx = async (txId: string) => {
    await allocateTransaksiToKegiatan([txId], null);
  };

  // Hitung total pagu per sumber dana
  const totalPaguYayasan = kegiatan.filter(k => k.sumberDana === 'Dana Yayasan').reduce((acc, k) => acc + k.paguAnggaran, 0);
  const totalPaguOrangtua = kegiatan.filter(k => k.sumberDana === 'Dana Orangtua').reduce((acc, k) => acc + k.paguAnggaran, 0);
  const totalPaguSekolah = kegiatan.filter(k => k.sumberDana === 'Dana Sekolah').reduce((acc, k) => acc + k.paguAnggaran, 0);

  return (
    <div className="space-y-6">
      {/* Header Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Buku Pembantu Kas Kegiatan (BKU Kegiatan)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pengendalian pagu anggaran per sub-kegiatan berdasarkan Dana Yayasan, Dana Orangtua, dan Dana Sekolah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {kegiatan.length > 0 && (
            <button
              type="button"
              onClick={() => openAllocateModal(selectedKegiatanDetail)}
              className="px-3 py-2 text-xs font-semibold text-slate-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              title="Hubungkan pengeluaran yang sudah dicatat di BKU Umum ke Sub-Kegiatan Anggaran"
            >
              <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
              <span>Alokasikan dari BKU Umum</span>
              {unallocatedExpenses.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-200/80 text-emerald-800 text-[10px] rounded-full font-mono font-bold">
                  {unallocatedExpenses.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenKegiatanTransaction(selectedKegiatanDetail)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Catat Transaksi Kegiatan</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewKegiatan}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>Tambah Sub-Kegiatan</span>
          </button>
        </div>
      </div>

      {/* Banner Penjelasan Perbedaan BKU Umum vs BKU Kegiatan */}
      <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold text-sky-950">Aturan Akuntansi BKU Kegiatan: </strong>
          Halaman ini khusus memonitor pengeluaran yang memotong <strong>Pagu Anggaran Sub-Kegiatan</strong> (misal: Kegiatan Kesiswaan, Pelatihan, Pemeliharaan Sarana). Belanja operasional rutin umum sekolah (air galon, fotokopi, kopi, wifi, transportasi rutin) tetap tercatat rapi di <strong>BKU Umum</strong> dan tidak dimasukkan ke BKU Kegiatan kecuali Anda mengalokasikannya ke sub-kegiatan tertentu.
        </div>
      </div>

      {/* 3 Summary Pagu Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Pagu Dana Yayasan</span>
          <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
            {formatRupiah(totalPaguYayasan, true)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {kegiatan.filter(k => k.sumberDana === 'Dana Yayasan').length} kegiatan terdaftar
          </p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Pagu Dana Orangtua (SPP/Iuran)</span>
          <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
            {formatRupiah(totalPaguOrangtua, true)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {kegiatan.filter(k => k.sumberDana === 'Dana Orangtua').length} kegiatan terdaftar
          </p>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block">Pagu Dana Sekolah (Mandiri)</span>
          <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
            {formatRupiah(totalPaguSekolah, true)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {kegiatan.filter(k => k.sumberDana === 'Dana Sekolah').length} kegiatan terdaftar
          </p>
        </div>
      </div>

      {/* Selector Sub-Kegiatan Tabs & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Sub-Kegiatan:</span>
          <button
            type="button"
            onClick={() => setSelectedKegiatanDetail(null)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              selectedKegiatanDetail === null
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Semua Sub-Kegiatan ({kegiatan.length})
          </button>

          {kegiatan.map((keg) => (
            <button
              key={keg.id}
              type="button"
              onClick={() => setSelectedKegiatanDetail(keg)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
                selectedKegiatanDetail?.id === keg.id
                  ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="font-mono text-[10px] opacity-80">[{keg.kodeKegiatan}]</span>
              <span className="truncate max-w-[180px]">{keg.namaKegiatan}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {selectedKegiatanDetail ? (
            <button
              type="button"
              onClick={() => handleExportSingleExcel(selectedKegiatanDetail)}
              className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white hover:bg-emerald-50 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Kegiatan Ini (.xlsx)</span>
            </button>
          ) : (
            kegiatan.length > 0 && (
              <button
                type="button"
                onClick={handleExportAllExcel}
                className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white hover:bg-emerald-50 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Unduh Seluruh BKU Kegiatan (.xlsx)</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* DETAIL BKU KEGIATAN SPESIFIK */}
      {selectedKegiatanDetail ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedKegiatanDetail(null)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali ke Ringkasan Semua Kegiatan</span>
            </button>

            <button
              type="button"
              onClick={() => openAllocateModal(selectedKegiatanDetail)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Hubungkan Belanja dari BKU Umum</span>
            </button>
          </div>

          {/* Banner Informasi Kegiatan */}
          {(() => {
            const stats = getKegiatanStats(selectedKegiatanDetail.id);

            return (
              <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {selectedKegiatanDetail.kodeKegiatan}
                      </span>
                      <span className="text-xs font-bold text-emerald-800">
                        Sumber: {selectedKegiatanDetail.sumberDana}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      {selectedKegiatanDetail.namaKegiatan}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>Penanggung Jawab: <strong>{selectedKegiatanDetail.penanggungJawab}</strong></span>
                      <span>·</span>
                      <span>Target Waktu: {selectedKegiatanDetail.targetWaktu || 'Tahunan'}</span>
                      {selectedKegiatanDetail.deskripsi && (
                        <>
                          <span>·</span>
                          <span className="text-slate-600">{selectedKegiatanDetail.deskripsi}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="text-left sm:text-right sm:shrink-0">
                    <span className="text-xs text-slate-500 block">Pagu Anggaran Disetujui</span>
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {formatRupiah(selectedKegiatanDetail.paguAnggaran, true)}
                    </span>
                  </div>
                </div>

                {/* Progress bar penyerapan */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">
                      Total Realisasi: <strong className="font-mono text-slate-900">{formatRupiah(stats.totalRealisasi, true)}</strong>
                    </span>
                    <span className="font-mono text-slate-700">
                      Terserap: {stats.persentase.toFixed(1)}% (Sisa Pagu: {formatRupiah(stats.sisa, true)})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        stats.persentase > 100
                          ? 'bg-rose-600'
                          : stats.persentase > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, stats.persentase)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tabel Transaksi Kas Pembantu Kegiatan */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Daftar Belanja Sub-Kegiatan ({selectedKegiatanDetail.namaKegiatan})
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {txKegiatan.length} Catatan Belanja
              </span>
            </div>

            {txKegiatan.length === 0 ? (
              <div className="py-12 px-6 text-center max-w-md mx-auto">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">
                  Belum Ada Realisasi Belanja untuk Sub-Kegiatan Ini
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Belanja operasional rutin umum tidak dicatat di sini. Anda dapat mencatat belanja baru untuk sub-kegiatan ini atau mengalokasikan transaksi pengeluaran yang sudah ada dari BKU Umum.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAllocateModal(selectedKegiatanDetail)}
                    className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Alokasikan Transaksi BKU Umum</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenKegiatanTransaction(selectedKegiatanDetail)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    + Catat Belanja Baru
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3 w-24">Tanggal</th>
                      <th className="py-2.5 px-3 w-36">No. Bukti</th>
                      <th className="py-2.5 px-4">Uraian Transaksi</th>
                      <th className="py-2.5 px-3 w-36">Penerima</th>
                      <th className="py-2.5 px-3 w-28 text-right">Nilai Belanja (Rp)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Potongan Pajak</th>
                      <th className="py-2.5 px-3 w-24 text-center">Metode</th>
                      <th className="py-2.5 px-3 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {txKegiatan.map((tx, idx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 group">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{formatTanggalIndo(tx.tanggal, { short: true })}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-800 font-medium">{tx.nomorBukti}</td>
                        <td className="py-2.5 px-4 text-slate-900 font-medium">
                          <div>{tx.uraian}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {tx.lampiran && tx.lampiran.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedTxForReceipt(tx)}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                              >
                                <Paperclip className="w-3 h-3 text-emerald-600" />
                                <span>{tx.lampiran.length} Foto Nota/Kwitansi</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedTxForLPJ(tx)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                              title="Unduh / Cetak Dokumen LPJ (Kwitansi & Nota)"
                            >
                              <FileText className="w-3 h-3 text-emerald-700" />
                              <span>Unduh LPJ</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{tx.penerima || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatRupiah(tx.nominal, false)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-700 tabular-nums">
                          {tx.pajak?.totalPotongan ? formatRupiah(tx.pajak.totalPotongan, false) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">{tx.metodePembayaran}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTxForLPJ(tx)}
                              className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors"
                              title="Unduh / Cetak Dokumen LPJ"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-700" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnallocateTx(tx.id)}
                              className="text-[10px] text-slate-400 hover:text-rose-600 underline"
                              title="Lepaskan dari sub-kegiatan ini dan kembalikan ke belanja umum"
                            >
                              Lepas
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                    <tr>
                      <td colSpan={5} className="py-2.5 px-4 text-right">
                        TOTAL REALISASI KEGIATAN:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 tabular-nums">
                        {formatRupiah(txKegiatan.reduce((acc, t) => acc + t.nominal, 0), false)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-800 tabular-nums">
                        {formatRupiah(txKegiatan.reduce((acc, t) => acc + (t.pajak?.totalPotongan || 0), 0), false)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* DAFTAR SEMUA SUB-KEGIATAN */
        <div className="space-y-6">
          {/* Filter Sumber Dana Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
            {[
              { id: 'all', label: 'Semua Sumber' },
              { id: 'Dana Yayasan', label: 'Dana Yayasan' },
              { id: 'Dana Orangtua', label: 'Dana Orangtua' },
              { id: 'Dana Sekolah', label: 'Dana Sekolah' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterSumberDana(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filterSumberDana === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {kegiatan.length === 0 ? (
            /* Empty state */
            <div className="py-16 px-6 text-center max-w-md mx-auto bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                <FolderKanban className="w-7 h-7 text-slate-400 stroke-1" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Belum Ada Sub-Kegiatan Anggaran Terdaftar
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Kelola alokasi pagu per program kegiatan sekolah yang bersumber dari Dana Yayasan, Dana Orangtua, atau Dana Sekolah.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={onOpenNewKegiatan}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Tambah Kegiatan Pertama</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Cards Grid Kegiatan */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredKegiatan.map((keg) => {
                  const stats = getKegiatanStats(keg.id);
                  const isOver = stats.persentase > 100;

                  return (
                    <div
                      key={keg.id}
                      className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
                    >
                      <div>
                        {/* Header baris kegiatan */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {keg.kodeKegiatan}
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-800">
                                {keg.sumberDana}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">
                              {keg.namaKegiatan}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onEditKegiatan(keg)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                              title="Ubah Rincian Kegiatan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setKegiatanToDelete(keg)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Hapus Kegiatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Penanggung jawab & Target */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-2.5">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {keg.penanggungJawab}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {keg.targetWaktu || 'Tahunan'}
                          </span>
                        </div>

                        {/* Financial metrics */}
                        <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-slate-50 rounded-lg text-xs">
                          <div>
                            <span className="text-slate-400 text-[11px] block">Pagu Anggaran</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatRupiah(keg.paguAnggaran, true)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px] block">Terserap (Realisasi)</span>
                            <span className="font-mono font-bold text-emerald-800">
                              {formatRupiah(stats.totalRealisasi, true)}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-500">
                            <span>Penyerapan</span>
                            <span className={`font-mono ${isOver ? 'text-rose-600 font-bold' : ''}`}>
                              {stats.persentase.toFixed(1)}% ({formatRupiah(stats.sisa, true)} sisa)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isOver ? 'bg-rose-600' : stats.persentase > 80 ? 'bg-amber-500' : 'bg-emerald-600'
                              }`}
                              style={{ width: `${Math.min(100, stats.persentase)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer card action */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleExportSingleExcel(keg)}
                          className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Excel</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedKegiatanDetail(keg)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-900 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span>Buka Rincian Belanja</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabel Konsolidasi Seluruh Pengeluaran Ber-Kegiatan */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mt-6">
                <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Daftar Seluruh Pengeluaran Kas Pembantu Kegiatan (BKU Kegiatan)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hanya menampilkan transaksi yang telah dialokasikan ke Sub-Kegiatan Anggaran. Belanja rutin umum lainnya berada di BKU Umum.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                      {allKegiatanTx.length} Transaksi Kegiatan
                    </span>
                    <button
                      type="button"
                      onClick={() => openAllocateModal()}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors flex items-center gap-1"
                    >
                      <ArrowRightLeft className="w-3 h-3 text-emerald-700" />
                      <span>Alokasikan Transaksi</span>
                    </button>
                  </div>
                </div>

                {allKegiatanTx.length === 0 ? (
                  <div className="py-12 px-6 text-center max-w-md mx-auto">
                    <p className="text-xs text-slate-500">
                      Belum ada transaksi pengeluaran yang dialokasikan ke Sub-Kegiatan.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Transaksi di BKU Umum yang berkaitan dengan program dapat dihubungkan ke sub-kegiatan menggunakan tombol di bawah ini.
                    </p>
                    <button
                      type="button"
                      onClick={() => openAllocateModal()}
                      className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Alokasikan Transaksi dari BKU Umum</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-3 w-24">Tanggal</th>
                          <th className="py-2.5 px-3 w-32">No. Bukti</th>
                          <th className="py-2.5 px-4 w-48">Sub-Kegiatan</th>
                          <th className="py-2.5 px-4">Uraian Belanja</th>
                          <th className="py-2.5 px-3 w-32">Penerima</th>
                          <th className="py-2.5 px-3 w-28 text-right">Nilai Belanja (Rp)</th>
                          <th className="py-2.5 px-3 w-24 text-center">Status Nota</th>
                          <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allKegiatanTx.map((tx, idx) => (
                          <tr key={tx.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{formatTanggalIndo(tx.tanggal, { short: true })}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-800 font-medium">{tx.nomorBukti}</td>
                            <td className="py-2.5 px-4">
                              <span className="font-semibold text-slate-800 block">
                                {tx.kegiatanNama || 'Sub-Kegiatan'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {tx.sumberDana}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-900 font-medium">
                              <div>{tx.uraian}</div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{tx.penerima || '-'}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {formatRupiah(tx.nominal, false)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {tx.lampiran && tx.lampiran.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTxForReceipt(tx)}
                                  className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                >
                                  {tx.lampiran.length} Nota
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">Belum Ada</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleUnallocateTx(tx.id)}
                                className="text-[10px] text-slate-400 hover:text-rose-600 underline"
                                title="Kembalikan transaksi ini ke belanja operasional umum di BKU Umum"
                              >
                                Lepas
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                        <tr>
                          <td colSpan={6} className="py-2.5 px-4 text-right">
                            TOTAL REALISASI SELURUH KEGIATAN:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-800 tabular-nums">
                            {formatRupiah(allKegiatanTx.reduce((acc, t) => acc + t.nominal, 0), false)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL ALOKASI TRANSAKSI DARI BKU UMUM */}
      {isAllocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Alokasikan Transaksi ke Sub-Kegiatan Anggaran
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pilih pengeluaran dari BKU Umum yang merupakan realisasi dari program kegiatan tertentu.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Controls */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Target Kegiatan Selector */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <label className="text-xs font-bold text-emerald-950 block">
                  Pilih Sub-Kegiatan Tujuan Alokasi:
                </label>
                <select
                  value={targetKegiatanIdForModal}
                  onChange={(e) => setTargetKegiatanIdForModal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  {kegiatan.map((k) => (
                    <option key={k.id} value={k.id}>
                      [{k.kodeKegiatan}] {k.namaKegiatan} — {k.sumberDana} (Pagu: {formatRupiah(k.paguAnggaran, true)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter controls inside modal */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Bulan:</span>
                  <select
                    value={modalFilterBulan}
                    onChange={(e) => setModalFilterBulan(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="all">Semua Bulan (Tahun {selectedTahun})</option>
                    {NAMA_BULAN.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>{m}</option>
                    ))}
                  </select>

                  <span className="text-slate-500 font-medium ml-2">Status:</span>
                  <select
                    value={modalFilterStatus}
                    onChange={(e) => setModalFilterStatus(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="unallocated">Belanja Umum (Belum Dialokasikan)</option>
                    <option value="allocated">Sudah Ber-Kegiatan</option>
                    <option value="all">Semua Pengeluaran</option>
                  </select>
                </div>

                {(() => {
                  const filteredList = transaksi.filter((t) => {
                    const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
                    if (!isKeluar) return false;
                    if (modalFilterBulan !== 'all' && t.bulan !== modalFilterBulan) return false;
                    const hasKeg = Boolean(t.kegiatanId || (t.kegiatanNama && t.kegiatanNama.trim().length > 0));
                    if (modalFilterStatus === 'unallocated' && hasKeg) return false;
                    if (modalFilterStatus === 'allocated' && !hasKeg) return false;
                    return true;
                  });

                  const filteredIds = filteredList.map(t => t.id);
                  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedTxIdsToAllocate.includes(id));

                  return (
                    <button
                      type="button"
                      onClick={() => handleSelectAllFilteredTx(filteredIds)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
                    >
                      {allSelected ? (
                        <>
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                          <span>Batalkan Pilih Semua ({filteredIds.length})</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4 text-slate-400" />
                          <span>Pilih Semua yang Ditampilkan ({filteredIds.length})</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>

              {/* Transaction checklist table */}
              {(() => {
                const filteredTxList = transaksi.filter((t) => {
                  const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
                  if (!isKeluar) return false;
                  if (modalFilterBulan !== 'all' && t.bulan !== modalFilterBulan) return false;
                  const hasKeg = Boolean(t.kegiatanId || (t.kegiatanNama && t.kegiatanNama.trim().length > 0));
                  if (modalFilterStatus === 'unallocated' && hasKeg) return false;
                  if (modalFilterStatus === 'allocated' && !hasKeg) return false;
                  return true;
                }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

                if (filteredTxList.length === 0) {
                  return (
                    <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                      Tidak ada transaksi pengeluaran yang cocok dengan kriteria filter di atas.
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">Pilih</th>
                          <th className="py-2.5 px-3 w-24">Tanggal</th>
                          <th className="py-2.5 px-3 w-28">No. Bukti</th>
                          <th className="py-2.5 px-4">Uraian Pengeluaran</th>
                          <th className="py-2.5 px-3 w-28 text-right">Nominal (Rp)</th>
                          <th className="py-2.5 px-3 w-36">Status Saat Ini</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTxList.map((tx) => {
                          const isChecked = selectedTxIdsToAllocate.includes(tx.id);
                          return (
                            <tr
                              key={tx.id}
                              onClick={() => handleToggleSelectTx(tx.id)}
                              className={`cursor-pointer transition-colors ${
                                isChecked ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // handled by tr onClick
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {tx.tanggal}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-800 font-medium whitespace-nowrap">
                                {tx.nomorBukti}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-slate-900">
                                {tx.uraian}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                                {formatRupiah(tx.nominal, false)}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {tx.kegiatanNama ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                                    {tx.kegiatanNama}
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                    Belanja Rutin Umum
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">
                {selectedTxIdsToAllocate.length} transaksi dipilih untuk dialokasikan
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={selectedTxIdsToAllocate.length === 0}
                  onClick={handleSaveAllocation}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Simpan Alokasi Sub-Kegiatan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {kegiatanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Hapus Kegiatan Anggaran?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus sub-kegiatan{' '}
              <strong className="text-slate-900">"{kegiatanToDelete.namaKegiatan}"</strong> ({kegiatanToDelete.sumberDana})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKegiatanToDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteKegiatan}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewer Lightbox Modal */}
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
    </div>
  );
};
