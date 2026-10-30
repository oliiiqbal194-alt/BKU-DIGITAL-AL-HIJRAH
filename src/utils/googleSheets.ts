import { TransaksiBKU, KegiatanAnggaran, ProfilInstansi, FileLampiran } from '../types';
import { formatRupiah } from './formatters';

function formatNotaStatus(lampiran?: FileLampiran[]): string {
  if (!lampiran || lampiran.length === 0) {
    return 'Belum Dilampirkan';
  }
  const l = lampiran[0];
  const count = lampiran.length;
  const fileName = l.nama || 'Nota';
  if (l.dataUrl) {
    return `=HYPERLINK("${l.dataUrl}", "🔗 Buka Nota (${count} Berkas: ${fileName})")`;
  }
  return `Ada (${count} Nota/Kwitansi)`;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
}

/**
 * Creates a new BKU Spreadsheet in Google Drive with the 3 dedicated tabs
 */
export async function createBKUSpreadsheet(
  accessToken: string,
  instansi: ProfilInstansi
): Promise<SpreadsheetInfo> {
  const title = `BKU Digital - ${instansi.namaInstansi || 'Keuangan Sekolah'} (${instansi.tahunAnggaran || 2026})`;

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';

  const payload = {
    properties: {
      title,
      timeZone: userTimeZone
    },
    sheets: [
      {
        properties: {
          sheetId: 0,
          title: 'BKU Umum',
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 200,
            columnCount: 15
          }
        }
      },
      {
        properties: {
          sheetId: 1,
          title: 'BKU Kegiatan',
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 200,
            columnCount: 12
          }
        }
      },
      {
        properties: {
          sheetId: 2,
          title: 'Rekap & Pagu',
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 100,
            columnCount: 10
          }
        }
      }
    ]
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal membuat spreadsheet (${res.status})`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Apply styling to headers (navy background, white bold text)
  try {
    await applyHeaderStyles(accessToken, spreadsheetId, [0, 1, 2]);
  } catch (err) {
    console.warn('Gagal menerapkan gaya visual header spreadsheet:', err);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle: title
  };
}

/**
 * Applies header styling (navy background, white text, bold) to given sheetIds
 */
async function applyHeaderStyles(accessToken: string, spreadsheetId: string, sheetIds: number[]) {
  const requests = sheetIds.map(sheetId => ({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: {
            red: 0.08,
            green: 0.28,
            blue: 0.44
          },
          textFormat: {
            foregroundColor: {
              red: 1,
              green: 1,
              blue: 1
            },
            bold: true,
            fontSize: 10
          },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
    }
  }));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });
}

/**
 * Ensures that BKU Umum, BKU Kegiatan, and Rekap & Pagu sheets exist in the spreadsheet
 */
async function ensureSheetsExist(accessToken: string, spreadsheetId: string): Promise<void> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) return;

  const data = await res.json();
  const existingTitles = (data.sheets || []).map((s: any) => s.properties?.title);

  const neededSheets = ['BKU Umum', 'BKU Kegiatan', 'Rekap & Pagu'];
  const missing = neededSheets.filter(title => !existingTitles.includes(title));

  if (missing.length > 0) {
    const requests = missing.map(title => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            frozenRowCount: 1
          }
        }
      }
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
  }
}

/**
 * Synchronizes transactions, activities, and balances to the Google Spreadsheet
 */
export async function syncAllBKUDataToSheets(
  accessToken: string,
  spreadsheetId: string,
  options: {
    transaksi: TransaksiBKU[];
    kegiatan: KegiatanAnggaran[];
    instansi: ProfilInstansi;
  }
): Promise<{ success: boolean; updatedCells?: number; error?: string }> {
  try {
    // 1. Ensure sheet tabs exist
    await ensureSheetsExist(accessToken, spreadsheetId);

    const { transaksi, kegiatan, instansi } = options;

    // Sort transactions chronologically
    const sortedTransaksi = [...transaksi].sort((a, b) => {
      const dateCmp = (a.tanggal || '').localeCompare(b.tanggal || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.nomorBukti || '').localeCompare(b.nomorBukti || '');
    });

    // 2. Prepare Tab 1: BKU Umum
    let runningTunai = 0;
    let runningBank = Number(instansi.saldoAwalTahun) || 0;
    let runningTotal = runningTunai + runningBank;

    const bkuUmumHeader = [
      'No',
      'Tanggal',
      'No. Bukti',
      'Pos Kategori',
      'Uraian Transaksi',
      'Sumber Dana',
      'Pemasukan / Debit (Rp)',
      'Pengeluaran / Kredit (Rp)',
      'Saldo Tunai (Rp)',
      'Saldo Bank (Rp)',
      'Total Saldo (Rp)',
      'Penerima / Rekanan',
      'Status Nota'
    ];

    const bkuUmumRows: (string | number)[][] = sortedTransaksi.map((t, idx) => {
      const nominal = Number(t.nominal) || 0;
      const isMasuk = t.jenisTransaksi === 'Masuk' || t.jenisTransaksi === 'SA' || t.jenisTransaksi === 'masuk';
      const isBank = t.metodePembayaran === 'Bank / Non-Tunai';

      const debit = isMasuk ? nominal : 0;
      const kredit = !isMasuk ? nominal : 0;

      if (isBank) {
        if (isMasuk) runningBank += nominal;
        else runningBank -= nominal;
      } else {
        if (isMasuk) runningTunai += nominal;
        else runningTunai -= nominal;
      }
      runningTotal = runningTunai + runningBank;

      const notaStatus = formatNotaStatus(t.lampiran);

      return [
        idx + 1,
        t.tanggal,
        t.nomorBukti,
        t.posKategori || '-',
        t.uraian,
        t.sumberDana || '-',
        debit,
        kredit,
        runningTunai,
        runningBank,
        runningTotal,
        t.penerima || t.kegiatanNama || '-',
        notaStatus
      ];
    });

    // 3. Prepare Tab 2: BKU Kegiatan (Buku Pembantu Kas Kegiatan)
    // HANYA memuat transaksi belanja yang secara spesifik dialokasikan ke Sub-Kegiatan Anggaran
    const bkuKegiatanHeader = [
      'No',
      'Tanggal',
      'No. Bukti',
      'Nama Sub-Kegiatan',
      'Uraian Belanja',
      'Sumber Dana',
      'Pengeluaran Realisasi (Rp)',
      'Penerima / Rekanan',
      'Status Nota'
    ];

    const bkuKegiatanRows: (string | number)[][] = [];

    if (kegiatan.length > 0) {
      // Kelompokkan pengeluaran berdasarkan masing-masing Sub-Kegiatan Anggaran
      let overallKegNo = 1;

      kegiatan.forEach((k) => {
        // Cari transaksi pengeluaran yang dialokasikan ke kegiatan ini
        const matchingTx = sortedTransaksi.filter((t) => {
          const isKeluar = t.jenisTransaksi === 'Keluar' || t.jenisTransaksi === 'keluar';
          if (!isKeluar) return false;
          if (t.kegiatanId && t.kegiatanId === k.id) return true;
          if (
            t.kegiatanNama &&
            k.namaKegiatan &&
            t.kegiatanNama.trim().toLowerCase() === k.namaKegiatan.trim().toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        const totalRealisasiKegiatan = matchingTx.reduce(
          (sum, tx) => sum + (Number(tx.nominal) || 0),
          0
        );
        const sisaPaguKegiatan = (Number(k.paguAnggaran) || 0) - totalRealisasiKegiatan;

        // Baris Sub-Header untuk Sub-Kegiatan ini
        bkuKegiatanRows.push([
          `▶ [${k.kodeKegiatan}]`,
          k.namaKegiatan,
          `Sumber: ${k.sumberDana}`,
          `P.J: ${k.penanggungJawab || '-'}`,
          `Pagu: Rp ${Number(k.paguAnggaran || 0).toLocaleString('id-ID')}`,
          `Realisasi: Rp ${totalRealisasiKegiatan.toLocaleString('id-ID')}`,
          totalRealisasiKegiatan,
          `Sisa: Rp ${sisaPaguKegiatan.toLocaleString('id-ID')}`,
          ''
        ]);

        if (matchingTx.length === 0) {
          bkuKegiatanRows.push([
            '-',
            '-',
            '-',
            k.namaKegiatan,
            '(Belum ada realisasi belanja yang dicatat untuk sub-kegiatan ini)',
            k.sumberDana,
            0,
            '-',
            '-'
          ]);
        } else {
          matchingTx.forEach((tx) => {
            const nominal = Number(tx.nominal) || 0;
            const notaStatus = formatNotaStatus(tx.lampiran);

            bkuKegiatanRows.push([
              overallKegNo++,
              tx.tanggal,
              tx.nomorBukti,
              k.namaKegiatan,
              tx.uraian,
              tx.sumberDana || k.sumberDana,
              nominal,
              tx.penerima || '-',
              notaStatus
            ]);
          });

          // Subtotal per Sub-Kegiatan
          bkuKegiatanRows.push([
            '',
            '',
            '',
            `TOTAL REALISASI [${k.kodeKegiatan}]`,
            k.namaKegiatan,
            '',
            totalRealisasiKegiatan,
            `Sisa Pagu: Rp ${sisaPaguKegiatan.toLocaleString('id-ID')}`,
            ''
          ]);
        }

        // Baris pemisah kosong antar sub-kegiatan
        bkuKegiatanRows.push(['', '', '', '', '', '', '', '', '']);
      });

      // Cari juga jika ada transaksi yang punya kegiatanId/kegiatanNama tetapi kegiatan master-nya tidak terdaftar
      const registeredKegIds = new Set(kegiatan.map((k) => k.id));
      const registeredKegNames = new Set(kegiatan.map((k) => k.namaKegiatan.trim().toLowerCase()));
      const otherKegTx = sortedTransaksi.filter((t) => {
        const isKeluar = t.jenisTransaksi === 'Keluar' || t.jenisTransaksi === 'keluar';
        if (!isKeluar) return false;
        const hasKeg = Boolean(t.kegiatanId || (t.kegiatanNama && t.kegiatanNama.trim().length > 0));
        if (!hasKeg) return false;
        if (t.kegiatanId && registeredKegIds.has(t.kegiatanId)) return false;
        if (t.kegiatanNama && registeredKegNames.has(t.kegiatanNama.trim().toLowerCase())) return false;
        return true;
      });

      if (otherKegTx.length > 0) {
        bkuKegiatanRows.push([
          '▶ LAINNYA',
          'Belanja Kegiatan Lainnya (Non-Master)',
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ]);
        otherKegTx.forEach((tx) => {
          const nominal = Number(tx.nominal) || 0;
          const notaStatus = formatNotaStatus(tx.lampiran);

          bkuKegiatanRows.push([
            overallKegNo++,
            tx.tanggal,
            tx.nomorBukti,
            tx.kegiatanNama || 'Kegiatan Khusus',
            tx.uraian,
            tx.sumberDana || '-',
            nominal,
            tx.penerima || '-',
            notaStatus
          ]);
        });
      }
    } else {
      // Belum ada data kegiatan terdaftar, cari apakah ada transaksi yang memiliki nama kegiatan
      const explicitKegTx = sortedTransaksi.filter((t) => {
        const isKeluar = t.jenisTransaksi === 'Keluar' || t.jenisTransaksi === 'keluar';
        return isKeluar && Boolean(t.kegiatanId || (t.kegiatanNama && t.kegiatanNama.trim().length > 0));
      });

      if (explicitKegTx.length > 0) {
        explicitKegTx.forEach((tx, idx) => {
          const nominal = Number(tx.nominal) || 0;
          const notaStatus = formatNotaStatus(tx.lampiran);

          bkuKegiatanRows.push([
            idx + 1,
            tx.tanggal,
            tx.nomorBukti,
            tx.kegiatanNama || 'Sub-Kegiatan',
            tx.uraian,
            tx.sumberDana || '-',
            nominal,
            tx.penerima || '-',
            notaStatus
          ]);
        });
      } else {
        bkuKegiatanRows.push([
          1,
          '-',
          '-',
          'Belum Ada Transaksi Kegiatan',
          'Belanja operasional umum dicatat di BKU Umum. Belanja hanya akan tampil di BKU Kegiatan jika dialokasikan ke Sub-Kegiatan tertentu.',
          '-',
          0,
          '-',
          '-'
        ]);
      }
    }

    // 4. Prepare Tab 3: Rekap & Pagu Anggaran
    const rekapHeader = [
      'No',
      'Kode Kegiatan',
      'Nama Program / Sub-Kegiatan',
      'Sumber Dana',
      'Pagu Anggaran (Rp)',
      'Realisasi Pengeluaran (Rp)',
      'Sisa Anggaran (Rp)',
      'Persentase Penyerapan (%)'
    ];

    let totalPagu = 0;
    let totalRealisasi = 0;

    const rekapRows: (string | number)[][] = kegiatan.map((k, idx) => {
      const pagu = Number(k.paguAnggaran) || 0;
      totalPagu += pagu;

      // Realisasi calculation based on activity ID or Activity Name
      const matchTx = sortedTransaksi.filter(t => {
        const isKeluar = t.jenisTransaksi === 'Keluar' || t.jenisTransaksi === 'keluar';
        if (!isKeluar) return false;
        if (t.kegiatanId && t.kegiatanId === k.id) return true;
        if (t.kegiatanNama && k.namaKegiatan && t.kegiatanNama.trim().toLowerCase() === k.namaKegiatan.trim().toLowerCase()) return true;
        return false;
      });

      const realisasi = matchTx.reduce((sum, tx) => sum + (Number(tx.nominal) || 0), 0);
      totalRealisasi += realisasi;
      const sisa = pagu - realisasi;
      const persen = pagu > 0 ? ((realisasi / pagu) * 100).toFixed(2) + '%' : '0.00%';

      return [
        idx + 1,
        k.kodeKegiatan,
        k.namaKegiatan,
        k.sumberDana,
        pagu,
        realisasi,
        sisa,
        persen
      ];
    });

    // Append Total Summary Row in Rekap
    const totalSisa = totalPagu - totalRealisasi;
    const totalPersen = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(2) + '%' : '0.00%';
    rekapRows.push([
      'TOTAL',
      '',
      'TOTAL KESELURUHAN KEGIATAN',
      '',
      totalPagu,
      totalRealisasi,
      totalSisa,
      totalPersen
    ]);

    // 5. Clear old rows first so deleted transactions are removed
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ranges: [
          'BKU Umum!A1:Z5000',
          'BKU Kegiatan!A1:Z5000',
          "'Rekap & Pagu'!A1:Z5000"
        ]
      })
    });

    // 6. Write values with batchUpdate
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: 'BKU Umum!A1',
            values: [bkuUmumHeader, ...bkuUmumRows]
          },
          {
            range: 'BKU Kegiatan!A1',
            values: [bkuKegiatanHeader, ...bkuKegiatanRows]
          },
          {
            range: "'Rekap & Pagu'!A1",
            values: [rekapHeader, ...rekapRows]
          }
        ]
      })
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gagal sinkronisasi data ke Google Sheets (${updateRes.status})`);
    }

    const updateData = await updateRes.json();
    return {
      success: true,
      updatedCells: updateData.totalUpdatedCells
    };
  } catch (error: any) {
    console.error('Error syncing to Google Sheets:', error);
    return {
      success: false,
      error: error?.message || 'Terjadi kesalahan saat menyinkronkan data ke Google Sheets'
    };
  }
}
