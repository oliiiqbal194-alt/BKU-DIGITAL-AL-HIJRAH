import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  TransaksiBKU,
  KegiatanAnggaran,
  ProfilInstansi,
  ToastMessage,
  RekapBulananItem,
  EnkripsiStatus,
  JenisTransaksi,
  PosKategori,
  GoogleSheetsConfig
} from '../types';
import { NAMA_BULAN, angkaKeRomawi } from '../utils/formatters';
import { encryptData, decryptData } from '../utils/crypto';

import { db, auth, googleSignIn, getAccessToken, logoutGoogle, initAuth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { createBKUSpreadsheet, syncAllBKUDataToSheets } from '../utils/googleSheets';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const STORAGE_KEY = 'bku_data_vault_v1';
const ENCRYPTION_FLAG_KEY = 'bku_encryption_active';

const DEFAULT_INSTANSI: ProfilInstansi = {
  namaInstansi: 'SD ISLAM AL HIJRAH GORONTALO',
  tahunAjaran: 'T.A 2026 / 2027',
  unitPengelola: 'Bagian Keuangan & Tata Usaha Sekolah',
  alamat: 'Jl. Trans Sulawesi, Kota Gorontalo',
  telepon: '(0435) 821-234',
  email: 'sdislamalhijrah@gmail.com',
  namaKepala: 'Hj. Fatimah Zahra, S.Pd.I., M.Pd.',
  nipKepala: '-',
  jabatanKepala: 'Kepala Sekolah',
  namaBendahara: 'Rahmatia Usman, S.E.',
  nipBendahara: '-',
  jabatanBendahara: 'Bendahara Sekolah',
  kotaTandaTangan: 'Gorontalo',
  tahunAnggaran: 2026,
  saldoAwalTahun: 4160000,
  nomorRekeningBank: '102-00-1234567-8',
  namaBank: 'Bank Syariah Indonesia (BSI)',
};

interface BKUContextType {
  transaksi: TransaksiBKU[];
  kegiatan: KegiatanAnggaran[];
  instansi: ProfilInstansi;
  selectedBulan: number;
  selectedTahun: number;
  activeTab: 'bku_umum' | 'bku_kegiatan' | 'rekapitulasi' | 'pengaturan';
  encryptionStatus: EnkripsiStatus;
  toasts: ToastMessage[];
  isLoading: boolean;

  // Google Sheets & Drive Integration
  googleUser: User | null;
  googleAccessToken: string | null;
  googleSheetsConfig: GoogleSheetsConfig | null;
  isSyncingSheets: boolean;
  connectGoogleDrive: () => Promise<boolean>;
  disconnectGoogleDrive: () => Promise<void>;
  syncToGoogleSheets: (customTx?: TransaksiBKU[], customKg?: KegiatanAnggaran[]) => Promise<boolean>;
  createAndLinkSpreadsheet: () => Promise<string | null>;
  updateGoogleSheetsConfig: (cfg: Partial<GoogleSheetsConfig>) => Promise<void>;
  
  // Setters
  setSelectedBulan: (bulan: number) => void;
  setSelectedTahun: (tahun: number) => void;
  setActiveTab: (tab: 'bku_umum' | 'bku_kegiatan' | 'rekapitulasi' | 'pengaturan') => void;
  
  // Transaksi Handlers
  addTransaksi: (data: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  addMultipleTransaksi: (items: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<boolean>;
  updateTransaksi: (id: string, data: Partial<TransaksiBKU>) => Promise<boolean>;
  deleteTransaksi: (id: string) => Promise<boolean>;
  getTransaksiBulan: (bulan?: number) => TransaksiBKU[];
  getSaldoAwalBulan: (bulan: number) => number;
  getSaldoAkhirBulan: (bulan: number) => number;
  setSaldoAwalBulan: (bulan: number, nominal: number | null) => Promise<boolean>;
  isCustomSaldoAwalBulan: (bulan: number) => boolean;
  getNextNomorBukti: (jenis: JenisTransaksi, bulan: number) => string;
  
  // Kegiatan Handlers
  addKegiatan: (data: Omit<KegiatanAnggaran, 'id' | 'createdAt'>) => Promise<boolean>;
  updateKegiatan: (id: string, data: Partial<KegiatanAnggaran>) => Promise<boolean>;
  deleteKegiatan: (id: string) => Promise<boolean>;
  getKegiatanStats: (kegiatanId: string) => { totalRealisasi: number; persentase: number; sisa: number };
  allocateTransaksiToKegiatan: (transaksiIds: string[], kegiatanId: string | null, kegiatanNama?: string) => Promise<boolean>;
  
  // Instansi & Pengaturan
  updateInstansi: (data: Partial<ProfilInstansi>) => void;
  resetAllData: () => Promise<boolean>;
  purgeAllDatabase: (options?: { resetProfil?: boolean }) => Promise<boolean>;
  purgeMonthTransaksi: (bulan: number) => Promise<boolean>;
  importBatchDatabase: (
    items: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[],
    options?: {
      mode?: 'replace' | 'append';
      kegiatanList?: Omit<KegiatanAnggaran, 'id' | 'createdAt'>[];
      instansiData?: Partial<ProfilInstansi>;
      tahun?: number;
    }
  ) => Promise<{ success: boolean; count: number }>;
  loadSampleTemplate: () => void;
  
  // Keamanan Enkripsi
  setMasterPassphrase: (passphrase: string) => Promise<boolean>;
  exportEncryptedVault: (passphrase?: string) => Promise<string>;
  importEncryptedVault: (payloadString: string, passphrase?: string) => Promise<boolean>;
  
  // Toasts
  addToast: (type: ToastMessage['type'], title: string, message: string) => void;
  removeToast: (id: string) => void;
}

const BKUContext = createContext<BKUContextType | null>(null);

export function BKUProvider({ children }: { children: React.ReactNode }) {
  // ATURAN KETAT: Memulai dengan state yang KOSONG (Empty State murni)
  const [transaksi, setTransaksi] = useState<TransaksiBKU[]>([]);
  const [kegiatan, setKegiatan] = useState<KegiatanAnggaran[]>([]);
  const [instansi, setInstansi] = useState<ProfilInstansi>(DEFAULT_INSTANSI);

  // Google Sheets & Drive States (OAuth Token managed strictly in-memory)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState<GoogleSheetsConfig | null>(null);
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);
  
  // Default to September 2026 as per user specification
  const [selectedBulan, setSelectedBulan] = useState<number>(9);
  const [selectedTahun, setSelectedTahun] = useState<number>(2026);
  const [activeTab, setActiveTab] = useState<'bku_umum' | 'bku_kegiatan' | 'rekapitulasi' | 'pengaturan'>('bku_umum');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [encryptionStatus, setEncryptionStatus] = useState<EnkripsiStatus>({
    isEncrypted: true,
    hasCustomKey: false,
    lastEncryptedAt: undefined
  });

  // Listen to Google Auth State and in-memory access token
  useEffect(() => {
    const unsubAuth = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );
    return () => unsubAuth();
  }, []);

  // Toast Helpers
  const addToast = useCallback((type: ToastMessage['type'], title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync real-time dengan Firestore
  useEffect(() => {
    setIsLoading(true);
    let hasLoadedTxFromFirestore = false;
    let hasLoadedKegFromFirestore = false;

    const unsubTx = onSnapshot(collection(db, 'transaksi'), (snapshot) => {
      hasLoadedTxFromFirestore = true;
      const items: TransaksiBKU[] = [];
      snapshot.forEach((d) => items.push({ id: d.id, ...d.data() } as TransaksiBKU));
      // SELALU setTransaksi dengan snapshot nyata, bahkan saat kosong (0 item)
      setTransaksi(items);
      setIsLoading(false);
    }, (error) => {
      console.warn('Firestore snapshot error on transaksi, using local fallback:', error);
      setIsLoading(false);
    });

    const unsubKeg = onSnapshot(collection(db, 'kegiatan'), (snapshot) => {
      hasLoadedKegFromFirestore = true;
      const items: KegiatanAnggaran[] = [];
      snapshot.forEach((d) => items.push({ id: d.id, ...d.data() } as KegiatanAnggaran));
      setKegiatan(items);
    }, (error) => {
      console.warn('Firestore snapshot error on kegiatan:', error);
    });

    const unsubInst = onSnapshot(collection(db, 'instansi'), (snapshot) => {
      snapshot.forEach((d) => {
        if (d.id === 'profil') {
          setInstansi((prev) => ({ ...prev, ...d.data() }));
        } else if (d.id === 'google_sheets_config') {
          setGoogleSheetsConfig((prev) => ({ ...prev, ...d.data() } as GoogleSheetsConfig));
        }
      });
    }, (error) => {
      console.warn('Firestore snapshot error on instansi:', error);
    });

    // Fallback lokal jika offline / sebelum firestore merespon
    async function loadLocalData() {
      try {
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        if (storedRaw) {
          const decrypted = await decryptData(storedRaw);
          if (decrypted) {
            // Hanya isi jika Firestore belum merespon
            if (!hasLoadedTxFromFirestore && Array.isArray(decrypted.transaksi) && decrypted.transaksi.length > 0) {
              setTransaksi(decrypted.transaksi);
            }
            if (!hasLoadedKegFromFirestore && Array.isArray(decrypted.kegiatan) && decrypted.kegiatan.length > 0) {
              setKegiatan(decrypted.kegiatan);
            }
            if (decrypted.instansi) setInstansi((prev) => ({ ...prev, ...decrypted.instansi }));
            if (decrypted.selectedTahun) setSelectedTahun(decrypted.selectedTahun);
          }
        }
      } catch (err) {
        console.warn('Load local fallback error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadLocalData();

    return () => {
      unsubTx();
      unsubKeg();
      unsubInst();
    };
  }, []);

  // Auto-Save terenkripsi setiap ada perubahan data
  const persistState = useCallback(async (
    txList: TransaksiBKU[],
    kgList: KegiatanAnggaran[],
    inst: ProfilInstansi,
    thn: number
  ) => {
    try {
      const payload = {
        transaksi: txList,
        kegiatan: kgList,
        instansi: inst,
        selectedTahun: thn,
        savedAt: new Date().toISOString()
      };
      const encryptedString = await encryptData(payload);
      localStorage.setItem(STORAGE_KEY, encryptedString);
      setEncryptionStatus((prev) => ({
        ...prev,
        isEncrypted: true,
        lastEncryptedAt: new Date().toLocaleTimeString('id-ID')
      }));
    } catch (err) {
      console.error('Gagal menyimpan data terenkripsi:', err);
    }
  }, []);

  // Hitung Saldo Awal Bulan secara otomatis (Carry forward dari bulan-bulan sebelumnya)
  const isCustomSaldoAwalBulan = useCallback((targetBulan: number): boolean => {
    return Boolean(instansi.saldoAwalBulanCustom && instansi.saldoAwalBulanCustom[targetBulan] !== undefined);
  }, [instansi.saldoAwalBulanCustom]);

  const getSaldoAwalBulan = useCallback((targetBulan: number): number => {
    if (instansi.saldoAwalBulanCustom && instansi.saldoAwalBulanCustom[targetBulan] !== undefined) {
      return instansi.saldoAwalBulanCustom[targetBulan];
    }

    let saldo = instansi.saldoAwalTahun || 0;
    if (targetBulan === 1) return saldo;

    for (let b = 1; b < targetBulan; b++) {
      if (instansi.saldoAwalBulanCustom && instansi.saldoAwalBulanCustom[b] !== undefined) {
        saldo = instansi.saldoAwalBulanCustom[b];
      }
      const txBulan = transaksi.filter((t) => t.tahun === selectedTahun && t.bulan === b);
      const totalMasuk = txBulan.reduce((acc, t) => {
        const isMasuk = t.jenisTransaksi === 'masuk' || t.jenisTransaksi === 'Masuk';
        return acc + (isMasuk ? t.nominal : 0);
      }, 0);
      const totalKeluar = txBulan.reduce((acc, t) => {
        const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
        return acc + (isKeluar ? t.nominal : 0);
      }, 0);
      saldo = saldo + totalMasuk - totalKeluar;
    }

    return saldo;
  }, [instansi.saldoAwalBulanCustom, instansi.saldoAwalTahun, selectedTahun, transaksi]);

  const setSaldoAwalBulan = useCallback(async (bulan: number, nominal: number | null): Promise<boolean> => {
    try {
      const currentMap = { ...(instansi.saldoAwalBulanCustom || {}) };
      if (nominal === null) {
        delete currentMap[bulan];
      } else {
        currentMap[bulan] = nominal;
        if (bulan === 1) {
          instansi.saldoAwalTahun = nominal;
        }
      }

      const updatedInstansi: ProfilInstansi = {
        ...instansi,
        saldoAwalBulanCustom: currentMap
      };

      setInstansi(updatedInstansi);

      // Sync with Firestore
      await setDoc(doc(db, 'instansi', 'profil'), updatedInstansi, { merge: true });

      // Save local backup
      await persistState(transaksi, kegiatan, updatedInstansi, selectedTahun);

      const namaBulanStr = NAMA_BULAN[bulan - 1] || `Bulan ${bulan}`;
      addToast(
        'success',
        'Saldo Awal Diperbarui',
        nominal === null
          ? `Saldo awal ${namaBulanStr} dikembalikan ke akumulasi otomatis.`
          : `Saldo awal ${namaBulanStr} disesuaikan menjadi Rp ${nominal.toLocaleString('id-ID')}.`
      );
      return true;
    } catch (err) {
      console.error('Gagal menyimpan Saldo Awal:', err);
      addToast('error', 'Gagal', 'Terjadi kesalahan saat menyimpan saldo awal.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi]);

  // Hitung Saldo Akhir Bulan
  const getSaldoAkhirBulan = useCallback((targetBulan: number): number => {
    const saldoAwal = getSaldoAwalBulan(targetBulan);
    const txBulan = transaksi.filter((t) => t.tahun === selectedTahun && t.bulan === targetBulan);
    const totalMasuk = txBulan.reduce((acc, t) => {
      const isMasuk = t.jenisTransaksi === 'masuk' || t.jenisTransaksi === 'Masuk';
      return acc + (isMasuk ? t.nominal : 0);
    }, 0);
    const totalKeluar = txBulan.reduce((acc, t) => {
      const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
      return acc + (isKeluar ? t.nominal : 0);
    }, 0);
    return saldoAwal + totalMasuk - totalKeluar;
  }, [getSaldoAwalBulan, selectedTahun, transaksi]);

  // Transaksi bulan aktif (diurutkan kronologis tanggal lalu waktu dibuat)
  const getTransaksiBulan = useCallback((bulan?: number): TransaksiBKU[] => {
    const b = bulan !== undefined ? bulan : selectedBulan;
    return transaksi
      .filter((t) => t.tahun === selectedTahun && t.bulan === b)
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
  }, [selectedBulan, selectedTahun, transaksi]);

  // Generator Nomor Bukti otomatis berurutan (misal: 001/BKU-KAS/IX/2026)
  const getNextNomorBukti = useCallback((jenis: JenisTransaksi, bulan: number): string => {
    const txBulan = transaksi.filter((t) => t.tahun === selectedTahun && t.bulan === bulan);
    const nextIndex = (txBulan.length + 1).toString().padStart(3, '0');
    const romawi = angkaKeRomawi(bulan);
    const isMasuk = jenis === 'masuk' || jenis === 'Masuk';
    const tag = isMasuk ? 'TRM' : 'KAS';
    return `${nextIndex}/BKU-${tag}/${romawi}/${selectedTahun}`;
  }, [selectedTahun, transaksi]);

  // Background Auto-sync to Google Spreadsheet when a transaction or activity is modified
  const triggerAutoSync = useCallback(async (
    currentTx: TransaksiBKU[],
    currentKg: KegiatanAnggaran[]
  ) => {
    try {
      const token = await getAccessToken();
      if (!token || !googleSheetsConfig?.spreadsheetId || googleSheetsConfig?.autoSyncEnabled === false) {
        return;
      }

      await syncAllBKUDataToSheets(token, googleSheetsConfig.spreadsheetId, {
        transaksi: currentTx,
        kegiatan: currentKg,
        instansi
      });

      const syncedAt = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...googleSheetsConfig,
        lastSyncedAt: syncedAt,
        status: 'success'
      };
      setGoogleSheetsConfig(updatedConfig);
      await setDoc(doc(db, 'instansi', 'google_sheets_config'), updatedConfig);
    } catch (err) {
      console.warn('Auto sync Google Sheets background warning:', err);
    }
  }, [googleSheetsConfig, instansi]);

  // Connect Google Drive
  const connectGoogleDrive = useCallback(async (): Promise<boolean> => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleAccessToken(res.accessToken);
        addToast('success', 'Akun Google Terhubung', `Berhasil masuk sebagai ${res.user.email || 'Pengguna Google'}.`);

        // If spreadsheet not created yet, automatically create it as requested!
        if (!googleSheetsConfig?.spreadsheetId) {
          try {
            const sheetInfo = await createBKUSpreadsheet(res.accessToken, instansi);
            const newConfig: GoogleSheetsConfig = {
              spreadsheetId: sheetInfo.spreadsheetId,
              spreadsheetUrl: sheetInfo.spreadsheetUrl,
              spreadsheetTitle: sheetInfo.spreadsheetTitle,
              autoSyncEnabled: true,
              lastSyncedAt: new Date().toISOString(),
              status: 'success'
            };
            setGoogleSheetsConfig(newConfig);
            await setDoc(doc(db, 'instansi', 'google_sheets_config'), newConfig);

            await syncAllBKUDataToSheets(res.accessToken, sheetInfo.spreadsheetId, {
              transaksi,
              kegiatan,
              instansi
            });

            addToast(
              'success',
              'Spreadsheet Baru Dibuat di Google Drive',
              `Berkas "${sheetInfo.spreadsheetTitle}" berhasil dibuat dan siap disinkronkan.`
            );
          } catch (createErr: any) {
            console.error('Create spreadsheet on connect error:', createErr);
          }
        }
        return true;
      }
      return false;
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMessage = err?.message || '';
      if (
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        errorCode === 'auth/user-cancelled' ||
        errorMessage.includes('popup-closed-by-user') ||
        errorMessage.includes('cancelled-popup-request')
      ) {
        return false;
      }
      console.error('Connect Google error:', err);
      addToast('error', 'Gagal Terhubung ke Google', err.message || 'Gagal otentikasi Google.');
      return false;
    }
  }, [addToast, googleSheetsConfig, instansi, kegiatan, transaksi]);

  // Disconnect Google Drive
  const disconnectGoogleDrive = useCallback(async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleAccessToken(null);
    addToast('info', 'Google Drive Diputuskan', 'Sesi autentikasi Google telah keluar.');
  }, [addToast]);

  // Create and link spreadsheet in Drive
  const createAndLinkSpreadsheet = useCallback(async (): Promise<string | null> => {
    let token = googleAccessToken || await getAccessToken();
    if (!token) {
      const ok = await connectGoogleDrive();
      if (!ok) return null;
      token = await getAccessToken();
    }
    if (!token) return null;

    try {
      setIsSyncingSheets(true);
      const sheetInfo = await createBKUSpreadsheet(token, instansi);
      const newConfig: GoogleSheetsConfig = {
        spreadsheetId: sheetInfo.spreadsheetId,
        spreadsheetUrl: sheetInfo.spreadsheetUrl,
        spreadsheetTitle: sheetInfo.spreadsheetTitle,
        autoSyncEnabled: true,
        lastSyncedAt: new Date().toISOString(),
        status: 'success'
      };
      setGoogleSheetsConfig(newConfig);
      await setDoc(doc(db, 'instansi', 'google_sheets_config'), newConfig);

      await syncAllBKUDataToSheets(token, sheetInfo.spreadsheetId, {
        transaksi,
        kegiatan,
        instansi
      });

      addToast('success', 'Spreadsheet Berhasil Dibuat', `File "${sheetInfo.spreadsheetTitle}" telah tersimpan di Google Drive.`);
      return sheetInfo.spreadsheetId;
    } catch (err: any) {
      console.error('Error creating spreadsheet:', err);
      addToast('error', 'Gagal Membuat Spreadsheet', err.message || 'Terjadi masalah pada API Google Sheets.');
      return null;
    } finally {
      setIsSyncingSheets(false);
    }
  }, [addToast, connectGoogleDrive, googleAccessToken, instansi, kegiatan, transaksi]);

  // Manual or on-demand full sync to Google Sheets
  const syncToGoogleSheets = useCallback(async (
    customTx?: TransaksiBKU[],
    customKg?: KegiatanAnggaran[]
  ): Promise<boolean> => {
    let token = googleAccessToken || await getAccessToken();
    if (!token) {
      const ok = await connectGoogleDrive();
      if (!ok) return false;
      token = await getAccessToken();
    }
    if (!token) return false;

    let targetSpreadsheetId = googleSheetsConfig?.spreadsheetId;
    if (!targetSpreadsheetId) {
      targetSpreadsheetId = (await createAndLinkSpreadsheet()) || undefined;
      if (!targetSpreadsheetId) return false;
    }

    try {
      setIsSyncingSheets(true);
      const res = await syncAllBKUDataToSheets(token, targetSpreadsheetId, {
        transaksi: customTx || transaksi,
        kegiatan: customKg || kegiatan,
        instansi
      });

      if (res.success) {
        const syncedAt = new Date().toISOString();
        const updatedConfig: GoogleSheetsConfig = {
          ...(googleSheetsConfig || {
            spreadsheetId: targetSpreadsheetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}/edit`,
            spreadsheetTitle: 'BKU Digital',
            autoSyncEnabled: true
          }),
          lastSyncedAt: syncedAt,
          status: 'success'
        };
        setGoogleSheetsConfig(updatedConfig);
        await setDoc(doc(db, 'instansi', 'google_sheets_config'), updatedConfig);
        addToast('success', 'Sinkronisasi Berhasil', 'Data BKU Umum, BKU Kegiatan, dan Rekapitulasi berhasil disinkronkan ke Google Spreadsheet.');
        return true;
      } else {
        throw new Error(res.error || 'Gagal menyinkronkan data.');
      }
    } catch (err: any) {
      console.error('Manual sync error:', err);
      addToast('error', 'Gagal Sinkronisasi Google Sheets', err.message || 'Terjadi masalah koneksi ke Google Sheets.');
      return false;
    } finally {
      setIsSyncingSheets(false);
    }
  }, [addToast, connectGoogleDrive, createAndLinkSpreadsheet, googleAccessToken, googleSheetsConfig, instansi, kegiatan, transaksi]);

  // Update Google Sheets config in memory & Firestore
  const updateGoogleSheetsConfig = useCallback(async (cfg: Partial<GoogleSheetsConfig>) => {
    if (!googleSheetsConfig) return;
    const updated = { ...googleSheetsConfig, ...cfg };
    setGoogleSheetsConfig(updated);
    try {
      await setDoc(doc(db, 'instansi', 'google_sheets_config'), updated);
      addToast('info', 'Pengaturan Disimpan', 'Konfigurasi Google Spreadsheet telah diperbarui.');
    } catch (e) {
      console.warn('Gagal menyimpan update google sheets config ke firestore:', e);
    }
  }, [addToast, googleSheetsConfig]);

  // Add Transaksi
  const addTransaksi = useCallback(async (data: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      const jenisKas = data.jenisKas || 'Kas Sekolah';
      const sumberDana = data.sumberDana || (
        jenisKas === 'Kas Yayasan' ? 'Dana Yayasan' :
        jenisKas === 'Kas Orang Tua' ? 'Dana Orangtua' : 'Dana Sekolah'
      );
      const newTx: TransaksiBKU = {
        ...data,
        jenisKas,
        sumberDana,
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now
      };

      const updated = [...transaksi, newTx];
      setTransaksi(updated);
      await persistState(updated, kegiatan, instansi, selectedTahun);

      try {
        await setDoc(doc(db, 'transaksi', newTx.id), newTx);
      } catch (fErr) {
        console.warn('Firestore write warning:', fErr);
      }

      // Trigger auto sync to Google Sheets
      triggerAutoSync(updated, kegiatan);

      addToast('success', 'Transaksi Berhasil Disimpan', `Nomor bukti ${newTx.nomorBukti} telah dicatat dalam database BKU.`);
      return true;
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Transaksi', 'Terjadi kesalahan sistem saat menyimpan data.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Add Multiple Transaksi (Batch / Database Input)
  const addMultipleTransaksi = useCallback(async (items: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      const newItems: TransaksiBKU[] = items.map((data) => {
        const jenisKas = data.jenisKas || 'Kas Sekolah';
        const sumberDana = data.sumberDana || (
          jenisKas === 'Kas Yayasan' ? 'Dana Yayasan' :
          jenisKas === 'Kas Orang Tua' ? 'Dana Orangtua' : 'Dana Sekolah'
        );
        return {
          ...data,
          jenisKas,
          sumberDana,
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: now,
          updatedAt: now
        };
      });

      const updated = [...transaksi, ...newItems];
      setTransaksi(updated);
      await persistState(updated, kegiatan, instansi, selectedTahun);

      try {
        for (const item of newItems) {
          await setDoc(doc(db, 'transaksi', item.id), item);
        }
      } catch (fErr) {
        console.warn('Firestore batch write warning:', fErr);
      }

      // Trigger auto sync to Google Sheets
      triggerAutoSync(updated, kegiatan);

      addToast('success', 'Batch Transaksi Disimpan', `${newItems.length} catatan transaksi berhasil ditambahkan ke database BKU.`);
      return true;
    } catch (err) {
      addToast('error', 'Gagal Menyimpan Batch', 'Terjadi kesalahan sistem saat menyimpan banyak transaksi.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Update Transaksi
  const updateTransaksi = useCallback(async (id: string, data: Partial<TransaksiBKU>): Promise<boolean> => {
    try {
      const updated = transaksi.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            ...data,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });

      setTransaksi(updated);
      await persistState(updated, kegiatan, instansi, selectedTahun);

      const target = updated.find((t) => t.id === id);
      if (target) {
        try {
          await setDoc(doc(db, 'transaksi', id), target);
        } catch (fErr) {
          console.warn('Firestore update warning:', fErr);
        }
      }

      // Trigger auto sync to Google Sheets
      triggerAutoSync(updated, kegiatan);

      addToast('success', 'Perubahan Disimpan', 'Data transaksi telah diperbarui.');
      return true;
    } catch (err) {
      addToast('error', 'Gagal Memperbarui', 'Tidak dapat memperbarui transaksi.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Delete Transaksi
  const deleteTransaksi = useCallback(async (id: string): Promise<boolean> => {
    try {
      const target = transaksi.find((t) => t.id === id);
      const updated = transaksi.filter((t) => t.id !== id);
      setTransaksi(updated);
      await persistState(updated, kegiatan, instansi, selectedTahun);

      try {
        await deleteDoc(doc(db, 'transaksi', id));
      } catch (fErr) {
        console.warn('Firestore delete warning:', fErr);
      }

      // Trigger auto sync to Google Sheets
      triggerAutoSync(updated, kegiatan);

      addToast('info', 'Transaksi Dihapus', `Transaksi ${target?.nomorBukti || ''} telah dihapus dari BKU.`);
      return true;
    } catch (err) {
      addToast('error', 'Gagal Menghapus', 'Terjadi kesalahan saat menghapus data.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Kegiatan Handlers
  const addKegiatan = useCallback(async (data: Omit<KegiatanAnggaran, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const newKeg: KegiatanAnggaran = {
        ...data,
        id: `kg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString()
      };
      const updated = [...kegiatan, newKeg];
      setKegiatan(updated);
      await persistState(transaksi, updated, instansi, selectedTahun);

      try {
        await setDoc(doc(db, 'kegiatan', newKeg.id), newKeg);
      } catch (fErr) {
        console.warn('Firestore write warning:', fErr);
      }

      // Trigger auto sync to Google Sheets
      triggerAutoSync(transaksi, updated);

      addToast('success', 'Kegiatan Ditambahkan', `Kegiatan "${newKeg.namaKegiatan}" berhasil dibuat.`);
      return true;
    } catch (err) {
      addToast('error', 'Gagal', 'Tidak dapat menambahkan kegiatan anggaran.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  const updateKegiatan = useCallback(async (id: string, data: Partial<KegiatanAnggaran>): Promise<boolean> => {
    try {
      const updated = kegiatan.map((k) => (k.id === id ? { ...k, ...data } : k));
      setKegiatan(updated);
      await persistState(transaksi, updated, instansi, selectedTahun);

      const target = updated.find((k) => k.id === id);
      if (target) {
        try {
          await setDoc(doc(db, 'kegiatan', id), target);
        } catch (fErr) {
          console.warn('Firestore update warning:', fErr);
        }
      }

      // Trigger auto sync to Google Sheets
      triggerAutoSync(transaksi, updated);

      addToast('success', 'Kegiatan Diperbarui', 'Data kegiatan anggaran berhasil diperbarui.');
      return true;
    } catch (err) {
      addToast('error', 'Gagal Memperbarui', 'Gagal mengubah kegiatan.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  const deleteKegiatan = useCallback(async (id: string): Promise<boolean> => {
    try {
      const updated = kegiatan.filter((k) => k.id !== id);
      setKegiatan(updated);
      await persistState(transaksi, updated, instansi, selectedTahun);

      try {
        await deleteDoc(doc(db, 'kegiatan', id));
      } catch (fErr) {
        console.warn('Firestore delete warning:', fErr);
      }

      // Trigger auto sync to Google Sheets
      triggerAutoSync(transaksi, updated);

      addToast('info', 'Kegiatan Dihapus', 'Data kegiatan telah dihapus dari daftar.');
      return true;
    } catch (err) {
      addToast('error', 'Gagal Menghapus', 'Tidak dapat menghapus kegiatan.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Hitung Realisasi Anggaran per Kegiatan
  const getKegiatanStats = useCallback((kegiatanId: string) => {
    const keg = kegiatan.find((k) => k.id === kegiatanId);
    if (!keg) return { totalRealisasi: 0, persentase: 0, sisa: 0 };
    
    const txTerkait = transaksi.filter((t) => {
      const isKeluar = t.jenisTransaksi === 'keluar' || t.jenisTransaksi === 'Keluar';
      if (!isKeluar) return false;
      
      const isDirectMatch = t.kegiatanId === kegiatanId;
      const isNameMatch = (
        t.sumberDana === keg.sumberDana && (
          t.posKategori === keg.namaKegiatan ||
          (t.uraian && keg.namaKegiatan && t.uraian.toLowerCase().includes(keg.namaKegiatan.toLowerCase())) ||
          (t.kodeRekening && keg.kodeKegiatan && t.kodeRekening === keg.kodeKegiatan)
        )
      );
      
      return isDirectMatch || isNameMatch;
    });

    const totalRealisasi = txTerkait.reduce((acc, t) => acc + t.nominal, 0);
    const persentase = keg.paguAnggaran > 0 ? (totalRealisasi / keg.paguAnggaran) * 100 : 0;
    const sisa = keg.paguAnggaran - totalRealisasi;

    return { totalRealisasi, persentase, sisa };
  }, [kegiatan, transaksi]);

  // Alokasi massal transaksi dari BKU Umum ke Sub-Kegiatan Anggaran tertentu
  const allocateTransaksiToKegiatan = useCallback(async (
    transaksiIds: string[],
    kegiatanId: string | null,
    kegiatanNama?: string
  ): Promise<boolean> => {
    try {
      const targetKeg = kegiatanId ? kegiatan.find((k) => k.id === kegiatanId) : null;
      const targetName = kegiatanNama || targetKeg?.namaKegiatan || undefined;

      const updated = transaksi.map((t) => {
        if (transaksiIds.includes(t.id)) {
          return {
            ...t,
            kegiatanId: kegiatanId || undefined,
            kegiatanNama: kegiatanId ? targetName : undefined,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });

      setTransaksi(updated);
      await persistState(updated, kegiatan, instansi, selectedTahun);

      try {
        for (const id of transaksiIds) {
          const t = updated.find((item) => item.id === id);
          if (t) {
            await setDoc(doc(db, 'transaksi', id), t);
          }
        }
      } catch (fErr) {
        console.warn('Firestore update allocation warning:', fErr);
      }

      triggerAutoSync(updated, kegiatan);
      addToast(
        'success',
        'Alokasi Diperbarui',
        kegiatanId
          ? `${transaksiIds.length} transaksi berhasil dialokasikan ke sub-kegiatan "${targetName}".`
          : `${transaksiIds.length} transaksi berhasil dialihkan sebagai belanja rutin operasional umum.`
      );
      return true;
    } catch (err) {
      addToast('error', 'Gagal Mengalokasikan', 'Terjadi kesalahan saat memperbarui alokasi kegiatan.');
      return false;
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Update profil instansi
  const updateInstansi = useCallback(async (data: Partial<ProfilInstansi>) => {
    const updated = { ...instansi, ...data };
    setInstansi(updated);
    await persistState(transaksi, kegiatan, updated, selectedTahun);
    try {
      await setDoc(doc(db, 'instansi', 'profil'), updated);
    } catch (fErr) {
      console.warn('Firestore instansi write warning:', fErr);
    }
    addToast('success', 'Profil Instansi Diperbarui', 'Informasi lembaga dan pejabat bendahara telah tersimpan.');
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi]);

  // Pembersihan Total Database: Hapus semua transaksi dan kegiatan dari Cloud Firestore dan lokal
  const purgeAllDatabase = useCallback(async (options?: { resetProfil?: boolean }): Promise<boolean> => {
    setIsLoading(true);
    try {
      // 1. Hapus semua dokumen transaksi di Firestore secara batch
      const txSnapshot = await getDocs(collection(db, 'transaksi'));
      const batchLimit = 350;
      let currentBatch = writeBatch(db);
      let count = 0;

      for (const d of txSnapshot.docs) {
        currentBatch.delete(d.ref);
        count++;
        if (count >= batchLimit) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await currentBatch.commit();
      }

      // 2. Hapus semua dokumen kegiatan di Firestore secara batch
      const kgSnapshot = await getDocs(collection(db, 'kegiatan'));
      currentBatch = writeBatch(db);
      count = 0;
      for (const d of kgSnapshot.docs) {
        currentBatch.delete(d.ref);
        count++;
        if (count >= batchLimit) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await currentBatch.commit();
      }

      // 3. Reset profil dan bersihkan penyesuaian saldo awal bulan kustom
      const newInstansi: ProfilInstansi = options?.resetProfil
        ? DEFAULT_INSTANSI
        : { ...instansi, saldoAwalBulanCustom: {} };

      try {
        await setDoc(doc(db, 'instansi', 'profil'), newInstansi);
      } catch (errProfil) {
        console.warn('Gagal mereset profil di firestore:', errProfil);
      }

      // 4. Hapus penyimpanan lokal terenkripsi
      localStorage.removeItem(STORAGE_KEY);

      // 5. Kosongkan state di memori aplikasi
      setTransaksi([]);
      setKegiatan([]);
      setInstansi(newInstansi);

      // 6. Sinkronkan keadaan kosong ke Google Sheets jika terhubung
      triggerAutoSync([], []);

      addToast('success', 'Database Berhasil Dikosongkan', 'Seluruh data transaksi dan kegiatan telah dihapus tuntas dari cloud Firestore dan lokal.');
      return true;
    } catch (err: any) {
      console.error('Error saat membersihkan database:', err);
      addToast('error', 'Gagal Mengosongkan Database', err?.message || 'Terjadi kesalahan sistem cloud.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addToast, instansi, triggerAutoSync]);

  // Hapus semua transaksi khusus bulan tertentu
  const purgeMonthTransaksi = useCallback(async (bulan: number): Promise<boolean> => {
    setIsLoading(true);
    try {
      const targetItems = transaksi.filter((t) => t.tahun === selectedTahun && t.bulan === bulan);
      if (targetItems.length === 0) {
        addToast('info', 'Tidak Ada Transaksi', `Tidak ada data transaksi pada bulan ${NAMA_BULAN[bulan - 1] || bulan}.`);
        return true;
      }

      // Hapus dokumen di Firestore secara batch
      const batchLimit = 350;
      let currentBatch = writeBatch(db);
      let count = 0;

      for (const item of targetItems) {
        currentBatch.delete(doc(db, 'transaksi', item.id));
        count++;
        if (count >= batchLimit) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await currentBatch.commit();
      }

      // Perbarui state transaksi lokal
      const remainingTx = transaksi.filter((t) => !(t.tahun === selectedTahun && t.bulan === bulan));
      setTransaksi(remainingTx);

      // Hapus penyesuaian saldo awal bulan ini jika ada
      const updatedSaldoAwalCustom = { ...(instansi.saldoAwalBulanCustom || {}) };
      delete updatedSaldoAwalCustom[bulan];
      const updatedInstansi: ProfilInstansi = { ...instansi, saldoAwalBulanCustom: updatedSaldoAwalCustom };
      setInstansi(updatedInstansi);
      try {
        await setDoc(doc(db, 'instansi', 'profil'), updatedInstansi, { merge: true });
      } catch (e) {
        console.warn('Gagal update instansi saat hapus bulan:', e);
      }

      // Simpan cadangan lokal
      await persistState(remainingTx, kegiatan, updatedInstansi, selectedTahun);

      // Sinkronkan ke Google Sheets jika terhubung
      triggerAutoSync(remainingTx, kegiatan);

      addToast(
        'success',
        `Data Bulan ${NAMA_BULAN[bulan - 1] || bulan} Dihapus`,
        `${targetItems.length} transaksi berhasil dihapus tuntas dari cloud database.`
      );
      return true;
    } catch (err: any) {
      console.error('Gagal menghapus data transaksi bulan:', err);
      addToast('error', 'Gagal Menghapus Transaksi Bulan', err?.message || 'Terjadi kesalahan sistem cloud.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Impor Batch Database (Excel / JSON) dengan penyimpanan permanen ke Firestore
  const importBatchDatabase = useCallback(async (
    items: Omit<TransaksiBKU, 'id' | 'createdAt' | 'updatedAt'>[],
    options?: {
      mode?: 'replace' | 'append';
      kegiatanList?: Omit<KegiatanAnggaran, 'id' | 'createdAt'>[];
      instansiData?: Partial<ProfilInstansi>;
      tahun?: number;
    }
  ): Promise<{ success: boolean; count: number }> => {
    setIsLoading(true);
    try {
      const mode = options?.mode || 'replace';
      const targetTahun = options?.tahun || selectedTahun;
      const now = new Date().toISOString();

      // Jika mode 'replace', hapus transaksi lama di Firestore terlebih dahulu
      if (mode === 'replace') {
        const oldDocs = await getDocs(collection(db, 'transaksi'));
        const batchLimit = 350;
        let deleteBatch = writeBatch(db);
        let dCount = 0;
        for (const d of oldDocs.docs) {
          deleteBatch.delete(d.ref);
          dCount++;
          if (dCount >= batchLimit) {
            await deleteBatch.commit();
            deleteBatch = writeBatch(db);
            dCount = 0;
          }
        }
        if (dCount > 0) {
          await deleteBatch.commit();
        }
      }

      // Siapkan array TransaksiBKU dengan ID permanen
      const preparedTx: TransaksiBKU[] = items.map((item, idx) => {
        const id = `tx_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        return {
          ...item,
          id,
          tahun: item.tahun || targetTahun,
          createdAt: now,
          updatedAt: now
        };
      });

      // Tulis transaksi baru ke Firestore secara batch
      const batchLimit = 350;
      let writeBatchInstance = writeBatch(db);
      let wCount = 0;

      for (const tx of preparedTx) {
        writeBatchInstance.set(doc(db, 'transaksi', tx.id), tx);
        wCount++;
        if (wCount >= batchLimit) {
          await writeBatchInstance.commit();
          writeBatchInstance = writeBatch(db);
          wCount = 0;
        }
      }
      if (wCount > 0) {
        await writeBatchInstance.commit();
      }

      // Siapkan kegiatan jika ada
      let finalKegiatan = kegiatan;
      if (options?.kegiatanList && options.kegiatanList.length > 0) {
        if (mode === 'replace') {
          const oldKegDocs = await getDocs(collection(db, 'kegiatan'));
          let kDelBatch = writeBatch(db);
          for (const d of oldKegDocs.docs) kDelBatch.delete(d.ref);
          await kDelBatch.commit();
        }

        const preparedKg: KegiatanAnggaran[] = options.kegiatanList.map((k, idx) => ({
          ...k,
          id: (k as any).id || `kg_${Date.now()}_${idx}`,
          createdAt: now
        }));

        let kgBatch = writeBatch(db);
        for (const kg of preparedKg) {
          kgBatch.set(doc(db, 'kegiatan', kg.id), kg);
        }
        await kgBatch.commit();
        finalKegiatan = mode === 'replace' ? preparedKg : [...kegiatan, ...preparedKg];
        setKegiatan(finalKegiatan);
      }

      // Update profil instansi jika disediakan dalam arsip
      let finalInstansi = instansi;
      if (options?.instansiData) {
        finalInstansi = { ...instansi, ...options.instansiData };
        setInstansi(finalInstansi);
        try {
          await setDoc(doc(db, 'instansi', 'profil'), finalInstansi, { merge: true });
        } catch (e) {
          console.warn('Gagal simpan instansi import:', e);
        }
      }

      // Update state transaksi
      const finalTransaksi = mode === 'replace' ? preparedTx : [...transaksi, ...preparedTx];
      setTransaksi(finalTransaksi);

      // Simpan ke cadangan lokal terenkripsi
      await persistState(finalTransaksi, finalKegiatan, finalInstansi, targetTahun);

      // Sinkronkan ke Google Sheets jika terhubung
      triggerAutoSync(finalTransaksi, finalKegiatan);

      addToast(
        'success',
        'Database Berhasil Dimuat & Disimpan',
        `${preparedTx.length} transaksi kas telah disimpan permanen ke cloud Firestore & penyimpanan lokal.`
      );

      return { success: true, count: preparedTx.length };
    } catch (err: any) {
      console.error('Error saat import database:', err);
      addToast('error', 'Gagal Mengimpor Database', err?.message || 'Terjadi kesalahan saat menyimpan data ke Firestore.');
      return { success: false, count: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [addToast, instansi, kegiatan, persistState, selectedTahun, transaksi, triggerAutoSync]);

  // Reset semua data ke kondisi kosong murni (Memanggil pembersihan total cloud & lokal)
  const resetAllData = useCallback(async (): Promise<boolean> => {
    return await purgeAllDatabase();
  }, [purgeAllDatabase]);

  // Template opsional untuk mempermudah verifikasi/pengujian pengguna jika diinginkan
  const loadSampleTemplate = useCallback(async () => {
    const sampleKegiatan: KegiatanAnggaran[] = [
      {
        id: 'kg_01',
        kodeKegiatan: '02.01.01',
        namaKegiatan: 'Pengembangan Sarana KBM & Ujian Semester',
        penanggungJawab: 'Dra. Endang Sulastri',
        paguAnggaran: 25000000,
        sumberDana: 'Dana Yayasan',
        tahun: 2026,
        targetWaktu: 'Triwulan 1',
        deskripsi: 'Penggandaan naskah ujian, ATK, dan modul belajar siswa.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'kg_02',
        kodeKegiatan: '03.02.01',
        namaKegiatan: 'Kegiatan Kesiswaan, Lomba & Ekstrakurikuler',
        penanggungJawab: "Ahmad Syafi'i, S.Pd.",
        paguAnggaran: 18000000,
        sumberDana: 'Dana Orangtua',
        tahun: 2026,
        targetWaktu: 'Sepanjang Tahun',
        deskripsi: 'Kegiatan kepramukaan, paskibra, dan pentas seni kesiswaan.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'kg_03',
        kodeKegiatan: '04.02.03',
        namaKegiatan: 'Pemeliharaan Sarana Sekolah & Lab Komputer',
        penanggungJawab: 'Bambang Irawan, S.T.',
        paguAnggaran: 30000000,
        sumberDana: 'Dana Sekolah',
        tahun: 2026,
        targetWaktu: 'Triwulan 1 & 2',
        deskripsi: 'Perawatan AC, instalasi wifi, dan perbaikan fasilitas kelas.',
        createdAt: new Date().toISOString()
      }
    ];

    const sampleInstansi: ProfilInstansi = {
      ...DEFAULT_INSTANSI,
      saldoAwalTahun: 4160000
    };

    const sampleItems: {
      tgl: string;
      uraian: string;
      jenis: 'Keluar' | 'Masuk';
      kas: 'Kas Sekolah' | 'Kas Yayasan' | 'Kas Orang Tua';
      nominal: number;
      kegiatanId?: string;
      kegiatanNama?: string;
      posKategori?: any;
    }[] = [
      // Belanja Operasional Umum Rutin (Tidak masuk BKU Kegiatan)
      { tgl: '2026-09-01', uraian: 'Bayar Biaya Konsumsi Rapat wakasek', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 160000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-02', uraian: 'Bayar Biaya Perlengkapan Kebersihan', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 86500, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-02', uraian: 'Bayar Biaya Akomodasi Kepalan sekolah', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 30000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-02', uraian: 'Bayar Biaya Transportasi penarikan dana', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 15000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      
      // Belanja Sub-Kegiatan 04.02.03: Pemeliharaan Sarana Sekolah
      { tgl: '2026-09-03', uraian: 'Bayar Biaya Perbaikan Panel Listrik', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 1679500, kegiatanId: 'kg_03', kegiatanNama: 'Pemeliharaan Sarana Sekolah & Lab Komputer', posKategori: 'Belanja Modal & Fasilitas' },
      
      { tgl: '2026-09-08', uraian: 'Bayar Biaya Transport Penarikan Dana', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 15000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-09', uraian: 'Bayar biaya konsumsi tamu dari dinas di Aula', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 123000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-10', uraian: 'Bayar biaya transportasi penarikan dana', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 15000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-10', uraian: 'Bayar Biaya Konsumsi rapat pekanan (pekan ke 2)', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 891000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-11', uraian: 'Bayar Biaya Pulsa Orbit Wifi', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 201500, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-15', uraian: 'Penerimaan Dana RAPBS BOB', jenis: 'Masuk', kas: 'Kas Sekolah', nominal: 8000000, posKategori: 'Penerimaan Dana Sekolah (Mandiri/Unit Usaha)' },
      
      // Belanja Sub-Kegiatan 03.02.01: Kegiatan Kesiswaan
      { tgl: '2026-09-17', uraian: 'Bayar Biaya Konsumsi tak terfuga Kegiatan Sosialisasi Aplikasi', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 870000, kegiatanId: 'kg_02', kegiatanNama: 'Kegiatan Kesiswaan, Lomba & Ekstrakurikuler', posKategori: 'Kegiatan Kesiswaan & Ekstrakurikuler' },
      { tgl: '2026-09-17', uraian: 'Bayar Biaya Konsumsi rapat pekanan (pekan Ke 3)', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 861000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-19', uraian: 'Bayar Biaya Transport pada kegiatan pelatihan koding (dana Bos)', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 80000, kegiatanId: 'kg_02', kegiatanNama: 'Kegiatan Kesiswaan, Lomba & Ekstrakurikuler', posKategori: 'Kegiatan Kesiswaan & Ekstrakurikuler' },
      { tgl: '2026-09-21', uraian: 'Bayar Biaya Pembelian Kopi Bulanan Kantor', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 415000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      
      // Pemeliharaan sarana
      { tgl: '2026-09-22', uraian: 'Bayar Biaya Perbaikan MCB Panel', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 100000, kegiatanId: 'kg_03', kegiatanNama: 'Pemeliharaan Sarana Sekolah & Lab Komputer', posKategori: 'Belanja Modal & Fasilitas' },
      { tgl: '2026-09-22', uraian: 'Bayar Biaya Perlengkapan Kebersihan', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 148000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-22', uraian: 'Bayar Biaya Pengeluaran bendara BOS', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 37500, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-22', uraian: 'Bayar biaya perbaikan wastafel, meja, kursi', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 410000, kegiatanId: 'kg_03', kegiatanNama: 'Pemeliharaan Sarana Sekolah & Lab Komputer', posKategori: 'Belanja Modal & Fasilitas' },
      { tgl: '2026-09-24', uraian: 'Bayar akomodasi kegiatan sosialisasi TKA', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 60000, kegiatanId: 'kg_02', kegiatanNama: 'Kegiatan Kesiswaan, Lomba & Ekstrakurikuler', posKategori: 'Kegiatan Kesiswaan & Ekstrakurikuler' },
      { tgl: '2026-09-24', uraian: 'Bayar Biaya Pembelian Materai', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 12000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-24', uraian: 'Bayar Biaya Konsumsi Pekanan (pekan ke 4)', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 901000, posKategori: 'Operasional (Listrik, Air, Wifi)' },
      { tgl: '2026-09-26', uraian: 'Bayar Honorarium Kegiatan Pendampingan Siswa', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 805000, kegiatanId: 'kg_02', kegiatanNama: 'Kegiatan Kesiswaan, Lomba & Ekstrakurikuler', posKategori: 'Kegiatan Kesiswaan & Ekstrakurikuler' },
      { tgl: '2026-09-29', uraian: 'Bayar Pemeliharaan AC dan Sanitasi Lingkungan Sekolah', jenis: 'Keluar', kas: 'Kas Sekolah', nominal: 500000, kegiatanId: 'kg_03', kegiatanNama: 'Pemeliharaan Sarana Sekolah & Lab Komputer', posKategori: 'Belanja Modal & Fasilitas' },
    ];

    const sampleTransaksi: TransaksiBKU[] = sampleItems.map((item, idx) => ({
      id: `tx_sample_${idx + 1}`,
      tanggal: item.tgl,
      bulan: 9,
      tahun: 2026,
      nomorBukti: `${(idx + 1).toString().padStart(3, '0')}/BKU-${item.jenis === 'Masuk' ? 'TRM' : 'KAS'}/IX/2026`,
      uraian: item.uraian,
      kodeRekening: item.jenis === 'Masuk' ? '1.1.03' : '5.1.02',
      posKategori: item.posKategori || (item.jenis === 'Masuk' ? 'Penerimaan Dana Sekolah (Mandiri/Unit Usaha)' : 'Belanja Sarana Belajar & ATK'),
      sumberDana: 'Dana Sekolah',
      jenisKas: item.kas,
      jenisTransaksi: item.jenis,
      metodePembayaran: 'Tunai',
      nominal: item.nominal,
      penerima: 'SD ISLAM AL HIJRAH',
      kegiatanId: item.kegiatanId,
      kegiatanNama: item.kegiatanNama,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    setInstansi(sampleInstansi);
    setKegiatan(sampleKegiatan);
    setTransaksi(sampleTransaksi);
    setSelectedBulan(9);
    setSelectedTahun(2026);
    await persistState(sampleTransaksi, sampleKegiatan, sampleInstansi, 2026);

    try {
      for (const k of sampleKegiatan) {
        await setDoc(doc(db, 'kegiatan', k.id), k);
      }
      for (const t of sampleTransaksi) {
        await setDoc(doc(db, 'transaksi', t.id), t);
      }
      await setDoc(doc(db, 'instansi', 'profil'), sampleInstansi);
    } catch (e) {
      console.warn('Error saving sample template to firestore:', e);
    }

    triggerAutoSync(sampleTransaksi, sampleKegiatan);
    addToast('success', 'Format BKU Al Hijrah Dimuat', '24 transaksi September 2026 berhasil dimuat dengan alokasi kegiatan yang tepat.');
  }, [addToast, persistState, triggerAutoSync]);

  // Fitur Keamanan Enkripsi Kustom
  const setMasterPassphrase = useCallback(async (passphrase: string): Promise<boolean> => {
    try {
      if (!passphrase || passphrase.length < 6) {
        addToast('warning', 'Kata Sandi Kurang Kuat', 'Gunakan minimal 6 karakter untuk perlindungan optimal.');
        return false;
      }
      localStorage.setItem(ENCRYPTION_FLAG_KEY, 'true');
      const payload = {
        transaksi,
        kegiatan,
        instansi,
        selectedTahun,
        savedAt: new Date().toISOString()
      };
      const enc = await encryptData(payload, passphrase);
      localStorage.setItem(STORAGE_KEY, enc);
      setEncryptionStatus({
        isEncrypted: true,
        hasCustomKey: true,
        lastEncryptedAt: new Date().toLocaleTimeString('id-ID')
      });
      addToast('success', 'Enkripsi Data Diaktifkan', 'Basis data kas telah dienkripsi dengan standar AES-GCM 256-bit.');
      return true;
    } catch (err) {
      addToast('error', 'Gagal Mengenkripsi', 'Terjadi masalah saat mengatur kunci keamanan.');
      return false;
    }
  }, [addToast, instansi, kegiatan, selectedTahun, transaksi]);

  const exportEncryptedVault = useCallback(async (passphrase?: string): Promise<string> => {
    const payload = {
      transaksi,
      kegiatan,
      instansi,
      selectedTahun,
      exportedAt: new Date().toISOString(),
      appVersion: 'BKU-Enterprise-2026'
    };
    return await encryptData(payload, passphrase);
  }, [instansi, kegiatan, selectedTahun, transaksi]);

  const importEncryptedVault = useCallback(async (payloadString: string, passphrase?: string): Promise<boolean> => {
    try {
      const decrypted = await decryptData(payloadString, passphrase);
      if (!decrypted || !Array.isArray(decrypted.transaksi)) {
        throw new Error('Format berkas tidak valid.');
      }

      const res = await importBatchDatabase(decrypted.transaksi, {
        mode: 'replace',
        kegiatanList: decrypted.kegiatan,
        instansiData: decrypted.instansi,
        tahun: decrypted.selectedTahun
      });

      return res.success;
    } catch (err) {
      addToast('error', 'Gagal Membuka Berkas', 'Kata sandi salah atau struktur berkas arsip rusak.');
      return false;
    }
  }, [addToast, importBatchDatabase]);

  const value = useMemo<BKUContextType>(() => ({
    transaksi,
    kegiatan,
    instansi,
    selectedBulan,
    selectedTahun,
    activeTab,
    encryptionStatus,
    toasts,
    isLoading,
    googleUser,
    googleAccessToken,
    googleSheetsConfig,
    isSyncingSheets,
    connectGoogleDrive,
    disconnectGoogleDrive,
    syncToGoogleSheets,
    createAndLinkSpreadsheet,
    updateGoogleSheetsConfig,
    setSelectedBulan,
    setSelectedTahun,
    setActiveTab,
    addTransaksi,
    addMultipleTransaksi,
    updateTransaksi,
    deleteTransaksi,
    getTransaksiBulan,
    getSaldoAwalBulan,
    getSaldoAkhirBulan,
    setSaldoAwalBulan,
    isCustomSaldoAwalBulan,
    getNextNomorBukti,
    addKegiatan,
    updateKegiatan,
    deleteKegiatan,
    getKegiatanStats,
    allocateTransaksiToKegiatan,
    updateInstansi,
    resetAllData,
    purgeAllDatabase,
    purgeMonthTransaksi,
    importBatchDatabase,
    loadSampleTemplate,
    setMasterPassphrase,
    exportEncryptedVault,
    importEncryptedVault,
    addToast,
    removeToast
  }), [
    transaksi,
    kegiatan,
    instansi,
    selectedBulan,
    selectedTahun,
    activeTab,
    encryptionStatus,
    toasts,
    isLoading,
    googleUser,
    googleAccessToken,
    googleSheetsConfig,
    isSyncingSheets,
    connectGoogleDrive,
    disconnectGoogleDrive,
    syncToGoogleSheets,
    createAndLinkSpreadsheet,
    updateGoogleSheetsConfig,
    addTransaksi,
    addMultipleTransaksi,
    updateTransaksi,
    deleteTransaksi,
    getTransaksiBulan,
    getSaldoAwalBulan,
    getSaldoAkhirBulan,
    setSaldoAwalBulan,
    isCustomSaldoAwalBulan,
    getNextNomorBukti,
    addKegiatan,
    updateKegiatan,
    deleteKegiatan,
    getKegiatanStats,
    allocateTransaksiToKegiatan,
    updateInstansi,
    resetAllData,
    purgeAllDatabase,
    purgeMonthTransaksi,
    importBatchDatabase,
    loadSampleTemplate,
    setMasterPassphrase,
    exportEncryptedVault,
    importEncryptedVault,
    addToast,
    removeToast
  ]);

  return <BKUContext.Provider value={value}>{children}</BKUContext.Provider>;
}

export function useBKU() {
  const context = useContext(BKUContext);
  if (!context) {
    throw new Error('useBKU harus digunakan di dalam BKUProvider');
  }
  return context;
}
