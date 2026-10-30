import React, { useState } from 'react';
import { BKUProvider, useBKU } from './context/BKUContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BKUUmumView } from './components/BKUUmumView';
import { BKUKegiatanView } from './components/BKUKegiatanView';
import { RekapitulasiView } from './components/RekapitulasiView';
import { SettingsSecurityView } from './components/SettingsSecurityView';
import { TransactionModal } from './components/TransactionModal';
import { KegiatanTransactionModal } from './components/KegiatanTransactionModal';
import { KegiatanModal } from './components/KegiatanModal';
import { PrintReportModal } from './components/PrintReportModal';
import { BatchTransactionModal } from './components/BatchTransactionModal';
import { ToastContainer } from './components/Toast';
import { TransaksiBKU, KegiatanAnggaran } from './types';
import { BookOpen, FolderKanban, BarChart3, ShieldCheck, Building2 } from 'lucide-react';

function BKUAppContent() {
  const { activeTab, setActiveTab, instansi, selectedTahun, isLoading } = useBKU();

  // Modals state
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransaksiBKU | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const [isKegiatanTransactionModalOpen, setIsKegiatanTransactionModalOpen] = useState(false);
  const [selectedKegiatanForTx, setSelectedKegiatanForTx] = useState<KegiatanAnggaran | null>(null);

  const [isKegiatanModalOpen, setIsKegiatanModalOpen] = useState(false);
  const [editingKegiatan, setEditingKegiatan] = useState<KegiatanAnggaran | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTargetBulan, setPrintTargetBulan] = useState<number | undefined>(undefined);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleOpenNewTransaction = () => {
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleOpenKegiatanTransaction = (keg?: KegiatanAnggaran | null) => {
    setSelectedKegiatanForTx(keg || null);
    setIsKegiatanTransactionModalOpen(true);
  };

  const handleEditTransaction = (tx: TransaksiBKU) => {
    setEditingTransaction(tx);
    setIsTransactionModalOpen(true);
  };

  const handleOpenNewKegiatan = () => {
    setEditingKegiatan(null);
    setIsKegiatanModalOpen(true);
  };

  const handleEditKegiatan = (keg: KegiatanAnggaran) => {
    setEditingKegiatan(keg);
    setIsKegiatanModalOpen(true);
  };

  const handleOpenPrintPreview = (bulan: number) => {
    setPrintTargetBulan(bulan);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Bar adhering to the Universal Top Bar Contract */}
      <Navbar
        onOpenNewTransaction={handleOpenNewTransaction}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Mobile Drawer */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenNewTransaction={handleOpenNewTransaction}
      />

      {/* Main App Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Contextual Institutional Breadcrumb & Header info */}
        <div className="no-print flex items-center justify-between pb-4 border-b border-slate-200/80 text-xs text-slate-500">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800 truncate">{instansi.namaInstansi}</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span>Tahun Anggaran: <strong className="font-mono text-slate-800">{selectedTahun}</strong></span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-emerald-700 font-medium">Buku Kas Berjalan</span>
          </div>
        </div>

        {/* View Switcher */}
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 mt-3 font-medium">Memuat data kas terenkripsi...</p>
          </div>
        ) : (
          <>
            {activeTab === 'bku_umum' && (
              <BKUUmumView
                onOpenNewTransaction={handleOpenNewTransaction}
                onOpenBatchModal={() => setIsBatchModalOpen(true)}
                onEditTransaction={handleEditTransaction}
                onOpenPrintPreview={handleOpenPrintPreview}
              />
            )}

            {activeTab === 'bku_kegiatan' && (
              <BKUKegiatanView
                onOpenNewKegiatan={handleOpenNewKegiatan}
                onEditKegiatan={handleEditKegiatan}
                onOpenKegiatanTransaction={handleOpenKegiatanTransaction}
              />
            )}

            {activeTab === 'rekapitulasi' && (
              <RekapitulasiView />
            )}

            {activeTab === 'pengaturan' && (
              <SettingsSecurityView />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="no-print mt-auto border-t border-slate-200 bg-white py-4 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>© {new Date().getFullYear()} BKU Digital · Sistem Penatausahaan Kas Sekolah & Yayasan</p>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Dana Yayasan · Dana Orangtua · Dana Sekolah</span>
            <span aria-hidden="true">·</span>
            <span>Enkripsi Web Crypto AES-GCM</span>
          </div>
        </div>
      </footer>

      {/* Modals & Dialogs */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        initialData={editingTransaction}
      />

      <KegiatanTransactionModal
        isOpen={isKegiatanTransactionModalOpen}
        onClose={() => setIsKegiatanTransactionModalOpen(false)}
        preSelectedKegiatan={selectedKegiatanForTx}
      />

      <BatchTransactionModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
      />

      <KegiatanModal
        isOpen={isKegiatanModalOpen}
        onClose={() => setIsKegiatanModalOpen(false)}
        initialData={editingKegiatan}
      />

      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        targetBulan={printTargetBulan}
      />

      {/* Real-time Toasts & Notifications */}
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <BKUProvider>
      <BKUAppContent />
    </BKUProvider>
  );
}
