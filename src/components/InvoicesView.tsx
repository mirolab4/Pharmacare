import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Printer, 
  Eye, 
  Ban, 
  RotateCcw, 
  Trash2, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import { Invoice, Settings } from '../types/pharmacy';

interface InvoicesViewProps {
  invoices: Invoice[];
  settings: Settings;
  onPrintInvoice: (invoice: Invoice) => void;
  onCancelInvoice: (id: string) => void;
  onReactivateInvoice: (id: string) => void;
  onDeleteInvoice: (id: string) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  settings,
  onPrintInvoice,
  onCancelInvoice,
  onReactivateInvoice,
  onDeleteInvoice,
}) => {
  // Date filter: 'today' | 'specific' | 'all'
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'specific' | 'all'>('today');
  const [specificDate, setSpecificDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Details Modal
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return invoices.filter(inv => {
      const invDateStr = inv.date.split('T')[0];

      // Date check
      if (dateFilterMode === 'today' && invDateStr !== todayStr) return false;
      if (dateFilterMode === 'specific' && invDateStr !== specificDate) return false;

      // Text search (invoice number or customer name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
        const matchCust = inv.customerName ? inv.customerName.toLowerCase().includes(q) : false;
        if (!matchNum && !matchCust) return false;
      }

      return true;
    });
  }, [invoices, dateFilterMode, specificDate, searchQuery]);

  // Statistical KPIs
  const stats = useMemo(() => {
    const activeList = filteredInvoices.filter(i => i.status === 'active');
    const totalAmount = activeList.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalCollected = activeList.reduce((sum, i) => sum + i.paidAmount, 0);
    const totalCredit = activeList.reduce((sum, i) => sum + i.remainingAmount, 0);
    const totalProfit = activeList.reduce((sum, i) => sum + i.totalProfit, 0);
    const cancelledCount = filteredInvoices.filter(i => i.status === 'cancelled').length;

    return {
      count: filteredInvoices.length,
      activeCount: activeList.length,
      cancelledCount,
      totalAmount,
      totalCollected,
      totalCredit,
      totalProfit,
    };
  }, [filteredInvoices]);

  return (
    <div className="space-y-4">
      {/* 1. Date Filter & Search Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">تصفية التاريخ:</span>
          <button
            onClick={() => setDateFilterMode('today')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              dateFilterMode === 'today'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            فواتير اليوم 📅
          </button>
          <button
            onClick={() => setDateFilterMode('specific')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              dateFilterMode === 'specific'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            تاريخ محدد
          </button>
          <button
            onClick={() => setDateFilterMode('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              dateFilterMode === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            جميع الفواتير ({invoices.length})
          </button>

          {dateFilterMode === 'specific' && (
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="rounded-xl border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          )}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pr-9 pl-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* 2. Statistical KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Count */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">عدد الفواتير المعروضة</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {stats.count}
            {stats.cancelledCount > 0 && (
              <span className="text-xs font-normal text-rose-500 mr-2">({stats.cancelledCount} ملغاة)</span>
            )}
          </div>
        </div>

        {/* Total Sales */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">إجمالي قيمة المبيعات</div>
          <div className="text-xl font-black text-sky-600 dark:text-sky-400 mt-1">
            {stats.totalAmount.toFixed(2)} {settings.currency}
          </div>
        </div>

        {/* Total Collected */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">المحصّل نقداً وبنوك</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.totalCollected.toFixed(2)} {settings.currency}
          </div>
        </div>

        {/* Total Credit / Remaining */}
        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-bold text-slate-500">الآجل (الذمم المتبقية)</div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.totalCredit.toFixed(2)} {settings.currency}
          </div>
        </div>
      </div>

      {/* 3. Invoices Table & Mobile Cards */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            لا توجد فواتير مسجلة في هذا التاريخ أو تطابق البحث
          </div>
        ) : (
          <>
            {/* Mobile Invoices Cards View */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
              {filteredInvoices.map((inv) => {
                const isCancelled = inv.status === 'cancelled';
                return (
                  <div
                    key={inv.id}
                    className={`rounded-2xl p-3 border space-y-2.5 transition-colors ${
                      isCancelled
                        ? 'bg-rose-50/40 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60'
                        : 'bg-slate-50/80 border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700'
                    }`}
                  >
                    {/* Header: Inv Number, Status, Customer */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-sm text-sky-700 dark:text-sky-400">
                            {inv.invoiceNumber}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {isCancelled ? 'ملغاة' : 'نشطة ✓'}
                          </span>
                          <span className="rounded-md bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {inv.paymentMethod === 'cash' && '💵 نقدي'}
                            {inv.paymentMethod === 'card' && '💳 بطاقة'}
                            {inv.paymentMethod === 'bank' && `🏦 ${inv.bankName || 'بنك'}`}
                            {inv.paymentMethod === 'credit' && '⏳ آجل'}
                          </span>
                        </div>
                        <div className="font-extrabold text-xs text-slate-900 dark:text-white mt-1">
                          👤 {inv.customerName || 'زبون نقدي عام'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          🕒 {new Date(inv.date).toLocaleDateString('ar-EG')} - {new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Main Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewingInvoice(inv)}
                          className="p-2 rounded-xl text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 transition-colors"
                          title="عرض تفاصيل الفاتورة"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onPrintInvoice(inv)}
                          className="p-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 transition-colors"
                          title="طباعة إيصال حراري"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Financial Figures */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block">الإجمالي:</span>
                        <span className={`font-black text-xs ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {inv.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المدفوع:</span>
                        <span className="font-black text-emerald-600 text-xs">
                          {inv.paidAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المتبقي:</span>
                        <span className={`font-black text-xs ${inv.remainingAmount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {inv.remainingAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Secondary Actions Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <span className="text-[10px] text-slate-400">
                        {inv.items.length} أصناف في الفاتورة
                      </span>

                      <div className="flex items-center gap-1.5">
                        {!isCancelled ? (
                          <button
                            onClick={() => {
                              if (confirm(`إلغاء الفاتورة ${inv.invoiceNumber}؟ سيتم إرجاع الأصناف للمخزون وعكس رصيد العميل إن كان آجلاً.`)) {
                                onCancelInvoice(inv.id);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-[11px] font-bold flex items-center gap-1"
                            title="إلغاء الفاتورة وإرجاع الأصناف"
                          >
                            <Ban className="h-3 w-3" />
                            <span>إلغاء</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`إعادة تفعيل الفاتورة ${inv.invoiceNumber}؟ سيتم إعادة خصم الأصناف من المخزون.`)) {
                                onReactivateInvoice(inv.id);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-[11px] font-bold flex items-center gap-1"
                            title="إعادة تفعيل الفاتورة"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>إعادة تفعيل</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`حذف الفاتورة ${inv.invoiceNumber} نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
                              onDeleteInvoice(inv.id);
                            }
                          }}
                          className="p-1 rounded-lg text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                          title="حذف نهائي"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">رقم الفاتورة</th>
                    <th className="px-3 py-3 font-bold">التاريخ والوقت</th>
                    <th className="px-3 py-3 font-bold">العميل</th>
                    <th className="px-3 py-3 font-bold">الإجمالي</th>
                    <th className="px-3 py-3 font-bold">المدفوع</th>
                    <th className="px-3 py-3 font-bold">المتبقي</th>
                    <th className="px-3 py-3 font-bold">طريقة الدفع</th>
                    <th className="px-3 py-3 font-bold text-center">الحالة</th>
                    <th className="px-3 py-3 font-bold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredInvoices.map((inv) => {
                    const isCancelled = inv.status === 'cancelled';
                    return (
                      <tr
                        key={inv.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isCancelled ? 'bg-rose-50/30 text-slate-400 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-sky-700 dark:text-sky-400">
                          {inv.invoiceNumber}
                        </td>

                        <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                          {new Date(inv.date).toLocaleDateString('ar-EG')} - {new Date(inv.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">
                          {inv.customerName || 'زبون نقدي عام'}
                        </td>

                        <td className={`px-3 py-3 font-bold ${isCancelled ? 'line-through' : 'text-slate-900 dark:text-white'}`}>
                          {inv.totalAmount.toFixed(2)} {settings.currency}
                        </td>

                        <td className="px-3 py-3 font-semibold text-emerald-600">
                          {inv.paidAmount.toFixed(2)} {settings.currency}
                        </td>

                        <td className="px-3 py-3">
                          {inv.remainingAmount > 0 ? (
                            <span className="font-bold text-amber-700 dark:text-amber-400">
                              {inv.remainingAmount.toFixed(2)} {settings.currency}
                            </span>
                          ) : (
                            <span className="text-slate-400">0.00</span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {inv.paymentMethod === 'cash' && '💵 نقدي'}
                            {inv.paymentMethod === 'card' && '💳 بطاقة'}
                            {inv.paymentMethod === 'bank' && `🏦 ${inv.bankName || 'بنك'}`}
                            {inv.paymentMethod === 'credit' && '⏳ آجل'}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCancelled 
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {isCancelled ? 'ملغاة' : 'نشطة ✓'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* 👁️ View details */}
                            <button
                              onClick={() => setViewingInvoice(inv)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                              title="عرض تفاصيل الفاتورة"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {/* 🖨️ Reprint */}
                            <button
                              onClick={() => onPrintInvoice(inv)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800"
                              title="طباعة إيصال حراري"
                            >
                              <Printer className="h-4 w-4" />
                            </button>

                            {/* Cancel or Reactivate */}
                            {!isCancelled ? (
                              <button
                                onClick={() => {
                                  if (confirm(`إلغاء الفاتورة ${inv.invoiceNumber}؟ سيتم إرجاع الأصناف للمخزون وعكس رصيد العميل إن كان آجلاً.`)) {
                                    onCancelInvoice(inv.id);
                                  }
                                }}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                title="إلغاء الفاتورة وإرجاع الأصناف"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (confirm(`إعادة تفعيل الفاتورة ${inv.invoiceNumber}؟ سيتم إعادة خصم الأصناف من المخزون.`)) {
                                    onReactivateInvoice(inv.id);
                                  }
                                }}
                                className="rounded-lg p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                                title="إعادة تفعيل الفاتورة"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}

                            {/* Permanent delete */}
                            <button
                              onClick={() => {
                                if (confirm(`حذف الفاتورة ${inv.invoiceNumber} نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
                                  onDeleteInvoice(inv.id);
                                }
                              }}
                              className="rounded-lg p-1 text-slate-300 hover:text-rose-700"
                              title="حذف نهائي"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ================= MODAL: INVOICE DETAILS ================= */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between border-b bg-sky-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <h3 className="font-extrabold text-sm">
                  تفاصيل الفاتورة: {viewingInvoice.invoiceNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPrintInvoice(viewingInvoice)}
                  className="flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/30"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>طباعة 🖨️</span>
                </button>
                <button onClick={() => setViewingInvoice(null)} className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block">التاريخ:</span>
                  <span className="font-bold">{new Date(viewingInvoice.date).toLocaleString('ar-EG')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">العميل:</span>
                  <span className="font-bold">{viewingInvoice.customerName || 'زبون نقدي عام'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">طريقة الدفع:</span>
                  <span className="font-bold">{viewingInvoice.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">الحالة:</span>
                  <span className={`font-bold ${viewingInvoice.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {viewingInvoice.status === 'active' ? 'نشطة' : 'ملغاة'}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="p-2">الصنف</th>
                      <th className="p-2">الوحدة</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2">السعر</th>
                      <th className="p-2">الإجمالي</th>
                      {!settings.hideCostAndProfit && (
                        <>
                          <th className="p-2 text-slate-500">التكلفة</th>
                          <th className="p-2 text-emerald-600">الربح</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {viewingInvoice.items.map((item, i) => (
                      <tr key={i}>
                        <td className="p-2 font-bold text-slate-900 dark:text-white">{item.productName}</td>
                        <td className="p-2 text-slate-600 dark:text-slate-400">{item.unitName}</td>
                        <td className="p-2 text-center font-bold">{item.quantity}</td>
                        <td className="p-2 font-mono">{item.salePrice.toFixed(2)}</td>
                        <td className="p-2 font-bold text-sky-700 dark:text-sky-400">{item.total.toFixed(2)}</td>
                        {!settings.hideCostAndProfit && (
                          <>
                            <td className="p-2 font-mono text-slate-500">{(item.costPrice * item.quantity).toFixed(2)}</td>
                            <td className="p-2 font-mono font-bold text-emerald-600">+{item.profit.toFixed(2)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 space-y-1.5 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{viewingInvoice.subtotal.toFixed(2)} {settings.currency}</span>
                </div>
                {viewingInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>الخصم:</span>
                    <span>- {viewingInvoice.discountAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                )}
                {viewingInvoice.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>الضريبة ({viewingInvoice.taxRate}%):</span>
                    <span>+ {viewingInvoice.taxAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>الإجمالي النهائي:</span>
                  <span className="text-sky-600 dark:text-sky-400">{viewingInvoice.totalAmount.toFixed(2)} {settings.currency}</span>
                </div>

                {!settings.hideCostAndProfit && (
                  <div className="flex justify-between text-emerald-600 font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>إجمالي ربح هذه الفاتورة:</span>
                    <span>+{viewingInvoice.totalProfit.toFixed(2)} {settings.currency}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
