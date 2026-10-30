export interface DriveUploadResult {
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

/**
 * Ensures a folder named "LPJ Transaksi BKU" exists in Google Drive and returns its ID.
 */
export async function ensureLPJFolder(accessToken: string): Promise<string | null> {
  try {
    const folderName = 'LPJ Transaksi BKU';
    // 1. Search for existing folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )}&fields=files(id, name)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // 2. Create folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }

    return null;
  } catch (err) {
    console.error('Error ensuring LPJ folder in Google Drive:', err);
    return null;
  }
}

/**
 * Uploads a PDF Blob to the "LPJ Transaksi BKU" folder in Google Drive.
 */
export async function uploadLPJPDFToDrive(
  accessToken: string,
  pdfBlob: Blob,
  fileName: string
): Promise<DriveUploadResult> {
  try {
    const folderId = await ensureLPJFolder(accessToken);
    if (!folderId) {
      return { error: 'Gagal membuat atau mengakses folder "LPJ Transaksi BKU" di Google Drive.' };
    }

    const metadata = {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [folderId]
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', pdfBlob);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: form
      }
    );

    if (!uploadRes.ok) {
      const errData = await uploadRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gagal mengunggah file (${uploadRes.status})`);
    }

    const fileData = await uploadRes.json();
    return {
      fileId: fileData.id,
      webViewLink: fileData.webViewLink
    };
  } catch (err: any) {
    console.error('Error uploading LPJ PDF to Google Drive:', err);
    return { error: err?.message || 'Terjadi kesalahan saat mengunggah LPJ ke Google Drive' };
  }
}
