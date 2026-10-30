import React, { useState } from 'react';
import { useBKU } from '../context/BKUContext';
import { RupiahInput } from './RupiahInput';
import { formatRupiah } from '../utils/formatters';
import { DatabaseImportModal } from './DatabaseImportModal';
import {
  ShieldCheck,
  Building,
  Key,
  Download,
  Upload,
  RotateCcw,
  Check,
  Lock,
  FileKey,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  LogOut,
  FolderSync,
  Database
} from 'lucide-react';

export const SettingsSecurityView: React.FC = () => {
  const {
    instansi,
    updateInstansi,
    encryptionStatus,
    setMasterPassphrase,
    exportEncryptedVault,
    importEncryptedVault,
    resetAllData,
    purgeAllDatabase,
    addToast,
    googleUser,
    googleSheetsConfig,
    isSyncingSheets,
    connectGoogleDrive,
    disconnectGoogleDrive,
    syncToGoogleSheets,
    createAndLinkSpreadsheet,
    updateGoogleSheetsConfig
  } = useBKU();

  // Local form state for instansi
  const [formData, setFormData] = useState({ ...instansi });
  const [isSaved, setIsSaved] = useState(false);

  // Security passphrase state
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isSettingKey, setIsSettingKey] = useState(false);

  // Restore backup state
  const [importPassword, setImportPassword] = useState('');
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  // Confirmation dialogs & Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isPurgingAll, setIsPurgingAll] = useState(false);
  const [shouldResetProfil, setShouldResetProfil] = useState(false);
  const [showNewSheetConfirm, setShowNewSheetConfirm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
      addToast('success', 'Logo Berhasil Dimuat', 'Klik "Simpan Profil Lembaga" di bagian bawah untuk menerapkan perubahan.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInstansiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateInstansi(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSetPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase !== confirmPassphrase) {
      addToast('error', 'Kata Sandi Tidak Cocok', 'Konfirmasi kata sandi harus sama dengan kata sandi baru.');
      return;
    }
    setIsSettingKey(true);
    const success = await setMasterPassphrase(passphrase);
    setIsSettingKey(false);
    if (success) {
      setPassphrase('');
      setConfirmPassphrase('');
    }
  };

  const handleExportBackup = async () => {
    try {
      const encryptedData = await exportEncryptedVault();
      const blob = new Blob([encryptedData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `BKU_Cadangan_Terenkripsi_${dateStr}.bku.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('success', 'Cadangan Terenkripsi Berhasil Diunduh', 'Simpan berkas .bku.enc ini di media penyimpanan yang aman.');
    } catch (err) {
      addToast('error', 'Gagal Ekspor Cadangan', 'Terjadi masalah saat membuat cadangan terenkripsi.');
    }
  };

  const handleFileSelectForImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportFileContent(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteImport = async () => {
    if (!importFileContent) {
      addToast('warning', 'Pilih Berkas', 'Silakan pilih berkas .bku.enc terlebih dahulu.');
      return;
    }
    setIsImporting(true);
    const ok = await importEncryptedVault(importFileContent, importPassword || undefined);
    setIsImporting(false);
    if (ok) {
      setImportFileContent(null);
      setImportFileName('');
      setImportPassword('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Pengaturan Lembaga & Enkripsi Keamanan
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Kelola profil instansi, pejabat penandatangan BKU, sinkronisasi Google Spreadsheet di Drive, dan sistem perlindungan data.
        </p>
      </div>

      {/* INTEGRASI GOOGLE DRIVE & GOOGLE SPREADSHEET */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Sinkronisasi Google Spreadsheet & Drive</span>
                {googleUser && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded-full border border-emerald-200">
                    Aktif Terhubung
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Menyimpan dan mencatat data transaksi BKU secara otomatis ke Google Spreadsheet di akun Google Drive Anda.
              </p>
            </div>
          </div>

          {googleUser && (
            <button
              type="button"
              onClick={() => setShowDisconnectConfirm(true)}
              className="text-xs text-slate-500 hover:text-rose-600 font-medium transition-colors flex items-center gap-1 shrink-0"
              title="Putuskan Hubungan Google Drive"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Putuskan</span>
            </button>
          )}
        </div>

        {!googleUser ? (
          <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800">Hubungkan Akun Google Anda</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aplikasi ini akan otomatis membuat file Google Spreadsheet baru di Drive Anda dengan tab terpisah untuk <strong>BKU Umum</strong>, <strong>BKU Kegiatan</strong>, dan <strong>Rekap Pagu</strong>, serta menyinkronkan transaksi kas setiap kali dicatat.
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={connectGoogleDrive}
                className="inline-flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg shadow-xs hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User Account Info */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Google User'}
                    className="w-9 h-9 rounded-full border border-slate-300"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold">
                    {(googleUser.email || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {googleUser.displayName || 'Pengguna Google'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {googleUser.email}
                  </div>
                </div>
              </div>

              {googleSheetsConfig?.lastSyncedAt && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Terakhir Disinkronkan:</span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {new Date(googleSheetsConfig.lastSyncedAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Linked Spreadsheet Card */}
            {googleSheetsConfig?.spreadsheetUrl ? (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Spreadsheet Terhubung di Google Drive
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {googleSheetsConfig.spreadsheetTitle || 'BKU Digital - Laporan Keuangan'}
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                      ID: {googleSheetsConfig.spreadsheetId}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={googleSheetsConfig.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Spreadsheet</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => syncToGoogleSheets()}
                      disabled={isSyncingSheets}
                      className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin text-emerald-600' : ''}`} />
                      <span>{isSyncingSheets ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
                    </button>
                  </div>
                </div>

                {/* Tab layout badges */}
                <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-700">Tab Lembar Kerja:</span>
                  <span className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-emerald-900 font-medium">
                    1. BKU Umum (Debit, Kredit, Saldo Kas/Bank)
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-emerald-900 font-medium">
                    2. BKU Kegiatan (Sub-Kegiatan & Belanja)
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-emerald-900 font-medium">
                    3. Rekap & Pagu (Persentase Penyerapan)
                  </span>
                </div>

                {/* Auto sync toggle */}
                <div className="pt-2 flex items-center justify-between gap-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={googleSheetsConfig.autoSyncEnabled !== false}
                      onChange={(e) => updateGoogleSheetsConfig({ autoSyncEnabled: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-medium text-slate-800">
                      Otomatis sinkron langsung setiap kali transaksi dicatat / diubah
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowNewSheetConfirm(true)}
                    className="text-[11px] text-slate-500 hover:text-slate-900 underline"
                  >
                    Buat Spreadsheet Baru
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Spreadsheet Belum Dibuat di Drive</h4>
                  <p className="text-[11px] text-slate-500">
                    Klik tombol di samping untuk membuat file Google Spreadsheet otomatis di akun Google Drive Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => createAndLinkSpreadsheet()}
                  disabled={isSyncingSheets}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{isSyncingSheets ? 'Membuat...' : 'Buat Spreadsheet Baru'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SISTEM ENKRIPSI DATA KEAMANAN (AES-GCM 256-bit) */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Sistem Keamanan & Enkripsi Data Kas (AES-GCM 256-bit)
              </h2>
              <p className="text-xs text-slate-500">
                Data keuangan dienkripsi secara client-side menggunakan Web Crypto API. Tidak ada pihak luar yang dapat membaca nominal kas Anda.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-semibold rounded-full border border-emerald-200 font-mono">
            <Lock className="w-3 h-3" />
            Aktif & Terlindungi
          </span>
        </div>

        {/* Set Master Key / Passphrase */}
        <form onSubmit={handleSetPassphrase} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-slate-600" />
            <span>Kunci Tambahan / Sandi Master Enkripsi</span>
          </h3>
          <p className="text-xs text-slate-500">
            Anda dapat menetapkan kata sandi master untuk mengunci basis data BKU di peramban ini.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Kata Sandi Baru (Min. 6 Karakter)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Ulangi Kata Sandi
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSettingKey || !passphrase}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isSettingKey ? 'Menerapkan Enkripsi...' : 'Terapkan Kunci Enkripsi'}</span>
          </button>
        </form>

        {/* Ekspor & Impor Cadangan Terenkripsi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Ekspor Vault */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-700" />
              <h4 className="text-xs font-bold text-slate-800">Unduh Cadangan Terenkripsi</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Buat cadangan seluruh transaksi BKU, sub-kegiatan, dan profil ke berkas format <code>.bku.enc</code> dengan perlindungan kriptografi penuh.
            </p>
            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Berkas Cadangan (.bku.enc)</span>
            </button>
          </div>

          {/* Impor Vault & Excel */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-slate-800">Unggah & Pulihkan Database</h4>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Excel & Vault
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Unggah file Excel (<code>.xlsx</code>, <code>.csv</code>) atau berkas cadangan (<code>.bku.enc</code>, <code>.json</code>) dengan pratinjau otomatis dan penyimpanan permanen ke cloud database.
            </p>

            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4 text-emerald-300" />
              <span>Buka Pusat Unggah Database</span>
            </button>
          </div>
        </div>
      </div>

      {/* FORM PROFIL INSTANSI & PEJABAT PENANDATANGAN */}
      <form onSubmit={handleInstansiSubmit} className="p-5 sm:p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Profil Instansi & Pejabat Penandatangan Dokumen
            </h2>
            <p className="text-xs text-slate-500">
              Data ini akan dicantumkan pada Kop Surat BKU, Berita Acara, dan lembar pengesahan cetak resmi.
            </p>
          </div>
        </div>

        {/* Logo Upload Box */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {formData.logoUrl ? (
              <img
                src={formData.logoUrl}
                alt="Logo Preview"
                className="w-14 h-14 object-contain rounded-xl border border-slate-300 bg-white p-1"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 text-xs font-semibold">
                No Logo
              </div>
            )}
            <div>
              <span className="text-xs font-bold text-slate-800 block">Logo Lembaga / Sekolah</span>
              <p className="text-[11px] text-slate-500">
                Akan ditampilkan di navigasi aplikasi dan hasil ekspor/unduhan laporan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs">
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Unggah Logo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
            {formData.logoUrl && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, logoUrl: undefined })}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors"
              >
                Hapus
              </button>
            )}
          </div>
        </div>

        {/* Data Lembaga */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Sekolah / Madrasah / Yayasan Pendidikan
            </label>
            <input
              type="text"
              required
              value={formData.namaInstansi}
              onChange={(e) => setFormData({ ...formData, namaInstansi: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tahun Ajaran (Kop BKU)
            </label>
            <input
              type="text"
              placeholder="Contoh: T.A 2026 / 2027"
              value={formData.tahunAjaran || ''}
              onChange={(e) => setFormData({ ...formData, tahunAjaran: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Unit Pengelola (Tata Usaha & Keuangan)
            </label>
            <input
              type="text"
              value={formData.unitPengelola}
              onChange={(e) => setFormData({ ...formData, unitPengelola: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Alamat Sekolah / Kantor Lengkap
            </label>
            <input
              type="text"
              value={formData.alamat}
              onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nomor Telepon
            </label>
            <input
              type="text"
              value={formData.telepon}
              onChange={(e) => setFormData({ ...formData, telepon: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Email Resmi
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Data Rekening & Saldo Awal */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
          <h3 className="text-xs font-bold text-slate-800">
            Pengaturan Rekening Kas & Saldo Awal Tahun
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Bank Rekening Kas Sekolah
              </label>
              <input
                type="text"
                value={formData.namaBank}
                onChange={(e) => setFormData({ ...formData, namaBank: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nomor Rekening Kas
              </label>
              <input
                type="text"
                value={formData.nomorRekeningBank}
                onChange={(e) => setFormData({ ...formData, nomorRekeningBank: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Saldo Awal Tahun dengan RupiahInput */}
          <div>
            <RupiahInput
              label="Saldo Awal Kas Tahun Anggaran (Per 1 Januari)"
              value={formData.saldoAwalTahun}
              onChange={(val) => setFormData({ ...formData, saldoAwalTahun: val })}
              showTerbilang={true}
            />
          </div>
        </div>

        {/* Pejabat Penandatangan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Kepala Instansi */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Pimpinan (Kepala Sekolah / Ketua Yayasan)</h4>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Jabatan</label>
              <input
                type="text"
                value={formData.jabatanKepala}
                onChange={(e) => setFormData({ ...formData, jabatanKepala: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Lengkap & Gelar</label>
              <input
                type="text"
                value={formData.namaKepala}
                onChange={(e) => setFormData({ ...formData, namaKepala: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">NIP / NIK / No. Pegawai (Opsional)</label>
              <input
                type="text"
                value={formData.nipKepala}
                onChange={(e) => setFormData({ ...formData, nipKepala: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
              />
            </div>
          </div>

          {/* Bendahara Sekolah */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Bendahara Sekolah / Keuangan Yayasan</h4>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Jabatan</label>
              <input
                type="text"
                value={formData.jabatanBendahara}
                onChange={(e) => setFormData({ ...formData, jabatanBendahara: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Lengkap & Gelar</label>
              <input
                type="text"
                value={formData.namaBendahara}
                onChange={(e) => setFormData({ ...formData, namaBendahara: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">NIP / NIK</label>
              <input
                type="text"
                value={formData.nipBendahara}
                onChange={(e) => setFormData({ ...formData, nipBendahara: e.target.value })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Kota / Tempat Penandatanganan Dokumen
            </label>
            <input
              type="text"
              value={formData.kotaTandaTangan}
              onChange={(e) => setFormData({ ...formData, kotaTandaTangan: e.target.value })}
              placeholder="Contoh: Jakarta"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-emerald-700 font-medium">
            {isSaved ? 'Informasi instansi berhasil disimpan!' : ''}
          </span>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simpan Perubahan Profil</span>
          </button>
        </div>
      </form>

      {/* Zona Berbahaya: Reset Semua Data Kas */}
      <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold text-rose-900">Kosongkan Semua Data Buku Kas (Cloud & Lokal)</h3>
          <p className="text-[11px] text-rose-700 mt-0.5">
            Menghapus tuntas seluruh catatan transaksi dan sub-kegiatan dari Cloud Firestore dan penyimpanan browser. Data akan bersih 100% sehingga aplikasi siap pakai untuk unggah database baru.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="px-3.5 py-2 bg-white hover:bg-rose-600 hover:text-white border border-rose-300 rounded-lg text-xs font-semibold text-rose-700 transition-colors shrink-0 cursor-pointer"
        >
          Bersihkan Data Total
        </button>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Bersihkan Database Total?</span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan <strong>menghapus permanen seluruh transaksi dan kegiatan dari Cloud Firestore server dan memori lokal</strong>. Data yang dihapus tidak dapat dipulihkan kecuali Anda memiliki file cadangan.
            </p>

            <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={shouldResetProfil}
                onChange={(e) => setShouldResetProfil(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-slate-700 font-medium">
                Reset profil instansi ke default juga (Fresh install)
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPurgingAll}
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPurgingAll}
                onClick={async () => {
                  setIsPurgingAll(true);
                  await purgeAllDatabase({ resetProfil: shouldResetProfil });
                  setIsPurgingAll(false);
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isPurgingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Membersihkan Cloud...</span>
                  </>
                ) : (
                  <span>Ya, Bersihkan Database Total</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Buat Spreadsheet Baru */}
      {showNewSheetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-800">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Buat File Spreadsheet Baru di Google Drive?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan membuat dokumen Google Spreadsheet baru di akun Google Drive Anda dengan 3 tab (<strong>BKU Umum</strong>, <strong>BKU Kegiatan</strong>, <strong>Rekap & Pagu</strong>) dan menyinkronkan seluruh mutasi yang ada saat ini. File spreadsheet lama Anda tetap tersimpan aman di Google Drive.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewSheetConfirm(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowNewSheetConfirm(false);
                  await createAndLinkSpreadsheet();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Ya, Buat Spreadsheet Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Konfirmasi Putuskan Sambungan Google */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Putuskan Sambungan Google Drive?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesi akun Google Anda akan dikeluarkan dari peramban ini. Sinkronisasi otomatis ke Google Spreadsheet akan dijeda hingga Anda masuk kembali. Data kas lokal dan database Firestore Anda tetap aman.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDisconnectConfirm(false);
                  await disconnectGoogleDrive();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Ya, Putuskan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pusat Unggah & Pemulihan Database Modal */}
      <DatabaseImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
};
