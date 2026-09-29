/**
 * PharmaCare Plus - Google Drive Backup Service via Google Apps Script Web App
 * Features:
 * - Zero Google Login required for users on client devices
 * - Uses Google Apps Script Web App as a secure proxy to Google Drive
 * - Web App URL and Secret Token stored in pharmacy settings and synced to all devices
 * - Direct POST with Content-Type: text/plain to prevent CORS preflight
 * - 30-second timeout via AbortController with 3 exponential backoff retries
 * - Automated background scheduling (every 24h on start, every 6h active)
 */

import { pharmacyStorage } from './storage';
import { firebaseSync } from './firebaseSync';

export interface DriveBackupFile {
  id: string;
  name: string;
  size?: string;
  createdTime: string;
  description?: string;
}

const LAST_BACKUP_DATE_KEY = 'pharmacare_last_drive_backup_date';
const LAST_BACKUP_TIMESTAMP_KEY = 'pharmacare_last_drive_backup_timestamp';

// Helper for abortable fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`انتهت مهلة انتظار خادم Google Drive (${Math.round(timeoutMs / 1000)} ثانية). تأكد من استقرار الإنترنت.`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// Retry fetch helper with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delayMs = 1500): Promise<Response> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, 30000);
      if (response.ok) return response;
      // If server returned error, check status
      const errorText = await response.text();
      lastError = new Error(`استجابة غير صحيحة من الخادم (${response.status}): ${errorText}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries) {
      console.warn(`PharmaCare Backup: Attempt ${attempt} failed, retrying in ${delayMs * attempt}ms...`);
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastError;
}

/**
 * Upload pharmacy database backup directly to Google Drive via Google Apps Script Web App
 */
export async function uploadBackupToDrive(
  isAutomatic = false,
  onProgress?: (progressMessage: string) => void
): Promise<{ success: boolean; fileName: string; fileId?: string }> {
  const settings = pharmacyStorage.getSettings();
  const webAppUrl = settings.googleWebAppUrl?.trim();
  const backupToken = settings.backupToken?.trim();

  if (!webAppUrl || !backupToken) {
    const errorMsg = 'لم يتم ضبط رابط Google Apps Script Web App أو رمز الأمان (Token) في إعدادات النسخ الاحتياطي.';
    if (!isAutomatic) {
      throw new Error(errorMsg);
    } else {
      console.warn('Auto Drive backup skipped:', errorMsg);
      return { success: false, fileName: '' };
    }
  }

  onProgress?.('جاري استخراج وتجميع بيانات الصيدلية بالكامل...');
  const backupData = pharmacyStorage.exportAllDataJSON();
  const pharmacyId = firebaseSync.getPharmacyId() || 'default';

  onProgress?.('جاري الاتصال بخدمة Google Drive Web App...');

  const payload = {
    token: backupToken,
    pharmacyId: pharmacyId,
    data: backupData,
    timestamp: Date.now()
  };

  onProgress?.('جاري رفع وحفظ ملف النسخة الاحتياطية في مجلد PharmaCare_Backups...');

  // Use Content-Type: text/plain to avoid CORS preflight options check
  const response = await fetchWithRetry(webAppUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  }, 3, 2000);

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'فشل حفظ النسخة في Google Drive');
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Update timestamps
  try {
    localStorage.setItem(LAST_BACKUP_DATE_KEY, today);
    localStorage.setItem(LAST_BACKUP_TIMESTAMP_KEY, now.getTime().toString());
  } catch {}

  const updatedSettings = {
    ...settings,
    lastDriveBackupTime: now.toISOString(),
    lastDriveBackupFileName: result.fileName,
    lastDriveBackupStatus: 'success' as const
  };
  pharmacyStorage.saveSettings(updatedSettings);

  onProgress?.('اكتمل حفظ النسخة في Google Drive بنجاح! ☁️');
  return {
    success: true,
    fileName: result.fileName,
    fileId: result.fileId
  };
}

/**
 * List available backups from Google Drive Web App
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const settings = pharmacyStorage.getSettings();
  const webAppUrl = settings.googleWebAppUrl?.trim();
  const backupToken = settings.backupToken?.trim();

  if (!webAppUrl || !backupToken) {
    return [];
  }

  try {
    const separator = webAppUrl.includes('?') ? '&' : '?';
    const targetUrl = `${webAppUrl}${separator}action=list&token=${encodeURIComponent(backupToken)}`;

    const response = await fetchWithTimeout(targetUrl, { method: 'GET' }, 20000);
    if (!response.ok) {
      throw new Error(`خطأ في استرجاع القائمة (${response.status})`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'فشل استرجاع قائمة النسخ الاحتياطية');
    }

    return (result.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size || 'غير محدد',
      createdTime: f.createdTime,
      description: f.description || ''
    }));
  } catch (err) {
    console.warn('PharmaCare: Failed to list drive backups:', err);
    throw err;
  }
}

/**
 * Download a backup file from Google Drive and restore local state
 */
export async function downloadAndRestoreBackup(fileId: string): Promise<boolean> {
  const settings = pharmacyStorage.getSettings();
  const webAppUrl = settings.googleWebAppUrl?.trim();
  const backupToken = settings.backupToken?.trim();

  if (!webAppUrl || !backupToken) {
    throw new Error('رابط Web App أو رمز الأمان غير محدد في الإعدادات');
  }

  const separator = webAppUrl.includes('?') ? '&' : '?';
  const targetUrl = `${webAppUrl}${separator}action=download&fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(backupToken)}`;

  const response = await fetchWithTimeout(targetUrl, { method: 'GET' }, 30000);
  if (!response.ok) {
    throw new Error(`فشل تحميل النسخة من Google Drive (${response.status})`);
  }

  const result = await response.json();
  if (!result.success || !result.content) {
    throw new Error(result.error || 'ملف النسخة الاحتياطية فارغ أو تالف');
  }

  const imported = pharmacyStorage.importAllDataJSON(result.content);
  if (!imported) {
    throw new Error('فشل تطبيق واسترجاع بيانات الصيدلية من الملف');
  }

  return true;
}

/**
 * Test connectivity with Google Apps Script Web App
 */
export async function testGoogleDriveConnection(webAppUrl: string, token: string): Promise<{ success: boolean; message: string }> {
  const trimmedUrl = webAppUrl.trim();
  const trimmedToken = token.trim();

  if (!trimmedUrl || !trimmedToken) {
    return { success: false, message: 'يرجى إدخال الرابط ورمز الأمان أولاً' };
  }

  try {
    const separator = trimmedUrl.includes('?') ? '&' : '?';
    const targetUrl = `${trimmedUrl}${separator}action=ping&token=${encodeURIComponent(trimmedToken)}`;

    const res = await fetchWithTimeout(targetUrl, { method: 'GET' }, 15000);
    const data = await res.json();

    if (data.success) {
      return { success: true, message: data.message || 'تم التحقق بنجاح: الرابط ورمز الأمان يعملان بشكل سليم 🟢' };
    } else {
      return { success: false, message: data.error || 'رفض الخادم الطلب: تأكد من صحة رمز الأمان (Token)' };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `تعذر الاتصال بـ Google Apps Script: ${err.message || 'تأكد من نشر الويب آب بصلاحية Anyone وإتاحة الوصول'}`
    };
  }
}

/**
 * Delete a backup file from Google Drive via Google Apps Script Web App
 */
export async function deleteDriveBackupFile(fileId: string): Promise<boolean> {
  const settings = pharmacyStorage.getSettings();
  const webAppUrl = settings.googleWebAppUrl?.trim();
  const backupToken = settings.backupToken?.trim();

  if (!webAppUrl || !backupToken) {
    throw new Error('رابط Web App أو رمز الأمان غير محدد في الإعدادات');
  }

  const separator = webAppUrl.includes('?') ? '&' : '?';
  const targetUrl = `${webAppUrl}${separator}action=delete&fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(backupToken)}`;

  const response = await fetchWithTimeout(targetUrl, { method: 'GET' }, 20000);
  if (!response.ok) {
    throw new Error(`فشل حذف النسخة من Google Drive (${response.status})`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'فشل حذف النسخة');
  }

  return true;
}

/**
 * Check and run scheduled daily backup
 * - Triggers on app start if > 24 hours since last backup
 * - Runs every 6 hours while the app remains open
 */
export async function checkAndRunScheduledBackup(): Promise<boolean> {
  const settings = pharmacyStorage.getSettings();
  if (settings.autoDailyDriveBackup === false) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!settings.googleWebAppUrl || !settings.backupToken) return false;

  const now = Date.now();
  const lastTimestamp = parseInt(localStorage.getItem(LAST_BACKUP_TIMESTAMP_KEY) || '0', 10);
  const sixHoursMs = 6 * 60 * 60 * 1000;

  // Run if never run or > 6 hours since last check
  if (now - lastTimestamp < sixHoursMs) {
    return false;
  }

  try {
    console.log('PharmaCare: Initiating scheduled background Google Drive backup...');
    const res = await uploadBackupToDrive(true);
    if (res.success) {
      console.log('PharmaCare: Scheduled Google Drive backup saved successfully:', res.fileName);
      return true;
    }
  } catch (e) {
    console.warn('PharmaCare: Scheduled backup skipped or failed:', e);
  }
  return false;
}

// Aliases for compatibility
export const checkAndRunDailyBackup = checkAndRunScheduledBackup;

export async function triggerSilentCloudBackup(): Promise<{ success: boolean; name: string }> {
  try {
    const res = await uploadBackupToDrive(true);
    return { success: res.success, name: res.fileName };
  } catch (err: any) {
    return { success: false, name: '' };
  }
}

