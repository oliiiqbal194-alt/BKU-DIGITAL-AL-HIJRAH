import React, { useState, useEffect } from 'react';
import { useBKU } from '../context/BKUContext';
import { KegiatanAnggaran, SumberDana } from '../types';
import { RupiahInput } from './RupiahInput';
import { X, Layers, Check } from 'lucide-react';

interface KegiatanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: KegiatanAnggaran | null;
}

export const KegiatanModal: React.FC<KegiatanModalProps> = ({
  isOpen,
  onClose,
  initialData
}) => {
  const { selectedTahun, addKegiatan, updateKegiatan } = useBKU();

  const [namaKegiatan, setNamaKegiatan] = useState('');
  const [penanggungJawab, setPenanggungJawab] = useState('');
  const [paguAnggaran, setPaguAnggaran] = useState(0);
  const [sumberDana, setSumberDana] = useState<SumberDana>('Dana Yayasan');
  const [deskripsi, setDeskripsi] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setNamaKegiatan(initialData.namaKegiatan);
      setPenanggungJawab(initialData.penanggungJawab);
      setPaguAnggaran(initialData.paguAnggaran);
      setSumberDana(initialData.sumberDana);
      setDeskripsi(initialData.deskripsi || '');
    } else {
      setNamaKegiatan('');
      setPenanggungJawab('');
      setPaguAnggaran(0);
      setSumberDana('Dana Yayasan');
      setDeskripsi('');
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!namaKegiatan.trim()) newErrors.namaKegiatan = 'Nama kegiatan tidak boleh kosong.';
    if (!penanggungJawab.trim()) newErrors.penanggungJawab = 'Penanggung jawab kegiatan wajib diisi.';
    if (paguAnggaran <= 0) newErrors.paguAnggaran = 'Pagu anggaran harus lebih besar dari 0.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    const payload = {
      kodeKegiatan: 'KEG-' + Math.floor(100 + Math.random() * 900),
      namaKegiatan: namaKegiatan.trim(),
      penanggungJawab: penanggungJawab.trim(),
      paguAnggaran,
      sumberDana,
      tahun: selectedTahun,
      targetWaktu: 'Sepanjang Tahun',
      deskripsi: deskripsi.trim() || undefined
    };

    let ok = false;
    if (initialData) {
      ok = await updateKegiatan(initialData.id, payload);
    } else {
      ok = await addKegiatan(payload);
    }

    setIsSubmitting(false);
    if (ok) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              {initialData ? 'Ubah Rencana Kegiatan & Pagu' : 'Tambah Sub-Kegiatan Anggaran'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pos kegiatan untuk Buku Kas Pembantu Kegiatan (BKU Kegiatan).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Sumber Dana
            </label>
            <select
              value={sumberDana}
              onChange={(e) => setSumberDana(e.target.value as SumberDana)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            >
              <option value="Dana Yayasan">Dana Yayasan</option>
              <option value="Dana Orangtua">Dana Orangtua</option>
              <option value="Dana Sekolah">Dana Sekolah</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Kegiatan Anggaran <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Penyelenggaraan Ujian Asesmen Nasional Berbasis Komputer"
              value={namaKegiatan}
              onChange={(e) => setNamaKegiatan(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.namaKegiatan && <p className="text-[11px] text-rose-500 mt-0.5">{errors.namaKegiatan}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Penanggung Jawab / PPTK <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Nama Koordinator Kegiatan"
              value={penanggungJawab}
              onChange={(e) => setPenanggungJawab(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.penanggungJawab && <p className="text-[11px] text-rose-500 mt-0.5">{errors.penanggungJawab}</p>}
          </div>

          {/* Pagu Anggaran dengan Rupiah Input */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <RupiahInput
              label="Alokasi Pagu Anggaran (Rp)"
              value={paguAnggaran}
              onChange={setPaguAnggaran}
              error={errors.paguAnggaran}
              showTerbilang={true}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Deskripsi & Rincian Penggunaan
            </label>
            <textarea
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Catatan tambahan mengenai sub-kegiatan..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{initialData ? 'Simpan Perubahan' : 'Tambah Kegiatan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
