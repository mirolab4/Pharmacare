import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Settings as SettingsIcon, 
  CheckCircle2, 
  Cloud, 
  Download, 
  Upload, 
  RefreshCw, 
  Database, 
  Sparkles,
  Wifi,
  WifiOff,
  CloudUpload,
  Calendar,
  Trash2,
  AlertTriangle,
  HardDrive,
  Copy,
  Check,
  QrCode,
  Link2,
  LogOut,
  HelpCircle,
  Activity,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Settings } from '../types/pharmacy';
import { firebaseSync, SyncStatus } from '../services/firebaseSync';
import { 
  uploadBackupToDrive, 
  listDriveBackups, 
  downloadAndRestoreBackup, 
  deleteDriveBackupFile, 
  DriveBackupFile,
  testGoogleDriveConnection
} from '../services/googleDrive';

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Settings) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonString: string) => boolean;
  onResetDatabase: () => void;
  onGenerate5000Items: () => void;
  totalProductsCount: number;
  onRefreshData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onExportBackup,
  onImportBackup,
  onResetDatabase,
  onGenerate5000Items,
  totalProductsCount,
  onRefreshData,
}) => {
  // Form State
  const [pharmacyName, setPharmacyName] = useState(settings.pharmacyName);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [currency, setCurrency] = useState(settings.currency);
  const [taxNumber, setTaxNumber] = useState(settings.taxNumber || '');
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter || settings.receiptFooterMessage || '');
  const [defaultTaxRate, setDefaultTaxRate] = useState(settings.defaultTaxRate);
  const [manualTotalBehavior, setManualTotalBehavior] = useState(settings.manualTotalBehavior || settings.editMode || 'price');
  const [thermalPaperWidth, setThermalPaperWidth] = useState(settings.thermalPaperWidth || '58mm');
  const [googleDriveAuto, setGoogleDriveAuto] = useState<boolean>(settings.autoDailyDriveBackup ?? true);
  const [googleWebAppUrl, setGoogleWebAppUrl] = useState(settings.googleWebAppUrl || '');
  const [backupToken, setBackupToken] = useState(settings.backupToken || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Pharmacy & Device Link State
  const pharmacyInfo = firebaseSync.getPharmacyInfo();
  const [copiedPid, setCopiedPid] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Firebase Sync State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>(firebaseSync.getLastSyncTime());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncResultMessage, setSyncResultMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Diagnostic Test State
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Google Apps Script Drive State
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveTestResult, setDriveTestResult] = useState<{ text: string; success: boolean } | null>(null);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [loadingDriveBackups, setLoadingDriveBackups] = useState(false);
  const [driveOperationLoading, setDriveOperationLoading] = useState(false);
  const [driveProgressText, setDriveProgressText] = useState<string | null>(null);
  const [driveStatusMessage, setDriveStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showDriveInstructions, setShowDriveInstructions] = useState(false);

  // Confirmation Modals
  const [restoreConfirmFile, setRestoreConfirmFile] = useState<DriveBackupFile | null>(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<DriveBackupFile | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to Firebase sync changes
  useEffect(() => {
    const unsubscribeSync = firebaseSync.onStatusChange((status, count, lastTime) => {
      setSyncStatus(status);
      setPendingQueueCount(count);
      if (lastTime) setLastSyncTime(lastTime);
    });

    return () => {
      unsubscribeSync();
    };
  }, []);

  // Update local fields if settings prop changes from remote sync
  useEffect(() => {
    if (settings.googleWebAppUrl !== undefined) setGoogleWebAppUrl(settings.googleWebAppUrl);
    if (settings.backupToken !== undefined) setBackupToken(settings.backupToken);
    if (settings.autoDailyDriveBackup !== undefined) setGoogleDriveAuto(settings.autoDailyDriveBackup);
  }, [settings.googleWebAppUrl, settings.backupToken, settings.autoDailyDriveBackup]);

  // Generate QR code for quick device linking
  useEffect(() => {
    if (qrModalOpen && pharmacyInfo.pharmacyId && pharmacyInfo.joinCode) {
      if (typeof window !== 'undefined') {
        const baseUrl = window.location.origin + window.location.pathname;
        const linkUrl = `${baseUrl}#/?pid=${encodeURIComponent(pharmacyInfo.pharmacyId)}&code=${encodeURIComponent(pharmacyInfo.joinCode)}`;
        QRCode.toDataURL(linkUrl, {
          width: 260,
          margin: 2,
          color: {
            dark: '#0284c7',
            light: '#ffffff'
          }
        }).then(setQrCodeDataUrl).catch(console.error);
      }
    }
  }, [qrModalOpen, pharmacyInfo.pharmacyId, pharmacyInfo.joinCode]);

  const copyToClipboard = (text: string, type: 'pid' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'pid') {
      setCopiedPid(true);
      setTimeout(() => setCopiedPid(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Trigger manual sync via waitForPendingWrites
  const handleTriggerFirebaseSync = async () => {
    setIsManualSyncing(true);
    setSyncResultMessage(null);
    try {
      const result = await firebaseSync.syncNow();
      setSyncResultMessage({
        text: result.message,
        success: result.success
      });
      if (result.success && onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      setSyncResultMessage({
        text: `حدث خطأ: ${err?.message || err}`,
        success: false
      });
    } finally {
      setIsManualSyncing(false);
      setTimeout(() => setSyncResultMessage(null), 6000);
    }
  };

  // Run full diagnostics test
  const handleRunDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    setDiagnosticResult(null);
    try {
      const res = await firebaseSync.runDiagnosticTest();
      setDiagnosticResult(res);
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        message: `فشل التشخيص: ${err?.message || err}`
      });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  // Disconnect device
  const handleDisconnect = () => {
    firebaseSync.disconnectPharmacy();
    setDisconnectConfirm(false);
  };

  // Test Google Drive Web App connection
  const handleTestDriveConnection = async () => {
    if (!googleWebAppUrl.trim() || !backupToken.trim()) {
      setDriveTestResult({
        text: 'يرجى إدخال رابط Web App ورمز الأمان (Token) أولاً',
        success: false
      });
      return;
    }
    setIsTestingDrive(true);
    setDriveTestResult(null);
    try {
      const res = await testGoogleDriveConnection(googleWebAppUrl, backupToken);
      setDriveTestResult({
        text: res.message,
        success: res.success
      });
      if (res.success) {
        // Auto-fetch list on successful test
        fetchDriveBackupsList();
      }
    } catch (err: any) {
      setDriveTestResult({
        text: `فشل الاتصال: ${err?.message || err}`,
        success: false
      });
    } finally {
      setIsTestingDrive(false);
    }
  };

  // Fetch available backups list from Google Drive Web App
  const fetchDriveBackupsList = async () => {
    setLoadingDriveBackups(true);
    setDriveStatusMessage(null);
    try {
      const files = await listDriveBackups();
      setDriveBackups(files);
    } catch (err: any) {
      setDriveStatusMessage({
        text: `تعذر جلب قائمة النسخ: ${err?.message || 'تأكد من صحة الرابط والرمز' }`,
        type: 'error'
      });
    } finally {
      setLoadingDriveBackups(false);
    }
  };

  // Instant Cloud Google Drive Backup
  const handleCreateDriveBackup = async () => {
    setDriveOperationLoading(true);
    setDriveStatusMessage(null);
    setDriveProgressText('جاري استخراج بيانات الصيدلية بالكامل...');
    try {
      const res = await uploadBackupToDrive(false, (msg) => setDriveProgressText(msg));
      setDriveStatusMessage({
        text: `تم حفظ النسخة الاحتياطية (${res.fileName}) بنجاح في Google Drive! ☁️`,
        type: 'success',
      });
      await fetchDriveBackupsList();
    } catch (err: any) {
      setDriveStatusMessage({
        text: `فشل النسخ على Google Drive: ${err?.message || err}`,
        type: 'error',
      });
    } finally {
      setDriveOperationLoading(false);
      setDriveProgressText(null);
    }
  };

  // Confirm Restore from Drive
  const handleExecuteRestore = async () => {
    if (!restoreConfirmFile) return;
    setDriveOperationLoading(true);
    try {
      await downloadAndRestoreBackup(restoreConfirmFile.id);
      setDriveStatusMessage({
        text: `تم استعادة قاعدة بيانات الصيدلية بنجاح من النسخة (${restoreConfirmFile.name})! 🟢`,
        type: 'success',
      });
      setRestoreConfirmFile(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setDriveStatusMessage({
        text: `فشل استرجاع النسخة: ${err?.message || 'خطأ غير متوقع'}`,
        type: 'error',
      });
    } finally {
      setDriveOperationLoading(false);
    }
  };

  // Confirm Delete from Drive
  const handleExecuteDelete = async () => {
    if (!deleteConfirmFile) return;
    setDriveOperationLoading(true);
    try {
      await deleteDriveBackupFile(deleteConfirmFile.id);
      setDriveStatusMessage({
        text: `تم حذف النسخة الاحتياطية (${deleteConfirmFile.name}) من Google Drive بنجاح.`,
        type: 'success',
      });
      setDeleteConfirmFile(null);
      await fetchDriveBackupsList();
    } catch (err: any) {
      setDriveStatusMessage({
        text: `فشل حذف النسخة: ${err?.message || 'خطأ غير معروف'}`,
        type: 'error',
      });
    } finally {
      setDriveOperationLoading(false);
    }
  };

  // Save Settings Form
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Settings = {
      ...settings,
      pharmacyName: pharmacyName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      currency: currency.trim(),
      taxNumber: taxNumber.trim(),
      receiptFooter: (receiptFooter || '').trim(),
      receiptFooterMessage: (receiptFooter || '').trim(),
      defaultTaxRate: Number(defaultTaxRate) || 0,
      manualTotalBehavior,
      editMode: manualTotalBehavior,
      thermalPaperWidth,
      autoDailyDriveBackup: googleDriveAuto,
      googleDriveBackupEnabled: googleDriveAuto,
      googleWebAppUrl: googleWebAppUrl.trim(),
      backupToken: backupToken.trim(),
    };

    onUpdateSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Local JSON import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = onImportBackup(content);
        if (success) {
          alert('تم استعادة النسخة الاحتياطية بنجاح وتحديث كافة الجداول!');
          if (onRefreshData) onRefreshData();
        } else {
          alert('الملف غير صالح أو تالف');
        }
      }
    };
    reader.readAsText(file);
  };

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12" dir="rtl">

      {/* 1. Multi-Device Linking & Pharmacy Sync Info */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>المزامنة السحابية وربط الأجهزة (Firestore Realtime)</span>
                {isOnline ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Wifi className="h-3 w-3" />
                    <span>متصل بالسحابة</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <WifiOff className="h-3 w-3" />
                    <span>وضع محلي دون إنترنت</span>
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مزامنة فورية لحظية (onSnapshot) ومستقلة لكل صنف وفاتورة بدون Google وبدون سيرفر وسيط.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold hover:bg-sky-100 transition-colors"
            >
              <QrCode className="h-4 w-4" />
              <span>رمز QR للربط السريع</span>
            </button>
          </div>
        </div>

        {/* Pharmacy Credentials Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              معرّف الصيدلية (Pharmacy ID):
            </span>
            <div className="flex items-center justify-between font-mono font-bold text-sm text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="select-all">{pharmacyInfo.pharmacyId || 'غير مرتبط'}</span>
              {pharmacyInfo.pharmacyId && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(pharmacyInfo.pharmacyId!, 'pid')}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                  title="نسخ"
                >
                  {copiedPid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              رمز الانضمام السري (Join Code):
            </span>
            <div className="flex items-center justify-between font-mono font-black text-sm tracking-widest text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="select-all">{pharmacyInfo.joinCode || 'غير محدد'}</span>
              {pharmacyInfo.joinCode && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(pharmacyInfo.joinCode!, 'code')}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                  title="نسخ"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              معرّف هذا الجهاز (Device ID):
            </span>
            <div className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 truncate select-all" dir="ltr">
              {pharmacyInfo.deviceId}
            </div>
          </div>
        </div>

        {/* Sync Status Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">حالة المزامنة الحالية:</span>
            <span className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5 block">
              {syncStatus === 'synced' && 'متزامن بالكامل 🟢'}
              {syncStatus === 'syncing' && 'جاري المزامنة مع فايربيس 🔄'}
              {syncStatus === 'offline' && 'غير متصل (الحفظ محلي) 🟡'}
              {syncStatus === 'error' && 'معلق (فحص الاتصال) 🔴'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">العمليات المعلقة محلياً:</span>
            <span className={`font-extrabold text-sm mt-0.5 block ${pendingQueueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {pendingQueueCount > 0 ? `${pendingQueueCount} عملية بانتظار الرفع` : '0 (جميع العمليات مسجلة سحابياً)'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">آخر مزامنة ناجحة:</span>
            <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">
              {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'numeric' }) : 'عند بدء التشغيل'}
            </span>
          </div>
        </div>

        {syncResultMessage && (
          <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            syncResultMessage.success
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}>
            {syncResultMessage.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{syncResultMessage.text}</span>
          </div>
        )}

        {/* Action Buttons for Sync & Diagnostics */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerFirebaseSync}
              disabled={isManualSyncing || !isOnline}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition-all ${
                !isOnline 
                  ? 'bg-slate-400 cursor-not-allowed' 
                  : 'bg-sky-600 hover:bg-sky-700 active:scale-95'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${isManualSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing ? 'جاري فحص وتفريغ العمليات المعلقة...' : 'مزامنة الآن 🔄'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunDiagnostic}
              disabled={isRunningDiagnostic}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Activity className={`h-4 w-4 text-sky-600 ${isRunningDiagnostic ? 'animate-spin' : ''}`} />
              <span>{isRunningDiagnostic ? 'جاري تشغيل الفحص...' : 'فحص وتشخيص الاتصال بالسحابة 🩺'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDisconnectConfirm(true)}
            className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            فصل هذا الجهاز عن الصيدلية
          </button>
        </div>

        {/* Diagnostic Results Box */}
        {diagnosticResult && (
          <div className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in duration-200 ${
            diagnosticResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              {diagnosticResult.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <span>{diagnosticResult.message}</span>
            </div>
            {diagnosticResult.details && (
              <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl font-mono text-[11px] space-y-1 text-slate-700 dark:text-slate-300 overflow-x-auto" dir="ltr">
                <div>UID: {diagnosticResult.details.uid || 'N/A'}</div>
                <div>Anonymous Auth: {diagnosticResult.details.isAnonymous ? 'YES ✅' : 'NO'}</div>
                <div>Pharmacy ID: {diagnosticResult.details.pharmacyId || 'N/A'}</div>
                {diagnosticResult.details.code && <div>Error Code: {diagnosticResult.details.code}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Google Drive Automated Backup via Google Apps Script (Zero User Login) */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <CloudUpload className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>النسخ الاحتياطي التلقائي على Google Drive (بدون تسجيل دخول)</span>
                <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold px-2 py-0.5 rounded-full">
                  Apps Script Web App
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حفظ نسخ JSON في مجلد PharmaCare_Backups تلقائياً كل 6 ساعات مع الاحتفاظ بأحدث 30 نسخة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDriveInstructions(!showDriveInstructions)}
            className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
          >
            <HelpCircle className="h-4 w-4" />
            <span>{showDriveInstructions ? 'إخفاء خطوات الإعداد' : 'خطوات النشر على Drive (5 دقائق)'}</span>
            {showDriveInstructions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Setup Instructions Accordion */}
        {showDriveInstructions && (
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900 text-xs text-slate-700 dark:text-slate-300 space-y-2.5 leading-relaxed animate-in fade-in duration-200">
            <div className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5 text-sm">
              <ExternalLink className="h-4 w-4 text-sky-600" />
              <span>خطوات نشر كود Google Apps Script كـ Web App:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>افتح <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-sky-600 font-bold underline">script.google.com</a> بحساب Google الذي تريد حفظ النسخ في درايفه.</li>
              <li>أنشئ مشروعاً جديداً وضع فيه الكود الموجود في ملف <code className="font-mono bg-white dark:bg-slate-800 px-1 rounded font-bold">Code.gs</code> في الريبو.</li>
              <li>اضغط على زر <strong>Deploy (نشر)</strong> ثم اختر <strong>New deployment (نشر جديد)</strong>.</li>
              <li>اختر نوع <strong>Web app (تطبيق ويب)</strong>:
                <ul className="list-disc list-inside mr-5 mt-1 text-[11px] space-y-0.5">
                  <li><strong>Execute as:</strong> اختر <code>Me</code> (حسابك الشخصي على Google).</li>
                  <li><strong>Who has access:</strong> اختر <code>Anyone</code> (حتى يتمكن PWA من الإرسال بدون شاشات تسجيل دخول).</li>
                </ul>
              </li>
              <li>اضغط <strong>Deploy</strong>، وانسخ رابط الـ Web App URL، وضعه في الحقل أدناه مع أي رمز أمان (Token) مكوّن من 8 خانات من اختيارك.</li>
            </ol>
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-900 text-[11px] text-sky-800 dark:text-sky-300 font-bold">
              💡 بمجرد وضع الرابط والـ Token وحفظ الإعدادات، يتم حفظها سحابياً في الصيدلية لتعمل كل الأجهزة المرتبطة تلقائياً دون الحاجة لإعادة إدخالها!
            </div>
          </div>
        )}

        {/* Input Fields for Web App URL & Secret Token */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              رابط تطبيق Google Apps Script Web App:
            </label>
            <input
              type="url"
              dir="ltr"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={googleWebAppUrl}
              onChange={(e) => setGoogleWebAppUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              رمز الأمان السري للنسخ (Backup Token):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                placeholder="رمز من 8 خانات على الأقل (مثال: secret-token-123)"
                value={backupToken}
                onChange={(e) => setBackupToken(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleTestDriveConnection}
                disabled={isTestingDrive}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition-all shrink-0"
              >
                {isTestingDrive ? 'جاري الفحص...' : 'اختبار الاتصال'}
              </button>
            </div>
          </div>
        </div>

        {driveTestResult && (
          <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            driveTestResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}>
            {driveTestResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{driveTestResult.text}</span>
          </div>
        )}

        {/* Auto Backup Toggle & Last Backup Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-white block">
                تفعيل الجدولة التلقائية:
              </span>
              <span className="text-[11px] text-slate-500">
                إنشاء نسخة تلقائية عند الفتح (إن مضى 24 ساعة) وكل 6 ساعات أثناء الاستخدام.
              </span>
            </div>
            <input
              type="checkbox"
              checked={googleDriveAuto}
              onChange={(e) => setGoogleDriveAuto(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-white block">
                آخر نسخة تم رفعها إلى Drive:
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {settings.lastDriveBackupTime 
                  ? new Date(settings.lastDriveBackupTime).toLocaleString('ar-EG')
                  : 'لم يتم الرفع مسبقاً'}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg">
              {settings.lastDriveBackupFileName || 'جاهز'}
            </span>
          </div>
        </div>

        {driveStatusMessage && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            driveStatusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200'
          }`}>
            {driveStatusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{driveStatusMessage.text}</span>
          </div>
        )}

        {/* Action Buttons for Drive Backup & List */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleCreateDriveBackup}
            disabled={driveOperationLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs active:scale-95 transition-all disabled:opacity-50"
          >
            <CloudUpload className={`h-4 w-4 ${driveOperationLoading ? 'animate-bounce' : ''}`} />
            <span>{driveOperationLoading ? (driveProgressText || 'جاري الرفع...') : 'إنشاء وحفظ نسخة في Google Drive الآن ☁️'}</span>
          </button>

          <button
            type="button"
            onClick={fetchDriveBackupsList}
            disabled={loadingDriveBackups}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingDriveBackups ? 'animate-spin' : ''}`} />
            <span>عرض وتحديث قائمة النسخ في Drive</span>
          </button>
        </div>

        {/* Existing Google Drive Backups List */}
        {driveBackups.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>النسخ المتوفرة في مجلد PharmaCare_Backups ({driveBackups.length}):</span>
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {driveBackups.map((file) => (
                <div key={file.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-2 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white" dir="ltr">
                      {file.name}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>📅 {new Date(file.createdTime).toLocaleString('ar-EG')}</span>
                      {file.size && <span>💾 {file.size}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setRestoreConfirmFile(file)}
                      className="px-3 py-1 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-bold transition-colors"
                    >
                      استعادة 📥
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmFile(file)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="حذف من درايف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Settings Form (Pharmacy Details & Bill Formatting) */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-sky-600" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                بيانات الصيدلية وإعدادات الفواتير
              </h3>
            </div>
            {savedSuccess && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                تم حفظ الإعدادات وتطبيقها بنجاح
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الصيدلية:</label>
              <input
                type="text"
                required
                value={pharmacyName}
                onChange={(e) => setPharmacyName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف / الجوال:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-center font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العنوان:</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الرقم الضريبي الموحد:</label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                dir="ltr"
                placeholder="مثال: 900213456"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-center font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العملة الافتراضية:</label>
              <input
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-center font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نسبة ضريبة القيمة المضافة (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-center font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">عرض ورق الطابعة الحرارية:</label>
              <select
                value={thermalPaperWidth}
                onChange={(e) => setThermalPaperWidth(e.target.value as '58mm' | '80mm')}
                className="w-full rounded-xl border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="58mm">58mm (طابعات الإيصالات المحمولة والصغيرة)</option>
                <option value="80mm">80mm (طابعات الكاشير القياسية الكبيرة)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">سلوك تعديل الإجمالي في الكاشير:</label>
              <select
                value={manualTotalBehavior}
                onChange={(e) => setManualTotalBehavior(e.target.value as 'price' | 'quantity')}
                className="w-full rounded-xl border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="price">تغيير السعر الفردي تلقائياً عند تغيير الإجمالي</option>
                <option value="quantity">تغيير الكمية تلقائياً عند تغيير الإجمالي</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تذييل ورسالة الفاتورة المطبوعة:</label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="طهور إن شاء الله.. مع تمنياتنا لكم بموفور الصحة"
                className="w-full rounded-xl border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 active:scale-95 transition-all"
            >
              حفظ وتطبيق الإعدادات
            </button>
          </div>
        </div>
      </form>

      {/* 4. Local JSON Backup & Factory Reset */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3 dark:border-slate-800">
          <Database className="h-5 w-5 text-teal-600" />
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              النسخ الاحتياطي اليدوي المحلي (ملف JSON)
            </h3>
            <p className="text-xs text-slate-500">
              تصدير ملف نسخة احتياطية مباشرة على جهازك دون الحاجة لاتصال بالإنترنت.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 p-3.5 text-xs font-extrabold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>📥 تصدير وتحميل ملف JSON محلياً</span>
          </button>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3.5 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <Upload className="h-4 w-4" />
              <span>📤 استعادة نسخة احتياطية من ملف</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (confirm('هل تريد توليد 5,000 صنف دوائي وتجاري لاختبار سرعة النظام الفائقة؟')) {
                onGenerate5000Items();
              }
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-amber-600 active:scale-95 transition-all text-center"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>⚡ توليد 5000 صنف للاختبار ({totalProductsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm('تحذير: هل أنت متأكد من رغبتك في إعادة ضبط المصنع ومسح جميع الفواتير والمخزون؟')) {
                onResetDatabase();
              }
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span>إعادة تعيين لقيم المصنع (Reset)</span>
          </button>
        </div>
      </div>

      {/* QR Code Quick Device Link Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-sky-600" />
              <span>ربط جهاز جديد بالصيدلية</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              وجّه كاميرا أي هاتف ذكي أو تابلت لمسح الرمز للدخول مباشرة إلى هذه الصيدلية:
            </p>

            <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-sky-100 dark:border-sky-950 inline-block">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Device Link QR" className="w-52 h-52 object-contain" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                  جاري توليد الرمز...
                </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl text-right text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Pharmacy ID:</span>
                <span className="font-bold text-sky-600">{pharmacyInfo.pharmacyId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Join Code:</span>
                <span className="font-bold text-emerald-600 tracking-wider">{pharmacyInfo.joinCode}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restore */}
      {restoreConfirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                تأكيد استعادة النسخة الاحتياطية
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في استعادة النسخة الاحتياطية التالية من Google Drive؟
              <br />
              <strong className="block mt-2 font-mono text-sky-600 dark:text-sky-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg" dir="ltr">
                {restoreConfirmFile.name}
              </strong>
              <span className="block mt-2 text-rose-600 font-bold">
                تنبيه: سيتم استبدال البيانات المحلية وتحديث الأصناف والفواتير بالبيانات المحفوظة في النسخة.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmFile(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={driveOperationLoading}
                className="px-4 py-2 rounded-xl bg-sky-600 text-xs font-extrabold text-white hover:bg-sky-700 transition-colors shadow-xs"
              >
                {driveOperationLoading ? 'جاري الاستعادة...' : 'تأكيد واسترجاع البيانات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950">
                <Trash2 className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                تأكيد حذف النسخة من Google Drive
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف ملف النسخة الاحتياطية التالي نهائياً من Google Drive؟
              <br />
              <strong className="block mt-2 font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg" dir="ltr">
                {deleteConfirmFile.name}
              </strong>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmFile(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={driveOperationLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-extrabold text-white hover:bg-rose-700 transition-colors shadow-xs"
              >
                {driveOperationLoading ? 'جاري الحذف...' : 'نعم، حذف نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950">
                <LogOut className="h-6 w-6" />
              </div>
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                تأكيد فصل هذا الجهاز عن الصيدلية
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              عند فصل الجهاز، سيتوقف هذا الجهاز عن استقبال وتحديث بيانات هذه الصيدلية. لن تُحذف البيانات من السحابة ويمكنك إعادة الربط في أي وقت باستخدام رمز الصيدلية.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDisconnectConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-extrabold text-white hover:bg-rose-700 transition-colors shadow-xs"
              >
                تأكيد الفصل
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
