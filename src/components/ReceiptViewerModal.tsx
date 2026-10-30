import React, { useState } from 'react';
import { TransaksiBKU, FileLampiran } from '../types';
import { formatRupiah, formatTanggalIndo } from '../utils/formatters';
import { X, Image as ImageIcon, FileText, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: TransaksiBKU | null;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  isOpen,
  onClose,
  transaksi
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  if (!isOpen || !transaksi || !transaksi.lampiran || transaksi.lampiran.length === 0) return null;

  const currentFile: FileLampiran = transaksi.lampiran[activeIndex] || transaksi.lampiran[0];
  const isImage = currentFile.tipe.startsWith('image/') || !!currentFile.dataUrl?.startsWith('data:image/');

  const handleNext = () => {
    if (transaksi.lampiran) {
      setActiveIndex((prev) => (prev + 1) % transaksi.lampiran!.length);
    }
  };

  const handlePrev = () => {
    if (transaksi.lampiran) {
      setActiveIndex((prev) => (prev - 1 + transaksi.lampiran!.length) % transaksi.lampiran!.length);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative max-w-3xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Bukti Fisik / Kwitansi Nota Transaksi
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                No. Bukti: {transaksi.nomorBukti} · {formatTanggalIndo(transaksi.tanggal, { short: true })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Summary Sub-banner */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-900">{transaksi.uraian}</span>
            {transaksi.penerima && (
              <span className="text-slate-500 text-[11px] block">Penerima/Toko: {transaksi.penerima}</span>
            )}
          </div>
          <div className="text-right font-mono">
            <span className="font-bold text-slate-900 text-sm">{formatRupiah(transaksi.nominal, true)}</span>
            <span className="text-[10px] text-slate-500 block">({transaksi.jenisKas})</span>
          </div>
        </div>

        {/* Image Preview Box */}
        <div className="relative p-4 bg-slate-950 flex items-center justify-center overflow-auto flex-1 min-h-[300px]">
          {isImage && currentFile.dataUrl ? (
            <img
              src={currentFile.dataUrl}
              alt={currentFile.nama}
              className="max-h-[65vh] max-w-full object-contain rounded border border-slate-800 shadow-md"
            />
          ) : currentFile.dataUrl ? (
            <iframe
              src={currentFile.dataUrl}
              title={currentFile.nama}
              className="w-full h-[55vh] rounded bg-white"
            />
          ) : (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">Berkas kwitansi tidak dapat ditampilkan secara langsung.</p>
            </div>
          )}

          {/* Navigation Controls if multiple attachments */}
          {transaksi.lampiran.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 text-white hover:bg-emerald-600 transition-colors shadow-lg"
                title="Foto Sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 text-white hover:bg-emerald-600 transition-colors shadow-lg"
                title="Foto Selanjutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Footer Gallery Controls */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={currentFile.nama}>
              {currentFile.nama}
            </span>
            <span className="font-mono text-[11px] text-slate-400">({currentFile.ukuran})</span>
            {transaksi.lampiran.length > 1 && (
              <span className="px-2 py-0.5 bg-slate-100 font-mono text-[10px] text-slate-600 rounded font-semibold">
                {activeIndex + 1} dari {transaksi.lampiran.length} foto
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentFile.dataUrl && (
              <a
                href={currentFile.dataUrl}
                download={currentFile.nama}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Foto</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
