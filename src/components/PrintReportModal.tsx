import React from 'react';
import { useBKU } from '../context/BKUContext';
import { NAMA_BULAN, formatRupiah, formatTanggalIndo, formatTanggalBKU } from '../utils/formatters';
import { Printer, X, FileSpreadsheet } from 'lucide-react';
import { exportBKUUmumToExcel } from '../utils/excelExport';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBulan?: number;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  targetBulan
}) => {
  const {
    instansi,
    selectedTahun,
    selectedBulan,
    getTransaksiBulan,
    getSaldoAwalBulan
  } = useBKU();

  if (!isOpen) return null;

  const currentBulan = targetBulan || selectedBulan;
  const namaBulan = NAMA_BULAN[currentBulan - 1] || '';
  const transaksiList = getTransaksiBulan(currentBulan);
  const saldoAwal = getSaldoAwalBulan(currentBulan);

  let currentSaldo = saldoAwal;
  let totalMasuk = 0;
  let totalKeluar = 0;
  let saldoTunai = 0;
  let saldoBank = 0;

  // Hitung running balances
  const rows = transaksiList.map((tx, idx) => {
    const masuk = tx.jenisTransaksi === 'masuk' ? tx.nominal : 0;
    const keluar = tx.jenisTransaksi === 'keluar' ? tx.nominal : 0;
    currentSaldo = currentSaldo + masuk - keluar;
    totalMasuk += masuk;
    totalKeluar += keluar;

    if (tx.metodePembayaran === 'Tunai') {
      saldoTunai += (masuk - keluar);
    } else {
      saldoBank += (masuk - keluar);
    }

    return {
      index: idx + 1,
      tanggal: formatTanggalIndo(tx.tanggal, { short: true }),
      nomorBukti: tx.nomorBukti,
      uraian: tx.uraian,
      sumberDana: tx.sumberDana || 'Dana Sekolah',
      kodeRekening: tx.kodeRekening || '-',
      masuk,
      keluar,
      saldo: currentSaldo,
      metode: tx.metodePembayaran
    };
  });

  const saldoAkhir = currentSaldo;
  const lastDate = transaksiList.length > 0 
    ? formatTanggalIndo(transaksiList[transaksiList.length - 1].tanggal) 
    : `31 ${namaBulan} ${selectedTahun}`;

  const handlePrint = () => {
    window.print();
  };

  const handleExcelExport = () => {
    exportBKUUmumToExcel(transaksiList, saldoAwal, currentBulan, selectedTahun, instansi);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Pratinjau Cetak / Unduh Dokumen Resmi BKU
            </h3>
            <p className="text-xs text-slate-500">
              Buku Kas Umum Sekolah & Yayasan (Dana Yayasan, Dana Orangtua, Dana Sekolah).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExcelExport}
              className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unduh Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Document Sheet */}
        <div className="p-8 sm:p-10 overflow-y-auto bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible">
          {/* Header BKU persis format gambar */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-900 pb-3 mb-6">
            <div>
              <h1 className="text-xl font-black tracking-wider text-slate-950 uppercase font-sans">
                BUKU KAS UMUM
              </h1>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                {instansi.namaInstansi || 'SD ISLAM AL HIJRAH GORONTALO'}
              </h2>
              <p className="text-xs font-semibold text-slate-700 font-mono">
                {instansi.tahunAjaran || 'T.A 2026 / 2027'}
              </p>
            </div>
            <div className="mt-2 sm:mt-0 text-left sm:text-right">
              <span className="inline-block px-3 py-1 border border-slate-800 font-mono font-bold text-xs uppercase text-slate-900">
                PERIODE {namaBulan.toUpperCase()} {selectedTahun}
              </span>
            </div>
          </div>

          {/* Tabel Buku Kas Umum persis spreadsheet */}
          <div className="border border-slate-800 rounded-none overflow-hidden mb-6">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-left">
                  <th className="py-2 px-2 border-r border-slate-400 w-8 text-center">No</th>
                  <th className="py-2 px-2 border-r border-slate-400 w-24">Tanggal</th>
                  <th className="py-2 px-2 border-r border-slate-400 w-20 text-center">Transaksi</th>
                  <th className="py-2 px-3 border-r border-slate-400">Uraian</th>
                  <th className="py-2 px-2 border-r border-slate-400 w-24">Jenis KAS</th>
                  <th className="py-2 px-2 border-r border-slate-400 w-28 text-right">Saldo Awal</th>
                  <th className="py-2 px-2 border-r border-slate-400 w-28 text-right">Debet</th>
                  <th className="py-2 px-2 border-r border-slate-400 w-28 text-right">Kredit</th>
                  <th className="py-2 px-2 w-28 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {/* Baris Saldo Awal (Row 1) */}
                <tr className="bg-slate-50/50 font-semibold border-b border-slate-300">
                  <td className="py-2 px-2 text-center border-r border-slate-300 font-mono">1</td>
                  <td className="py-2 px-2 border-r border-slate-300 font-mono whitespace-nowrap">
                    {formatTanggalBKU(`${selectedTahun}-${currentBulan.toString().padStart(2, '0')}-01`)}
                  </td>
                  <td className="py-2 px-2 text-center border-r border-slate-300 font-mono font-bold">SA</td>
                  <td className="py-2 px-3 border-r border-slate-300 font-bold text-slate-900">
                    Saldo Awal
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-slate-700 whitespace-nowrap">Kas Sekolah</td>
                  <td className="py-2 px-2 text-right border-r border-slate-300 font-mono font-bold text-slate-950">
                    {formatRupiah(saldoAwal, true)}
                  </td>
                  <td className="py-2 px-2 text-right border-r border-slate-300 font-mono text-slate-400">-</td>
                  <td className="py-2 px-2 text-right border-r border-slate-300 font-mono text-slate-400">-</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-950">
                    {formatRupiah(saldoAwal, true)}
                  </td>
                </tr>

                {/* Transaksi Rows */}
                {transaksiList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                      Belum ada transaksi kas pada bulan ini.
                    </td>
                  </tr>
                ) : (
                  transaksiList.map((tx, i) => {
                    const isMasuk = tx.jenisTransaksi === 'masuk' || tx.jenisTransaksi === 'Masuk';
                    const masukVal = isMasuk ? tx.nominal : 0;
                    const keluarVal = !isMasuk ? tx.nominal : 0;
                    // Running balance up to this row
                    let cur = saldoAwal;
                    for (let j = 0; j <= i; j++) {
                      const t = transaksiList[j];
                      const m = (t.jenisTransaksi === 'masuk' || t.jenisTransaksi === 'Masuk') ? t.nominal : 0;
                      const k = (t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar') ? t.nominal : 0;
                      cur = cur + m - k;
                    }

                    return (
                      <tr key={tx.id || i} className="hover:bg-slate-50">
                        <td className="py-2 px-2 text-center border-r border-slate-300 font-mono">{i + 2}</td>
                        <td className="py-2 px-2 border-r border-slate-300 font-mono whitespace-nowrap">
                          {formatTanggalBKU(tx.tanggal)}
                        </td>
                        <td className="py-2 px-2 text-center border-r border-slate-300 font-medium">
                          {isMasuk ? 'Masuk' : 'Keluar'}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-300 text-slate-900">{tx.uraian}</td>
                        <td className="py-2 px-2 border-r border-slate-300 text-slate-700 whitespace-nowrap">
                          {tx.jenisKas || 'Kas Sekolah'}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-300 font-mono text-slate-400">-</td>
                        <td className="py-2 px-2 text-right border-r border-slate-300 font-mono text-emerald-800 font-medium">
                          {masukVal > 0 ? formatRupiah(masukVal, true) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-300 font-mono text-rose-800 font-medium">
                          {keluarVal > 0 ? formatRupiah(keluarVal, true) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-950">
                          {formatRupiah(cur, true)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-800 bg-slate-100 font-bold text-slate-950">
                <tr>
                  <td colSpan={5} className="py-2.5 px-3 text-right border-r border-slate-400 font-bold">
                    TOTAL:
                  </td>
                  <td className="py-2.5 px-2 text-right border-r border-slate-400 font-mono">
                    {formatRupiah(saldoAwal, true)}
                  </td>
                  <td className="py-2.5 px-2 text-right border-r border-slate-400 font-mono text-emerald-800">
                    {formatRupiah(totalMasuk, true)}
                  </td>
                  <td className="py-2.5 px-2 text-right border-r border-slate-400 font-mono text-rose-800">
                    {formatRupiah(totalKeluar, true)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-950 bg-emerald-50">
                    {formatRupiah(saldoAkhir, true)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Berita Acara Penutupan Kas / Register Kas */}
          <div className="p-4 bg-slate-50 border border-slate-300 rounded-md text-xs space-y-2 mb-8">
            <h4 className="font-bold text-slate-900 tracking-wide uppercase">
              REGISTER PENUTUPAN KAS BULAN {namaBulan.toUpperCase()} {selectedTahun}
            </h4>
            <p className="text-slate-700">
              Pada hari ini tanggal {lastDate}, Buku Kas Umum Sekolah & Yayasan ditutup dengan keadaan kas riil sebagai berikut:
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono pl-3 text-slate-800">
              <div>1. Saldo Kas Tunai (di Brankas Sekolah)</div>
              <div className="text-right font-semibold">: {formatRupiah(Math.max(0, saldoTunai), true)}</div>
              <div>2. Saldo Simpanan Kas Bank Sekolah</div>
              <div className="text-right font-semibold">: {formatRupiah(Math.max(0, saldoBank), true)}</div>
              <div className="font-bold border-t border-slate-300 pt-1">TOTAL SALDO KAS (1 + 2)</div>
              <div className="font-bold border-t border-slate-300 pt-1 text-right text-emerald-800">
                : {formatRupiah(saldoAkhir, true)}
              </div>
            </div>
          </div>

          {/* Kolom Tanda Tangan Kepala Sekolah / Yayasan & Bendahara */}
          <div className="grid grid-cols-2 gap-8 text-center text-xs mt-10">
            <div>
              <p className="text-slate-600">Mengetahui,</p>
              <p className="font-bold text-slate-900">{instansi.jabatanKepala || 'Kepala Sekolah / Ketua Yayasan'}</p>
              <div className="h-20 flex items-end justify-center">
                <p className="font-bold text-slate-900 underline">
                  {instansi.namaKepala || '( ............................................... )'}
                </p>
              </div>
              {instansi.nipKepala && instansi.nipKepala !== '-' && (
                <p className="text-slate-600 font-mono text-[11px] mt-0.5">
                  NIP/NIK. {instansi.nipKepala}
                </p>
              )}
            </div>

            <div>
              <p className="text-slate-600">
                {instansi.kotaTandaTangan || 'Kota'}, {lastDate}
              </p>
              <p className="font-bold text-slate-900">{instansi.jabatanBendahara || 'Bendahara Sekolah'}</p>
              <div className="h-20 flex items-end justify-center">
                <p className="font-bold text-slate-900 underline">
                  {instansi.namaBendahara || '( ............................................... )'}
                </p>
              </div>
              {instansi.nipBendahara && instansi.nipBendahara !== '-' && (
                <p className="text-slate-600 font-mono text-[11px] mt-0.5">
                  NIP/NIK. {instansi.nipBendahara}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
