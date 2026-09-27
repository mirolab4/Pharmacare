/**
 * Google Drive Backup Service for PharmaCare Plus
 * Handles daily automated backups and manual backups/restores via Google Drive API v3
 */

import { GoogleAuthProvider, signInWithPopup, User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebaseSync';
import { pharmacyStorage } from './storage';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const BACKUP_FOLDER_NAME = 'PharmaCare_Backups';
const LAST_BACKUP_DATE_KEY = 'pharmacare_last_drive_backup_date';

// In-memory token cache (Do NOT store in localStorage per guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveBackupFile {
  id: string;
  name: string;
  size?: string;
  createdTime: string;
  description?: string;
}

export interface DriveAuthState {
  isAuthenticated: boolean;
  user: User | null;
  hasDriveAccess: boolean;
}

type AuthListener = (state: DriveAuthState) => void;
const authListeners: AuthListener[] = [];

// Initialize Auth state
export function initDriveAuth(listener: AuthListener): () => void {
  authListeners.push(listener);
  
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    const state: DriveAuthState = {
      isAuthenticated: !!user,
      user,
      hasDriveAccess: !!cachedAccessToken,
    };
    listener(state);
  });

  return () => {
    const idx = authListeners.indexOf(listener);
    if (idx >= 0) authListeners.splice(idx, 1);
    unsubscribe();
  };
}

function notifyAuthListeners(user: User | null) {
  const state: DriveAuthState = {
    isAuthenticated: !!user,
    user,
    hasDriveAccess: !!cachedAccessToken,
  };
  authListeners.forEach((l) => l(state));
}

/**
 * Sign in with Google requesting Google Drive scope
 */
export async function signInWithGoogleDrive(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    SCOPES.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline',
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('لم نتمكن من الحصول على تصريح الوصول إلى Google Drive من المصادقة');
    }

    cachedAccessToken = credential.accessToken;
    notifyAuthListeners(result.user);
    
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error('Sign-in error with Google Drive scope:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Get current Drive access token or return null
 */
export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Sign out from Google Drive
 */
export async function signOutFromDrive(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
  notifyAuthListeners(null);
}

/**
 * Find or create the PharmaCare_Backups folder on Google Drive
 */
async function getOrCreateBackupsFolder(token: string): Promise<string> {
  // 1. Search for existing folder
  const query = encodeURIComponent(`name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`فشل البحث عن مجلد النسخ الاحتياطي في درايف: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Folder not found, create it
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'مجلد النسخ الاحتياطي التلقائي لنظام فارماكير بلس لإدارة الصيدليات',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`فشل إنشاء مجلد النسخ الاحتياطي في درايف: ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Perform backup to Google Drive
 */
export async function uploadBackupToDrive(isAutomatic = false): Promise<DriveBackupFile> {
  let token = cachedAccessToken;
  if (!token) {
    // If not in memory and user triggers manual, prompt login
    if (!isAutomatic) {
      const authResult = await signInWithGoogleDrive();
      token = authResult.accessToken;
    } else {
      throw new Error('يرجى ربط حساب Google أولاً لتفعيل النسخ الاحتياطي التلقائي');
    }
  }

  const folderId = await getOrCreateBackupsFolder(token);
  const now = new Date();
  const dateFormatted = now.toISOString().split('T')[0];
  const timeFormatted = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const fileName = `pharmacare_backup_${dateFormatted}_${timeFormatted}.json`;

  // Get full database JSON payload
  const backupJson = pharmacyStorage.exportAllDataJSON();

  // Create multipart body
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
    description: `نسخة احتياطية ${isAutomatic ? 'تلقائية يومية' : 'يدوية'} لقاعدة بيانات الصيدلية - ${now.toLocaleString('ar-EG')}`,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    backupJson +
    closeDelimiter;

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`فشل رفع ملف النسخة الاحتياطية إلى Google Drive: ${errText}`);
  }

  const fileData = await uploadRes.json();

  // Save last backup timestamp and mark today as backed up
  localStorage.setItem(LAST_BACKUP_DATE_KEY, dateFormatted);
  const settings = pharmacyStorage.getSettings();
  pharmacyStorage.saveSettings({
    ...settings,
    lastDriveBackupTime: now.toISOString(),
    lastDriveBackupFileName: fileName,
    lastDriveBackupStatus: 'success',
  });

  return {
    id: fileData.id,
    name: fileName,
    createdTime: now.toISOString(),
    description: metadata.description,
  };
}

/**
 * List existing backups from Google Drive
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = cachedAccessToken;
  if (!token) return [];

  try {
    const folderId = await getOrCreateBackupsFolder(token);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=20&fields=files(id,name,size,createdTime,description)`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.warn('Failed to list drive files:', await res.text());
      return [];
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size ? `${(parseInt(f.size, 10) / 1024).toFixed(1)} KB` : 'غير محدد',
      createdTime: f.createdTime,
      description: f.description,
    }));
  } catch (err) {
    console.warn('Error fetching drive backups list:', err);
    return [];
  }
}

/**
 * Download and restore backup content from Google Drive
 */
export async function downloadAndRestoreBackup(fileId: string): Promise<boolean> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('غير مصرح بالوصول إلى Google Drive');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`فشل تحميل النسخة الاحتياطية من درايف: ${res.statusText}`);
  }

  const jsonContent = await res.text();
  const success = pharmacyStorage.importAllDataJSON(jsonContent);
  if (!success) {
    throw new Error('فشل تطبيق واسترجاع بيانات ملف النسخة الاحتياطية');
  }

  return true;
}

/**
 * Delete a backup file from Google Drive
 */
export async function deleteDriveBackupFile(fileId: string): Promise<boolean> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('غير مصرح بالوصول إلى Google Drive');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.ok;
}

/**
 * Daily backup scheduler check
 * Checks if today's backup has run, and if not, runs it silently if token exists
 */
export async function checkAndRunDailyBackup(): Promise<boolean> {
  const settings = pharmacyStorage.getSettings();
  if (settings.autoDailyDriveBackup === false) {
    return false; // User disabled auto daily backup
  }

  const today = new Date().toISOString().split('T')[0];
  const lastBackup = localStorage.getItem(LAST_BACKUP_DATE_KEY);

  if (lastBackup === today) {
    return false; // Already backed up today!
  }

  if (!cachedAccessToken) {
    return false; // Token not in memory; will backup next time user connects
  }

  try {
    await uploadBackupToDrive(true);
    console.log('Automated daily backup to Google Drive completed successfully for date:', today);
    return true;
  } catch (err) {
    console.warn('Automated daily backup to Google Drive postponed:', err);
    return false;
  }
}
