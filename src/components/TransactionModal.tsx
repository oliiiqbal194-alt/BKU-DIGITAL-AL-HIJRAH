import React, { useState, useEffect } from 'react';
import { useBKU } from '../context/BKUContext';
import { ReceiptUploader } from './ReceiptUploader';
import {
  TransaksiBKU,
  JenisTransaksi,
  MetodePembayaran,
  SumberDana,
  JenisKas,
  FileLampiran
} from '../types';
import { RupiahInput } from './RupiahInput';
import { formatRupiah, formatTanggalBKU } from '../utils/formatters';
import {
  X,
  FileText,
  Check,
  Calculator
} from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TransaksiBKU | null;
  targetBulan?: number;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  targetBulan
}) => {
  const {
    selectedBulan,
    selectedTahun,
    kegiatan,
    addTransaksi,
    updateTransaksi,
    getSaldoAkhirBulan
  } = useBKU();

  const activeBulan = targetBulan || selectedBulan;

  const [jenisTransaksi, setJenisTransaksi] = useState<JenisTransaksi>('keluar');
  const [jenisKas, setJenisKas] = useState<JenisKas>('Kas Sekolah');
  const [sumberDana, setSumberDana] = useState<SumberDana>('Dana Sekolah');
  const [tanggal, setTanggal] = useState<string>('');
  const [uraian, setUraian] = useState<string>('');
  const [metodePembayaran, setMetodePembayaran] = useState<MetodePembayaran>('Tunai');
  const [nominal, setNominal] = useState<number>(0);
  const [kegiatanId, setKegiatanId] = useState<string>('');
  const [penanggungJawab, setPenanggungJawab] = useState<string>('');
  const [lampiran, setLampiran] = useState<FileLampiran[]>([]);

  // Pajak State
  const [enablePajak, setEnablePajak] = useState<boolean>(false);
  const [ppnCheck, setPpnCheck] = useState<boolean>(false);
  const [pph21Check, setPph21Check] = useState<boolean>(false);
  const [pph22Check, setPph22Check] = useState<boolean>(false);
  const [pph23Check, setPph23Check] = useState<boolean>(false);

  // Validation & UI state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize or reset form
  useEffect(() => {
    if (initialData) {
      setJenisTransaksi(initialData.jenisTransaksi === 'masuk' ? 'Masuk' : initialData.jenisTransaksi === 'SA' ? 'SA' : 'Keluar');
      setJenisKas(initialData.jenisKas || 'Kas Sekolah');
      setSumberDana(initialData.sumberDana || 'Dana Sekolah');
      setTanggal(initialData.tanggal);
      setUraian(initialData.uraian);
      setMetodePembayaran(initialData.metodePembayaran);
      setNominal(initialData.nominal);
      setKegiatanId(initialData.kegiatanId || '');
      setPenanggungJawab(initialData.penanggungJawab || '');
      setLampiran(initialData.lampiran || []);

      if (initialData.pajak && initialData.pajak.totalPotongan > 0) {
        setEnablePajak(true);
        setPpnCheck(!!initialData.pajak.ppnPersen);
        setPph21Check(!!initialData.pajak.pph21Persen);
        setPph22Check(!!initialData.pajak.pph22Persen);
        setPph23Check(!!initialData.pajak.pph23Persen);
      } else {
        setEnablePajak(false);
      }
    } else {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const defaultDate = `${selectedTahun}-${pad(activeBulan)}-01`;
      setJenisTransaksi('Keluar');
      setJenisKas('Kas Sekolah');
      setSumberDana('Dana Sekolah');
      setTanggal(defaultDate);
      setUraian('');
      setMetodePembayaran('Tunai');
      setNominal(0);
      setKegiatanId('');
      setPenanggungJawab('');
      setLampiran([]);
      setEnablePajak(false);
      setPpnCheck(false);
      setPph21Check(false);
      setPph22Check(false);
      setPph23Check(false);
    }
    setErrors({});
  }, [initialData, isOpen, activeBulan, selectedTahun]);

  if (!isOpen) return null;

  // Hitung Potongan Pajak
  const hitungPajak = () => {
    if (!enablePajak || nominal <= 0) {
      return { totalPotongan: 0 };
    }
    const ppnNominal = ppnCheck ? Math.round(nominal * 0.11) : 0;
    const pph21Nominal = pph21Check ? Math.round(nominal * 0.05) : 0;
    const pph22Nominal = pph22Check ? Math.round(nominal * 0.015) : 0;
    const pph23Nominal = pph23Check ? Math.round(nominal * 0.02) : 0;
    const total = ppnNominal + pph21Nominal + pph22Nominal + pph23Nominal;

    return {
      ppnPersen: ppnCheck ? 11 : undefined,
      ppnNominal: ppnCheck ? ppnNominal : undefined,
      pph21Persen: pph21Check ? 5 : undefined,
      pph21Nominal: pph21Check ? pph21Nominal : undefined,
      pph22Persen: pph22Check ? 1.5 : undefined,
      pph22Nominal: pph22Check ? pph22Nominal : undefined,
      pph23Persen: pph23Check ? 2 : undefined,
      pph23Nominal: pph23Check ? pph23Nominal : undefined,
      totalPotongan: total
    };
  };

  const pajakCalculated = hitungPajak();
  const nilaiBersih = nominal - pajakCalculated.totalPotongan;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!tanggal) newErrors.tanggal = 'Tanggal transaksi wajib diisi.';
    if (!uraian.trim()) newErrors.uraian = 'Uraian rincian transaksi tidak boleh kosong.';
    if (nominal <= 0) newErrors.nominal = 'Nominal transaksi harus lebih dari 0.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const dateObj = new Date(tanggal);
    const parsedBulan = dateObj.getMonth() + 1;
    const parsedTahun = dateObj.getFullYear();

    const computedSumberDana: SumberDana = jenisKas === 'Kas Yayasan' ? 'Dana Yayasan' : jenisKas === 'Kas Orang Tua' ? 'Dana Orangtua' : 'Dana Sekolah';
    const selectedKegiatan = kegiatan.find((k) => k.id === kegiatanId);

    const payload = {
      tanggal,
      bulan: parsedBulan,
      tahun: parsedTahun,
      nomorBukti: '-',
      uraian: uraian.trim(),
      posKategori: 'Lain-lain' as any,
      sumberDana: computedSumberDana,
      jenisKas,
      jenisTransaksi: (jenisTransaksi === 'masuk' ? 'Masuk' : jenisTransaksi === 'SA' ? 'SA' : 'Keluar') as JenisTransaksi,
      metodePembayaran,
      nominal,
      penanggungJawab: penanggungJawab.trim() || undefined,
      kegiatanId: kegiatanId || undefined,
      kegiatanNama: selectedKegiatan ? selectedKegiatan.namaKegiatan : undefined,
      pajak: enablePajak ? pajakCalculated : undefined,
      lampiran: lampiran.length > 0 ? lampiran : undefined
    };

    let ok = false;
    if (initialData) {
      ok = await updateTransaksi(initialData.id, payload);
    } else {
      ok = await addTransaksi(payload);
    }

    setIsSubmitting(false);
    if (ok) {
      onClose();
    }
  };

  const currentKas = getSaldoAkhirBulan(activeBulan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              {initialData ? 'Ubah Catatan Transaksi Kas' : 'Catat Transaksi Kas Sekolah & Yayasan'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Penatausahaan kas non-pemerintah (Dana Yayasan, Dana Orangtua, dan Dana Sekolah).
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Kolom Transaksi (Keluar / Masuk) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">
                Transaksi <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                Pilih status: <strong>{jenisTransaksi === 'masuk' || jenisTransaksi === 'Masuk' ? 'Debet (Penerimaan)' : 'Kredit (Pengeluaran)'}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setJenisTransaksi('Keluar')}
                className={`py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  jenisTransaksi === 'keluar' || jenisTransaksi === 'Keluar'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Keluar (Kredit)
              </button>
              <button
                type="button"
                onClick={() => setJenisTransaksi('Masuk')}
                className={`py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  jenisTransaksi === 'masuk' || jenisTransaksi === 'Masuk'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk (Debet)
              </button>
            </div>
          </div>

          {/* Kolom Jenis KAS */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900">
                Jenis KAS <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-slate-200/80 rounded text-slate-700">
                {jenisKas}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['Kas Sekolah', 'Kas Yayasan', 'Kas Orang Tua'] as JenisKas[]).map((kasOption) => (
                <button
                  key={kasOption}
                  type="button"
                  onClick={() => {
                    setJenisKas(kasOption);
                    const sd: SumberDana = kasOption === 'Kas Yayasan' ? 'Dana Yayasan' : kasOption === 'Kas Orang Tua' ? 'Dana Orangtua' : 'Dana Sekolah';
                    setSumberDana(sd);
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                    jenisKas === kasOption
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {kasOption}
                </button>
              ))}
            </div>
          </div>

          {/* Tanggal & Metode Pembayaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Tanggal Transaksi <span className="text-rose-500">*</span>
                </label>
                {tanggal && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                    {formatTanggalBKU(tanggal)}
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
              {errors.tanggal && <p className="text-[11px] text-rose-500 mt-0.5">{errors.tanggal}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Metode Pembayaran
              </label>
              <select
                value={metodePembayaran}
                onChange={(e) => setMetodePembayaran(e.target.value as MetodePembayaran)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              >
                <option value="Tunai">Kas Tunai Sekolah</option>
                <option value="Bank / Non-Tunai">Transfer Rekening Bank</option>
              </select>
            </div>
          </div>

          {/* Uraian Transaksi */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Uraian Transaksi <span className="text-rose-500">*</span>
              </label>
            </div>
            <textarea
              required
              rows={2}
              value={uraian}
              onChange={(e) => setUraian(e.target.value)}
              placeholder="Contoh: Bayar Biaya Konsumsi Rapat wakasek"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.uraian && <p className="text-[11px] text-rose-500 mt-0.5">{errors.uraian}</p>}
          </div>

          {/* Nama Penanggung Jawab */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Penanggung Jawab / Pelaksana
            </label>
            <input
              type="text"
              value={penanggungJawab}
              onChange={(e) => setPenanggungJawab(e.target.value)}
              placeholder="Contoh: Budi Santoso, S.Pd."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Alokasi BKU Kegiatan */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <label className="text-xs font-semibold text-slate-800 block flex items-center justify-between">
              <span>Alokasi ke Buku Kas Kegiatan (BKU Kegiatan)</span>
              <span className="text-[10px] text-slate-500 font-normal">Opsional</span>
            </label>
            <p className="text-[11px] text-slate-500 leading-snug">
              Pilih sub-kegiatan jika belanja ini memotong pagu program. Biarkan kosong jika belanja operasional rutin umum sekolah.
            </p>
            <select
              value={kegiatanId}
              onChange={(e) => {
                const kegId = e.target.value;
                setKegiatanId(kegId);
                if (kegId) {
                  const k = kegiatan.find(item => item.id === kegId);
                  if (k) {
                    if (k.sumberDana === 'Dana Yayasan') setJenisKas('Kas Yayasan');
                    else if (k.sumberDana === 'Dana Orangtua') setJenisKas('Kas Orang Tua');
                    else setJenisKas('Kas Sekolah');
                    setSumberDana(k.sumberDana);
                  }
                }
              }}
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">-- Belanja Rutin Umum (Hanya Masuk BKU Umum) --</option>
              {kegiatan.map((k) => (
                <option key={k.id} value={k.id}>
                  [{k.kodeKegiatan}] {k.namaKegiatan} ({k.sumberDana})
                </option>
              ))}
            </select>
          </div>

          {/* NOMINAL INPUT */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <RupiahInput
              label="Nominal Transaksi (Nilai Bruto)"
              value={nominal}
              onChange={setNominal}
              maxSaldo={jenisTransaksi === 'keluar' ? currentKas : undefined}
              error={errors.nominal}
              showTerbilang={true}
            />

            {/* Kalkulator Potongan Pajak Opsional */}
            {jenisTransaksi === 'keluar' && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setEnablePajak(!enablePajak)}
                    className="text-xs font-medium text-slate-700 flex items-center gap-1.5 hover:text-emerald-700"
                  >
                    <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Potongan Pajak / Administrasi (Opsional)</span>
                    <span className="text-[10px] text-slate-400">({enablePajak ? 'Aktif' : 'Non-aktif'})</span>
                  </button>
                  {enablePajak && pajakCalculated.totalPotongan > 0 && (
                    <span className="text-xs font-mono font-semibold text-rose-700">
                      Potongan: {formatRupiah(pajakCalculated.totalPotongan, true)}
                    </span>
                  )}
                </div>

                {enablePajak && (
                  <div className="mt-2.5 p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ppnCheck}
                          onChange={(e) => setPpnCheck(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>PPN 11%</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pph21Check}
                          onChange={(e) => setPph21Check(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>PPh 21 (5%)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pph22Check}
                          onChange={(e) => setPph22Check(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>PPh 22 (1.5%)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pph23Check}
                          onChange={(e) => setPph23Check(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>PPh 23 (2%)</span>
                      </label>
                    </div>

                    {nominal > 0 && pajakCalculated.totalPotongan > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Jumlah Bersih Dibayarkan ke Penerima:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {formatRupiah(nilaiBersih, true)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Receipt Upload Section */}
            <div className="pt-2 border-t border-slate-100">
              <ReceiptUploader files={lampiran} onChange={setLampiran} />
            </div>
          </div>

          {/* Modal Footer Actions */}
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
              {isSubmitting ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{initialData ? 'Perbarui Transaksi' : 'Simpan Transaksi'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
