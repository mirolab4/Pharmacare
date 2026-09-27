/**
 * Google Drive Backup Service for PharmaCare Plus
 * Handles daily automated backups and manual backups/restores via Google Drive API v3
 */

import { GoogleAuthProvider, signInWithPopup, User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, firebaseSync } from './firebaseSync';
import { pharmacyStorage } from './storage';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const BACKUP_FOLDER_NAME = 'PharmaCare_Backups';
const LAST_BACKUP_DATE_KEY = 'pharmacare_last_drive_backup_date';
const TOKEN_KEY = 'pharmacare_drive_access_token';
const TOKEN_EXPIRY_KEY = 'pharmacare_drive_token_expiry';
const USER_EMAIL_KEY = 'pharmacare_drive_user_email';

// Token caching with session & local storage fallback so page refreshes don't lose connection
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export function getDriveAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const saved = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY) || sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    if (saved && expiry && Date.now() < parseInt(expiry, 10)) {
      cachedAccessToken = saved;
      return saved;
    }
  } catch (e) {}
  return null;
}

export function setStoredAccessToken(token: string, expiresInSeconds: number = 3600) {
  cachedAccessToken = token;
  const expiry = Date.now() + (expiresInSeconds - 120) * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
  } catch (e) {}
}

export function clearStoredAccessToken() {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (e) {}
}

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
  
  // Emit initial state immediately
  const token = getDriveAccessToken();
  listener({
    isAuthenticated: !!auth.currentUser,
    user: auth.currentUser,
    hasDriveAccess: !!token,
  });

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    const currentToken = getDriveAccessToken();
    const state: DriveAuthState = {
      isAuthenticated: !!user,
      user,
      hasDriveAccess: !!currentToken,
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
  const currentToken = getDriveAccessToken();
  const state: DriveAuthState = {
    isAuthenticated: !!user,
    user,
    hasDriveAccess: !!currentToken,
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
      prompt: 'select_account',
    });

    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (popupErr: any) {
      if (popupErr?.code === 'auth/cancelled-popup-request' || popupErr?.code === 'auth/popup-closed-by-user') {
        throw popupErr;
      }
      // If error occurred with stale session, sign out cleanly and retry once
      await signOut(auth);
      clearStoredAccessToken();
      result = await signInWithPopup(auth, provider);
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    
    if (!token) {
      throw new Error('لم نتمكن من الحصول على تصريح الوصول إلى Google Drive من المصادقة');
    }

    setStoredAccessToken(token);
    try {
      if (result.user?.email) {
        localStorage.setItem(USER_EMAIL_KEY, result.user.email);
      }
    } catch {}
    
    notifyAuthListeners(result.user);
    
    return { user: result.user, accessToken: token };
  } catch (err) {
    console.error('Sign-in error with Google Drive scope:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Sign out from Google Drive
 */
export async function signOutFromDrive(): Promise<void> {
  clearStoredAccessToken();
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
  let token = getDriveAccessToken();
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

  if (uploadRes.status === 401) {
    clearStoredAccessToken();
    notifyAuthListeners(auth.currentUser);
    throw new Error('انتهت صلاحية جلسة Google Drive، يرجى النقر على زر تسجيل الدخول لتجديد الاتصال');
  }

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
  const token = getDriveAccessToken();
  if (!token) return [];

  try {
    const folderId = await getOrCreateBackupsFolder(token);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=20&fields=files(id,name,size,createdTime,description)`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      clearStoredAccessToken();
      notifyAuthListeners(auth.currentUser);
      return [];
    }

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
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('غير مصرح بالوصول إلى Google Drive');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearStoredAccessToken();
    notifyAuthListeners(auth.currentUser);
    throw new Error('انتهت صلاحية جلسة Google Drive، يرجى تسجيل الدخول مجدداً');
  }

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
  const token = getDriveAccessToken();
  if (!token) {
    throw new Error('غير مصرح بالوصول إلى Google Drive');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearStoredAccessToken();
    notifyAuthListeners(auth.currentUser);
    throw new Error('انتهت صلاحية جلسة Google Drive، يرجى تسجيل الدخول مجدداً');
  }

  return res.ok;
}

/**
 * Check if the browser supports sharing files directly to Google Drive / Share Sheet
 */
export function canShareBackupDirectly(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    const dummyFile = new File(['{}'], 'test.json', { type: 'application/json' });
    return !!(navigator.canShare && navigator.canShare({ files: [dummyFile] }));
  } catch {
    return false;
  }
}

/**
 * Share backup file directly to Google Drive / system share sheet (Zero setup, works on Android & iOS & desktop)
 */
export async function shareBackupToDriveDirectly(): Promise<boolean> {
  const backupJson = pharmacyStorage.exportAllDataJSON();
  const now = new Date();
  const dateFormatted = now.toISOString().split('T')[0];
  const timeFormatted = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const fileName = `pharmacare_backup_${dateFormatted}_${timeFormatted}.json`;

  const file = new File([backupJson], fileName, { type: 'application/json' });

  if (navigator.share) {
    await navigator.share({
      title: 'نسخة احتياطية لنظام فارماكير بلس',
      text: 'حفظ النسخة الاحتياطية لقاعدة بيانات الصيدلية مباشرة إلى Google Drive',
      files: [file],
    });
    return true;
  }
  return false;
}

export async function triggerSilentCloudBackup(): Promise<{ driveSuccess: boolean; firestoreSuccess: boolean; message: string }> {
  let driveSuccess = false;
  let firestoreSuccess = false;

  // 1. Silent Firestore Cloud Backup Snapshot
  try {
    const firestoreRes = await firebaseSync.saveCloudSnapshotBackup(false);
    firestoreSuccess = firestoreRes.success;
  } catch (e) {
    console.warn('Silent Firestore cloud backup failed:', e);
  }

  // 2. Direct Google Drive Cloud Upload
  const token = getDriveAccessToken();
  if (token) {
    try {
      await uploadBackupToDrive(true);
      driveSuccess = true;
    } catch (e) {
      console.warn('Silent Google Drive upload failed:', e);
    }
  }

  let message = '';
  if (driveSuccess && firestoreSuccess) {
    message = 'تم رفع النسخة الاحتياطية مباشرة إلى Google Drive وسحابة النظام ☁️';
  } else if (driveSuccess) {
    message = 'تم رفع النسخة الاحتياطية مباشرة إلى Google Drive ☁️';
  } else if (firestoreSuccess) {
    message = 'تم حفظ النسخة الاحتياطية السحابية بنجاح في سحابة النظام ☁️';
  } else {
    message = 'يرجى ربط وتنشيط Google Drive للرفع المباشر إلى حسابك.';
  }

  return { driveSuccess, firestoreSuccess, message };
}

export async function checkAndRunDailyBackup(): Promise<boolean> {
  const settings = pharmacyStorage.getSettings();
  if (settings.autoDailyDriveBackup === false) {
    return false; // User disabled auto daily backup
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  const today = new Date().toISOString().split('T')[0];
  const lastBackup = localStorage.getItem(LAST_BACKUP_DATE_KEY);

  if (lastBackup === today) {
    return false; // Already backed up today!
  }

  let anySuccess = false;

  // 1. Silent Firestore snapshot backup
  try {
    const res = await firebaseSync.saveCloudSnapshotBackup(true);
    if (res.success) anySuccess = true;
  } catch (e) {}

  // 2. Silent Google Drive background upload if token available
  if (getDriveAccessToken()) {
    try {
      await uploadBackupToDrive(true);
      anySuccess = true;
      console.log('PharmaCare: Automated silent daily backup to Google Drive completed for date:', today);
    } catch (err) {
      console.warn('Automated daily backup to Google Drive postponed:', err);
    }
  }

  if (anySuccess) {
    localStorage.setItem(LAST_BACKUP_DATE_KEY, today);
  }

  return anySuccess;
}
