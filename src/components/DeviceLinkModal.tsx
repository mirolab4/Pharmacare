import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, QrCode, Info, Clock, RefreshCw } from 'lucide-react';
import { Product } from '../types/pharmacy';
import { firebaseSync } from '../services/firebaseSync';

interface DeviceLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
}

export const DeviceLinkModal: React.FC<DeviceLinkModalProps> = ({
  isOpen,
  onClose,
  products = [],
}) => {
  const [appUrl, setAppUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [tempCode, setTempCode] = useState<string>('');
  const [tempExpiry, setTempExpiry] = useState<number>(0);
  const [isPermanent, setIsPermanent] = useState<boolean>(false);
  const [expiryMinutes, setExpiryMinutes] = useState<number>(5);
  const [customSlug, setCustomSlug] = useState<string>('صيدليتي');
  const [timeLeft, setTimeLeft] = useState<string>('05:00');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPid, setCopiedPid] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [mode, setMode] = useState<'app_link' | 'product_barcode'>('app_link');
  const [selectedProductBarcode, setSelectedProductBarcode] = useState<string>('');
  const [productQrUrl, setProductQrUrl] = useState<string>('');

  const workspaceInfo = firebaseSync.getWorkspaceInfo();

  // Generate numeric token and QR with selected expiration and custom slug
  const generateTokenAndQR = async (minutes = expiryMinutes, slug = customSlug) => {
    if (!workspaceInfo.workspaceId) return;
    setIsGenerating(true);
    try {
      const { code, expiresAt, isPermanent: perm } = await firebaseSync.generateTemporaryLinkCode(minutes);
      setTempCode(code);
      setTempExpiry(expiresAt);
      setIsPermanent(perm);

      const baseUrl = window.location.origin + window.location.pathname;
      const cleanSlug = slug.trim().replace(/\s+/g, '-');
      const targetUrl = `${baseUrl}#/?w=${encodeURIComponent(workspaceInfo.workspaceId)}&code=${encodeURIComponent(code)}${cleanSlug ? `&slug=${encodeURIComponent(cleanSlug)}` : ''}`;
      setAppUrl(targetUrl);

      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0284c7',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.warn('Failed to generate temp token, fallback to permanent joinCode:', e);
      const baseUrl = window.location.origin + window.location.pathname;
      const fallbackCode = workspaceInfo.joinCode || '000000';
      const cleanSlug = slug.trim().replace(/\s+/g, '-');
      const targetUrl = `${baseUrl}#/?w=${encodeURIComponent(workspaceInfo.workspaceId || '')}&code=${encodeURIComponent(fallbackCode)}${cleanSlug ? `&slug=${encodeURIComponent(cleanSlug)}` : ''}`;
      setAppUrl(targetUrl);
      setTempCode(fallbackCode);
      setIsPermanent(true);
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0284c7',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && workspaceInfo.workspaceId) {
      generateTokenAndQR(expiryMinutes, customSlug);
    }
  }, [isOpen, workspaceInfo.workspaceId]);

  // Countdown timer for expiration
  useEffect(() => {
    if (!tempExpiry || isPermanent) {
      setTimeLeft('دائم (بدون انتهاء)');
      return;
    }
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((tempExpiry - Date.now()) / 1000));
      const mins = String(Math.floor(diff / 60)).padStart(2, '0');
      const secs = String(diff % 60).padStart(2, '0');
      setTimeLeft(`${mins}:${secs}`);
      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tempExpiry, isPermanent]);

  useEffect(() => {
    if (selectedProductBarcode) {
      QRCode.toDataURL(selectedProductBarcode, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(setProductQrUrl)
        .catch(console.error);
    }
  }, [selectedProductBarcode]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyText = (text: string, type: 'pid' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'pid') {
      setCopiedPid(true);
      setTimeout(() => setCopiedPid(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-sky-600 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            <h3 className="font-bold text-base">ربط جهاز جديد ومزامنة حية 📱</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={() => setMode('app_link')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              mode === 'app_link'
                ? 'border-b-2 border-sky-600 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>ربط هاتف / جهاز كاشير آخر</span>
          </button>
          <button
            onClick={() => setMode('product_barcode')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              mode === 'product_barcode'
                ? 'border-b-2 border-sky-600 text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>توليد باركود للأدوية والرفوف</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'app_link' ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                امسح هذا الرمز بواسطة كاميرا أي هاتف ذكي أو تابلت للدخول فوراً والربط التلقائي بمساحة العمل الحالية:
              </p>

              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-3xl shadow-md border-2 border-sky-100 dark:border-sky-950 inline-block relative">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="App Link QR Code" className="w-56 h-56 sm:w-60 sm:h-60 object-contain" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                    جاري توليد رمز الربط...
                  </div>
                )}
              </div>

              {/* Link Expiry & Custom Slug Controls */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-right space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      مدة صلاحية الرابط والرمز:
                    </label>
                    <select
                      value={expiryMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setExpiryMinutes(val);
                        generateTokenAndQR(val, customSlug);
                      }}
                      className="w-full p-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    >
                      <option value={5}>5 دقائق (للاستخدام الفوري)</option>
                      <option value={15}>15 دقيقة</option>
                      <option value={60}>ساعة واحدة</option>
                      <option value={1440}>24 ساعة (يوم كامل)</option>
                      <option value={0}>دائم / بدون انتهاء (أبداً)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ملحق الرابط (خاص بالصيدلية):
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        placeholder="اسم الصيدلية بالرابط"
                        className="flex-1 p-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => generateTokenAndQR(expiryMinutes, customSlug)}
                        className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all"
                        title="تحديث الرابط"
                      >
                        تطبيق
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5 inline animate-pulse" />
                    <span>حالة الصلاحية: {timeLeft}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => generateTokenAndQR(expiryMinutes, customSlug)}
                    disabled={isGenerating}
                    className="text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>توليد رمز رقمي جديد</span>
                  </button>
                </div>
              </div>

              {/* Credentials for manual entry */}
              {workspaceInfo.workspaceId && (
                <div className="w-full grid grid-cols-2 gap-2 text-right">
                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block font-bold">معرّف مساحة العمل (Workspace ID):</span>
                    <div className="flex items-center justify-between font-mono text-xs font-bold text-sky-600 mt-0.5">
                      <span>{workspaceInfo.workspaceId}</span>
                      <button
                        onClick={() => handleCopyText(workspaceInfo.workspaceId!, 'pid')}
                        className="text-slate-400 hover:text-sky-600 p-1"
                        title="نسخ"
                      >
                        {copiedPid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block font-bold">رمز الربط (Link Token):</span>
                    <div className="flex items-center justify-between font-mono text-xs font-black tracking-wider text-emerald-600 mt-0.5">
                      <span>{tempCode || workspaceInfo.joinCode}</span>
                      <button
                        onClick={() => handleCopyText(tempCode || workspaceInfo.joinCode!, 'code')}
                        className="text-slate-400 hover:text-emerald-600 p-1"
                        title="نسخ"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* URL Display and Copy */}
              <div className="w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl p-2 border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="flex-1 bg-transparent text-xs font-mono text-slate-700 dark:text-slate-200 outline-none px-2 text-left truncate"
                  dir="ltr"
                />
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedUrl ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                </button>
              </div>

              {/* Instructions */}
              <div className="w-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-2xl p-3 text-right space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>كيف يعمل الربط اللحظي؟</span>
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
                  <li>وجّه كاميرا الهاتف المساعد نحو شاشة الكاشير لمسح الباركود أعلاه.</li>
                  <li>ينضم الجهاز تلقائياً للمساحة ويبدأ مزامنة الأصناف والمبيعات مباشرة بدون Google.</li>
                  <li>يمكنك إدارة وإلغاء الأجهزة من قسم "الأجهزة المرتبطة" في الإعدادات.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                اختر صنفاً أو اكتب الباركود لتوليد ملصق QR للطباعة:
              </label>

              <div className="space-y-2">
                <select
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  onChange={(e) => setSelectedProductBarcode(e.target.value)}
                  value={selectedProductBarcode}
                >
                  <option value="">-- اختر من قائمة الأدوية المسجلة --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.barcode}>
                      {p.nameAr} - {p.barcode}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="أو اكتب أي رقم باركود يدوياً..."
                  value={selectedProductBarcode}
                  onChange={(e) => setSelectedProductBarcode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-xs bg-slate-50 dark:bg-slate-800 font-mono text-center text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              {productQrUrl && (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="p-3 bg-white rounded-xl shadow-xs border">
                    <img src={productQrUrl} alt="Product Barcode QR" className="w-44 h-44 object-contain" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                    {selectedProductBarcode}
                  </span>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `barcode-${selectedProductBarcode}.png`;
                      link.href = productQrUrl;
                      link.click();
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    تحميل ملصق الباركود (PNG) للطباعة
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
