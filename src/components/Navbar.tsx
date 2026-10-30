import React from 'react';
import { useBKU } from '../context/BKUContext';
import { Plus, ShieldCheck, Menu, X, ExternalLink, RefreshCw, FileSpreadsheet } from 'lucide-react';

interface NavbarProps {
  onOpenNewTransaction: () => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewTransaction,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}) => {
  const {
    activeTab,
    setActiveTab,
    instansi,
    googleUser,
    googleSheetsConfig,
    isSyncingSheets,
    connectGoogleDrive,
    syncToGoogleSheets
  } = useBKU();

  return (
    <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-16">
        {/* Zone 1: Wordmark & Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2.5">
            {instansi.logoUrl ? (
              <img
                src={instansi.logoUrl}
                alt="Logo Sekolah"
                className="w-9 h-9 object-contain rounded-lg border border-slate-200 bg-white p-0.5 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-emerald-400 font-bold text-sm">
                BK
              </div>
            )}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('bku_umum');
              }}
              className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-emerald-700 transition-colors"
            >
              BKU AL HIJRAH DIGITAL
            </a>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('bku_umum')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
              activeTab === 'bku_umum'
                ? 'text-slate-950 border-emerald-600'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            BKU Umum
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bku_kegiatan')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
              activeTab === 'bku_kegiatan'
                ? 'text-slate-950 border-emerald-600'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            BKU Kegiatan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rekapitulasi')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
              activeTab === 'rekapitulasi'
                ? 'text-slate-950 border-emerald-600'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            Rekap Anggaran
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pengaturan')}
            className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 flex items-center gap-1.5 ${
              activeTab === 'pengaturan'
                ? 'text-slate-950 border-emerald-600'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Keamanan & Data</span>
          </button>
        </nav>

        {/* Zone 3: Google Drive/Sheets Status & Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Google Sheets Quick Access / Sync */}
          {googleSheetsConfig?.spreadsheetUrl ? (
            <div className="flex items-center gap-1 bg-emerald-50/80 border border-emerald-200/90 rounded-lg p-1">
              <a
                href={googleSheetsConfig.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Buka Spreadsheet di Google Drive"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/70 rounded transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Buka Spreadsheet</span>
                <ExternalLink className="w-3 h-3 text-emerald-600" />
              </a>

              <button
                type="button"
                onClick={() => syncToGoogleSheets()}
                disabled={isSyncingSheets}
                title="Sinkronkan data sekarang ke Google Sheets"
                className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheets ? 'animate-spin text-emerald-700' : ''}`} />
              </button>
            </div>
          ) : googleUser ? (
            <button
              type="button"
              onClick={() => syncToGoogleSheets()}
              disabled={isSyncingSheets}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isSyncingSheets ? 'Membuat...' : 'Buat Spreadsheet'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogleDrive}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
              title="Hubungkan Google Drive untuk menyimpan ke Spreadsheet"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Hubungkan Drive</span>
            </button>
          )}

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Tambah Transaksi</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>
      </div>
    </header>
  );
};
