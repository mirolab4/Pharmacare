import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, QrCode, Monitor, Share2, Info } from 'lucide-react';
import { Product } from '../types/pharmacy';

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
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'app_link' | 'product_barcode'>('app_link');
  const [selectedProductBarcode, setSelectedProductBarcode] = useState<string>('');
  const [productQrUrl, setProductQrUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      setAppUrl(url);
      QRCode.toDataURL(url, {
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
  }, [isOpen]);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-sky-600 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            <h3 className="font-bold text-base">صانع الباركود وربط الأجهزة المتعددة 📱</h3>
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
                امسح هذا الرمز بواسطة كاميرا أي هاتف ذكي أو تابلت للدخول فوراً والعمل على نفس الصيدلية سحابياً ومحلياً:
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
                  onClick={handleCopy}
                  className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
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
                  <li>تتزامن البيانات سحابياً تلقائياً عبر Firestore مع دعم كامل لعدم وجود إنترنت ومنع تكرار الفواتير.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                اختر صنفاً أو اكتب الباركود لتوليد ملصق QR للطباعة:
              </label>

              <select
                value={selectedProductBarcode}
                onChange={(e) => setSelectedProductBarcode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 p-2.5 text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="">-- اختر صنفاً من المخزون --</option>
                {products.map(p => (
                  <option key={p.id} value={p.barcode}>
                    {p.nameAr} - باركود: {p.barcode}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="أو اكتب باركود يدوي هنا..."
                  value={selectedProductBarcode}
                  onChange={(e) => setSelectedProductBarcode(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 p-2 text-xs"
                />
              </div>

              {selectedProductBarcode && (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                  {productQrUrl ? (
                    <img src={productQrUrl} alt="Product Barcode QR" className="w-48 h-48 object-contain bg-white p-2 rounded-xl shadow-xs" />
                  ) : null}
                  <span className="mt-2 font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                    {selectedProductBarcode}
                  </span>
                  <button
                    onClick={() => {
                      const printWin = window.open('', '', 'width=400,height=400');
                      if (printWin) {
                        printWin.document.write(`
                          <html dir="rtl">
                            <head><title>طباعة باركود الصنف</title></head>
                            <body style="text-align:center;font-family:sans-serif;padding:20px;">
                              <h3>ملصق باركود صيدلية</h3>
                              <img src="${productQrUrl}" style="width:180px;height:180px;" />
                              <p style="font-family:monospace;font-size:16px;font-weight:bold;">${selectedProductBarcode}</p>
                              <script>window.onload = function() { window.print(); window.close(); }</script>
                            </body>
                          </html>
                        `);
                        printWin.document.close();
                      }
                    }}
                    className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <span>طباعة ملصق الباركود للرف 🏷️</span>
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
