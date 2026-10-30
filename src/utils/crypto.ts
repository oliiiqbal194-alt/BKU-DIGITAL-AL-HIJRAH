/**
 * Modul Enkripsi Data Keuangan BKU menggunakan Web Crypto API (AES-GCM 256-bit).
 * Standar keamanan perbankan & privasi data finansial instansi.
 */

const DEFAULT_SALT = new Uint8Array([23, 89, 12, 94, 55, 172, 88, 19, 44, 201, 73, 90, 11, 62, 85, 33]);
const DEFAULT_FALLBACK_PASSPHRASE = 'bku-sistem-keuangan-aman-v1-production';

// Helper konversi ArrayBuffer ke Hex / Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derivasi kunci AES-GCM dari passphrase pengguna menggunakan PBKDF2
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  v: number;
  salt: string;
  iv: string;
  data: string;
  timestamp: string;
}

/**
 * Enkripsi objek data dengan passphrase (AES-GCM 256-bit)
 */
export async function encryptData(data: any, customPassphrase?: string): Promise<string> {
  try {
    const passphrase = customPassphrase || DEFAULT_FALLBACK_PASSPHRASE;
    const salt = customPassphrase 
      ? window.crypto.getRandomValues(new Uint8Array(16))
      : DEFAULT_SALT;
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKey(passphrase, salt);
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    const payload: EncryptedPayload = {
      v: 1,
      salt: bufferToBase64(salt.buffer),
      iv: bufferToBase64(iv.buffer),
      data: bufferToBase64(ciphertext),
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(payload);
  } catch (err) {
    console.error('Enkripsi gagal:', err);
    throw new Error('Gagal mengenkripsi data keuangan');
  }
}

/**
 * Dekripsi payload terenkripsi dengan passphrase
 */
export async function decryptData<T = any>(encryptedString: string, customPassphrase?: string): Promise<T> {
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedString);
    if (!payload.salt || !payload.iv || !payload.data) {
      throw new Error('Format data terenkripsi tidak valid');
    }

    const passphrase = customPassphrase || DEFAULT_FALLBACK_PASSPHRASE;
    const salt = new Uint8Array(base64ToBuffer(payload.salt));
    const iv = new Uint8Array(base64ToBuffer(payload.iv));
    const ciphertext = base64ToBuffer(payload.data);

    const key = await deriveKey(passphrase, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    console.error('Dekripsi gagal:', err);
    throw new Error('Kata sandi enkripsi salah atau berkas rusak');
  }
}
