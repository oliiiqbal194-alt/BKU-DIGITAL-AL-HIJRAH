import React, { useState } from 'react';
import { TransaksiBKU, FileLampiran } from '../types';
import { useBKU } from '../context/BKUContext';
import { formatRupiah } from '../utils/formatters';
import { terbilangRupiah, formatTanggalFormal } from '../utils/terbilang';
import { uploadLPJPDFToDrive } from '../utils/googleDrive';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Printer,
  X,
  FileText,
  Paperclip,
  CheckCircle2,
  Building2,
  Upload,
  Image as ImageIcon,
  Trash2,
  FileCheck,
  Loader2,
  CloudUpload,
  ExternalLink
} from 'lucide-react';
import { ReceiptUploader } from './ReceiptUploader';

interface LPJTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: TransaksiBKU | null;
}

type PaperSize = 'a4' | 'folio';

export const LPJTransactionModal: React.FC<LPJTransactionModalProps> = ({
  isOpen,
  onClose,
  transaksi
}) => {
  const { instansi, selectedTahun, updateTransaksi, googleAccessToken, connectGoogleDrive, addToast } = useBKU();
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [isUpdatingLampiran, setIsUpdatingLampiran] = useState(false);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [lastUploadedLink, setLastUploadedLink] = useState<string | null>(null);

  if (!isOpen || !transaksi) return null;

  const isMasuk = transaksi.jenisTransaksi === 'masuk' || transaksi.jenisTransaksi === 'Masuk';
  const totalPotongan = transaksi.pajak?.totalPotongan || 0;
  const nilaiBersih = transaksi.nominal - totalPotongan;

  const handleDownloadAndSaveToDrive = async () => {
    const input = document.getElementById('printable-lpj');
    if (!input) {
      window.print();
      return;
    }
    try {
      setIsProcessingPDF(true);
      const canvas = await html2canvas(input, {
        scale: 3, // Ultra-sharp 300 DPI text rendering
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          // 1. Remove all SVG elements (icons) so html2canvas never instantiates SVGElementContainer with computed oklch/oklab styles
          const svgs = clonedDoc.querySelectorAll('svg');
          svgs.forEach((s) => s.remove());

          // 2. Remove external link stylesheets so html2canvas doesn't fetch external CSS files
          const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          links.forEach((link) => link.remove());

          // 3. Clean ALL style tags in clonedDoc from any unsupported CSS color functions
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((style) => {
            if (style.innerHTML) {
              style.innerHTML = style.innerHTML
                .replace(/oklab\([^)]+\)/gi, '#0f172a')
                .replace(/oklch\([^)]+\)/gi, '#0f172a')
                .replace(/color-mix\([^)]+\)/gi, '#0f172a')
                .replace(/light-dark\([^)]+\)/gi, '#0f172a')
                .replace(/lab\([^)]+\)/gi, '#0f172a')
                .replace(/lch\([^)]+\)/gi, '#0f172a');
            }
          });

          // 4. Sanitize style attributes on all cloned elements
          const allEls = clonedDoc.querySelectorAll('#printable-lpj *');
          allEls.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style && htmlEl.style.cssText) {
              const cssText = htmlEl.style.cssText;
              if (cssText.includes('oklch') || cssText.includes('oklab') || cssText.includes('color-mix')) {
                htmlEl.style.cssText = cssText
                  .replace(/oklab\([^)]+\)/gi, '#0f172a')
                  .replace(/oklch\([^)]+\)/gi, '#0f172a')
                  .replace(/color-mix\([^)]+\)/gi, '#0f172a');
              }
            }
          });

          // Inject ultra-clear LPJ print layout rules
          const pdfStyle = clonedDoc.createElement('style');
          pdfStyle.innerHTML = `
            * {
              box-sizing: border-box !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              background-color: #ffffff !important;
              font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
            }
            #printable-lpj {
              width: 210mm !important;
              box-sizing: border-box !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              padding: 28px 36px !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
            }
            #printable-lpj .kop-container {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 20px !important;
              border-bottom: 3px double #000000 !important;
              padding-bottom: 14px !important;
              margin-bottom: 20px !important;
            }
            #printable-lpj .kop-logo {
              width: 65px !important;
              height: 65px !important;
              max-width: 65px !important;
              max-height: 65px !important;
              object-fit: contain !important;
              flex-shrink: 0 !important;
            }
            #printable-lpj .kop-text {
              flex: 1 !important;
              text-align: center !important;
            }
            #printable-lpj table {
              width: 100% !important;
              border-collapse: collapse !important;
              border: 1.5px solid #334155 !important;
              margin-top: 14px !important;
            }
            #printable-lpj th, #printable-lpj td {
              border: 1px solid #475569 !important;
              padding: 8px 12px !important;
              font-size: 13px !important;
              color: #000000 !important;
            }
            #printable-lpj .lpj-label-col {
              background-color: #f1f5f9 !important;
              font-weight: 700 !important;
              color: #0f172a !important;
              width: 32% !important;
            }
            #printable-lpj .lpj-val-col {
              font-weight: 600 !important;
              color: #000000 !important;
            }
            #printable-lpj .lpj-nota-img {
              width: 100% !important;
              max-height: 260px !important;
              object-fit: contain !important;
              display: block !important;
              margin: 0 auto !important;
            }
            #printable-lpj .signature-grid {
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between !important;
              margin-top: 36px !important;
              padding-top: 16px !important;
            }
            #printable-lpj .signature-col {
              width: 45% !important;
              text-align: center !important;
            }
          `;
          clonedDoc.head.appendChild(pdfStyle);
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdfWidth = paperSize === 'folio' ? 215 : 210;
      const pdfHeight = paperSize === 'folio' ? 330 : 297;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: paperSize === 'folio' ? [215, 330] : 'a4'
      });

      const canvasRatio = canvas.height / canvas.width;
      let imgWidth = pdfWidth;
      let imgHeight = pdfWidth * canvasRatio;

      // Smart single-page auto-fit: If height is slightly larger than page height (up to 22%), fit it perfectly on 1 page!
      if (imgHeight > pdfHeight && imgHeight <= pdfHeight * 1.22) {
        imgHeight = pdfHeight;
      }

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 5) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
      }

      const safeNoBukti = (transaksi.nomorBukti || 'transaksi').replace(/[/\\?%*:|"<>]/g, '_');
      const fileName = `LPJ_${safeNoBukti}_${transaksi.tanggal}.pdf`;

      // 1. Save locally
      pdf.save(fileName);

      // 2. Automatically save to Google Drive in "LPJ Transaksi BKU" folder
      let token = googleAccessToken;
      if (!token) {
        await connectGoogleDrive();
      }

      const activeToken = (window as any).__google_access_token || googleAccessToken;
      if (activeToken) {
        const pdfBlob = pdf.output('blob');
        const uploadRes = await uploadLPJPDFToDrive(activeToken, pdfBlob, fileName);
        if (uploadRes.fileId) {
          setLastUploadedLink(uploadRes.webViewLink || null);
          addToast(
            'success',
            'Tersimpan di Google Drive',
            `LPJ berhasil diunggah ke folder "LPJ Transaksi BKU" di Google Drive.`
          );
        } else if (uploadRes.error) {
          console.warn('Google Drive auto-upload warning:', uploadRes.error);
          addToast('warning', 'Penyimpanan Drive', 'LPJ diunduh lokal, namun gagal otomatis ke Drive: ' + uploadRes.error);
        }
      } else {
        addToast('success', 'LPJ Berhasil Diunduh', 'Berkas LPJ telah disimpan ke perangkat Anda.');
      }
    } catch (err) {
      console.error('PDF export & drive sync error:', err);
      window.print();
    } finally {
      setIsProcessingPDF(false);
    }
  };

  const handleUpdateLampiran = async (newFiles: FileLampiran[]) => {
    try {
      setIsUpdatingLampiran(true);
      await updateTransaksi(transaksi.id, {
        lampiran: newFiles
      });
      transaksi.lampiran = newFiles;
      addToast('success', 'Lampiran Diperbarui', `${newFiles.length} berkas foto nota tersimpan.`);
    } catch {
      addToast('error', 'Gagal', 'Terjadi kesalahan saat menyimpan lampiran foto.');
    } finally {
      setIsUpdatingLampiran(false);
    }
  };

  const lampiranList = transaksi.lampiran || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto max-h-[96vh] flex flex-col">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print bg-white border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <FileCheck className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Lembar LPJ Sederhana & Sinkron Drive
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              No. Bukti: <strong className="font-mono text-slate-700">{transaksi.nomorBukti}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Paper Size Selector */}
            <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setPaperSize('a4')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  paperSize === 'a4'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('folio')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  paperSize === 'folio'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Folio (F4)
              </button>
            </div>

            {/* Download & Save to Drive Button */}
            <button
              type="button"
              onClick={handleDownloadAndSaveToDrive}
              disabled={isProcessingPDF}
              className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Menyimpan ke Drive...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4 text-emerald-400" />
                  <span>Unduh & Simpan ke Drive</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {lastUploadedLink && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 px-5 py-2 flex items-center justify-between text-xs text-emerald-800">
            <span>LPJ berhasil dicadangkan di folder "LPJ Transaksi BKU" Google Drive Anda.</span>
            <a
              href={lastUploadedLink}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline flex items-center gap-1 hover:text-emerald-900"
            >
              <span>Buka di Drive</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Scrollable Document Body */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div
            id="printable-lpj"
            className={`bg-white text-slate-900 shadow-lg border border-slate-300 p-6 sm:p-10 flex flex-col justify-between relative ${
              paperSize === 'folio' ? 'w-[21.5cm] min-h-[33cm]' : 'w-[21cm] min-h-[29.7cm]'
            } mx-auto transition-all`}
            style={{ boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            <div>
              {/* Kop Instansi */}
              <div
                className="border-b-2 border-slate-900 pb-4 mb-5 flex items-center gap-4 kop-container"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}
              >
                {instansi.logoUrl ? (
                  <img
                    src={instansi.logoUrl}
                    alt="Logo"
                    className="w-16 h-16 object-contain shrink-0 kop-logo"
                    style={{ width: '60px', height: '60px', maxWidth: '60px', maxHeight: '60px', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xl shrink-0 kop-logo"
                    style={{ width: '60px', height: '60px', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                  >
                    <Building2 className="w-8 h-8 text-white" style={{ width: '32px', height: '32px' }} />
                  </div>
                )}
                <div className="flex-1 text-center kop-text" style={{ flex: 1, textAlign: 'center' }}>
                  <h3 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-slate-900" style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                    {instansi.namaInstansi || 'SEKOLAH / LEMBAGA PENDIDIKAN'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5" style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#475569' }}>
                    {instansi.alamat || 'Alamat Lembaga'} {instansi.telepon ? `• Telp: ${instansi.telepon}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5" style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                    Tahun Anggaran: {instansi.tahunAnggaran || selectedTahun || 2026}
                  </p>
                </div>
              </div>

              {/* Judul Dokumen */}
              <div className="text-center my-6" style={{ textAlign: 'center', margin: '20px 0' }}>
                <h4 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-slate-900 underline underline-offset-4" style={{ fontSize: '14px', fontWeight: 'bold', textDecoration: 'underline' }}>
                  LAPORAN PERTANGGUNGJAWABAN (LPJ) TRANSAKSI KEUANGAN
                </h4>
                <p className="text-xs font-mono text-slate-600 mt-1" style={{ fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
                  Nomor Bukti: {transaksi.nomorBukti}
                </p>
              </div>

              {/* Tabel Rincian Transaksi */}
              <div className="my-6 space-y-3" style={{ margin: '20px 0' }}>
                <table className="w-full text-xs sm:text-sm border-collapse border border-slate-400" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8' }}>
                  <tbody>
                    <tr className="border-b border-slate-400" style={{ borderBottom: '1px solid #94a3b8' }}>
                      <td className="w-1/3 bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ width: '33%', backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                        Nama Penanggung Jawab
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900" style={{ padding: '8px 12px', fontWeight: 'bold', fontSize: '12px' }}>
                        {transaksi.penanggungJawab || transaksi.penerima || instansi.namaBendahara || 'Bendahara / Pelaksana Kegiatan'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-400" style={{ borderBottom: '1px solid #94a3b8' }}>
                      <td className="bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                        Tanggal Transaksi
                      </td>
                      <td className="px-3 py-2 text-slate-900" style={{ padding: '8px 12px', fontSize: '12px' }}>
                        {formatTanggalFormal(transaksi.tanggal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-400" style={{ borderBottom: '1px solid #94a3b8' }}>
                      <td className="bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                        Sumber Dana / Kas
                      </td>
                      <td className="px-3 py-2 text-slate-900" style={{ padding: '8px 12px', fontSize: '12px' }}>
                        {transaksi.sumberDana || 'Dana Sekolah'} ({transaksi.jenisKas || 'Kas Sekolah'})
                      </td>
                    </tr>
                    {transaksi.kegiatanNama && (
                      <tr className="border-b border-slate-400" style={{ borderBottom: '1px solid #94a3b8' }}>
                        <td className="bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                          Sub-Kegiatan Anggaran
                        </td>
                        <td className="px-3 py-2 text-slate-900 font-medium" style={{ padding: '8px 12px', fontSize: '12px' }}>
                          {transaksi.kegiatanNama}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-400" style={{ borderBottom: '1px solid #94a3b8' }}>
                      <td className="bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                        Pihak Penerima / Rekanan
                      </td>
                      <td className="px-3 py-2 text-slate-900" style={{ padding: '8px 12px', fontSize: '12px' }}>
                        {transaksi.penerima || '-'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-400" style={{ borderBottom: '1px solid #94a3b8' }}>
                      <td className="bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                        Uraian / Keterangan Belanja
                      </td>
                      <td className="px-3 py-2 text-slate-900 leading-relaxed" style={{ padding: '8px 12px', fontSize: '12px' }}>
                        {transaksi.uraian}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-400" style={{ borderBottom: '1px solid #94a3b8' }}>
                      <td className="bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                        Jumlah Nominal Bruto
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900 text-sm" style={{ padding: '8px 12px', fontWeight: 'bold', fontSize: '13px' }}>
                        {formatRupiah(transaksi.nominal)}
                      </td>
                    </tr>
                    {totalPotongan > 0 && (
                      <tr className="border-b border-slate-400 bg-amber-50/50" style={{ borderBottom: '1px solid #94a3b8', backgroundColor: '#fffbeb' }}>
                        <td className="bg-amber-50 font-semibold px-3 py-2 border-r border-slate-400 text-amber-900" style={{ backgroundColor: '#fffbeb', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                          Potongan Pajak
                        </td>
                        <td className="px-3 py-2 font-semibold text-amber-900" style={{ padding: '8px 12px', fontWeight: '600', fontSize: '12px' }}>
                          - {formatRupiah(totalPotongan)} (Netto: {formatRupiah(nilaiBersih)})
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="bg-slate-50 font-semibold px-3 py-2 border-r border-slate-400 text-slate-700" style={{ backgroundColor: '#f8fafc', fontWeight: '600', padding: '8px 12px', borderRight: '1px solid #94a3b8', fontSize: '12px' }}>
                        Terbilang
                      </td>
                      <td className="px-3 py-2 italic font-medium text-slate-800 bg-slate-50/50" style={{ padding: '8px 12px', fontStyle: 'italic', fontSize: '12px' }}>
                        "{terbilangRupiah(transaksi.nominal)} Rupiah"
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Lampiran Nota / Kwitansi */}
              <div className="mt-6" style={{ marginTop: '24px' }}>
                <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3" style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px' }}>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5" style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    <Paperclip className="w-4 h-4 text-slate-500" style={{ width: '16px', height: '16px' }} />
                    <span>Lampiran Nota / Kwitansi Fisik ({lampiranList.length})</span>
                  </h5>
                </div>

                {lampiranList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 lampiran-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
                    {lampiranList.map((file, idx) => (
                      <div key={file.id || idx} className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 flex flex-col items-center lampiran-card" style={{ flex: '1 1 45%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', backgroundColor: '#f8fafc' }}>
                        <div className="text-[11px] font-medium text-slate-600 mb-1.5 self-start" style={{ fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                          Nota #{idx + 1}: {file.nama}
                        </div>
                        {file.dataUrl ? (
                          <img
                            src={file.dataUrl}
                            alt={`Nota ${idx + 1}`}
                            className="w-full h-48 sm:h-56 object-contain rounded border border-slate-200 bg-white lpj-nota-img"
                            style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', display: 'block', margin: '0 auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                          />
                        ) : (
                          <div className="w-full h-48 flex items-center justify-center text-xs text-slate-400 bg-white rounded border border-slate-200" style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#94a3b8' }}>
                            Pratinjau tidak tersedia
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center bg-slate-50" style={{ border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <p className="text-xs text-slate-500 italic mb-3" style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                      Belum ada foto nota/kwitansi yang diunggah untuk transaksi ini.
                    </p>
                    <div className="no-print max-w-md mx-auto">
                      <ReceiptUploader files={lampiranList} onChange={handleUpdateLampiran} maxFiles={3} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bagian Tanda Tangan (Di Bawah Dokumen) */}
            <div
              className="mt-12 pt-4 grid grid-cols-2 gap-8 text-center text-xs sm:text-sm shrink-0 signature-grid"
              style={{ marginTop: '36px', paddingTop: '16px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', textAlign: 'center' }}
            >
              <div className="signature-col" style={{ width: '45%', textAlign: 'center' }}>
                <p className="font-medium text-slate-700" style={{ fontSize: '12px', color: '#334155' }}>Pelapor / Penanggung Jawab,</p>
                <div className="h-16" style={{ height: '60px' }}></div>
                <p className="font-bold underline text-slate-900" style={{ fontSize: '12px', fontWeight: 'bold', textDecoration: 'underline' }}>
                  {transaksi.penanggungJawab || transaksi.penerima || instansi.namaBendahara || 'Bendahara / Pelaksana'}
                </p>
                <p className="text-[11px] text-slate-500" style={{ fontSize: '11px', color: '#64748b' }}>NIP. -</p>
              </div>

              <div className="signature-col" style={{ width: '45%', textAlign: 'center' }}>
                <p className="font-medium text-slate-700" style={{ fontSize: '12px', color: '#334155' }}>
                  {instansi.kotaTandaTangan || 'Gorontalo'}, {formatTanggalFormal(transaksi.tanggal)}
                </p>
                <p className="font-medium text-slate-700" style={{ fontSize: '12px', color: '#334155' }}>Mengetahui / Menyetujui,</p>
                <p className="font-medium text-slate-700" style={{ fontSize: '12px', color: '#334155' }}>{instansi.jabatanKepala || 'Kepala Sekolah'}</p>
                <div className="h-12" style={{ height: '45px' }}></div>
                <p className="font-bold underline text-slate-900" style={{ fontSize: '12px', fontWeight: 'bold', textDecoration: 'underline' }}>
                  {instansi.namaKepala || 'Kepala Sekolah, S.Pd.'}
                </p>
                <p className="text-[11px] text-slate-500" style={{ fontSize: '11px', color: '#64748b' }}>NIP. {instansi.nipKepala || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
