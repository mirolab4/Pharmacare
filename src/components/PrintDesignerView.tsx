import React, { useState } from 'react';
import { 
  Printer, 
  Save, 
  RotateCcw, 
  FileText, 
  Receipt, 
  QrCode, 
  Sparkles, 
  Eye, 
  Check, 
  Settings as SettingsIcon,
  Palette,
  ShieldCheck,
  Building2,
  Phone,
  MapPin,
  FileCheck
} from 'lucide-react';
import { Settings, PrintTemplateSettings } from '../types/pharmacy';

interface PrintDesignerViewProps {
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
}

export const PrintDesignerView: React.FC<PrintDesignerViewProps> = ({
  settings,
  onSaveSettings,
}) => {
  const currentTpl: PrintTemplateSettings = settings.printTemplate || {
    pharmacyName: settings.pharmacyName || 'فارماكير بلس (PharmaCare Plus)',
    subTitle: 'صيدلية نموذجية متكاملة وخدمات رعاية صيدلانية',
    phone: settings.phone || '0599123456',
    address: settings.address || 'فلسطين - الشارع الرئيسي',
    taxNumber: settings.taxNumber || '300123456789',
    receiptWidth: settings.thermalPaperWidth || '80mm',
    fontSize: 'medium',
    showBarcode: true,
    showQRCode: true,
    showTaxDetails: true,
    showCashierName: true,
    showReturnPolicy: true,
    returnPolicyText: 'البضاعة المباعة ترد وتستبدل خلال 3 أيام بحالتها الأصلية مع إبراز الفاتورة (الأدوية المبردة لا تسترجع)',
    footerMessage: settings.receiptFooterMessage || settings.receiptFooter || 'شكراً لزيارتكم - نسأل الله لكم دوام الصحة والعافية',
    accentColor: '#0284c7', // Sky-600
  };

  const [tpl, setTpl] = useState<PrintTemplateSettings>(currentTpl);
  const [previewDoc, setPreviewDoc] = useState<'thermal' | 'a4' | 'statement'>('thermal');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    const updated: Settings = {
      ...settings,
      pharmacyName: tpl.pharmacyName,
      phone: tpl.phone,
      address: tpl.address,
      taxNumber: tpl.taxNumber,
      thermalPaperWidth: tpl.receiptWidth === '58mm' ? '58mm' : '80mm',
      receiptFooterMessage: tpl.footerMessage,
      receiptFooter: tpl.footerMessage,
      printTemplate: tpl,
    };
    onSaveSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handlePrintTest = () => {
    window.print();
  };

  const handleResetDefaults = () => {
    if (confirm('هل تريد استعادة الإعدادات الافتراضية لقوالب الطباعة؟')) {
      setTpl({
        pharmacyName: settings.pharmacyName || 'فارماكير بلس',
        subTitle: 'صيدلية نموذجية متكاملة وخدمات رعاية صيدلانية',
        phone: settings.phone || '0599123456',
        address: settings.address || 'فلسطين',
        taxNumber: settings.taxNumber || '300123456789',
        receiptWidth: '80mm',
        fontSize: 'medium',
        showBarcode: true,
        showQRCode: true,
        showTaxDetails: true,
        showCashierName: true,
        showReturnPolicy: true,
        returnPolicyText: 'البضاعة المباعة ترد وتستبدل خلال 3 أيام بحالتها الأصلية مع إبراز الفاتورة',
        footerMessage: 'شكراً لزيارتكم - نتمنى لكم دوام الصحة والعافية',
        accentColor: '#0284c7',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-md shadow-purple-500/20">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              استوديو تصميم قوالب الطباعة والفواتير
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تخصيص ترويسة الفواتير، إيصالات الكاشير الحرارية (80mm/58mm)، كشوفات الحساب، والباركود
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            onClick={handlePrintTest}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة نموذج تجريبي</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-extrabold shadow-xs transition active:scale-95 ${
              saveSuccess ? 'bg-emerald-600' : 'bg-gradient-to-r from-sky-600 to-teal-600 hover:opacity-90'
            }`}
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saveSuccess ? 'تم الحفظ بنجاح ✓' : 'حفظ التصميم'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Controls Column (Left) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Card 1: Pharmacy Header Information */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span>بيانات الترويسة والصيدلية</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  اسم الصيدلية الرئيسي في الترويسة:
                </label>
                <input
                  type="text"
                  value={tpl.pharmacyName}
                  onChange={(e) => setTpl({ ...tpl, pharmacyName: e.target.value })}
                  placeholder="مثال: صيدلية فارماكير الحديثة"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الشعار أو الوصف المختصر (سلوجان):
                </label>
                <input
                  type="text"
                  value={tpl.subTitle || ''}
                  onChange={(e) => setTpl({ ...tpl, subTitle: e.target.value })}
                  placeholder="مثال: رعاية صيدلانية متكاملة - خدمات على مدار الساعة"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  رقم الهاتف والتواصل:
                </label>
                <input
                  type="text"
                  value={tpl.phone}
                  onChange={(e) => setTpl({ ...tpl, phone: e.target.value })}
                  placeholder="059xxxxxxx"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs font-mono text-center dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الرقم الضريبي أو الترخيص:
                </label>
                <input
                  type="text"
                  value={tpl.taxNumber}
                  onChange={(e) => setTpl({ ...tpl, taxNumber: e.target.value })}
                  placeholder="رقم الترخيص الرسمي..."
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs font-mono text-center dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  العنوان بالتفصيل:
                </label>
                <input
                  type="text"
                  value={tpl.address}
                  onChange={(e) => setTpl({ ...tpl, address: e.target.value })}
                  placeholder="المدينة، الشارع الرئيسي، بجانب المركز الصحي..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Print Paper & Dimensions */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>إعدادات نوع الورق والخطوط</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نوع وحجم الورق الافتراضي:
                </label>
                <select
                  value={tpl.receiptWidth}
                  onChange={(e) => setTpl({ ...tpl, receiptWidth: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="80mm">طابعة حرارية 80mm (قياسي كبير)</option>
                  <option value="58mm">طابعة حرارية 58mm (إيصالات صغيرة)</option>
                  <option value="A4">ورق قياسي A4 (فواتير كاملة)</option>
                  <option value="A5">ورق نصفي A5</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  حجم الخط:
                </label>
                <select
                  value={tpl.fontSize}
                  onChange={(e) => setTpl({ ...tpl, fontSize: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="small">صغير (مضغوط وموفر للورق)</option>
                  <option value="medium">متوسط (متوازن وواضح)</option>
                  <option value="large">كبير (بارز وسهل القراءة)</option>
                </select>
              </div>
            </div>

            {/* Accent Color Picker for Headers */}
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-600" />
                <span>لون ترويسة وعناصر الفاتورة:</span>
              </label>
              <div className="flex items-center gap-2">
                {[
                  { label: 'أزرق', hex: '#0284c7' },
                  { label: 'زمردي', hex: '#059669' },
                  { label: 'بنفسجي', hex: '#7c3aed' },
                  { label: 'نيلي', hex: '#4f46e5' },
                  { label: 'عنبري', hex: '#d97706' },
                  { label: 'رمادي كلاسيك', hex: '#334155' },
                ].map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setTpl({ ...tpl, accentColor: c.hex })}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      tpl.accentColor === c.hex ? 'scale-110 border-slate-900 dark:border-white shadow-md' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Elements Toggle (Barcode, QR, Tax, Return Policy) */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-600" />
              <span>العناصر المعروضة بالفاتورة</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tpl.showQRCode}
                  onChange={(e) => setTpl({ ...tpl, showQRCode: e.target.checked })}
                  className="rounded text-sky-600 h-4 w-4"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300">رمز QR الإلكتروني</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tpl.showBarcode}
                  onChange={(e) => setTpl({ ...tpl, showBarcode: e.target.checked })}
                  className="rounded text-sky-600 h-4 w-4"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300">باركود رقم الفاتورة</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tpl.showCashierName}
                  onChange={(e) => setTpl({ ...tpl, showCashierName: e.target.checked })}
                  className="rounded text-sky-600 h-4 w-4"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300">اسم الكاشير / الصيدلي</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tpl.showTaxDetails}
                  onChange={(e) => setTpl({ ...tpl, showTaxDetails: e.target.checked })}
                  className="rounded text-sky-600 h-4 w-4"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300">تفاصيل الضريبة والخصم</span>
              </label>
            </div>

            {/* Return Policy Text */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                سياسة التبديل والإرجاع:
              </label>
              <textarea
                rows={2}
                value={tpl.returnPolicyText}
                onChange={(e) => setTpl({ ...tpl, returnPolicyText: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Footer Message */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                رسالة التذييل والختام:
              </label>
              <input
                type="text"
                value={tpl.footerMessage}
                onChange={(e) => setTpl({ ...tpl, footerMessage: e.target.value })}
                placeholder="شكراً لزيارتكم..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Column (Right) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Preview Document Switcher */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 mr-2 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-sky-600" />
              <span>معاينة حية وفورية:</span>
            </span>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPreviewDoc('thermal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewDoc === 'thermal'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                حراري (الكاشير)
              </button>

              <button
                type="button"
                onClick={() => setPreviewDoc('a4')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewDoc === 'a4'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                فاتورة A4
              </button>

              <button
                type="button"
                onClick={() => setPreviewDoc('statement')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  previewDoc === 'statement'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                كشف حساب
              </button>
            </div>
          </div>

          {/* Live Preview Paper Box */}
          <div className="rounded-2xl bg-slate-200/70 dark:bg-slate-950 p-4 flex items-center justify-center min-h-[580px] overflow-y-auto">
            {previewDoc === 'thermal' && (
              <div 
                className="bg-white text-slate-900 p-4 rounded-lg shadow-xl font-mono text-center space-y-3 transition-all"
                style={{ width: tpl.receiptWidth === '58mm' ? '280px' : '360px', fontSize: tpl.fontSize === 'small' ? '11px' : tpl.fontSize === 'large' ? '14px' : '12px' }}
              >
                {/* Header */}
                <div className="border-b-2 border-dashed border-slate-300 pb-2 space-y-1">
                  <h4 className="font-black text-base" style={{ color: tpl.accentColor }}>
                    {tpl.pharmacyName || 'فارماكير بلس'}
                  </h4>
                  {tpl.subTitle && <p className="text-[10px] text-slate-500 font-sans">{tpl.subTitle}</p>}
                  <p className="text-[10px] text-slate-500">{tpl.address}</p>
                  <p className="text-[10px] text-slate-500">هاتف: {tpl.phone}</p>
                  {tpl.taxNumber && <p className="text-[10px] text-slate-500">ضريبي: {tpl.taxNumber}</p>}
                </div>

                {/* Metadata */}
                <div className="flex justify-between text-[11px] text-slate-600 border-b border-dashed border-slate-200 pb-1.5">
                  <span>فاتورة: INV-10024</span>
                  <span>{new Date().toLocaleDateString('ar-EG')}</span>
                </div>

                {tpl.showCashierName && (
                  <div className="text-right text-[10px] text-slate-500">
                    الصيدلي: د. أحمد النجار | نقدي
                  </div>
                )}

                {/* Items */}
                <table className="w-full text-right text-xs my-2">
                  <thead className="border-b border-slate-300 text-slate-600 font-bold">
                    <tr>
                      <th className="py-1">الصنف</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">السعر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-slate-200">
                    <tr>
                      <td className="py-1">أكامول 500 ملغم (علبة)</td>
                      <td className="py-1 text-center">2</td>
                      <td className="py-1 text-left">34.00</td>
                    </tr>
                    <tr>
                      <td className="py-1">أوجمنتين 1 غرام (علبة)</td>
                      <td className="py-1 text-center">1</td>
                      <td className="py-1 text-left">48.50</td>
                    </tr>
                    <tr>
                      <td className="py-1">فيتامين C فوار (أنبوب)</td>
                      <td className="py-1 text-center">1</td>
                      <td className="py-1 text-left">18.00</td>
                    </tr>
                  </tbody>
                </table>

                {/* Total */}
                <div className="border-t-2 border-dashed border-slate-300 pt-2 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>المجموع الفرعي:</span>
                    <span>100.50 {settings.currency}</span>
                  </div>
                  {tpl.showTaxDetails && (
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>الضريبة (0%):</span>
                      <span>0.00 {settings.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black border-t border-slate-900 pt-1" style={{ color: tpl.accentColor }}>
                    <span>الصافي المطلوب:</span>
                    <span>100.50 {settings.currency}</span>
                  </div>
                </div>

                {/* QR Code */}
                {tpl.showQRCode && (
                  <div className="py-2 flex flex-col items-center justify-center">
                    <div className="h-16 w-16 bg-slate-900 text-white rounded p-1 flex items-center justify-center">
                      <QrCode className="h-12 w-12" />
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1">فاتورة إلكترونية معتمدة</span>
                  </div>
                )}

                {/* Barcode */}
                {tpl.showBarcode && (
                  <div className="py-1 text-center font-mono text-xs tracking-widest text-slate-600 border-t border-dashed border-slate-200 pt-1.5">
                    ||||| |||| | ||||| |||||||
                    <span className="block text-[10px] tracking-normal">INV-10024</span>
                  </div>
                )}

                {/* Return policy */}
                {tpl.showReturnPolicy && (
                  <p className="text-[9px] text-slate-500 leading-tight pt-1 border-t border-dashed border-slate-200">
                    {tpl.returnPolicyText}
                  </p>
                )}

                {/* Footer Message */}
                <p className="text-[10px] font-bold text-slate-700 pt-1">
                  {tpl.footerMessage}
                </p>
              </div>
            )}

            {previewDoc === 'a4' && (
              <div className="bg-white text-slate-900 p-6 rounded-lg shadow-xl w-full max-w-[480px] space-y-4 text-xs font-sans">
                {/* A4 Header */}
                <div className="border-b-2 pb-3 flex justify-between items-center" style={{ borderColor: tpl.accentColor }}>
                  <div>
                    <h3 className="text-base font-black" style={{ color: tpl.accentColor }}>{tpl.pharmacyName}</h3>
                    <p className="text-[11px] text-slate-500">{tpl.address} | هاتف: {tpl.phone}</p>
                    <p className="text-[10px] text-slate-400 font-mono">الرقم الضريبي: {tpl.taxNumber}</p>
                  </div>
                  <div className="text-left font-mono">
                    <span className="bg-sky-50 text-sky-800 px-2 py-0.5 rounded font-bold">فاتورة مبيعات A4</span>
                    <span className="block text-[11px] text-slate-400 mt-1">#INV-2026-0081</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div><b>العميل:</b> نقدي / زبون صيدلية</div>
                  <div><b>التاريخ:</b> {new Date().toLocaleDateString('ar-EG')}</div>
                  <div><b>طريقة الدفع:</b> نقداً</div>
                  <div><b>الصيدلي المسؤول:</b> د. أحمد</div>
                </div>

                <table className="w-full text-right text-[11px] border border-slate-200 rounded">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-1.5">الصنف</th>
                      <th className="p-1.5 text-center">الكمية</th>
                      <th className="p-1.5 text-center">السعر</th>
                      <th className="p-1.5 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-1.5 font-bold">أكامول 500 ملغم</td>
                      <td className="p-1.5 text-center">2</td>
                      <td className="p-1.5 text-center">17.00</td>
                      <td className="p-1.5 text-left font-mono font-bold">34.00</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-bold">أوجمنتين 1 غرام</td>
                      <td className="p-1.5 text-center">1</td>
                      <td className="p-1.5 text-center">48.50</td>
                      <td className="p-1.5 text-left font-mono font-bold">48.50</td>
                    </tr>
                  </tbody>
                  <tfoot className="border-t-2 font-bold bg-slate-50">
                    <tr>
                      <td colSpan={3} className="p-1.5 text-left">المجموع الصافي:</td>
                      <td className="p-1.5 text-left font-mono font-black text-sky-700">82.50 {settings.currency}</td>
                    </tr>
                  </tfoot>
                </table>

                {tpl.showReturnPolicy && (
                  <p className="text-[10px] text-slate-500 border-t pt-2">{tpl.returnPolicyText}</p>
                )}
              </div>
            )}

            {previewDoc === 'statement' && (
              <div className="bg-white text-slate-900 p-6 rounded-lg shadow-xl w-full max-w-[480px] space-y-3 text-xs font-sans">
                <div className="border-b-2 pb-2 flex justify-between items-center" style={{ borderColor: tpl.accentColor }}>
                  <div>
                    <h3 className="text-base font-black" style={{ color: tpl.accentColor }}>{tpl.pharmacyName}</h3>
                    <p className="text-[10px] text-slate-500">كشف حساب مالي رسمي معتمد</p>
                  </div>
                  <div className="text-left text-[11px] font-mono text-slate-500">
                    تاريخ الكشف: {new Date().toLocaleDateString('ar-EG')}
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded text-[11px]">
                  <b>اسم العميل/المورد:</b> أحمد خليل النجار | <b>الرصيد النهائي:</b> 250.00 {settings.currency}
                </div>

                <div className="border rounded p-2 text-[10px] text-slate-500 text-center font-mono">
                  نموذج الحركات المالية التفصيلية (سندات وفواتير ورصيد تراكمي)
                </div>

                <div className="pt-4 border-t flex justify-between text-[10px] text-slate-500 text-center">
                  <div>توقيع وختم الصيدلية</div>
                  <div>توقيع المستلم</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
