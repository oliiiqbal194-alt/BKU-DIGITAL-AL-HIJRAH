import React, { useState, useEffect } from 'react';
import { useBKU } from '../context/BKUContext';
import { KegiatanAnggaran, JenisKas, JenisTransaksi, FileLampiran } from '../types';
import { RupiahInput } from './RupiahInput';
import { ReceiptUploader } from './ReceiptUploader';
import { formatRupiah } from '../utils/formatters';
import { X, FolderKanban, Check, AlertCircle } from 'lucide-react';

interface KegiatanTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedKegiatan?: KegiatanAnggaran | null;
}

export const KegiatanTransactionModal: React.FC<KegiatanTransactionModalProps> = ({
  isOpen,
  onClose,
  preSelectedKegiatan
}) => {
  const {
    kegiatan,
    selectedBulan,
    selectedTahun,
    addTransaksi,
    getNextNomorBukti,
    getKegiatanStats
  } = useBKU();

  const [selectedKegiatanId, setSelectedKegiatanId] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>('');
  const [nomorBukti, setNomorBukti] = useState<string>('');
  const [uraian, setUraian] = useState<string>('');
  const [nominal, setNominal] = useState<number>(0);
  const [penerima, setPenerima] = useState<string>('');
  const [penanggungJawab, setPenanggungJawab] = useState<string>('');
  const [jenisKas, setJenisKas] = useState<JenisKas>('Kas Sekolah');
  const [metodePembayaran, setMetodePembayaran] = useState<'Tunai' | 'Bank / Non-Tunai'>('Tunai');
  const [lampiran, setLampiran] = useState<FileLampiran[]>([]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when opened or when preSelectedKegiatan changes
  useEffect(() => {
    if (isOpen) {
      const activeKeg = preSelectedKegiatan || (kegiatan.length > 0 ? kegiatan[0] : null);
      const kegId = activeKeg ? activeKeg.id : '';
      setSelectedKegiatanId(kegId);

      // Default date to active month/year or current date
      const today = new Date();
      const bStr = selectedBulan.toString().padStart(2, '0');
      const dStr = today.getDate().toString().padStart(2, '0');
      setTanggal(`${selectedTahun}-${bStr}-${dStr}`);

      setNomorBukti(getNextNomorBukti('Keluar', selectedBulan));
      setUraian('');
      setNominal(0);
      setPenerima('');
      setPenanggungJawab(activeKeg?.penanggungJawab || '');
      setLampiran([]);
      
      if (activeKeg) {
        if (activeKeg.sumberDana === 'Dana Yayasan') setJenisKas('Kas Yayasan');
        else if (activeKeg.sumberDana === 'Dana Orangtua') setJenisKas('Kas Orang Tua');
        else setJenisKas('Kas Sekolah');
      } else {
        setJenisKas('Kas Sekolah');
      }

      setMetodePembayaran('Tunai');
      setErrors({});
    }
  }, [isOpen, preSelectedKegiatan, kegiatan, selectedBulan, selectedTahun, getNextNomorBukti]);

  if (!isOpen) return null;

  const currentKegiatan = kegiatan.find((k) => k.id === selectedKegiatanId);
  const stats = currentKegiatan ? getKegiatanStats(currentKegiatan.id) : null;

  const handleKegiatanChange = (kegId: string) => {
    setSelectedKegiatanId(kegId);
    const keg = kegiatan.find((k) => k.id === kegId);
    if (keg) {
      if (keg.sumberDana === 'Dana Yayasan') setJenisKas('Kas Yayasan');
      else if (keg.sumberDana === 'Dana Orangtua') setJenisKas('Kas Orang Tua');
      else setJenisKas('Kas Sekolah');
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedKegiatanId || !currentKegiatan) {
      errs.kegiatan = 'Sub-kegiatan anggaran wajib dipilih.';
    }
    if (!tanggal) {
      errs.tanggal = 'Tanggal transaksi wajib diisi.';
    }
    if (!uraian.trim()) {
      errs.uraian = 'Uraian pengeluaran belanja wajib diisi.';
    }
    if (nominal <= 0) {
      errs.nominal = 'Nominal belanja harus lebih dari Rp 0.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !currentKegiatan) return;

    setIsSubmitting(true);
    try {
      const [thnStr, blnStr] = tanggal.split('-');
      const bulanNum = parseInt(blnStr, 10) || selectedBulan;
      const tahunNum = parseInt(thnStr, 10) || selectedTahun;

      const success = await addTransaksi({
        tanggal,
        bulan: bulanNum,
        tahun: tahunNum,
        nomorBukti,
        uraian: uraian.trim(),
        kodeRekening: currentKegiatan.kodeKegiatan,
        posKategori: 'Kegiatan Kesiswaan & Ekstrakurikuler',
        sumberDana: currentKegiatan.sumberDana,
        jenisKas,
        jenisTransaksi: 'Keluar' as JenisTransaksi,
        metodePembayaran,
        nominal,
        penerima: penerima.trim() || undefined,
        penanggungJawab: penanggungJawab.trim() || undefined,
        kegiatanId: currentKegiatan.id,
        kegiatanNama: currentKegiatan.namaKegiatan,
        lampiran: lampiran.length > 0 ? lampiran : undefined
      });

      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Tambah Transaksi BKU Kegiatan
              </h2>
              <p className="text-xs text-slate-400">
                Pencatatan pengeluaran kas yang memotong pagu sub-kegiatan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Activity Banner & Pagu Status */}
        {currentKegiatan && stats && (
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <div>
                <span className="font-mono text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded mr-2">
                  {currentKegiatan.kodeKegiatan}
                </span>
                <span className="font-bold text-slate-900">{currentKegiatan.namaKegiatan}</span>
              </div>
              <span className="font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded text-[11px] shrink-0">
                Sumber: {currentKegiatan.sumberDana}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Pagu Disetujui</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatRupiah(currentKegiatan.paguAnggaran, true)}
                </span>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Realisasi Belanja</span>
                <span className="font-mono font-bold text-emerald-800">
                  {formatRupiah(stats.totalRealisasi, true)}
                </span>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-lg">
                <span className="text-slate-400 block text-[10px]">Sisa Pagu Tersedia</span>
                <span className={`font-mono font-bold ${stats.sisa < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatRupiah(stats.sisa, true)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Form Input */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {kegiatan.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Belum Ada Sub-Kegiatan</p>
                <p className="mt-0.5">Silakan buat sub-kegiatan anggaran terlebih dahulu sebelum mencatat transaksi kegiatan.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Select Sub-Kegiatan */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Pilih Sub-Kegiatan Anggaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedKegiatanId}
                  onChange={(e) => handleKegiatanChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                >
                  {kegiatan.map((k) => (
                    <option key={k.id} value={k.id}>
                      [{k.kodeKegiatan}] {k.namaKegiatan} — ({k.sumberDana})
                    </option>
                  ))}
                </select>
                {errors.kegiatan && <p className="text-rose-600 font-medium">{errors.kegiatan}</p>}
              </div>

              {/* Tanggal & No Bukti */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">
                    Tanggal Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                  />
                  {errors.tanggal && <p className="text-rose-600 font-medium">{errors.tanggal}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">
                    Nomor Bukti Transaksi
                  </label>
                  <input
                    type="text"
                    value={nomorBukti}
                    onChange={(e) => setNomorBukti(e.target.value)}
                    placeholder="Otomatis tergenerasi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Uraian Belanja */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Uraian Transaksi / Belanja Kegiatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uraian}
                  onChange={(e) => setUraian(e.target.value)}
                  placeholder="Contoh: Pembelian spanduk, konsumsi peserta panitia, atau honor narasumber"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                />
                {errors.uraian && <p className="text-rose-600 font-medium">{errors.uraian}</p>}
              </div>

              {/* Nominal Input */}
              <RupiahInput
                value={nominal}
                onChange={setNominal}
                label="Nilai Belanja Kegiatan (Rp)"
                placeholder="0"
                required={true}
                maxSaldo={stats ? stats.sisa : undefined}
                error={errors.nominal}
              />

              {/* Penerima / Toko & Penanggung Jawab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">
                    Penerima / Toko / Penyedia
                  </label>
                  <input
                    type="text"
                    value={penerima}
                    onChange={(e) => setPenerima(e.target.value)}
                    placeholder="Contoh: CV Media Grafika / Panitia"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 block">
                    Nama Penanggung Jawab / Pelaksana
                  </label>
                  <input
                    type="text"
                    value={penanggungJawab}
                    onChange={(e) => setPenanggungJawab(e.target.value)}
                    placeholder="Contoh: Budi Santoso, S.Pd."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                  />
                </div>
              </div>

              {/* Jenis KAS Penerbitan */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Jenis KAS Penerbitan
                </label>
                <select
                  value={jenisKas}
                  onChange={(e) => setJenisKas(e.target.value as JenisKas)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50"
                >
                  <option value="Kas Sekolah">Kas Sekolah</option>
                  <option value="Kas Yayasan">Kas Yayasan</option>
                  <option value="Kas Orang Tua">Kas Orang Tua</option>
                </select>
              </div>

              {/* Metode Pembayaran */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Metode Pembayaran
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                    <input
                      type="radio"
                      name="metodePembayaranKeg"
                      checked={metodePembayaran === 'Tunai'}
                      onChange={() => setMetodePembayaran('Tunai')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Tunai (Kas)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                    <input
                      type="radio"
                      name="metodePembayaranKeg"
                      checked={metodePembayaran === 'Bank / Non-Tunai'}
                      onChange={() => setMetodePembayaran('Bank / Non-Tunai')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Transfer Bank / Non-Tunai</span>
                  </label>
                </div>
              </div>

              {/* Receipt Upload Section */}
              <div className="pt-2 border-t border-slate-100">
                <ReceiptUploader files={lampiran} onChange={setLampiran} />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || kegiatan.length === 0}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Simpan Transaksi Kegiatan</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
