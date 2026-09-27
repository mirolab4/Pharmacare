import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { firebaseSync, SyncStatus } from '../services/firebaseSync';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [showSyncedToast, setShowSyncedToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowSyncedToast(true);
      setTimeout(() => setShowSyncedToast(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = firebaseSync.onStatusChange((status, count) => {
      setSyncStatus(status);
      setPendingCount(count);
      if (status === 'synced' && count === 0) {
        setShowSyncedToast(true);
        setTimeout(() => setShowSyncedToast(false), 2500);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-20 sm:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 backdrop-blur-xs px-3.5 py-2 text-xs font-semibold text-white shadow-xl animate-bounce" dir="rtl">
        <WifiOff className="w-4 h-4 text-amber-200" />
        <span>
          وضع عدم الاتصال — الحفظ يعمل محلياً {pendingCount > 0 ? `(${pendingCount} عملية بانتظار المزامنة)` : ''} وسيتم الرفع فور توفر النت بدون أي تكرار
        </span>
      </div>
    );
  }

  if (syncStatus === 'syncing' && pendingCount > 0) {
    return (
      <div className="fixed bottom-20 sm:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-sky-600/95 backdrop-blur-xs px-3.5 py-2 text-xs font-semibold text-white shadow-xl" dir="rtl">
        <RefreshCw className="w-4 h-4 text-sky-200 animate-spin" />
        <span>جاري مزامنة {pendingCount} عملية مع السحابة وFirestore...</span>
      </div>
    );
  }

  if (showSyncedToast) {
    return (
      <div className="fixed bottom-20 sm:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600/95 backdrop-blur-xs px-3.5 py-2 text-xs font-semibold text-white shadow-xl transition-all" dir="rtl">
        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
        <span>تمت المزامنة السحابية بنجاح 🟢</span>
      </div>
    );
  }

  return null;
};
