import React from 'react';
import { useBKU } from '../context/BKUContext';
import { NAMA_BULAN, formatRupiah } from '../utils/formatters';
import { RekapBulananItem } from '../types';
import { exportRekapitulasiToExcel } from '../utils/excelExport';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Calendar,
  Building
} from 'lucide-react';

export const RekapitulasiView: React.FC = () => {
  const {
    transaksi,
    selectedTahun,
    setSelectedTahun,
    getSaldoAwalBulan,
    getSaldoAkhirBulan,
    instansi
  } = useBKU();

  // Hitung otomatis data rekapitulasi 12 bulan
  const rekapList: RekapBulananItem[] = NAMA_BULAN.map((nama, idx) => {
    const bulanNum = idx + 1;
    const saldoAwal = getSaldoAwalBulan(bulanNum);
    const saldoAkhir = getSaldoAkhirBulan(bulanNum);
    const txBulan = transaksi.filter((t) => t.tahun === selectedTahun && t.bulan === bulanNum);

    let masuk = 0;
    let keluar = 0;
    const penerimaanSumber = {
      yayasan: 0,
      orangtua: 0,
      sekolah: 0
    };
    const rincian = {
      pegawai: 0,
      barangJasa: 0,
      modal: 0,
      pemeliharaan: 0,
      kesiswaan: 0,
      pajak: 0,
      lainnya: 0
    };

    txBulan.forEach((tx) => {
      const isMasuk = tx.jenisTransaksi === 'masuk' || tx.jenisTransaksi === 'Masuk';
      if (isMasuk) {
        masuk += tx.nominal;
        if (tx.jenisKas === 'Kas Yayasan' || tx.sumberDana === 'Dana Yayasan') {
          penerimaanSumber.yayasan += tx.nominal;
        } else if (tx.jenisKas === 'Kas Orang Tua' || tx.sumberDana === 'Dana Orangtua') {
          penerimaanSumber.orangtua += tx.nominal;
        } else {
          penerimaanSumber.sekolah += tx.nominal;
        }
      } else {
        keluar += tx.nominal;
        switch (tx.posKategori) {
          case 'Gaji & Honorarium Guru / Karyawan':
            rincian.pegawai += tx.nominal;
            break;
          case 'Belanja Sarana Belajar & ATK':
            rincian.barangJasa += tx.nominal;
            break;
          case 'Belanja Modal & Fasilitas':
            rincian.modal += tx.nominal;
            break;
          case 'Operasional (Listrik, Air, Wifi)':
            rincian.pemeliharaan += tx.nominal;
            break;
          case 'Kegiatan Kesiswaan & Ekstrakurikuler':
            rincian.kesiswaan += tx.nominal;
            break;
          case 'Pajak & Administrasi Bank':
            rincian.pajak += tx.nominal;
            break;
          default:
            rincian.lainnya += tx.nominal;
            break;
        }
      }
    });

    return {
      bulan: bulanNum,
      namaBulan: nama,
      saldoAwal,
      totalPenerimaan: masuk,
      totalPengeluaran: keluar,
      saldoAkhir,
      sumberDanaPenerimaan: penerimaanSumber,
      rincianBelanja: rincian
    };
  });

  // Hitung total tahunan
  const totalPenerimaanYayasan = rekapList.reduce((acc, r) => acc + r.sumberDanaPenerimaan.yayasan, 0);
  const totalPenerimaanOrangtua = rekapList.reduce((acc, r) => acc + r.sumberDanaPenerimaan.orangtua, 0);
  const totalPenerimaanSekolah = rekapList.reduce((acc, r) => acc + r.sumberDanaPenerimaan.sekolah, 0);
  const totalPengeluaranTahunan = rekapList.reduce((acc, r) => acc + r.totalPengeluaran, 0);
  const saldoAkhirTahun = rekapList[11]?.saldoAkhir || 0;

  const handleExcelExport = () => {
    exportRekapitulasiToExcel(rekapList, selectedTahun, instansi);
  };

  const handlePrint = () => {
    window.print();
  };

  const maxVal = Math.max(
    1,
    ...rekapList.map((r) => Math.max(r.totalPenerimaan, r.totalPengeluaran))
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Laporan Rekapitulasi Kas & Anggaran Tahunan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kompilasi otomatis penerimaan (Yayasan, Orangtua, Sekolah) dan alokasi belanja kas selama 12 bulan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Tahun:</span>
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(parseInt(e.target.value, 10))}
              className="bg-transparent font-mono font-bold text-slate-900 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExcelExport}
            className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white hover:bg-emerald-50 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Unduh Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards Tahunan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs text-slate-500 block">Total Penerimaan Dana Yayasan</span>
          <p className="text-lg sm:text-xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {formatRupiah(totalPenerimaanYayasan, true)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Alokasi & subsidi yayasan</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs text-slate-500 block">Total Penerimaan Dana Orangtua</span>
          <p className="text-lg sm:text-xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {formatRupiah(totalPenerimaanOrangtua, true)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Iuran SPP & sumbangan kesiswaan</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-xs text-slate-500 block">Total Penerimaan Dana Sekolah</span>
          <p className="text-lg sm:text-xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {formatRupiah(totalPenerimaanSekolah, true)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Unit usaha & kas operasional</p>
        </div>

        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
          <span className="text-xs text-slate-300 block">Saldo Kas Akhir Tahun {selectedTahun}</span>
          <p className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
            {formatRupiah(saldoAkhirTahun, true)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Total kas riil tersisa</p>
        </div>
      </div>

      {/* Visualisasi Arus Kas Bulanan */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>Grafik Perbandingan Penerimaan vs Belanja per Bulan ({selectedTahun})</span>
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" />
              Penerimaan
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
              Pengeluaran
            </span>
          </div>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2 items-end min-h-[140px]">
          {rekapList.map((item) => {
            const heightMasuk = maxVal > 0 ? (item.totalPenerimaan / maxVal) * 90 : 0;
            const heightKeluar = maxVal > 0 ? (item.totalPengeluaran / maxVal) * 90 : 0;

            return (
              <div key={item.bulan} className="flex flex-col items-center gap-1 text-center group">
                <div className="w-full flex items-end justify-center gap-1 h-24">
                  {/* Bar Masuk */}
                  <div
                    title={`Penerimaan ${item.namaBulan}: ${formatRupiah(item.totalPenerimaan, true)}`}
                    style={{ height: `${Math.max(4, heightMasuk)}%` }}
                    className={`w-2.5 rounded-t transition-all ${
                      item.totalPenerimaan > 0 ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                  />
                  {/* Bar Keluar */}
                  <div
                    title={`Pengeluaran ${item.namaBulan}: ${formatRupiah(item.totalPengeluaran, true)}`}
                    style={{ height: `${Math.max(4, heightKeluar)}%` }}
                    className={`w-2.5 rounded-t transition-all ${
                      item.totalPengeluaran > 0 ? 'bg-rose-500' : 'bg-slate-200'
                    }`}
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-500 group-hover:text-slate-900">
                  {item.namaBulan.substring(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabel Komprehensif Rekapitulasi 12 Bulan */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Matriks Rekapitulasi Arus Kas 12 Bulan (Penerimaan Sumber Dana & Belanja)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-3 w-24">Bulan</th>
                <th className="py-3 px-3 text-right">Saldo Awal</th>
                <th className="py-3 px-3 text-right text-emerald-800">Dana Yayasan</th>
                <th className="py-3 px-3 text-right text-emerald-800">Dana Orangtua</th>
                <th className="py-3 px-3 text-right text-emerald-800">Dana Sekolah</th>
                <th className="py-3 px-3 text-right text-rose-800 font-bold">Total Belanja</th>
                <th className="py-3 px-3 text-right font-bold text-slate-900">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rekapList.map((r) => (
                <tr key={r.bulan} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{r.namaBulan}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                    {formatRupiah(r.saldoAwal, false)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 tabular-nums">
                    {r.sumberDanaPenerimaan.yayasan > 0 ? formatRupiah(r.sumberDanaPenerimaan.yayasan, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 tabular-nums">
                    {r.sumberDanaPenerimaan.orangtua > 0 ? formatRupiah(r.sumberDanaPenerimaan.orangtua, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 tabular-nums">
                    {r.sumberDanaPenerimaan.sekolah > 0 ? formatRupiah(r.sumberDanaPenerimaan.sekolah, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 tabular-nums">
                    {r.totalPengeluaran > 0 ? formatRupiah(r.totalPengeluaran, false) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatRupiah(r.saldoAkhir, false)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
              <tr>
                <td className="py-3 px-3 font-bold uppercase">TOTAL TAHUNAN</td>
                <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                  {formatRupiah(rekapList[0]?.saldoAwal || 0, false)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-800 tabular-nums">
                  {formatRupiah(totalPenerimaanYayasan, false)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-800 tabular-nums">
                  {formatRupiah(totalPenerimaanOrangtua, false)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-800 tabular-nums">
                  {formatRupiah(totalPenerimaanSekolah, false)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-rose-800 tabular-nums">
                  {formatRupiah(totalPengeluaranTahunan, false)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-950 tabular-nums">
                  {formatRupiah(saldoAkhirTahun, false)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
