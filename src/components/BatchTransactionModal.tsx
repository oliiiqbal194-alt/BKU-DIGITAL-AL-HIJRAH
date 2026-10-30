import React, { useState, useRef } from 'react';
import { useBKU } from '../context/BKUContext';
import { JenisKas, MetodePembayaran, SumberDana, TransaksiBKU } from '../types';
import { parseRupiah, angkaKeRomawi } from '../utils/formatters';
import { X, Plus, Trash2, Check, Database, FileSpreadsheet, AlertCircle, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BatchTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBulan?: number;
}

interface BatchRow {
  id: string;
  tanggal: string;
  jenisTransaksi: 'Keluar' | 'Masuk';
  uraian: string;
  jenisKas: JenisKas;
  nominalStr: string;
  metodePembayaran: MetodePembayaran;
}

function parseDateString(dateStr: string, defaultYear: number, defaultMonth: number): string {
  if (!dateStr) return `${defaultYear}-${defaultMonth.toString().padStart(2, '0')}-01`;
  const clean = dateStr.trim();
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    let day = parts[0];
    let monthStr = parts[1];
    let yearStr = parts[2];

    const monthsMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', mei: '05',
      jun: '06', jul: '07', aug: '08', agu: '08', sep: '09',
      oct: '10', okt: '10', nov: '11', dec: '12', des: '12'
    };

    let month = '01';
    if (monthsMap[monthStr.toLowerCase()]) {
      month = monthsMap[monthStr.toLowerCase()];
    } else if (!isNaN(Number(monthStr))) {
      month = monthStr.padStart(2, '0');
    }

    let year = yearStr;
    if (year.length === 2) {
      year = '20' + year;
    }
    day = day.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return `${defaultYear}-${defaultMonth.toString().padStart(2, '0')}-01`;
}

export const BatchTransactionModal: React.FC<BatchTransactionModalProps> = ({
  isOpen,
  onClose,
  targetBulan
}) => {
  const { selectedBulan, selectedTahun, addMultipleTransaksi, kegiatan } = useBKU();
  const activeBulan = targetBulan || selectedBulan;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const defaultDate = `${selectedTahun}-${pad(activeBulan)}-01`;

  const [batchKegiatanId, setBatchKegiatanId] = useState<string>('');
  const [rows, setRows] = useState<BatchRow[]>([
    {
      id: 'row_1',
      tanggal: defaultDate,
      jenisTransaksi: 'Keluar',
      uraian: '',
      jenisKas: 'Kas Sekolah',
      nominalStr: '',
      metodePembayaran: 'Tunai'
    },
    {
      id: 'row_2',
      tanggal: defaultDate,
      jenisTransaksi: 'Keluar',
      uraian: '',
      jenisKas: 'Kas Sekolah',
      nominalStr: '',
      metodePembayaran: 'Tunai'
    },
    {
      id: 'row_3',
      tanggal: defaultDate,
      jenisTransaksi: 'Masuk',
      uraian: '',
      jenisKas: 'Kas Sekolah',
      nominalStr: '',
      metodePembayaran: 'Tunai'
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tanggal: defaultDate,
        jenisTransaksi: 'Keluar',
        uraian: '',
        jenisKas: 'Kas Sekolah',
        nominalStr: '',
        metodePembayaran: 'Tunai'
      }
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) {
      setErrorMsg('Minimal harus ada 1 baris transaksi.');
      return;
    }
    setErrorMsg(null);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof BatchRow, val: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const handleNominalChange = (id: string, rawInput: string) => {
    const num = parseRupiah(rawInput);
    const formatted = num > 0 ? num.toLocaleString('id-ID') : '';
    updateRow(id, 'nominalStr', formatted);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        // Cari baris header yang mengandung kolom 'Tanggal' atau 'Uraian'
        let headerRowIdx = -1;
        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          if (row && row.some((cell: any) => typeof cell === 'string' && (cell.toLowerCase().includes('tanggal') || cell.toLowerCase().includes('uraian')))) {
            headerRowIdx = i;
            break;
          }
        }

        const importedRows: BatchRow[] = [];
        const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 5;

        for (let i = startIdx; i < json.length; i++) {
          const r = json[i];
          if (!r || r.length === 0) continue;

          // Format kolom BKU Al Hijrah: No(0), Tanggal(1), Transaksi(2), Uraian(3), Jenis KAS(4), Saldo Awal(5), Debet(6), Kredit(7), Jumlah(8)
          const tanggalRaw = r[1];
          const jenisTxRaw = r[2]; // SA, Masuk, Keluar
          const uraianRaw = r[3];
          const jenisKasRaw = r[4] || 'Kas Sekolah';
          const debetRaw = r[6];
          const kreditRaw = r[7];

          // Jika baris kosong atau tidak ada uraian & nominal, lewati
          if (!uraianRaw && !debetRaw && !kreditRaw) continue;
          if (typeof uraianRaw === 'string' && uraianRaw.toLowerCase().includes('saldo awal') && i <= startIdx) {
            // Lewati baris saldo awal tabel (karena saldo awal otomatis dikelola sistem)
            continue;
          }

          let jenisTransaksi: 'Keluar' | 'Masuk' = 'Keluar';
          if (jenisTxRaw && (jenisTxRaw.toString().toLowerCase().includes('masuk') || jenisTxRaw.toString().toUpperCase() === 'SA')) {
            jenisTransaksi = 'Masuk';
          }
          if (jenisTxRaw && jenisTxRaw.toString().toLowerCase().includes('keluar')) {
            jenisTransaksi = 'Keluar';
          }

          let nominal = 0;
          if (debetRaw !== undefined && debetRaw !== null && debetRaw !== '') {
            nominal = typeof debetRaw === 'number' ? debetRaw : parseRupiah(debetRaw.toString());
            jenisTransaksi = 'Masuk';
          } else if (kreditRaw !== undefined && kreditRaw !== null && kreditRaw !== '') {
            nominal = typeof kreditRaw === 'number' ? kreditRaw : parseRupiah(kreditRaw.toString());
            jenisTransaksi = 'Keluar';
          }

          let tanggalStr = defaultDate;
          if (tanggalRaw) {
            if (typeof tanggalRaw === 'string') {
              tanggalStr = parseDateString(tanggalRaw, selectedTahun, activeBulan);
            } else if (typeof tanggalRaw === 'number') {
              const excelDate = new Date((tanggalRaw - (25567 + 2)) * 86400 * 1000);
              if (!isNaN(excelDate.getTime())) {
                tanggalStr = excelDate.toISOString().split('T')[0];
              }
            }
          }

          importedRows.push({
            id: `imp_${i}_${Math.random().toString(36).substring(2, 6)}`,
            tanggal: tanggalStr,
            jenisTransaksi,
            uraian: String(uraianRaw || 'Transaksi Impor'),
            jenisKas: (jenisKasRaw === 'Kas Yayasan' || jenisKasRaw === 'Kas Orang Tua' || jenisKasRaw === 'Kas Sekolah') ? jenisKasRaw : 'Kas Sekolah',
            nominalStr: nominal > 0 ? nominal.toLocaleString('id-ID') : '',
            metodePembayaran: 'Tunai'
          });
        }

        if (importedRows.length > 0) {
          setRows(importedRows);
          setErrorMsg(null);
          setSuccessMsg(`Berhasil mengimpor ${importedRows.length} baris dari file Excel/CSV!`);
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          setErrorMsg('Tidak ditemukan data transaksi valid pada file yang diunggah. Pastikan format kolom sesuai.');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Gagal membaca file Excel/CSV. Pastikan format file benar.');
      }
    };
    reader.readAsArrayBuffer(file);
    if (e.target) e.target.value = '';
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.uraian.trim()) {
        setErrorMsg(`Baris ke-${i + 1}: Uraian transaksi wajib diisi.`);
        return;
      }
      const nom = parseRupiah(r.nominalStr);
      if (nom <= 0) {
        setErrorMsg(`Baris ke-${i + 1}: Nominal transaksi harus lebih dari 0.`);
        return;
      }
    }

    const selectedKeg = kegiatan.find((k) => k.id === batchKegiatanId);

    const payloadList: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[] = rows.map((r, idx) => {
      const dateObj = new Date(r.tanggal);
      const parsedBulan = isNaN(dateObj.getMonth()) ? activeBulan : dateObj.getMonth() + 1;
      const parsedTahun = isNaN(dateObj.getFullYear()) ? selectedTahun : dateObj.getFullYear();
      const romawi = angkaKeRomawi(parsedBulan);
      const tag = r.jenisTransaksi === 'Masuk' ? 'TRM' : 'KAS';
      const noBukti = `${(idx + 1).toString().padStart(3, '0')}/BKU-${tag}/${romawi}/${parsedTahun}`;
      const sumberDana: SumberDana = r.jenisKas === 'Kas Yayasan' ? 'Dana Yayasan' : r.jenisKas === 'Kas Orang Tua' ? 'Dana Orangtua' : 'Dana Sekolah';

      return {
        tanggal: r.tanggal,
        bulan: parsedBulan,
        tahun: parsedTahun,
        nomorBukti: noBukti,
        uraian: r.uraian.trim(),
        jenisKas: r.jenisKas,
        sumberDana,
        jenisTransaksi: r.jenisTransaksi,
        metodePembayaran: r.metodePembayaran,
        nominal: parseRupiah(r.nominalStr),
        posKategori:
          r.jenisTransaksi === 'Masuk'
            ? 'Penerimaan Dana Sekolah (Mandiri/Unit Usaha)'
            : selectedKeg
            ? 'Kegiatan Kesiswaan & Ekstrakurikuler'
            : 'Operasional (Listrik, Air, Wifi)',
        kodeRekening: r.jenisTransaksi === 'Masuk' ? '1.1.03' : '5.1.02',
        kegiatanId: batchKegiatanId || undefined,
        kegiatanNama: selectedKeg ? selectedKeg.namaKegiatan : undefined
      };
    });

    const success = await addMultipleTransaksi(payloadList);
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Input Database Transaksi Sekaligus (Format Excel / CSV)
              </h2>
              <p className="text-xs text-slate-500">
                Impor file Excel/CSV atau input langsung beberapa baris transaksi ke database BKU Bulanan.
              </p>
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

        {/* Action Bar: Upload File & Alokasi Sub-Kegiatan */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Format Excel / CSV</span>
            </div>
            {kegiatan.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Alokasikan ke Kegiatan:</span>
                <select
                  value={batchKegiatanId}
                  onChange={(e) => setBatchKegiatanId(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800"
                >
                  <option value="">-- Belanja Rutin Umum (Hanya Masuk BKU Umum) --</option>
                  {kegiatan.map((k) => (
                    <option key={k.id} value={k.id}>
                      [{k.kodeKegiatan}] {k.namaKegiatan}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="shrink-0 self-end md:self-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah File Excel / CSV</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Spreadsheet Grid */}
        <form onSubmit={handleSubmitBatch} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Tabel Pra-Input Database ({rows.length} Baris):
            </span>
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tambah Baris (+1)</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3 w-32">Tanggal</th>
                    <th className="py-2.5 px-3 w-28">Transaksi</th>
                    <th className="py-2.5 px-3 min-w-[260px]">Uraian Keterangan</th>
                    <th className="py-2.5 px-3 w-32">Jenis KAS</th>
                    <th className="py-2.5 px-3 w-36 text-right">Nominal (Rp)</th>
                    <th className="py-2.5 px-3 w-14 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="date"
                          required
                          value={row.tanggal}
                          onChange={(e) => updateRow(row.id, 'tanggal', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={row.jenisTransaksi}
                          onChange={(e) => updateRow(row.id, 'jenisTransaksi', e.target.value)}
                          className={`w-full px-2 py-1.5 rounded text-xs font-bold ${
                            row.jenisTransaksi === 'Masuk'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border border-rose-300'
                          }`}
                        >
                          <option value="Keluar">Keluar (Kredit)</option>
                          <option value="Masuk">Masuk (Debet)</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Bayar Biaya Konsumsi Rapat wakasek"
                          value={row.uraian}
                          onChange={(e) => updateRow(row.id, 'uraian', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={row.jenisKas}
                          onChange={(e) => updateRow(row.id, 'jenisKas', e.target.value as JenisKas)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="Kas Sekolah">Kas Sekolah</option>
                          <option value="Kas Yayasan">Kas Yayasan</option>
                          <option value="Kas Orang Tua">Kas Orang Tua</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="text"
                          required
                          placeholder="300.000"
                          value={row.nominalStr}
                          onChange={(e) => handleNominalChange(row.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-right font-bold text-slate-900"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Menyimpan ke Database...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Simpan Semua ({rows.length} Transaksi)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
