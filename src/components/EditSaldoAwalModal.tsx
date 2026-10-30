import React, { useState, useEffect } from 'react';
import { useBKU } from '../context/BKUContext';
import { NAMA_BULAN } from '../utils/formatters';
import { RupiahInput } from './RupiahInput';
import { X, Wallet, Check, RotateCcw, AlertCircle } from 'lucide-react';

interface EditSaldoAwalModalProps {
  isOpen: boolean;
  onClose: () => void;
  bulan: number;
  tahun: number;
}

export const EditSaldoAwalModal: React.FC<EditSaldoAwalModalProps> = ({
  isOpen,
  onClose,
  bulan,
  tahun
}) => {
  const {
    getSaldoAwalBulan,
    setSaldoAwalBulan,
    isCustomSaldoAwalBulan
  } = useBKU();

  const [nominal, setNominal] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const namaBulan = NAMA_BULAN[bulan - 1] || `Bulan ${bulan}`;
  const isCustom = isCustomSaldoAwalBulan(bulan);

  useEffect(() => {
    if (isOpen) {
      const currentSaldoAwal = getSaldoAwalBulan(bulan);
      setNominal(currentSaldoAwal);
    }
  }, [isOpen, bulan, getSaldoAwalBulan]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ok = await setSaldoAwalBulan(bulan, nominal);
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToAuto = async () => {
    setIsSubmitting(true);
    try {
      const ok = await setSaldoAwalBulan(bulan, null);
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ubah Saldo Awal {namaBulan} {tahun}
              </h2>
              <p className="text-xs text-slate-500">
                Penyesuaian nominal saldo kas awal periode bulanan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>Status Saldo Awal</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold ${
                isCustom
                  ? 'bg-amber-200 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {isCustom ? 'Disesuaikan Manual' : 'Hitungan Otomatis Akumulasi'}
              </span>
            </div>
            <p className="text-[11px] text-amber-800 leading-snug">
              {isCustom
                ? `Saldo awal bulan ${namaBulan} saat ini diatur secara manual. Anda dapat mengubah nilainya atau mengembalikan ke hitungan akumulasi otomatis dari bulan sebelumnya.`
                : `Secara bawaan, saldo awal bulan ${namaBulan} dihitung otomatis dari akumulasi saldo akhir bulan sebelumnya. Jika terdapat penyesuaian kas, isi nominal di bawah.`}
            </p>
          </div>

          <RupiahInput
            label={`Nominal Saldo Awal (${namaBulan} ${tahun})`}
            value={nominal}
            onChange={setNominal}
            showTerbilang={true}
          />

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
            <div>
              {isCustom && (
                <button
                  type="button"
                  onClick={handleResetToAuto}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center gap-1.5"
                  title="Kembalikan nilai saldo awal bulan ini ke akumulasi otomatis"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset ke Otomatis</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Simpan Saldo Awal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
