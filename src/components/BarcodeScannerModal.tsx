import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle, Zap, ShieldCheck } from 'lucide-react';
import { sounds } from '../utils/audio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPermissionRequested, setIsPermissionRequested] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-reader-viewport';

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      html5QrCodeRef.current = null;
      setIsScanning(false);
      setIsTorchOn(false);
    }

    // إيقاف مسارات الفيديو بالهاردوير لإطفاء ضوء الكاميرا فوراً
    try {
      const container = document.getElementById(scannerContainerId);
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

  const startScanner = useCallback(async (cameraIdOrConfig?: string | MediaTrackConstraints) => {
    try {
      setErrorMsg(null);
      await stopScanner();

      // Ensure container element is mounted
      const container = document.getElementById(scannerContainerId);
      if (!container) {
        setTimeout(() => startScanner(cameraIdOrConfig), 150);
        return;
      }

      const scanner = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = scanner;

      // Prefer environment facingMode (rear camera) or specified camera
      const cameraConfig = cameraIdOrConfig || { facingMode: 'environment' };

      await scanner.start(
        cameraConfig,
        {
          fps: 20,
          qrbox: (viewWidth, viewHeight) => {
            const width = Math.min(Math.floor(viewWidth * 0.85), 320);
            const height = Math.min(Math.floor(viewHeight * 0.65), 200);
            return { width, height };
          },
          aspectRatio: 1.333,
        },
        (decodedText) => {
          sounds.playScanBeep();
          onScan(decodedText.trim());
          stopScanner();
          onClose();
        },
        () => {
          // Frame missed, keep scanning smoothly
        }
      );

      setIsScanning(true);
      setIsPermissionRequested(true);

      // Check flashlight support
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }

      // Check available cameras to allow switching
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      } catch {
        // non-fatal
      }
    } catch (err: unknown) {
      console.error('Camera initialization failed:', err);
      const errorStr = String(err);
      
      if (errorStr.includes('NotAllowedError') || errorStr.includes('Permission')) {
        setErrorMsg('تم رفض إذن الكاميرا. يرجى الضغط على زر "طلب إذن الكاميرا" أدناه أو السماح بالوصول للكاميرا من إعدادات المتصفح.');
      } else if (errorStr.includes('NotFoundError') || errorStr.includes('DevicesNotFoundError')) {
        setErrorMsg('لم يتم العثور على كاميرا في هذا الجهاز. يمكنك إدخال الباركود يدوياً.');
      } else {
        // Try fallback to device list if facingMode failed
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCam = devices.find(d => /back|rear|خلفية|environment/i.test(d.label)) || devices[0];
            setSelectedCameraId(backCam.id);
            await startScanner(backCam.id);
            return;
          }
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr);
        }
        setErrorMsg('تعذر فتح الكاميرا مباشرة. اضغط على الزر أدناه لتنشيط إذن الكاميرا.');
      }
      setIsScanning(false);
    }
  }, [onScan, onClose, stopScanner]);

  // Request explicit permission on user click
  const handleRequestPermissionAndStart = async () => {
    try {
      setErrorMsg(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        testStream.getTracks().forEach(t => t.stop());
      }
      await startScanner();
    } catch (e: unknown) {
      console.warn('Explicit getUserMedia rejected:', e);
      setErrorMsg('لم يتم منح إذن الكاميرا. يرجى تفعيل إذن الكاميرا في إعدادات المتصفح.');
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Delay slightly to ensure modal is rendered in DOM
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      sounds.playScanBeep();
      onScan(manualCode.trim());
      stopScanner();
      onClose();
      setManualCode('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-sky-600 px-4 py-3.5 text-white dark:border-slate-800 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 animate-pulse" />
            <h3 className="font-bold text-base">مسح باركود الدواء الذكي</h3>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-xl p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5">
          {errorMsg && (
            <div className="rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span className="leading-relaxed font-medium">{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={handleRequestPermissionAndStart}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-95 transition"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>طلب إذن الكاميرا وإعادة المحاولة</span>
              </button>
            </div>
          )}

          {/* Camera Viewport Container */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-950 border-2 border-dashed border-sky-400/50 min-h-[240px] flex items-center justify-center shadow-inner">
            <div id={scannerContainerId} className="w-full h-full" />
            
            {/* Overlay Scanner Laser Frame */}
            {isScanning && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative h-28 w-60 rounded-xl border-2 border-sky-400 bg-sky-500/10 shadow-[0_0_20px_rgba(56,189,248,0.5)]">
                  <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
                </div>
                <span className="mt-2 text-[11px] font-bold text-white/90 bg-black/60 px-3 py-0.5 rounded-full backdrop-blur-xs">
                  وجه الكاميرا نحو خطوط الباركود
                </span>
              </div>
            )}

            {!isScanning && !errorMsg && (
              <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
                <RefreshCw className="h-7 w-7 animate-spin text-sky-400" />
                <span className="text-xs font-medium">جاري تجهيز الكاميرا...</span>
              </div>
            )}
          </div>

          {/* Controls: Torch + Camera Switch */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {hasTorch ? (
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  isTorchOn
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{isTorchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}</span>
              </button>
            ) : <div />}

            {cameras.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[11px]">الكاميرا:</span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedCameraId(newId);
                    startScanner(newId);
                  }}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 max-w-[140px] truncate"
                >
                  {cameras.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label || `كاميرا ${c.id.slice(0, 4)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Manual Barcode entry fallback */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              أو أدخل رقم الباركود يدوياً:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="أدخل الباركود واضغط تأكيد..."
                dir="ltr"
                className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-center focus:border-sky-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="submit"
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 active:scale-95 transition"
              >
                إدخال
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
