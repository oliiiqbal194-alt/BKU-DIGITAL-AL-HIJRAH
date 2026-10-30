import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  FileKey, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Database,
  RefreshCw,
  PlusCircle,
  FileCheck,
  ShieldCheck
} from 'lucide-react';
import { useBKU } from '../context/BKUContext';
import { parseExcelBKUFile, ParsedImportResult } from '../utils/excelImport';
import { decryptData } from '../utils/crypto';
import { TransaksiBKU, KegiatanAnggaran, ProfilInstansi } from '../types';
import { formatRupiah, NAMA_BULAN } from '../utils/formatters';

interface DatabaseImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseImportModal: React.FC<DatabaseImportModalProps> = ({ isOpen, onClose }) => {
  const { 
    importBatchDatabase, 
    addToast, 
    setSelectedBulan, 
    setSelectedTahun, 
    selectedTahun,
    selectedBulan
  } = useBKU();

  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'vault' | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data Pratinjau
  const [parsedData, setParsedData] = useState<{
    transaksi: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[];
    kegiatan?: Omit<KegiatanAnggaran, 'id' | 'createdAt'>[];
    instansi?: Partial<ProfilInstansi>;
    totalMasuk: number;
    totalKeluar: number;
    detectedTahun: number;
    detectedBulan: number[];
    errors: string[];
  } | null>(null);

  // Vault Passphrase jika file .enc / vault terenkripsi
  const [vaultPassword, setVaultPassword] = useState('');
  const [rawVaultContent, setRawVaultContent] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);

  // Mode Impor: replace atau append
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setFileType(null);
    setParsedData(null);
    setErrorMessage(null);
    setVaultPassword('');
    setRawVaultContent(null);
    setNeedsPassword(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (selectedFile: File) => {
    handleReset();
    setFile(selectedFile);
    setIsLoadingFile(true);
    setErrorMessage(null);

    const name = selectedFile.name.toLowerCase();

    try {
      if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
        setFileType('excel');
        const res = await parseExcelBKUFile(selectedFile);
        if (res.transaksi.length === 0) {
          throw new Error('Tidak ada baris data transaksi yang valid dalam berkas spreadsheet ini.');
        }
        setParsedData({
          ...res,
          detectedTahun: res.detectedTahun || selectedTahun,
          detectedBulan: res.detectedBulan || []
        });
      } else if (name.endsWith('.enc') || name.endsWith('.json') || name.endsWith('.bku')) {
        setFileType('vault');
        const text = await selectedFile.text();
        setRawVaultContent(text);

        // Coba dekripsi tanpa kata sandi kustom terlebih dahulu (default)
        try {
          const decrypted = await decryptData(text);
          if (decrypted && Array.isArray(decrypted.transaksi)) {
            populateVaultData(decrypted);
          } else {
            setNeedsPassword(true);
          }
        } catch {
          setNeedsPassword(true);
        }
      } else {
        throw new Error('Format berkas tidak didukung. Harap unggah file Excel (.xlsx / .csv) atau Cadangan Sistem (.json / .bku.enc).');
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setErrorMessage(err?.message || 'Gagal membaca isi berkas.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const populateVaultData = (decrypted: any) => {
    const txList = decrypted.transaksi || [];
    let masuk = 0;
    let keluar = 0;
    const bulanSet = new Set<number>();

    txList.forEach((t: any) => {
      const isMasuk = t.jenisTransaksi === 'masuk' || t.jenisTransaksi === 'Masuk';
      if (isMasuk) masuk += Number(t.nominal || 0);
      else keluar += Number(t.nominal || 0);
      if (t.bulan) bulanSet.add(Number(t.bulan));
    });

    setParsedData({
      transaksi: txList,
      kegiatan: decrypted.kegiatan || [],
      instansi: decrypted.instansi,
      totalMasuk: masuk,
      totalKeluar: keluar,
      detectedTahun: decrypted.selectedTahun || selectedTahun,
      detectedBulan: Array.from(bulanSet).sort((a, b) => a - b),
      errors: []
    });
    setNeedsPassword(false);
  };

  const handleUnlockVault = async () => {
    if (!rawVaultContent) return;
    setIsLoadingFile(true);
    setErrorMessage(null);
    try {
      const decrypted = await decryptData(rawVaultContent, vaultPassword);
      if (decrypted && Array.isArray(decrypted.transaksi)) {
        populateVaultData(decrypted);
      } else {
        throw new Error('Kata sandi salah atau format berkas cadangan rusak.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Kata sandi tidak cocok.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!parsedData || parsedData.transaksi.length === 0) return;

    setIsSaving(true);
    try {
      const result = await importBatchDatabase(parsedData.transaksi, {
        mode: importMode,
        kegiatanList: parsedData.kegiatan,
        instansiData: parsedData.instansi,
        tahun: parsedData.detectedTahun
      });

      if (result.success) {
        if (parsedData.detectedTahun) {
          setSelectedTahun(parsedData.detectedTahun);
        }
        if (parsedData.detectedBulan.length > 0) {
          // Set ke bulan pertama yang ada transaksi jika bulan aktif kosong
          if (!parsedData.detectedBulan.includes(selectedBulan)) {
            setSelectedBulan(parsedData.detectedBulan[0]);
          }
        }
        onClose();
      }
    } catch (err: any) {
      addToast('error', 'Gagal Menyimpan', err?.message || 'Terjadi kesalahan sistem saat menyimpan ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Pusat Unggah & Pemulihan Database BKU</h2>
              <p className="text-xs text-slate-300">
                Impor data dari spreadsheet Excel atau file cadangan vault langsung ke cloud database
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Petunjuk / Informasi Dukungan Format */}
          {!file && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>File Spreadsheet Excel / CSV</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Mendukung format <code>.xlsx</code>, <code>.xls</code>, atau <code>.csv</code> dengan kolom: Tanggal, Uraian, Debet/Masuk, Kredit/Keluar, Jenis KAS, dan Penanggung Jawab.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/50 space-y-2">
                <div className="flex items-center gap-2 text-sky-800 font-bold text-xs">
                  <FileKey className="w-4 h-4 text-sky-600" />
                  <span>Berkas Cadangan Vault BKU</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Mendukung format arsip <code>.bku.enc</code> atau <code>.json</code> yang diekspor dari aplikasi BKU, memulihkan seluruh transaksi kas beserta alokasi kegiatannya.
                </p>
              </div>
            </div>
          )}

          {/* Area Drop & Upload File */}
          {!parsedData && !needsPassword && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isLoadingFile 
                  ? 'border-emerald-400 bg-emerald-50/30' 
                  : 'border-slate-300 hover:border-emerald-600 hover:bg-slate-50/80 bg-slate-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.enc,.json,.bku"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
                  {isLoadingFile ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                  ) : (
                    <Upload className="w-6 h-6 text-emerald-600" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800">
                    {isLoadingFile ? 'Membaca data berkas...' : 'Klik untuk memilih berkas database'}
                  </div>
                  <p className="text-xs text-slate-500">
                    Format didukung: <strong>.xlsx, .csv, .bku.enc, .json</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prompt Kata Sandi untuk Vault Terenkripsi Kustom */}
          {needsPassword && (
            <div className="p-5 border border-amber-200 bg-amber-50/60 rounded-xl space-y-4">
              <div className="flex items-center gap-2.5 text-amber-900 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <span>Berkas Terlindungi Kata Sandi Master</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Berkas cadangan ini dilindungi dengan enkripsi keamanan tinggi. Masukkan kata sandi master yang Anda buat saat mengekspor berkas ini.
              </p>

              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Masukkan kata sandi master cadangan"
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-600"
                />

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Ganti Berkas
                  </button>
                  <button
                    type="button"
                    disabled={!vaultPassword || isLoadingFile}
                    onClick={handleUnlockVault}
                    className="px-5 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isLoadingFile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                    <span>Buka & Muat Cadangan</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pesan Kesalahan jika ada */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">Gagal Mengurai Data</div>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* PRATINJAU DATA BERHASIL TERBACA */}
          {parsedData && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Info Berkas & Ringkasan */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                      {fileType === 'excel' ? <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> : <FileKey className="w-4 h-4 text-emerald-700" />}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {file?.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors"
                  >
                    Ganti Berkas
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Total Transaksi</span>
                    <span className="text-sm font-bold text-slate-900">
                      {parsedData.transaksi.length} baris
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Tahun / Periode</span>
                    <span className="text-sm font-bold text-slate-900">
                      {parsedData.detectedTahun} {parsedData.detectedBulan.length > 0 && `(${parsedData.detectedBulan.map(b => NAMA_BULAN[b-1] || b).join(', ')})`}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Total Penerimaan</span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-700">
                      {formatRupiah(parsedData.totalMasuk)}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block">Total Pengeluaran</span>
                    <span className="text-xs sm:text-sm font-bold text-rose-700">
                      {formatRupiah(parsedData.totalKeluar)}
                    </span>
                  </div>
                </div>
              </div>

              {/* OPSI PENYIMPANAN: Replace atau Append */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Metode Penyimpanan ke Database Cloud & Lokal:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label 
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Ganti Seluruh Data (Replace)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Bersihkan data lama di cloud dan gantikan dengan data baru yang diunggah secara menyeluruh.
                      </p>
                    </div>
                  </label>

                  <label 
                    onClick={() => setImportMode('append')}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      importMode === 'append'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <PlusCircle className="w-3.5 h-3.5 text-sky-700" />
                        <span>Gabungkan Data (Append)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tambahkan transaksi baru ke data yang sudah ada di database tanpa menghapus data sebelumnya.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tabel Pratinjau Baris (Maks. 6 baris) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Contoh Pratinjau Transaksi ({Math.min(parsedData.transaksi.length, 6)} dari {parsedData.transaksi.length} baris):
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Tanggal</th>
                        <th className="py-2 px-3">No. Bukti</th>
                        <th className="py-2 px-3">Uraian</th>
                        <th className="py-2 px-3">Kas</th>
                        <th className="py-2 px-3">Jenis</th>
                        <th className="py-2 px-3 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedData.transaksi.slice(0, 6).map((tx, idx) => {
                        const isMasuk = tx.jenisTransaksi === 'masuk' || tx.jenisTransaksi === 'Masuk';
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 whitespace-nowrap font-mono">{tx.tanggal}</td>
                            <td className="py-2 px-3 whitespace-nowrap font-mono text-[10px] text-slate-600">{tx.nomorBukti}</td>
                            <td className="py-2 px-3 max-w-[180px] truncate">{tx.uraian}</td>
                            <td className="py-2 px-3 whitespace-nowrap text-slate-600">{tx.jenisKas}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                isMasuk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isMasuk ? 'Masuk' : 'Keluar'}
                              </span>
                            </td>
                            <td className={`py-2 px-3 text-right whitespace-nowrap font-semibold ${
                              isMasuk ? 'text-emerald-700' : 'text-slate-900'
                            }`}>
                              {formatRupiah(tx.nominal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={!parsedData || parsedData.transaksi.length === 0 || isSaving}
            onClick={handleSaveToDatabase}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Menyimpan ke Cloud Firestore...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Simpan Permanen ke Database ({parsedData?.transaksi.length || 0} Data)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
