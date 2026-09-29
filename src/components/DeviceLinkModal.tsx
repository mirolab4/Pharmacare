import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, QrCode, Info, KeyRound } from 'lucide-react';
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
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPid, setCopiedPid] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [mode, setMode] = useState<'app_link' | 'product_barcode'>('app_link');
  const [selectedProductBarcode, setSelectedProductBarcode] = useState<string>('');
  const [productQrUrl, setProductQrUrl] = useState<string>('');

  const pharmacyInfo = firebaseSync.getPharmacyInfo();

  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      const baseUrl = window.location.origin + window.location.pathname;
      let targetUrl = baseUrl;
      if (pharmacyInfo.pharmacyId && pharmacyInfo.joinCode) {
        targetUrl = `${baseUrl}#/?pid=${encodeURIComponent(pharmacyInfo.pharmacyId)}&code=${encodeURIComponent(pharmacyInfo.joinCode)}`;
      }
      setAppUrl(targetUrl);

      QRCode.toDataURL(targetUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0284c7', // sky-600
          light: '#ffffff',
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [isOpen, pharmacyInfo.pharmacyId, pharmacyInfo.joinCode]);

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
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-sky-600 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            <h3 className="font-bold text-base">ربط الأجهزة المتعددة وصانع الباركود 📱</h3>
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
                امسح هذا الرمز بواسطة كاميرا أي هاتف ذكي أو تابلت للدخول فوراً والربط بالصيدلية سحابياً ومحلياً:
              </p>

              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-sky-100 dark:border-sky-950 inline-block">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="App Link QR Code" className="w-56 h-56 sm:w-64 sm:h-64 object-contain" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                    جاري توليد الرمز...
                  </div>
                )}
              </div>

              {/* Credentials for manual entry */}
              {pharmacyInfo.pharmacyId && pharmacyInfo.joinCode && (
                <div className="w-full grid grid-cols-2 gap-2 text-right">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block font-bold">معرّف الصيدلية:</span>
                    <div className="flex items-center justify-between font-mono text-xs font-bold text-sky-600 mt-0.5">
                      <span>{pharmacyInfo.pharmacyId}</span>
                      <button
                        onClick={() => handleCopyText(pharmacyInfo.pharmacyId!, 'pid')}
                        className="text-slate-400 hover:text-sky-600"
                        title="نسخ"
                      >
                        {copiedPid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block font-bold">رمز الانضمام:</span>
                    <div className="flex items-center justify-between font-mono text-xs font-black tracking-wider text-emerald-600 mt-0.5">
                      <span>{pharmacyInfo.joinCode}</span>
                      <button
                        onClick={() => handleCopyText(pharmacyInfo.joinCode!, 'code')}
                        className="text-slate-400 hover:text-emerald-600"
                        title="نسخ"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* URL Display and Copy */}
              <div className="w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="flex-1 bg-transparent text-xs font-mono text-slate-700 dark:text-slate-200 outline-none px-2 text-left"
                  dir="ltr"
                />
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0"
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedUrl ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                </button>
              </div>

              {/* Instructions */}
              <div className="w-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-xl p-3 text-right space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>كيف يعمل الربط المتعدد؟</span>
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
                  <li>وجّه كاميرا الهاتف المساعد نحو شاشة الكاشير لمسح الباركود أعلاه.</li>
                  <li>يفتح التطبيق مباشرة في متصفح الهاتف مع إمكانية تثبيته (PWA).</li>
                  <li>تتزامن البيانات سحابياً تلقائياً عبر Firestore مع دعم كامل لعدم وجود إنترنت.</li>
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
