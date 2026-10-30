import React, { useState } from 'react';
import { FileLampiran } from '../types';
import { Upload, X, Eye, FileText, Image as ImageIcon, Trash2, Camera, Loader2 } from 'lucide-react';

interface ReceiptUploaderProps {
  files: FileLampiran[];
  onChange: (newFiles: FileLampiran[]) => void;
  maxFiles?: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Kompresi & Resize Otomatis untuk Foto Kamera HP
async function compressAndResizeImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<{ dataUrl: string; sizeFormatted: string }> {
  if (file.type === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve({
          dataUrl,
          sizeFormatted: formatFileSize(file.size)
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const head = 'data:image/jpeg;base64,';
          const sizeInBytes = Math.round(((compressedDataUrl.length - head.length) * 3) / 4);
          resolve({
            dataUrl: compressedDataUrl,
            sizeFormatted: formatFileSize(sizeInBytes)
          });
          return;
        }
        resolve({ dataUrl: e.target?.result as string, sizeFormatted: formatFileSize(file.size) });
      };
      img.onerror = () => {
        resolve({ dataUrl: e.target?.result as string, sizeFormatted: formatFileSize(file.size) });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({
  files,
  onChange,
  maxFiles = 3
}) => {
  const [selectedPreview, setSelectedPreview] = useState<FileLampiran | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    const selectedList = e.target.files;
    if (!selectedList || selectedList.length === 0) return;

    if (files.length + selectedList.length > maxFiles) {
      setErrorMessage(`Maksimal ${maxFiles} foto nota/kwitansi per transaksi.`);
      return;
    }

    setIsProcessing(true);
    const newProcessedFiles: FileLampiran[] = [];

    try {
      for (const file of Array.from(selectedList)) {
        // Otomatis kompres foto resolusi tinggi dari HP
        const { dataUrl, sizeFormatted } = await compressAndResizeImage(file);
        const newFile: FileLampiran = {
          id: `lamp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          nama: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
          ukuran: sizeFormatted,
          tipe: 'image/jpeg',
          dataUrl
        };
        newProcessedFiles.push(newFile);
      }
      onChange([...files, ...newProcessedFiles]);
    } catch (err) {
      setErrorMessage('Gagal memproses foto nota. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleRemove = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 tracking-wide flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-emerald-600" />
          <span>Upload / Ambil Foto Nota (Bukti Fisik HP)</span>
        </label>
        <span className="text-[11px] text-slate-400">
          Maks. {maxFiles} berkas (Auto-Compress HP)
        </span>
      </div>

      {/* File Drop / Select Area */}
      {files.length < maxFiles && (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Main Upload / Select Input */}
          <label className="flex-1 flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30 rounded-xl cursor-pointer transition-colors group">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 group-hover:text-emerald-700">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  <span>Memproses & Mengompres Foto HP...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  <span>Pilih dari Galeri atau Berkas</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Otomatis dioptimalkan agar tidak berat di seluler
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              disabled={isProcessing}
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* Dedicated Direct Camera Input for Mobile */}
          <label className="px-4 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-semibold shrink-0 shadow-xs">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Camera className="w-4 h-4 text-emerald-300" />
            )}
            <span>Kamera HP</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={isProcessing}
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      )}

      {errorMessage && (
        <p className="text-[11px] text-rose-600 font-medium">{errorMessage}</p>
      )}

      {/* List / Grid Thumbnail Foto Kwitansi */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {files.map((file) => {
            const isImage = file.tipe.startsWith('image/') || !!file.dataUrl?.startsWith('data:image/');

            return (
              <div
                key={file.id}
                className="relative group p-2 bg-white border border-slate-200 rounded-lg flex items-center gap-2 shadow-2xs hover:border-slate-300 transition-all"
              >
                {/* Image Thumbnail Preview */}
                {isImage && file.dataUrl ? (
                  <img
                    src={file.dataUrl}
                    alt={file.nama}
                    className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0 bg-slate-100"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-xs font-medium text-slate-800 truncate" title={file.nama}>
                    {file.nama}
                  </p>
                  <p className="text-[10px] text-emerald-700 font-mono font-semibold">{file.ukuran}</p>
                </div>

                {/* Actions: Preview & Remove */}
                <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                  {file.dataUrl && (
                    <button
                      type="button"
                      onClick={() => setSelectedPreview(file)}
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Lihat Foto Nota"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(file.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Lightbox Preview Foto Kwitansi */}
      {selectedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-4">
                <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold truncate">{selectedPreview.nama}</span>
                <span className="text-[10px] font-mono text-slate-400">({selectedPreview.ukuran})</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto flex-1 min-h-[250px]">
              {selectedPreview.tipe.startsWith('image/') || selectedPreview.dataUrl?.startsWith('data:image/') ? (
                <img
                  src={selectedPreview.dataUrl}
                  alt={selectedPreview.nama}
                  className="max-h-[70vh] w-auto object-contain rounded border border-slate-800"
                />
              ) : (
                <iframe
                  src={selectedPreview.dataUrl}
                  title={selectedPreview.nama}
                  className="w-full h-[60vh] rounded"
                />
              )}
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
