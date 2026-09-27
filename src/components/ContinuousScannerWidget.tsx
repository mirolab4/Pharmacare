import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Volume2, VolumeX, Minimize2, Maximize2, Check, RefreshCw, X } from 'lucide-react';
import { sounds } from '../utils/audio';

interface ContinuousScannerWidgetProps {
  isActive: boolean;
  onToggleActive: (active: boolean) => void;
  onBarcodeDetected: (barcode: string) => void;
  soundEnabled?: boolean;
}

export const ContinuousScannerWidget: React.FC<ContinuousScannerWidgetProps> = ({
  isActive,
  onToggleActive,
  onBarcodeDetected,
  soundEnabled = true,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'continuous-barcode-camera-view';
  const lastCodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef<number>(0);

  // تحديث المراجع المتزامنة
  useEffect(() => {
    lastCodeRef.current = lastScannedCode;
    lastTimeRef.current = lastScanTime;
  }, [lastScannedCode, lastScanTime]);

  // إيقاف الماسح
  const stopScannerInstance = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping background scanner:', err);
      }
      scannerRef.current = null;
      setIsScannerRunning(false);
    }

    // إيقاف مسارات الكاميرا في الهاردوير لإطفاء ضوء الكاميرا تماماً
    try {
      const container = document.getElementById(containerId);
      if (container) {
        const videos = container.querySelectorAll('video');
        videos.forEach(v => {
          if (v.srcObject && 'getTracks' in (v.srcObject as MediaStream)) {
            (v.srcObject as MediaStream).getTracks().forEach(track => {
              track.stop();
            });
            v.srcObject = null;
          }
        });
      }
    } catch (e) {
      console.warn('Hardware track release error:', e);
    }
  }, []);

  // تشغيل الماسح بكاميرا محددة
  const startScannerInstance = useCallback(async (camId: string) => {
    try {
      setCameraError(null);
      await stopScannerInstance();

      // التأكد من وجود العنصر في DOM
      const element = document.getElementById(containerId);
      if (!element) {
        setTimeout(() => startScannerInstance(camId), 200);
        return;
      }

      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        camId,
        {
          fps: 15,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.33,
        },
        (decodedText) => {
          const now = Date.now();
          const cleanText = decodedText.trim();
          
          // حماية من التكرار المفرط: إذا كان نفس الكود يجب الانتظار 1.4 ثانية، إذا كان كود مختلف 0.6 ثانية
          if (cleanText === lastCodeRef.current && now - lastTimeRef.current < 1400) {
            return;
          }
          if (now - lastTimeRef.current < 600) {
            return;
          }

          // تسجيل الكود
          lastCodeRef.current = cleanText;
          lastTimeRef.current = now;
          setLastScannedCode(cleanText);
          setLastScanTime(now);

          // صوت نجاح المسح
          if (soundEnabled) {
            sounds.playScanBeep();
          }

          // تأثير وميض أخضر
          setFlashSuccess(true);
          setTimeout(() => setFlashSuccess(false), 800);

          // بث الحدث العام لأي حقل إدخال نشط أو واجهة مفتوحة
          onBarcodeDetected(cleanText);

          // إرسال حدث مخصص للمتصفح لدعم أي نافذة منبثقة أو حقل إدخال
          window.dispatchEvent(
            new CustomEvent('pharmacy:barcode-scanned', {
              detail: { barcode: cleanText },
            })
          );

          // إذا كان هناك حقل إدخال محدد حالياً (Focused Input)، ضع الباركود فيه تلقائياً
          const activeElem = document.activeElement;
          if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
            const input = activeElem as HTMLInputElement;
            // التحقق من نوع الحقل
            if (input.type === 'text' || input.type === 'search' || !input.type) {
              input.value = cleanText;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        },
        () => {
          // تجاهل الإطارات الفارغة
        }
      );

      setIsScannerRunning(true);
    } catch (err: unknown) {
      console.error('فشل تشغيل ماسح الكاميرا في الخلفية:', err);
      setCameraError('تعذر فتح الكاميرا، يرجى منح الإذن');
      setIsScannerRunning(false);
    }
  }, [onBarcodeDetected, soundEnabled, stopScannerInstance]);

  // إدارة تفعيل وإيقاف الكاميرا
  useEffect(() => {
    if (!isActive) {
      stopScannerInstance();
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('خلفية') ||
              d.label.toLowerCase().includes('environment')
          );
          const preferredCamId = backCam ? backCam.id : devices[devices.length - 1].id;
          setSelectedCameraId(preferredCamId);
          startScannerInstance(preferredCamId);
        } else {
          setCameraError('لم يتم العثور على كاميرا في هذا الجهاز');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Camera detection error:', err);
        setCameraError('يرجى السماح للتطبيق باستخدام الكاميرا');
      });

    return () => {
      isMounted = false;
      stopScannerInstance();
    };
  }, [isActive, startScannerInstance, stopScannerInstance]);

  // تبديل الكاميرا
  const handleSwitchCamera = (newCamId: string) => {
    setSelectedCameraId(newCamId);
    if (isActive) {
      startScannerInstance(newCamId);
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={`fixed z-50 transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900/95 backdrop-blur-md text-white ${
        isMinimized
          ? 'bottom-20 sm:bottom-4 left-3 right-3 sm:right-auto sm:left-4 sm:w-72 h-14'
          : 'bottom-20 sm:bottom-4 left-3 right-3 sm:right-auto sm:left-4 sm:w-80 md:w-96 max-h-[75vh] overflow-y-auto'
      }`}
      style={{ direction: 'rtl' }}
    >
      {/* شريط التحكم بالماسح العائم */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-700 to-teal-800 text-white select-none">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
          </span>
          <span className="text-xs font-bold flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" />
            الماسح المستمر شغال
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded-md transition-colors text-white"
            title={isMinimized ? 'توسيع نافذة الكاميرا' : 'تصغير'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onToggleActive(false)}
            className="p-1 hover:bg-rose-600 rounded-md transition-colors text-white"
            title="إيقاف الماسح المستمر"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* الحالة المصغرة */}
      {isMinimized ? (
        <div className="px-3 py-2 flex items-center justify-between text-xs">
          <div className="truncate flex-1">
            {lastScannedCode ? (
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                آخر باركود: {lastScannedCode}
              </span>
            ) : (
              <span className="text-slate-400">في انتظار توجيه علبة الدواء...</span>
            )}
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="text-[11px] text-teal-300 hover:underline mr-2"
          >
            عرض
          </button>
        </div>
      ) : (
        /* الحالة الموسعة */
        <div className="p-3 space-y-2.5">
          {/* حاوية كاميرا الفيديو */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-slate-700">
            {/* عنصر تغذية الكاميرا */}
            <div id={containerId} className="w-full h-full object-cover"></div>

            {/* خط ليزر وهمي متحرك ليوحي بعملية المسح */}
            {isScannerRunning && !flashSuccess && (
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse pointer-events-none top-1/2 -translate-y-1/2"></div>
            )}

            {/* وميض النجاح عند التقاط الباركود */}
            {flashSuccess && (
              <div className="absolute inset-0 bg-emerald-500/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white font-bold transition-all z-20 pointer-events-none">
                <div className="bg-emerald-600 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-emerald-300">
                  <Check className="w-4 h-4 text-white" />
                  <span>تم المسح بنجاح!</span>
                </div>
                <span className="text-sm font-mono mt-1 drop-shadow">{lastScannedCode}</span>
              </div>
            )}

            {/* تنبيه الخطأ إن وجد */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center text-rose-300 text-xs">
                <p>{cameraError}</p>
                <button
                  onClick={() => selectedCameraId && startScannerInstance(selectedCameraId)}
                  className="mt-2 px-3 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded-lg flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  إعادة المحاولة
                </button>
              </div>
            )}
          </div>

          {/* تبديل الكاميرا إن وُجد أكثر من واحدة */}
          {cameras.length > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="text-slate-400">الكاميرا:</span>
              <select
                value={selectedCameraId}
                onChange={(e) => handleSwitchCamera(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white max-w-[200px] truncate outline-none"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `كاميرا ${c.id.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* شريط الإشعار بآخر باركود ملتقط */}
          <div className="bg-slate-800/80 rounded-xl p-2 flex items-center justify-between text-xs border border-slate-700/60">
            <span className="text-slate-400">آخر كود مسح:</span>
            {lastScannedCode ? (
              <span className="font-mono font-bold text-emerald-400 tracking-wider">
                {lastScannedCode}
              </span>
            ) : (
              <span className="text-slate-500 italic">وجّه الكاميرا للباركود</span>
            )}
          </div>

          {/* إرشادات سريعة للصيدلي */}
          <div className="text-[11px] text-slate-400 bg-teal-950/40 border border-teal-900/40 rounded-lg p-2 leading-relaxed">
            💡 <strong className="text-teal-300">ملاحظة ذكية:</strong> في الكاشير يُضاف الصنف فورياً للفاتورة، وفي النوافذ الأخرى يوضع الباركود في الحقل المفتوح تلقائياً.
          </div>
        </div>
      )}
    </div>
  );
};
