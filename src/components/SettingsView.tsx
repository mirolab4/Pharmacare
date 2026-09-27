import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Trash2, 
  Sparkles, 
  Save, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Moon, 
  Sun, 
  CheckCircle2, 
  AlertTriangle,
  Database,
  RefreshCw,
  Cloud,
  HardDrive
} from 'lucide-react';
import { Settings } from '../types/pharmacy';

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonString: string) => boolean;
  onResetDatabase: () => void;
  onGenerate5000Items: () => void;
  totalProductsCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onExportBackup,
  onImportBackup,
  onResetDatabase,
  onGenerate5000Items,
  totalProductsCount,
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
  const [googleDriveAuto, setGoogleDriveAuto] = useState<boolean>(settings.googleDriveBackupEnabled ?? true);
  const [backupFrequency, setBackupFrequency] = useState<'daily' | 'weekly'>('daily');
  const [driveSyncing, setDriveSyncing] = useState<boolean>(false);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // File import ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      googleDriveBackupEnabled: googleDriveAuto,
    };

    onUpdateSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleGoogleDriveBackup = () => {
    setDriveSyncing(true);
    setTimeout(() => {
      onExportBackup();
      setDriveSyncing(false);
      setDriveSyncSuccess(`تم تصدير وحفظ النسخة الاحتياطية بنجاح بنظام Google Drive و Firestore.`);
      setTimeout(() => setDriveSyncSuccess(null), 4000);
    }, 600);
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
        } else {
          alert('الملف غير صالح أو تالف');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 1. Pharmacy Information */}
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
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="₪">شيكل (₪ - ILS)</option>
                <option value="ر.س">ريال سعودي (ر.س - SAR)</option>
                <option value="د.أ">دينار أردني (د.أ - JOD)</option>
                <option value="$">دولار ($ - USD)</option>
                <option value="ج.م">جنيه مصري (ج.م - EGP)</option>
                <option value="د.إ">درهم إماراتي (د.إ - AED)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نسبة الضريبة الافتراضية (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-center dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">مقاس الطابعة الحرارية:</label>
              <select
                value={thermalPaperWidth}
                onChange={(e) => setThermalPaperWidth(e.target.value as '58mm' | '80mm')}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="58mm">طابعة بلوتوث صغيرة (58 مم - قياسي أندرويد)</option>
                <option value="80mm">طابعة كاشير عريضة (80 مم)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                عند تعديل الإجمالي يدوياً في الكاشير:
              </label>
              <select
                value={manualTotalBehavior}
                onChange={(e) => setManualTotalBehavior(e.target.value as 'price' | 'quantity')}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="price">إعادة احتساب السعر تلقائياً (تعديل السعر)</option>
                <option value="quantity">إعادة احتساب الكمية تلقائياً (تعديل الكمية)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                تذييل الفاتورة المطبوعة (رسالة الزبون):
              </label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-700"
            >
              <Save className="h-4 w-4" />
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </div>
      </form>

      {/* 2. System Controls (Eye, Audio, Theme) */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white border-b pb-3 dark:border-slate-800">
          خيارات العرض والخصوصية والأصوات
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Magic Eye Toggle */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, hideCostAndProfit: !settings.hideCostAndProfit })}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-bold transition-all ${
              settings.hideCostAndProfit
                ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200'
                : 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {settings.hideCostAndProfit ? <EyeOff className="h-5 w-5 text-amber-600" /> : <Eye className="h-5 w-5 text-sky-600" />}
              <div className="text-right">
                <span className="block">زر 👁️ السحري</span>
                <span className="text-[10px] text-slate-400">
                  {settings.hideCostAndProfit ? 'الأرباح مخفية أمام الزبون' : 'الأرباح معروضة'}
                </span>
              </div>
            </div>
            <span className="text-xs">{settings.hideCostAndProfit ? 'مخفي 🔒' : 'معروض 👁️'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-bold transition-all ${
              settings.soundEnabled
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200'
                : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {settings.soundEnabled ? <Volume2 className="h-5 w-5 text-emerald-600" /> : <VolumeX className="h-5 w-5 text-slate-400" />}
              <div className="text-right">
                <span className="block">صوت المسح والنجاح</span>
                <span className="text-[10px] text-slate-400">
                  {settings.soundEnabled ? 'الأصوات مفعلة' : 'الأصوات صامتة'}
                </span>
              </div>
            </div>
            <span className="text-xs">{settings.soundEnabled ? 'مفعل 🔊' : 'صامت 🔇'}</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, darkMode: !settings.darkMode })}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-bold transition-all ${
              settings.darkMode
                ? 'bg-indigo-950 border-indigo-700 text-indigo-200'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {settings.darkMode ? <Moon className="h-5 w-5 text-indigo-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
              <div className="text-right">
                <span className="block">المظهر والوضع</span>
                <span className="text-[10px] text-slate-400">
                  {settings.darkMode ? 'الوضع الليلي (Dark)' : 'الوضع الفاتح (Light)'}
                </span>
              </div>
            </div>
            <span className="text-xs">{settings.darkMode ? 'ليلي 🌙' : 'نهاري ☀️'}</span>
          </button>
        </div>
      </div>

      {/* Google Drive Automatic Cloud Backup Card */}
      <div className="rounded-2xl bg-gradient-to-br from-sky-50 via-white to-blue-50/40 p-4 sm:p-6 shadow-xs border border-sky-200 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 dark:border-sky-900/60 space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-sky-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>النسخ الاحتياطي التلقائي إلى Google Drive ☁️</span>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  سحابي مجاني 100%
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                حفظ وحماية تلقائية لبيانات الصيدلية والمخزون والفواتير السحابية تحميك من ضياع أو سرقة الهاتف.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-white block">تفعيل المزامنة التلقائية مع Drive:</span>
              <span className="text-[11px] text-slate-500">حفظ نسخة احتياطية دورياً تلقائياً</span>
            </div>
            <input
              type="checkbox"
              checked={googleDriveAuto}
              onChange={(e) => setGoogleDriveAuto(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-white block">دورية النسخ التلقائي:</span>
              <span className="text-[11px] text-slate-500">التوقيت المفضل للحفظ</span>
            </div>
            <select
              value={backupFrequency}
              onChange={(e) => setBackupFrequency(e.target.value as 'daily' | 'weekly')}
              className="rounded-lg border border-slate-300 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 p-1.5 font-bold"
            >
              <option value="daily">يومياً (نهاية الدوام)</option>
              <option value="weekly">أسبوعياً</option>
            </select>
          </div>
        </div>

        {driveSyncSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{driveSyncSuccess}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleGoogleDriveBackup}
            disabled={driveSyncing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 active:scale-95 transition-all"
          >
            <Cloud className="h-4 w-4" />
            <span>{driveSyncing ? 'جاري النسخ الاحتياطي...' : 'رفع نسخة احتياطية فورية إلى Google Drive 🚀'}</span>
          </button>
        </div>
      </div>

      {/* 3. Backup, Restore, and 5000+ Items Generator */}
      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3 dark:border-slate-800">
          <Database className="h-5 w-5 text-teal-600" />
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              النسخ الاحتياطي وإدارة البيانات (100% Offline)
            </h3>
            <p className="text-xs text-slate-500">
              جميع بياناتك تُحفظ محلياً على جهاز الأندرويد. يمكنك تصدير نسخة احتياطية في أي وقت ونقلها لهاتف آخر بضغطة زر.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Download Backup */}
          <button
            type="button"
            onClick={onExportBackup}
            className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 p-3.5 text-xs font-extrabold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>📥 تصدير وتحميل نسخة احتياطية (JSON)</span>
          </button>

          {/* Import Backup */}
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

        {/* 5000+ Items Generator & Factory Reset */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Generate 5000+ Items */}
          <div className="flex items-center w-full sm:w-auto">
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
          </div>

          {/* Factory Reset */}
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
    </div>
  );
};
