import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  X, 
  Calendar, 
  Filter, 
  DollarSign, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Share2,
  CheckCircle2,
  User,
  Building2,
  Phone,
  MapPin,
  Clock
} from 'lucide-react';
import { Customer, Supplier, Invoice, Voucher, Purchase, Settings } from '../types/pharmacy';

export interface StatementParty {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  type: 'customer' | 'supplier';
  balance: number;
  creditLimit?: number;
  notes?: string;
}

interface StatementOfAccountModalProps {
  party: StatementParty;
  invoices: Invoice[];
  purchases?: Purchase[];
  vouchers: Voucher[];
  settings: Settings;
  onClose: () => void;
}

export const StatementOfAccountModal: React.FC<StatementOfAccountModalProps> = ({
  party,
  invoices,
  purchases = [],
  vouchers,
  settings,
  onClose,
}) => {
  const currency = settings.currency || '₪';

  // Filters State
  const [quickPeriod, setQuickPeriod] = useState<'all' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [transactionType, setTransactionType] = useState<'all' | 'invoices' | 'vouchers' | 'credit_only'>('all');
  const [minAmount, setMinAmount] = useState<string>('');

  // Quick Period Handler
  const handleQuickPeriodChange = (period: typeof quickPeriod) => {
    setQuickPeriod(period);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'all') {
      setStartDate('2020-01-01');
      setEndDate(todayStr);
    } else if (period === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(todayStr);
    } else if (period === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (period === 'last_3_months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(todayStr);
    } else if (period === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(todayStr);
    }
  };

  // Compile All Transactions for this Party
  const allEvents = useMemo(() => {
    const events: Array<{
      id: string;
      date: string;
      type: 'invoice' | 'purchase' | 'voucher';
      reference: string;
      description: string;
      debit: number;   // مدين (يزيد مستحقات الصيدلية على الزبون، أو يقلل مستحقات المورد)
      credit: number;  // دائن (يقلل دين الزبون، أو يزيد مستحقات المورد للصيدلية)
      paymentMethod?: string;
      notes?: string;
    }> = [];

    if (party.type === 'customer') {
      // 1. مبيعات ومرتجعات العميل
      const custInvoices = invoices.filter(i => i.customerId === party.id);
      custInvoices.forEach(inv => {
        const isReturn = inv.type === 'sale_return';
        if (isReturn) {
          // المرتجع يقلل دين العميل (دائن)
          events.push({
            id: inv.id,
            date: inv.date,
            type: 'invoice',
            reference: inv.invoiceNumber,
            description: `مرتجع مبيعات (${inv.items.length} صنف)`,
            debit: 0,
            credit: inv.totalAmount,
            paymentMethod: inv.paymentMethod,
            notes: inv.notes,
          });
        } else {
          // الفاتورة العادية: الجزء الآجل يزيد المديونية (مدين)
          const debitVal = inv.paymentMethod === 'credit' ? inv.totalAmount : inv.remainingAmount;
          events.push({
            id: inv.id,
            date: inv.date,
            type: 'invoice',
            reference: inv.invoiceNumber,
            description: `فاتورة مبيعات (${inv.paymentMethod === 'credit' ? 'آجل' : 'نقدي/بنكي'}) - ${inv.items.length} صنف`,
            debit: debitVal,
            credit: 0,
            paymentMethod: inv.paymentMethod,
            notes: inv.notes,
          });
        }
      });

      // 2. سندات العميل (قبض / صرف)
      const custVouchers = vouchers.filter(v => v.partyType === 'customer' && v.partyId === party.id);
      custVouchers.forEach(vch => {
        events.push({
          id: vch.id,
          date: vch.date,
          type: 'voucher',
          reference: vch.voucherNumber,
          description: vch.statement || (vch.type === 'receipt' ? 'سند قبض - دفعة نقدية مسددة' : 'سند صرف'),
          debit: vch.type === 'payment' ? vch.amount : 0,
          credit: vch.type === 'receipt' ? vch.amount : 0, // سند القبض يقلل دين العميل
          paymentMethod: vch.paymentMethod,
        });
      });
    } else {
      // 1. فواتير مشتريات ومردودات المورد
      const supPurchases = purchases.filter(p => p.partyType === 'supplier' && p.partyId === party.id);
      supPurchases.forEach(pur => {
        const isReturn = pur.type === 'purchase_return';
        if (isReturn) {
          // إرجاع للمورد يقلل مستحقاته على الصيدلية (مدين للمورد)
          events.push({
            id: pur.id,
            date: pur.date,
            type: 'purchase',
            reference: pur.purchaseNumber,
            description: `مردود مشتريات للمورد (${pur.items.length} صنف)`,
            debit: pur.totalAmount,
            credit: 0,
            paymentMethod: pur.paymentMethod,
            notes: pur.notes,
          });
        } else {
          // شراء من المورد: الجزء الآجل يزيد مستحقات المورد (دائن)
          const creditVal = pur.paymentMethod === 'credit' ? pur.totalAmount : pur.remainingAmount;
          events.push({
            id: pur.id,
            date: pur.date,
            type: 'purchase',
            reference: pur.purchaseNumber,
            description: `فاتورة توريد بضاعة (${pur.paymentMethod === 'credit' ? 'آجل' : 'نقدي/بنكي'}) - ${pur.items.length} صنف`,
            debit: 0,
            credit: creditVal,
            paymentMethod: pur.paymentMethod,
            notes: pur.notes,
          });
        }
      });

      // 2. سندات المورد (صرف له / قبض منه)
      const supVouchers = vouchers.filter(v => v.partyType === 'supplier' && v.partyId === party.id);
      supVouchers.forEach(vch => {
        events.push({
          id: vch.id,
          date: vch.date,
          type: 'voucher',
          reference: vch.voucherNumber,
          description: vch.statement || (vch.type === 'payment' ? 'سند صرف - سداد دفعة للمورد' : 'سند قبض'),
          debit: vch.type === 'payment' ? vch.amount : 0, // سداد للمورد يقلل مستحقاته
          credit: vch.type === 'receipt' ? vch.amount : 0,
          paymentMethod: vch.paymentMethod,
        });
      });
    }

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [party, invoices, purchases, vouchers]);

  // Split into Prior Balance (before start date) and In-Range Transactions
  const { previousBalance, filteredTransactions, totalDebit, totalCredit, finalBalance } = useMemo(() => {
    let priorBal = 0;
    const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
    const endTimestamp = new Date(endDate + 'T23:59:59').getTime();
    const minAmt = parseFloat(minAmount) || 0;

    const inRange: typeof allEvents = [];

    allEvents.forEach(evt => {
      const evtTime = new Date(evt.date).getTime();
      const change = evt.debit - evt.credit;

      if (evtTime < startTimestamp) {
        priorBal += change;
      } else if (evtTime <= endTimestamp) {
        // Filters check
        if (transactionType === 'invoices' && evt.type === 'voucher') return;
        if (transactionType === 'vouchers' && (evt.type === 'invoice' || evt.type === 'purchase')) return;
        if (transactionType === 'credit_only' && evt.paymentMethod !== 'credit') return;
        if (minAmt > 0 && Math.max(evt.debit, evt.credit) < minAmt) return;

        inRange.push(evt);
      }
    });

    let runningBal = priorBal;
    let sumDebit = 0;
    let sumCredit = 0;

    const withRunning = inRange.map(item => {
      runningBal += (item.debit - item.credit);
      sumDebit += item.debit;
      sumCredit += item.credit;
      return {
        ...item,
        runningBalance: runningBal,
      };
    });

    return {
      previousBalance: priorBal,
      filteredTransactions: withRunning,
      totalDebit: sumDebit,
      totalCredit: sumCredit,
      finalBalance: runningBal,
    };
  }, [allEvents, startDate, endDate, transactionType, minAmount]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!party.phone) {
      alert('لا يوجد رقم هاتف مسجل لهذا الحساب');
      return;
    }
    const cleanPhone = party.phone.replace(/[^0-9]/g, '');
    const msg = `كشف حساب معتمد من ${settings.pharmacyName}\nالحساب: ${party.name}\nالفترة: من ${startDate} إلى ${endDate}\nالرصيد السابق: ${previousBalance.toFixed(2)} ${currency}\nإجمالي المسحوبات/الفواتير: ${totalDebit.toFixed(2)} ${currency}\nإجمالي المدفوعات والسندات: ${totalCredit.toFixed(2)} ${currency}\nالرصيد الحالي المستحق: ${finalBalance.toFixed(2)} ${currency}\nشاكرين حسن تعاونكم.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header - Hidden on Print */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-400" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                كشف حساب {party.type === 'customer' ? 'عميل / زبون' : 'مورد / شركة'}: {party.name}
              </h3>
              <span className="text-[11px] text-slate-400">
                كشف حركات تفصيلي ورسمي معتمد مع تتبع الرصيد التراكمي
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
              title="إرسال الكشف ملخصاً عبر واتساب"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">واتساب</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الكشف</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-xl hover:bg-white/10 text-white/80"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar - Hidden on Print */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0 print:hidden">
          {/* Quick Periods Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              الفترة:
            </span>
            {[
              { id: 'this_month', label: 'هذا الشهر' },
              { id: 'last_month', label: 'الشهر الماضي' },
              { id: 'last_3_months', label: 'آخر 3 أشهر' },
              { id: 'this_year', label: 'هذا العام' },
              { id: 'all', label: 'كامل الحركات' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickPeriodChange(p.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  quickPeriod === p.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Advanced Filter Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">من تاريخ:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickPeriod('custom');
                }}
                className="w-full rounded-xl border border-slate-300 p-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">إلى تاريخ:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickPeriod('custom');
                }}
                className="w-full rounded-xl border border-slate-300 p-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">نوع الحركة:</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">كل الحركات</option>
                <option value="invoices">الفواتير والمردودات فقط</option>
                <option value="vouchers">سندات القبض والصرف فقط</option>
                <option value="credit_only">الحركات الآجلة فقط</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">المبلغ أكبر من أو يساوي:</label>
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Printable Statement Document (Scrollable on screen, Full page on Print) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 print:p-0 print:overflow-visible text-slate-900 dark:text-slate-100">
          {/* Pharmacy Printable Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-sky-900 dark:text-sky-400">
                {settings.pharmacyName || 'فارماكير بلس (PharmaCare Plus)'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {settings.address || 'فلسطين - نظام إدارة الصيدليات ونقاط البيع السحابية'}
              </p>
              {settings.phone && (
                <p className="text-xs text-slate-500 font-mono">
                  هاتف: {settings.phone} {settings.taxNumber ? `| رقم الضريبة/الترخيص: ${settings.taxNumber}` : ''}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 self-stretch sm:self-auto">
              <span className="block text-xs font-bold text-sky-800 dark:text-sky-300">كشف حساب رسمي</span>
              <span className="block text-[11px] text-slate-500">
                تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG', { dateStyle: 'long' })}
              </span>
              <span className="block text-[11px] font-mono text-slate-400">
                الفترة: من {startDate} إلى {endDate}
              </span>
            </div>
          </div>

          {/* Party Details Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">اسم الحساب:</span>
              <strong className="text-sm text-slate-900 dark:text-white">{party.name}</strong>
              <span className="block text-[10px] text-slate-500 font-mono">النوع: {party.type === 'customer' ? 'عميل / زبون' : 'مورد'}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold block">معلومات الاتصال:</span>
              <span className="block font-mono">{party.phone || 'غير مسجل'}</span>
              <span className="block text-slate-500">{party.address || 'العنوان غير محدد'}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold block">سقف الائتمان المسموح:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {party.creditLimit ? `${party.creditLimit} ${currency}` : 'غير محدد'}
              </span>
              <span className="block text-[10px] text-slate-400">حالة الحساب: نشط</span>
            </div>
          </div>

          {/* Financial Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 block">الرصيد السابق (قبل الفترة):</span>
              <strong className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono">
                {previousBalance.toFixed(2)} {currency}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block">إجمالي المسحوبات (مدين +):</span>
              <strong className="text-sm font-black text-rose-700 dark:text-rose-400 font-mono">
                {totalDebit.toFixed(2)} {currency}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">إجمالي المدفوعات (دائن -):</span>
              <strong className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {totalCredit.toFixed(2)} {currency}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-800">
              <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 block">الرصيد الصافي المتبقي:</span>
              <strong className={`text-base font-black font-mono ${finalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {finalBalance.toFixed(2)} {currency}
              </strong>
            </div>
          </div>

          {/* Statement Transactions Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">التاريخ والوقت</th>
                  <th className="py-2.5 px-2">رقم المرجع / الفاتورة</th>
                  <th className="py-2.5 px-3">البيان والتفاصيل</th>
                  <th className="py-2.5 px-3 text-center text-rose-700 dark:text-rose-400">مدين (+)</th>
                  <th className="py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400">دائن (-)</th>
                  <th className="py-2.5 px-3 text-center text-sky-800 dark:text-sky-300">الرصيد التراكمي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* Previous Balance Row */}
                <tr className="bg-slate-50/60 dark:bg-slate-800/40 font-bold text-slate-600 dark:text-slate-300">
                  <td className="py-2 px-3 font-mono">{startDate}</td>
                  <td className="py-2 px-2">-</td>
                  <td className="py-2 px-3">رصيد ما قبل تاريخ {startDate}</td>
                  <td className="py-2 px-3 text-center">-</td>
                  <td className="py-2 px-3 text-center">-</td>
                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                    {previousBalance.toFixed(2)} {currency}
                  </td>
                </tr>

                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      لا توجد حركات مسجلة خلال الفترة والتصفيات المحددة
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(evt => (
                    <tr key={evt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {new Date(evt.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-bold text-sky-700 dark:text-sky-400">
                        {evt.reference}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {evt.description}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">
                        {evt.debit > 0 ? `${evt.debit.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                        {evt.credit > 0 ? `${evt.credit.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 dark:text-white">
                        {evt.runningBalance.toFixed(2)} {currency}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 font-bold">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-left">
                    المجموع الكلي للحركات بالفترة:
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-rose-700 text-sm">
                    {totalDebit.toFixed(2)} {currency}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-emerald-700 text-sm">
                    {totalCredit.toFixed(2)} {currency}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-base font-black text-sky-900 dark:text-sky-300">
                    {finalBalance.toFixed(2)} {currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Statement Official Footer (Signatures and Stamp) */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-8 text-center text-xs text-slate-600 dark:text-slate-400">
            <div>
              <span className="block font-bold mb-8">توقيع وختم الصيدلية:</span>
              <span className="inline-block w-40 border-b border-dashed border-slate-400"></span>
            </div>
            <div>
              <span className="block font-bold mb-8">توقيع المستلم / العميل / المورد:</span>
              <span className="inline-block w-40 border-b border-dashed border-slate-400"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
