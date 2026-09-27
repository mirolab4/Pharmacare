import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  CameraOff, 
  Check, 
  AlertTriangle, 
  Plus, 
  Minus, 
  Save, 
  RefreshCw, 
  PackageCheck, 
  ScanLine 
} from 'lucide-react';
import { Product, StockMovement } from '../types/pharmacy';
import { sounds } from '../utils/audio';
import { pharmacyStorage } from '../services/storage';

interface AuditItem {
  product: Product;
  systemStock: number;
  actualStock: number;
  difference: number;
  lastScannedAt: number;
}

interface QuickStockAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onCompleteAudit: () => void;
}

export const QuickStockAuditModal: React.FC<QuickStockAuditModalProps> = ({
  isOpen,
  onClose,
  products,
  onCompleteAudit,
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [auditedItems, setAuditedItems] = useState<Record<string, AuditItem>>({});
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'quick-audit-camera-viewport';
  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping audit camera:', err);
      }
      html5QrCodeRef.current = null;
    }
    // Explicitly release any open video stream tracks
    if (navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
        if (stream) stream.getTracks().forEach(t => t.stop());
      } catch {}
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      await stopCamera();

      const element = document.getElementById(containerId);
      if (!element) {
        setTimeout(startCamera, 150);
        return;
      }

      const qrScanner = new Html5Qrcode(containerId);
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 240, height: 160 },
          aspectRatio: 1.33,
        },
        (decodedText) => {
          const now = Date.now();
          const clean = decodedText.trim();
          if (clean === lastCodeRef.current && now - lastTimeRef.current < 1500) {
            return;
          }
          lastCodeRef.current = clean;
          lastTimeRef.current = now;

          handleBarcodeFound(clean);
        },
        () => {}
      );

      setIsCameraActive(true);
    } catch (err) {
      console.error('Audit camera start error:', err);
      setCameraError('يرجى السماح بالوصول للكاميرا للجرد السريع');
      setIsCameraActive(false);
    }
  };

  const toggleCamera = () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const handleBarcodeFound = (barcode: string) => {
    const raw = barcode.trim().toLowerCase();
    const cleanNumeric = barcode.trim().replace(/^0+/, '');

    // Search product
    const match = products.find(p => {
      const pCode = (p.barcode || '').trim().toLowerCase();
      const pClean = pCode.replace(/^0+/, '');
      return pCode === raw || (cleanNumeric.length > 0 && pClean === cleanNumeric);
    });

    if (match) {
      sounds.playScanBeep();
      setLastScannedProduct(match);
      setScanMessage(`تم جرد: ${match.nameAr}`);
      setTimeout(() => setScanMessage(null), 2500);

      setAuditedItems(prev => {
        const existing = prev[match.id];
        const newActual = existing ? existing.actualStock + 1 : match.stock + 1;
        return {
          ...prev,
          [match.id]: {
            product: match,
            systemStock: match.stock,
            actualStock: newActual,
            difference: newActual - match.stock,
            lastScannedAt: Date.now(),
          },
        };
      });
    } else {
      sounds.playWarning();
      setScanMessage(`الصنف (${barcode}) غير موجود في النظام`);
      setTimeout(() => setScanMessage(null), 3000);
    }
  };

  const handleAdjustCount = (productId: string, delta: number) => {
    setAuditedItems(prev => {
      const item = prev[productId];
      if (!item) return prev;
      const newActual = Math.max(0, item.actualStock + delta);
      return {
        ...prev,
        [productId]: {
          ...item,
          actualStock: newActual,
          difference: newActual - item.systemStock,
        },
      };
    });
  };

  const handleApplyAudit = async () => {
    const list = Object.values(auditedItems);
    if (list.length === 0) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();

      list.forEach(({ product, actualStock, difference }) => {
        if (difference !== 0) {
          // Update product stock in storage
          const updatedProd = {
            ...product,
            stock: actualStock,
            updatedAt: now,
          };
          pharmacyStorage.saveProduct(updatedProd);
        }
      });

      sounds.playCashSuccess();
      await stopCamera();
      onCompleteAudit();
      onClose();
    } catch (err) {
      console.error('Audit apply error:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Start camera automatically on mobile opening
      setTimeout(() => {
        startCamera();
      }, 200);
    } else {
      stopCamera();
      setAuditedItems({});
      setLastScannedProduct(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const itemsList = Object.values(auditedItems).sort((a, b) => b.lastScannedAt - a.lastScannedAt);
  const totalAudited = itemsList.length;
  const netDifference = itemsList.reduce((sum, item) => sum + item.difference, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shrink-0">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            <h3 className="font-bold text-sm sm:text-base">الجرد السريع للمخزون عبر كاميرا الهاتف 📦📷</h3>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera and Quick Scan Area */}
        <div className="p-3 sm:p-4 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Camera Viewport */}
            <div className="relative w-full sm:w-64 h-44 bg-black rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0">
              <div id={containerId} className="w-full h-full object-cover"></div>

              {isCameraActive && (
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse pointer-events-none top-1/2 -translate-y-1/2"></div>
              )}

              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-1 bg-slate-900/90">
                  <CameraOff className="h-6 w-6 text-slate-500" />
                  <span>الكاميرا متوقفة</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-2 text-center text-rose-300 text-xs">
                  <span>{cameraError}</span>
                  <button
                    onClick={startCamera}
                    className="mt-2 px-2.5 py-1 bg-rose-700 rounded text-white flex items-center gap-1 text-[11px]"
                  >
                    <RefreshCw className="h-3 w-3" /> إعادة المحاولة
                  </button>
                </div>
              )}
            </div>

            {/* Controls & Quick Scan Info */}
            <div className="flex-1 w-full space-y-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleCamera}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                    isCameraActive
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isCameraActive ? (
                    <>
                      <CameraOff className="h-4 w-4" />
                      <span>إيقاف الكاميرا ⏹️</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      <span>تشغيل الكاميرا ▶️</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span>المعدود: <strong className="text-emerald-600">{totalAudited}</strong> أصناف</span>
                  <span>الفرق: <strong className={netDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{netDifference >= 0 ? `+${netDifference}` : netDifference}</strong></span>
                </div>
              </div>

              {/* Status Toast */}
              {scanMessage && (
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
                  <ScanLine className="h-4 w-4 text-emerald-600" />
                  <span>{scanMessage}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                💡 وجّه الكاميرا نحو علبة الدواء، كل مسحة تزيد الكمية الفعلية تلقائياً بمقدار 1، ويمكنك التعديل يدوياً بالأزرار بالأسفل.
              </p>
            </div>
          </div>
        </div>

        {/* Audited Items Table / List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {itemsList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs sm:text-sm">
              لم يتم مسح أي صنف بعد. وجّه الكاميرا نحو باركود الأدوية لبدء الجرد.
            </div>
          ) : (
            <div className="space-y-2">
              {itemsList.map(({ product, systemStock, actualStock, difference }) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-2xs gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {product.nameAr}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      باركود: {product.barcode}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <span className="block text-[10px] text-slate-400">النظام</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{systemStock}</span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-1">
                      <button
                        onClick={() => handleAdjustCount(product.id, -1)}
                        className="p-1 rounded bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                        title="إنقاص 1"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {actualStock}
                      </span>
                      <button
                        onClick={() => handleAdjustCount(product.id, 1)}
                        className="p-1 rounded bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                        title="زيادة 1"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-center min-w-[45px]">
                      <span className="block text-[10px] text-slate-400">الفارق</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        difference === 0 
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' 
                          : difference > 0 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {difference > 0 ? `+${difference}` : difference}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            إلغاء
          </button>

          <button
            onClick={handleApplyAudit}
            disabled={itemsList.length === 0 || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'جاري الاعتماد...' : `اعتماد فروقات الجرد (${itemsList.length} صنف)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
