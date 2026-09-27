import React, { useState, useEffect } from 'react';
import { Settings, Customer } from '../types/pharmacy';
import { ShoppingBag, Sparkles, HeartPulse, CheckCircle2, ShieldCheck, QrCode } from 'lucide-react';

export interface CustomerDisplayCartItem {
  productId: string;
  productName: string;
  unitName: string;
  quantity: number;
  salePrice: number;
  total: number;
}

export interface CustomerDisplayData {
  items: CustomerDisplayCartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  customerName?: string;
  isPaid?: boolean;
}

interface CustomerDisplayViewProps {
  settings: Settings;
  onClose?: () => void;
}

export const CustomerDisplayView: React.FC<CustomerDisplayViewProps> = ({
  settings,
  onClose,
}) => {
  const [data, setData] = useState<CustomerDisplayData>({
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,
    paidAmount: 0,
    remainingAmount: 0,
  });

  const [activeAdviceIndex, setActiveAdviceIndex] = useState(0);

  const healthAdvices = [
    'احرص دائماً على إنهاء كورس المضاد الحيوي كاملاً حتى لو شعرت بالتحسن.',
    'تناول كميات كافية من الماء يومياً يحافظ على نشاط الكلى وصحة البشرة.',
    'لا تتردد في استشارة الصيدلي حول التفاعلات الدوائية بين علاجاتك المختلفة.',
    'احفظ الأدوية بعيداً عن الرطوبة وأشعة الشمس المباشرة وفي متناول الأطفال.',
  ];

  useEffect(() => {
    // Health tips rotation
    const timer = setInterval(() => {
      setActiveAdviceIndex(prev => (prev + 1) % healthAdvices.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 1. Check local storage initial state
    try {
      const stored = localStorage.getItem('pharmacare_customer_cart');
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch {}

    // 2. Listen to BroadcastChannel for real-time instant dual screen updates
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('pharmacare_customer_display');
      channel.onmessage = (event) => {
        if (event.data) {
          setData(event.data);
        }
      };
      return () => {
        channel.close();
      };
    } else {
      // Fallback: storage event
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'pharmacare_customer_cart' && e.newValue) {
          setData(JSON.parse(e.newValue));
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
  }, []);

  const hasItems = data.items && data.items.length > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col p-4 sm:p-8 select-none" dir="rtl">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <HeartPulse className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {settings.pharmacyName || 'صيدلية الأمل المركزية'}
            </h1>
            <p className="text-xs sm:text-sm text-teal-400 font-medium">
              شاشة الزبون التفاعلية • مرحباً بكم
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-300"
          >
            إغلاق شاشة العرض
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 overflow-hidden">
        {/* Left/Middle Column: Scanned Cart Items (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-slate-800/60 rounded-3xl border border-slate-700/60 p-6 overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-base">
              <ShoppingBag className="h-5 w-5" />
              <span>مشترياتك الحالية ({data.items?.length || 0})</span>
            </div>
            {data.customerName && (
              <span className="text-xs bg-sky-950 text-sky-300 px-3 py-1 rounded-full border border-sky-800 font-bold">
                العميل: {data.customerName}
              </span>
            )}
          </div>

          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            {!hasItems ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                  <ShoppingBag className="h-10 w-10 text-slate-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-300">في انتظار بدء الفاتورة...</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    عند تمرير الدواء أو الصنف عند الكاشير ستظهر أسماء الأصناف وأسعارها هنا مباشرة.
                  </p>
                </div>
                {/* Health Advice Carousel */}
                <div className="mt-8 p-4 bg-teal-950/40 border border-teal-800/40 rounded-2xl max-w-md text-teal-300 text-xs text-center flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-teal-400" />
                  <span>💡 {healthAdvices[activeAdviceIndex]}</span>
                </div>
              </div>
            ) : (
              data.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700/50 hover:border-sky-500/50 transition-all text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-full bg-sky-950 border border-sky-800 text-sky-300 flex items-center justify-center text-xs font-bold font-mono">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-white text-sm">{item.productName}</div>
                      <div className="text-xs text-slate-400">
                        {item.quantity} × {item.salePrice} {settings.currency} ({item.unitName})
                      </div>
                    </div>
                  </div>

                  <div className="text-left font-mono font-bold text-base text-emerald-400" dir="ltr">
                    {item.total.toFixed(2)} {settings.currency}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Totals & Receipt Summary (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-gradient-to-b from-slate-800/80 to-slate-800/40 rounded-3xl border border-slate-700/60 p-6 space-y-6">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-300 pb-2 border-b border-slate-700">
              ملخص الحساب
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span>المجموع الفرعي:</span>
                <span className="font-mono text-white font-bold">{data.subtotal.toFixed(2)} {settings.currency}</span>
              </div>

              {data.discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>الخصم الممنوح:</span>
                  <span className="font-mono font-bold">-{data.discountAmount.toFixed(2)} {settings.currency}</span>
                </div>
              )}

              {data.taxAmount > 0 && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>ضريبة القيمة المضافة:</span>
                  <span className="font-mono text-white">+{data.taxAmount.toFixed(2)} {settings.currency}</span>
                </div>
              )}
            </div>

            {/* Giant Total Box */}
            <div className="p-5 bg-gradient-to-r from-teal-600 to-sky-600 rounded-2xl shadow-xl text-center space-y-1">
              <span className="text-xs uppercase tracking-wider text-teal-100 font-bold">المطلوب للدفع</span>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white" dir="ltr">
                {data.total.toFixed(2)} {settings.currency}
              </div>
            </div>

            {data.paidAmount > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-700 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>المدفوع:</span>
                  <span className="font-mono font-bold text-white">{data.paidAmount.toFixed(2)} {settings.currency}</span>
                </div>
                {data.remainingAmount > 0 && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>المتبقي (آجل):</span>
                    <span className="font-mono">{data.remainingAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer message / QR for digital receipt */}
          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs text-teal-400 font-bold">
              <ShieldCheck className="h-4 w-4" />
              <span>{settings.receiptFooter || 'طهور إن شاء الله.. مع تمنياتنا لكم بالشفاء العاجل'}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {settings.address} • {settings.phone}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
