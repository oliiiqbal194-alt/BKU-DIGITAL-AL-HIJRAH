import React from 'react';
import { useBKU } from '../context/BKUContext';
import {
  BookOpen,
  FolderKanban,
  BarChart3,
  ShieldCheck,
  Building2,
  Calendar,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewTransaction: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpenNewTransaction }) => {
  const {
    activeTab,
    setActiveTab,
    instansi,
    selectedTahun,
    encryptionStatus
  } = useBKU();

  const navItems = [
    {
      id: 'bku_umum',
      label: 'Buku Kas Umum (BKU)',
      desc: 'Buku kas bulanan utama & arsip kas',
      icon: BookOpen
    },
    {
      id: 'bku_kegiatan',
      label: 'BKU Pembantu Kegiatan',
      desc: 'Realisasi anggaran sub-kegiatan',
      icon: FolderKanban
    },
    {
      id: 'rekapitulasi',
      label: 'Rekapitulasi Anggaran',
      desc: 'Laporan 12 bulan & belanja pos',
      icon: BarChart3
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan & Enkripsi',
      desc: 'Profil lembaga, pejabat & keamanan',
      icon: ShieldCheck
    }
  ];

  const handleSelectTab = (tab: any) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-emerald-400 font-bold text-sm">
              BK
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">BKU AL HIJRAH DIGITAL</h2>
              <p className="text-[10px] text-slate-400">Tahun Anggaran {selectedTahun}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instansi Info Box */}
        <div className="p-3.5 mx-3 mt-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{instansi.namaInstansi}</p>
              <p className="text-[11px] text-slate-500 truncate">{instansi.unitPengelola}</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-3 ${
                  isActive
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className={`text-[10px] ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Security badge at bottom */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            AES-GCM 256-bit
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Terenkripsi</span>
        </div>
      </aside>
    </>
  );
};
