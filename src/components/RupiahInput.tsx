import React, { useState, useEffect } from 'react';
import { formatRupiah, parseRupiah, angkaKeTerbilang } from '../utils/formatters';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface RupiahInputProps {
  value: number;
  onChange: (val: number) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  maxSaldo?: number; // untuk peringatan kas minus / overdraft
  showTerbilang?: boolean;
  disabled?: boolean;
  error?: string;
}

export const RupiahInput: React.FC<RupiahInputProps> = ({
  value,
  onChange,
  label = 'Nominal Transaksi (Rp)',
  placeholder = '0',
  required = true,
  maxSaldo,
  showTerbilang = true,
  disabled = false,
  error
}) => {
  const [displayValue, setDisplayValue] = useState<string>('');

  useEffect(() => {
    if (value === 0 && displayValue === '') {
      setDisplayValue('');
    } else {
      setDisplayValue(value > 0 ? formatRupiah(value, false) : '');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseRupiah(raw);
    onChange(parsed);
    setDisplayValue(parsed > 0 ? formatRupiah(parsed, false) : '');
  };

  const isOverdraft = maxSaldo !== undefined && value > maxSaldo && maxSaldo >= 0;
  const terbilangText = value > 0 ? angkaKeTerbilang(value) : '';

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 tracking-wide">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {maxSaldo !== undefined && (
            <span className="text-[11px] text-slate-500 font-mono">
              Batas Saldo Kas: {formatRupiah(maxSaldo, true)}
            </span>
          )}
        </div>
      )}

      {/* Input Box with Rp Prefix */}
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none flex items-center gap-1">
          <span className="text-xs font-bold text-slate-400 font-mono select-none">Rp</span>
        </div>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg text-base font-mono font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
              : isOverdraft
              ? 'border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
              : 'border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50'
          } ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-75' : ''}`}
        />
        {value > 0 && !isOverdraft && (
          <div className="absolute right-3 pointer-events-none text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Pencegahan Kesalahan: Terbilang Otomatis Bahasa Indonesia */}
      {showTerbilang && value > 0 && (
        <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-700 transition-all">
          <span className="font-medium text-slate-500 mr-1.5">Terbilang:</span>
          <span className="font-semibold text-emerald-800 italic">"{terbilangText}"</span>
        </div>
      )}

      {/* Peringatan Saldo Defisit / Overdraft */}
      {isOverdraft && (
        <div className="flex items-start gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Peringatan: Pengeluaran ini ({formatRupiah(value, true)}) melampaui sisa saldo kas tersedia saat ini ({formatRupiah(maxSaldo, true)}).
          </span>
        </div>
      )}

      {/* Pesan Kesalahan Validasi */}
      {error && (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      )}
    </div>
  );
};
