import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  CheckCircle2, 
  Cloud, 
  Download, 
  Upload, 
  RefreshCw, 
  Database, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff, 
  DollarSign, 
  FileText, 
  Sparkles,
  Wifi,
  WifiOff,
  CloudUpload,
  Calendar,
  Trash2,
  AlertTriangle,
  HardDrive,
  LogOut,
  UserCheck
} from 'lucide-react';
import { Settings } from '../types/pharmacy';
import { firebaseSync, SyncStatus } from '../services/firebaseSync';
import { 
  signInWithGoogleDrive, 
  signOutFromDrive, 
  uploadBackupToDrive, 
  listDriveBackups, 
  downloadAndRestoreBackup, 
  deleteDriveBackupFile, 
  DriveBackupFile,
  initDriveAuth,
  DriveAuthState,
  getDriveAccessToken
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
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Firebase Sync State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>(firebaseSync.getLastSyncTime());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncResultMessage, setSyncResultMessage] = useState<string | null>(null);

  // Google Drive State
  const [driveAuth, setDriveAuth] = useState<DriveAuthState>({
    isAuthenticated: false,
    user: null,
    hasDriveAccess: !!getDriveAccessToken(),
  });
  const [isSigningInDrive, setIsSigningInDrive] = useState(false);
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [loadingDriveBackups, setLoadingDriveBackups] = useState(false);
  const [driveOperationLoading, setDriveOperationLoading] = useState(false);
  const [driveStatusMessage, setDriveStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Confirmation Modals for Destructive Drive Operations (per guidelines)
  const [restoreConfirmFile, setRestoreConfirmFile] = useState<DriveBackupFile | null>(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<DriveBackupFile | null>(null);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to Firebase sync changes
  useEffect(() => {
    const unsubscribeSync = firebaseSync.onStatusChange((status, count, lastTime) => {
      setSyncStatus(status);
      setPendingQueueCount(count);
      if (lastTime) setLastSyncTime(lastTime);
    });

    const unsubscribeDrive = initDriveAuth((authState) => {
      setDriveAuth(authState);
      if (authState.hasDriveAccess) {
        fetchDriveBackupsList();
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeDrive();
    };
  }, []);

  const fetchDriveBackupsList = async () => {
    setLoadingDriveBackups(true);
    try {
      const files = await listDriveBackups();
      setDriveBackups(files);
    } catch (err) {
      console.warn('Failed to load drive backups:', err);
    } finally {
      setLoadingDriveBackups(false);
    }
  };

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
    };

    onUpdateSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Trigger full Firebase two-way sync
  const handleTriggerFirebaseSync = async () => {
    setIsManualSyncing(true);
    setSyncResultMessage(null);
    try {
      const result = await firebaseSync.fullTwoWaySync();
      if (result.success) {
        setSyncResultMessage(`تمت المزامنة بنجاح! تم رفع ${result.pushed} عملية وتحديث البيانات السحابية.`);
        if (onRefreshData) onRefreshData();
      } else {
        setSyncResultMessage('تعذر استكمال المزامنة السحابية. يرجى التحقق من اتصال الإنترنت.');
      }
    } catch {
      setSyncResultMessage('حدث خطأ أثناء المزامنة مع فايربيس.');
    } finally {
      setIsManualSyncing(false);
      setTimeout(() => setSyncResultMessage(null), 5000);
    }
  };

  // Google Drive Connect / Login
  const handleConnectGoogleDrive = async () => {
    setIsSigningInDrive(true);
    setDriveStatusMessage(null);
    try {
      const res = await signInWithGoogleDrive();
      setDriveStatusMessage({
        text: `تم الاتصال بحساب Google Drive بنجاح: ${res.user.email || 'المستخدم'}`,
        type: 'success',
      });
      await fetchDriveBackupsList();
    } catch (err: any) {
      setDriveStatusMessage({
        text: `فشل تسجيل الدخول إلى Google Drive: ${err?.message || 'خطأ غير معروف'}`,
        type: 'error',
      });
    } finally {
      setIsSigningInDrive(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    try {
      await signOutFromDrive();
      setDriveBackups([]);
      setDriveStatusMessage({ text: 'تم تسجيل الخروج من Google Drive بنجاح', type: 'success' });
    } catch (e: any) {
      setDriveStatusMessage({ text: 'فشل تسجيل الخروج', type: 'error' });
    }
  };

  // Instant Drive Backup
  const handleCreateDriveBackup = async () => {
    setDriveOperationLoading(true);
    setDriveStatusMessage(null);
    try {
      const uploadedFile = await uploadBackupToDrive(false);
      setDriveStatusMessage({
        text: `تم حفظ ورفع النسخة الاحتياطية بنجاح إلى مجلد PharmaCare_Backups (${uploadedFile.name})`,
        type: 'success',
      });
      await fetchDriveBackupsList();
    } catch (err: any) {
      setDriveStatusMessage({
        text: `فشل رفع النسخة إلى Google Drive: ${err?.message || 'خطأ غير معروف'}`,
        type: 'error',
      });
    } finally {
      setDriveOperationLoading(false);
    }
  };

  // Confirm Restore from Drive
  const handleExecuteRestore = async () => {
    if (!restoreConfirmFile) return;
    setDriveOperationLoading(true);
    try {
      await downloadAndRestoreBackup(restoreConfirmFile.id);
      setDriveStatusMessage({
        text: `تم استعادة قاعدة بيانات الصيدلية بنجاح من النسخة (${restoreConfirmFile.name})!`,
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
        text: `فشل حذف النسخة من Google Drive: ${err?.message || 'خطأ غير معروف'}`,
        type: 'error',
      });
    } finally {
      setDriveOperationLoading(false);
    }
  };

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
      {/* 1. Firebase Firestore & Offline-First Live Status Section */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                قاعدة بيانات فايربيس (Firebase Firestore) والعمل دون إنترنت
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مزامنة ثنائية ذكية (Two-Way Sync) تضمن استمرار البيع والمخزون دون أي انقطاع.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                متصل بالسحابة
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300">
                <WifiOff className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                وضع عدم الاتصال (محلياً 100%)
              </span>
            )}
          </div>
        </div>

        {/* Informational Offline Architecture Box */}
        <div className="rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <HardDrive className="h-4 w-4 text-sky-600" />
            <span>معمارية العمل دون إنترنت (Offline-First Zero-Delay):</span>
          </div>
          <p className="leading-relaxed">
            عند انقطاع الإنترنت، يعمل النظام بكامل طاقته (كاشير، فواتير مبيعات، مشتريات، مخزون، حسابات عملاء وبنوك). يتم حفظ جميع العمليات فوراً في قاعدة البيانات المحلية، وفور عودة اتصال الإنترنت، يقوم محرك المزامنة برفع وتحديث قاعدة بيانات فايربيس تلقائياً دون أي تكرار.
          </p>
        </div>

        {/* Sync Status Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">حالة المزامنة الحالية:</span>
            <span className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5 block">
              {syncStatus === 'synced' && 'متزامن بالكامل 🟢'}
              {syncStatus === 'syncing' && 'جاري المزامنة مع فايربيس 🔄'}
              {syncStatus === 'offline' && 'غير متصل (الحفظ محلي) 🟡'}
              {syncStatus === 'error' && 'معلق (بانتظار استقرار الشبكة) 🔴'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">عمليات تم إجراؤها في الانقطاع:</span>
            <span className={`font-extrabold text-sm mt-0.5 block ${pendingQueueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {pendingQueueCount > 0 ? `${pendingQueueCount} عملية معلقة بانتظار الرفع` : '0 (كافة العمليات مسجلة سحابياً)'}
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
          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-sky-600" />
            <span>{syncResultMessage}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
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
            <span>{isManualSyncing ? 'جاري المزامنة الشاملة...' : 'مزامنة شاملة الآن مع فايربيس (Sync All)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Google Drive Daily Backup & Cloud Restore Section */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <CloudUpload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                النسخ الاحتياطي اليومي إلى Google Drive (Daily Backup)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حفظ نسخة احتياطية يومية كاملة وتلقائية في مجلد PharmaCare_Backups على Google Drive.
              </p>
            </div>
          </div>
        </div>

        {/* Google Drive Account Connection Banner */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          {driveAuth.hasDriveAccess && driveAuth.user ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {driveAuth.user.photoURL ? (
                  <img
                    src={driveAuth.user.photoURL}
                    alt={driveAuth.user.displayName || 'Google User'}
                    className="h-10 w-10 rounded-full border border-emerald-400 shadow-xs"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <UserCheck className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {driveAuth.user.displayName || 'حساب Google متصل'}
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      Drive مفعل ومأذون 🟢
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono block">
                    {driveAuth.user.email}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnectGoogleDrive}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>تبديل الحساب</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <span className="font-bold block text-slate-900 dark:text-white">
                  ربط Google Drive بالصيدلية
                </span>
                <p className="text-[11px] text-slate-500">
                  قم بتسجيل الدخول بحساب Google لتمكين حفظ النسخ الاحتياطية اليومية لبيانات الصيدلية تلقائياً بأمان تام.
                </p>
              </div>

              {/* Official Google Sign-In Styled Button per guidelines */}
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                disabled={isSigningInDrive}
                className="inline-flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition-all dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              >
                <svg className="h-4 w-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>{isSigningInDrive ? 'جاري الاتصال بـ Google...' : 'تسجيل الدخول وربط Google Drive'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Auto Backup Toggle & Frequency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-white block">
                النسخ الاحتياطي التلقائي اليومي:
              </span>
              <span className="text-[11px] text-slate-500">
                فحص وإنشاء نسخة يومية في Google Drive كل 24 ساعة
              </span>
            </div>
            <input
              type="checkbox"
              checked={googleDriveAuto}
              onChange={(e) => setGoogleDriveAuto(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-white block">
                آخر نسخة تم رفعها لدرايف:
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {settings.lastDriveBackupTime 
                  ? new Date(settings.lastDriveBackupTime).toLocaleString('ar-EG')
                  : 'لم يتم الرفع مسبقاً'}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg">
              يومياً
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleCreateDriveBackup}
            disabled={driveOperationLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <CloudUpload className={`h-4 w-4 ${driveOperationLoading ? 'animate-bounce' : ''}`} />
            <span>{driveOperationLoading ? 'جاري الرفع إلى Drive...' : 'رفع نسخة احتياطية فورية إلى Google Drive 🚀'}</span>
          </button>

          {driveAuth.hasDriveAccess && (
            <button
              type="button"
              onClick={fetchDriveBackupsList}
              disabled={loadingDriveBackups}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDriveBackups ? 'animate-spin' : ''}`} />
              <span>تحديث قائمة نسخ Drive</span>
            </button>
          )}
        </div>

        {/* Existing Google Drive Backups List */}
        {driveAuth.hasDriveAccess && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-600" />
                النسخ الاحتياطية المتوفرة في Google Drive ({driveBackups.length}):
              </span>
            </div>

            {loadingDriveBackups ? (
              <div className="text-center py-6 text-xs text-slate-500 font-bold">
                جاري فحص مجلد النسخ في Google Drive...
              </div>
            ) : driveBackups.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                لم يتم رفع أي نسخ احتياطية إلى Google Drive بعد. انقر على زر "رفع نسخة احتياطية فورية" لإنشاء أول نسخة.
              </div>
            ) : (
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
            )}
          </div>
        )}
      </div>

      {/* 3. Settings Form (Pharmacy Details) */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-sky-600" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                بيانات الصيدلية والفاتورة
              </h3>
            </div>
            {savedSuccess && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                تم حفظ الإعدادات بنجاح
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

      {/* 4. Local Backup & Test Data */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3 dark:border-slate-800">
          <Database className="h-5 w-5 text-teal-600" />
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              النسخ الاحتياطي المحلي اليدوي (ملف JSON)
            </h3>
            <p className="text-xs text-slate-500">
              تصدير ملف نسخة احتياطية مباشرة على هاتفك أو حاسوبك دون إنترنت.
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

      {/* Confirmation Modal for Restore (Required by Workspace Integration Guidelines) */}
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
                تنبيه: سيتم استبدال البيانات الحالية بالكامل وتحديث الأصناف والفواتير بالبيانات المحفوظة في النسخة.
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

      {/* Confirmation Modal for Delete (Required by Workspace Integration Guidelines) */}
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
    </div>
  );
};
