import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Link2, 
  PlusCircle, 
  QrCode, 
  KeyRound, 
  Check, 
  Copy, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  Camera,
  X
} from 'lucide-react';
import { firebaseSync } from '../services/firebaseSync';

interface PharmacySetupModalProps {
  isOpen: boolean;
  onSuccess: (pharmacyId: string) => void;
  initialPharmacyId?: string;
  initialJoinCode?: string;
}

export const PharmacySetupModal: React.FC<PharmacySetupModalProps> = ({
  isOpen,
  onSuccess,
  initialPharmacyId = '',
  initialJoinCode = ''
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  
  // Create mode state
  const [pharmacyName, setPharmacyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ pharmacyId: string; joinCode: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Join mode state
  const [inputPharmacyId, setInputPharmacyId] = useState(initialPharmacyId);
  const [inputJoinCode, setInputJoinCode] = useState(initialJoinCode);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-fill from props (e.g. from URL scan)
  useEffect(() => {
    if (initialPharmacyId && initialJoinCode) {
      setInputPharmacyId(initialPharmacyId);
      setInputJoinCode(initialJoinCode);
      setTab('join');
    }
  }, [initialPharmacyId, initialJoinCode]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setErrorMsg(null);
    try {
      const res = await firebaseSync.createPharmacy(pharmacyName.trim() || 'صيدلية فارماكير');
      setCreateResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء إنشاء الصيدلية');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinishCreate = () => {
    if (createResult) {
      onSuccess(createResult.pharmacyId);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPharmacyId.trim() || !inputJoinCode.trim()) {
      setErrorMsg('يرجى ملء كافة الحقول (معرّف الصيدلية ورمز الربط)');
      return;
    }

    setIsJoining(true);
    setErrorMsg(null);
    try {
      await firebaseSync.joinPharmacy(inputPharmacyId.trim(), inputJoinCode.trim());
      onSuccess(inputPharmacyId.trim());
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل الربط بالصيدلية. تأكد من صحة البيانات أو نشر قواعد Firebase.');
    } finally {
      setIsJoining(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto" dir="rtl">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black">مرحباً بك في فارماكير بلس 🏥</h2>
          <p className="text-xs sm:text-sm text-sky-100 mt-1 max-w-sm mx-auto">
            مزامنة حية ولحظية بين أجهزتك بدون حسابات Google وبدون تعقيد
          </p>
        </div>

        {/* Tab Switcher */}
        {!createResult && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-1">
            <button
              onClick={() => { setTab('create'); setErrorMsg(null); }}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                tab === 'create'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>إنشاء صيدلية جديدة</span>
            </button>
            <button
              onClick={() => { setTab('join'); setErrorMsg(null); }}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                tab === 'join'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>ربط بصيدلية موجودة</span>
            </button>
          </div>
        )}

        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* CREATE TAB - Success Screen */}
          {createResult ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">تم إنشاء الصيدلية بنجاح! 🎉</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                احفظ هذه البيانات لربط أي هاتف ذكي أو جهاز كاشير آخر في صيدليتك:
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-right space-y-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">معرّف الصيدلية (Pharmacy ID):</span>
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-sky-600">
                    <span>{createResult.pharmacyId}</span>
                    <button
                      onClick={() => copyToClipboard(createResult.pharmacyId)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                      title="نسخ"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">رمز الانضمام السري (Join Code):</span>
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-base font-black tracking-widest text-emerald-600">
                    <span>{createResult.joinCode}</span>
                    <button
                      onClick={() => copyToClipboard(createResult.joinCode)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                      title="نسخ"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {copiedCode && (
                <div className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>تم النسخ إلى الحافظة!</span>
                </div>
              )}

              <button
                onClick={handleFinishCreate}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-sky-600/25 transition-all"
              >
                الدخول إلى الصيدلية وبدء العمل 🚀
              </button>
            </div>
          ) : tab === 'create' ? (
            /* CREATE TAB - Input Form */
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم الصيدلية أو الفرع:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: صيدلية الأمل المركزية"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 text-[11px] text-sky-800 dark:text-sky-300 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>ماذا يحدث عند الإنشاء؟</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                  <li>يتم توليد مساحة سحابية خاصة بصيدليتك على Firestore مجاناً.</li>
                  <li>تُنقل أي بيانات أو أصناف سابقة موجودة في هذا الجهاز تلقائياً.</li>
                  <li>تحصل على رمز مكوّن من 8 خانات لربط الهواتف والأجهزة المساعدة.</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md shadow-sky-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري إنشاء الصيدلية السحابية...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>إنشاء الصيدلية الآن</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* JOIN TAB - Input Form */
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  معرّف الصيدلية (Pharmacy ID):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="مثال: pharma-a1b2c3"
                    value={inputPharmacyId}
                    onChange={(e) => setInputPharmacyId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm uppercase focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  رمز الانضمام (Join Code):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="رمز رقمي مكوّن من 6 أرقام (مثال: 729401)"
                    value={inputJoinCode}
                    onChange={(e) => setInputJoinCode(e.target.value.trim())}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-base tracking-widest text-center focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                💡 <strong>أين أجد هذه البيانات؟</strong> افتح شاشة الكاشير الرئيسية في صيدليتك، واذهب إلى <strong>الإعدادات &gt; ربط الأجهزة</strong> أو اضغط على أيقونة QR في الأعلى.
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق والربط...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    <span>ربط هذا الجهاز بالصيدلية</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
