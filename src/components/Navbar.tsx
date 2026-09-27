import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Package, 
  FileText, 
  Receipt, 
  Users, 
  Building2, 
  BarChart3, 
  Settings as SettingsIcon, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Camera,
  Download,
  RotateCcw, 
  Database, 
  ArrowDownLeft, 
  ArrowUpRight,
  Menu,
  X,
  Sparkles,
  ChevronLeft,
  QrCode,
  PackageCheck,
  Monitor,
  Smartphone,
  Cloud,
  CloudOff,
  CloudUpload
} from 'lucide-react';
import { MainTab, Settings } from '../types/pharmacy';
import { PWAInstallButton } from './PWAInstallButton';
import { firebaseSync, SyncStatus } from '../services/firebaseSync';

interface NavbarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  settings: Settings;
  onToggleHideProfit: () => void;
  onToggleSound: () => void;
  onOpenScanner: () => void;
  onQuickBackup: () => void;
  isContinuousScannerOn?: boolean;
  onToggleContinuousScanner?: () => void;
  onOpenDeviceLink?: () => void;
  onOpenStockAudit?: () => void;
  onOpenCustomerDisplay?: () => void;
  cartCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  settings,
  onToggleHideProfit,
  onToggleSound,
  onOpenScanner,
  onQuickBackup,
  isContinuousScannerOn = false,
  onToggleContinuousScanner,
  onOpenDeviceLink,
  onOpenStockAudit,
  onOpenCustomerDisplay,
  cartCount,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  React.useEffect(() => {
    return firebaseSync.onStatusChange((status, count) => {
      setSyncStatus(status);
      setPendingSyncCount(count);
    });
  }, []);

  const allNavItems: { id: MainTab; label: string; icon: React.ReactNode; badge?: number; category: string }[] = [
    { id: 'pos', label: 'الكاشير (POS)', icon: <ShoppingCart className="h-4 w-4" />, badge: cartCount, category: 'المبيعات والكاشير' },
    { id: 'sales_returns', label: 'مرجع الكاشير', icon: <RotateCcw className="h-4 w-4 text-rose-500" />, category: 'المبيعات والكاشير' },
    { id: 'invoices', label: 'سجل الفواتير', icon: <FileText className="h-4 w-4 text-sky-500" />, category: 'المبيعات والكاشير' },
    { id: 'purchases', label: 'المشتريات', icon: <ArrowDownLeft className="h-4 w-4 text-emerald-500" />, category: 'المشتريات والمخزون' },
    { id: 'purchase_returns', label: 'مرجع المشتريات', icon: <ArrowUpRight className="h-4 w-4 text-amber-500" />, category: 'المشتريات والمخزون' },
    { id: 'products', label: 'الأصناف والمخزون', icon: <Package className="h-4 w-4 text-teal-500" />, category: 'المشتريات والمخزون' },
    { id: 'banks', label: 'البنوك والمحافظ', icon: <Building2 className="h-4 w-4 text-indigo-500" />, category: 'الحسابات والمالية' },
    { id: 'customers', label: 'العملاء والموردون', icon: <Users className="h-4 w-4 text-blue-500" />, category: 'الحسابات والمالية' },
    { id: 'vouchers', label: 'السندات المالية', icon: <Receipt className="h-4 w-4 text-violet-500" />, category: 'الحسابات والمالية' },
    { id: 'analytics', label: 'الإحصائيات', icon: <BarChart3 className="h-4 w-4 text-amber-500" />, category: 'التقارير والإعدادات' },
    { id: 'settings', label: 'الإعدادات والنسخ', icon: <SettingsIcon className="h-4 w-4 text-slate-500" />, category: 'التقارير والإعدادات' },
  ];

  // Primary bottom tabs for mobile
  const mobilePrimaryTabs: { id: MainTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'pos', label: 'الكاشير', icon: <ShoppingCart className="h-5 w-5" />, badge: cartCount },
    { id: 'products', label: 'الأصناف', icon: <Package className="h-5 w-5" /> },
    { id: 'purchases', label: 'المشتريات', icon: <ArrowDownLeft className="h-5 w-5" /> },
    { id: 'invoices', label: 'الفواتير', icon: <FileText className="h-5 w-5" /> },
  ];

  const handleTabClick = (tabId: MainTab) => {
    onSelectTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs dark:bg-slate-900/95 dark:border-slate-800">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-2.5 sm:px-6 gap-2">
          {/* Brand & Pharmacy Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-sky-600 to-teal-500 text-white shadow-md shadow-sky-500/20">
              <span className="font-black text-base sm:text-xl leading-none">Rx</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-extrabold text-xs sm:text-base text-slate-900 dark:text-white truncate">
                  {settings.pharmacyName}
                </h1>
                <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-0.5">
                  <Database className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-600" />
                  <span className="hidden xs:inline">Cloud SQL</span> 🟢
                </span>
              </div>
              <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400 truncate">
                نظام إدارة الصيدلية السريرية المتكامل + PostgreSQL + أوفلاين
              </p>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Continuous Scanner Toggle */}
            {onToggleContinuousScanner && (
              <button
                onClick={onToggleContinuousScanner}
                className={`flex items-center justify-center gap-1 min-h-[38px] sm:min-h-[40px] px-2 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  isContinuousScannerOn
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-400/50 animate-pulse'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                }`}
                title={isContinuousScannerOn ? 'إيقاف الماسح المستمر في الخلفية' : 'تشغيل كاميرا المسح المستمر في الخلفية'}
              >
                <Camera className={`h-4 w-4 ${isContinuousScannerOn ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                <span className="hidden sm:inline">
                  {isContinuousScannerOn ? 'كاميرا مستمرة 🟢' : 'كاميرا مستمرة'}
                </span>
              </button>
            )}

            {/* Multi-Device QR Code Link */}
            {onOpenDeviceLink && (
              <button
                onClick={onOpenDeviceLink}
                className="flex items-center justify-center gap-1 min-h-[38px] sm:min-h-[40px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 transition-colors text-xs font-bold"
                title="توليد باركود لربط هاتف أو شاشة كاشير ثانية"
              >
                <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="hidden xl:inline">ربط جهاز 📱</span>
              </button>
            )}

            {/* Quick Phone Camera Stock Audit */}
            {onOpenStockAudit && (
              <button
                onClick={onOpenStockAudit}
                className="flex items-center justify-center gap-1 min-h-[38px] sm:min-h-[40px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 transition-colors text-xs font-bold"
                title="الجرد السريع للمخزون عبر كاميرا الهاتف"
              >
                <PackageCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="hidden xl:inline">الجرد بالكاميرا 📦</span>
              </button>
            )}

            {/* Customer Display View Toggle */}
            {onOpenCustomerDisplay && (
              <button
                onClick={onOpenCustomerDisplay}
                className="hidden md:flex items-center justify-center gap-1 min-h-[38px] sm:min-h-[40px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 transition-colors text-xs font-bold"
                title="عرض شاشة الزبون المزدوجة"
              >
                <Monitor className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span className="hidden xl:inline">شاشة الزبون 🖥️</span>
              </button>
            )}

            {/* Quick Camera Barcode trigger */}
            <button
              onClick={onOpenScanner}
              className="flex items-center justify-center gap-1 min-h-[38px] sm:min-h-[40px] px-2 sm:px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 transition-colors text-xs font-bold"
              title="مسح باركود لمرة واحدة"
            >
              <Camera className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span className="hidden md:inline">مسح لمرة واحدة</span>
            </button>

            {/* Magic Eye Button (Hide Profit) */}
            <button
              onClick={onToggleHideProfit}
              className={`flex items-center justify-center min-h-[38px] sm:min-h-[40px] min-w-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                settings.hideCostAndProfit
                  ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-400/40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
              }`}
              title={settings.hideCostAndProfit ? 'الربح مخفي حالياً (انقر للإظهار)' : 'إخفاء الأرباح لحماية الخصوصية'}
            >
              {settings.hideCostAndProfit ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span className="hidden lg:inline mr-1">مخفي 🔒</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden lg:inline mr-1">إخفاء الأرباح</span>
                </>
              )}
            </button>

            {/* Sound Toggle (hidden on small phone, available in More menu) */}
            <button
              onClick={onToggleSound}
              className={`hidden sm:flex items-center justify-center min-h-[38px] min-w-[38px] rounded-xl p-2 transition-colors ${
                settings.enableScannerSound
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                  : 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/50'
              }`}
              title={settings.enableScannerSound ? 'كتم الصوت' : 'تفعيل صوت الماسح'}
            >
              {settings.enableScannerSound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Live Cloud / Firebase Sync Status Pill */}
            <button
              onClick={() => handleTabClick('settings')}
              className={`flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                syncStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                  : syncStatus === 'syncing'
                  ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 animate-pulse'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300'
              }`}
              title={
                syncStatus === 'synced'
                  ? 'قاعدة البيانات متصلة ومتزامنة مع فايربيس (انقر للإعدادات)'
                  : syncStatus === 'syncing'
                  ? 'جاري رفع ومزامنة العمليات مع فايربيس...'
                  : `وضع عدم الاتصال بالإنترنت - يتم الحفظ محلياً (${pendingSyncCount} معلقة)`
              }
            >
              {syncStatus === 'synced' && <Cloud className="h-4 w-4 text-emerald-600" />}
              {syncStatus === 'syncing' && <Cloud className="h-4 w-4 text-sky-600 animate-bounce" />}
              {syncStatus === 'offline' && <CloudOff className="h-4 w-4 text-amber-600" />}
              {syncStatus === 'error' && <CloudOff className="h-4 w-4 text-rose-600" />}
              
              <span className="hidden sm:inline">
                {syncStatus === 'synced' && 'متزامن 🟢'}
                {syncStatus === 'syncing' && 'جاري الرفع 🔄'}
                {syncStatus === 'offline' && `محلي (${pendingSyncCount})`}
                {syncStatus === 'error' && 'معلق'}
              </span>
            </button>

            {/* Quick Cloud Backup (uploads directly to cloud without downloading to browser) */}
            <button
              onClick={onQuickBackup}
              className="hidden lg:flex items-center gap-1.5 min-h-[38px] rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 transition-colors"
              title="رفع وحفظ نسخة احتياطية فورية في Google Drive وسحابة النظام"
            >
              <CloudUpload className="h-4 w-4 text-teal-600" />
              <span>نسخ سحابي ☁️</span>
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden flex items-center justify-center min-h-[38px] min-w-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white p-2"
              title="عرض كل الأقسام"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5 text-rose-600" /> : <Menu className="h-5 w-5 text-sky-600" />}
            </button>
          </div>
        </div>

        {/* Desktop Horizontal Tabs (lg and up) */}
        <div className="hidden lg:block border-t border-slate-200/80 bg-slate-50/80 px-4 dark:border-slate-800 dark:bg-slate-900/80 overflow-x-auto scrollbar-none">
          <div className="mx-auto flex max-w-7xl gap-1 py-1.5 min-w-max">
            {allNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all min-h-[36px] ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                      isActive ? 'bg-white text-sky-700' : 'bg-sky-600 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile Drawer / Slide-Over Menu for "كل الأقسام والإجراءات" */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity">
          {/* Drawer backdrop tap to close */}
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />

          {/* Drawer Sheet */}
          <div className="w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                  <Menu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">أقسام نظام فارماكير</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">انقر على أي قسم للانتقال إليه مباشرة</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Tools in Drawer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex justify-center">
                <PWAInstallButton />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={onToggleSound}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 min-h-[44px]"
              >
                {settings.enableScannerSound ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-red-500" />}
                <span>صوت التنبيه: {settings.enableScannerSound ? 'مفعّل' : 'مكتوم'}</span>
              </button>

              <button
                onClick={() => { onQuickBackup(); setIsMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-700 dark:text-emerald-300 min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                <span>نسخ احتياطي JSON</span>
              </button>
              </div>
            </div>

            {/* Categorized Nav Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {['المبيعات والكاشير', 'المشتريات والمخزون', 'الحسابات والمالية', 'التقارير والإعدادات'].map((cat) => {
                const itemsInCat = allNavItems.filter(item => item.category === cat);
                return (
                  <div key={cat} className="space-y-1.5">
                    <span className="text-[11px] font-extrabold text-slate-400 px-1 uppercase tracking-wider block">
                      {cat}
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {itemsInCat.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleTabClick(item.id)}
                            className={`flex items-center justify-between w-full p-3 rounded-2xl font-bold text-xs transition-all min-h-[44px] ${
                              isActive
                                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
                              <span className="text-sm">{item.label}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {item.badge !== undefined && item.badge > 0 && (
                                <span className="bg-sky-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                  {item.badge}
                                </span>
                              )}
                              <ChevronLeft className="w-4 h-4 opacity-50" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Tab Bar (Thumbs Zone - Mobile First) */}
      <nav 
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+4px)]"
        aria-label="شريط التنقل السريع"
      >
        <div className="grid grid-cols-5 items-center gap-1 max-w-md mx-auto">
          {mobilePrimaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-extrabold transition-all min-h-[48px] ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="mt-1 leading-none">{tab.label}</span>
              </button>
            );
          })}

          {/* 5th Tab: "المزيد" Drawer Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-extrabold transition-all min-h-[48px] ${
              isMobileMenuOpen || !mobilePrimaryTabs.some(t => t.id === activeTab)
                ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Menu className="h-5 w-5" />
            <span className="mt-1 leading-none">المزيد</span>
          </button>
        </div>
      </nav>
    </>
  );
};
