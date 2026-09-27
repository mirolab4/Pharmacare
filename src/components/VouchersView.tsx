import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  FileSpreadsheet, 
  Trash2, 
  Calendar, 
  Building2, 
  X,
  Printer
} from 'lucide-react';
import { Voucher, Customer, Supplier, Bank, Settings } from '../types/pharmacy';

interface VouchersViewProps {
  vouchers: Voucher[];
  customers: Customer[];
  suppliers: Supplier[];
  banks: Bank[];
  settings: Settings;
  onSaveVoucher: (voucher: Voucher) => void;
  onDeleteVoucher: (id: string) => void;
}

export const VouchersView: React.FC<VouchersViewProps> = ({
  vouchers,
  customers,
  suppliers,
  banks,
  settings,
  onSaveVoucher,
  onDeleteVoucher,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'receipt' | 'payment' | 'journal'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Voucher Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [voucherType, setVoucherType] = useState<'receipt' | 'payment' | 'journal'>('receipt');
  const [partyType, setPartyType] = useState<'customer' | 'supplier' | 'general'>('customer');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [bankId, setBankId] = useState('');
  const [statement, setStatement] = useState('');
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');

  // View / Print Voucher Modal
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (filterType !== 'all' && v.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = v.voucherNumber.toLowerCase().includes(q);
        const matchParty = v.partyName ? v.partyName.toLowerCase().includes(q) : false;
        const matchState = v.statement.toLowerCase().includes(q);
        if (!matchNum && !matchParty && !matchState) return false;
      }
      return true;
    });
  }, [vouchers, filterType, searchQuery]);

  const handleOpenAdd = (type: 'receipt' | 'payment' | 'journal') => {
    setVoucherType(type);
    if (type === 'receipt') {
      setPartyType('customer');
      setPartyId(customers[0]?.id || '');
    } else if (type === 'payment') {
      setPartyType('supplier');
      setPartyId(suppliers[0]?.id || '');
    } else {
      setPartyType('general');
      setPartyId('');
    }
    setAmount(0);
    setPaymentMethod('cash');
    setBankId(banks[0]?.id || '');
    setStatement('');
    setDebitAccount('الصندوق الرئيسي');
    setCreditAccount('حساب جاري');
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('الرجاء إدخال مبلغ صالح');
      return;
    }

    let pName: string | undefined = undefined;
    if (partyType === 'customer') {
      pName = customers.find(c => c.id === partyId)?.name;
    } else if (partyType === 'supplier') {
      pName = suppliers.find(s => s.id === partyId)?.name;
    }

    const bankObj = banks.find(b => b.id === bankId);

    const prefix = voucherType === 'receipt' ? 'REC' : voucherType === 'payment' ? 'PAY' : 'JRN';
    const newVoucher: Voucher = {
      id: 'vch-' + Date.now(),
      voucherNumber: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      type: voucherType,
      date: new Date().toISOString(),
      partyType,
      partyId: partyId || undefined,
      partyName: pName,
      amount: Number(amount),
      paymentMethod,
      bankId: paymentMethod === 'bank' ? bankId : undefined,
      bankName: paymentMethod === 'bank' ? bankObj?.name : undefined,
      statement: statement.trim(),
      debitAccount: voucherType === 'journal' ? debitAccount.trim() : undefined,
      creditAccount: voucherType === 'journal' ? creditAccount.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    onSaveVoucher(newVoucher);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-sky-600" />
            <span>السندات المالية والقيود المحاسبية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            سندات القبض تخفض مديونية العملاء، وسندات الصرف تخفض مستحقات الموردين تلقائياً
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleOpenAdd('receipt')}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>+ سند قبض</span>
          </button>
          <button
            onClick={() => handleOpenAdd('payment')}
            className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-xs"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>+ سند صرف</span>
          </button>
          <button
            onClick={() => handleOpenAdd('journal')}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>+ سند قيد</span>
          </button>
        </div>
      </div>

      {/* 2. Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              filterType === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            كل السندات ({vouchers.length})
          </button>
          <button
            onClick={() => setFilterType('receipt')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              filterType === 'receipt' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            سندات القبض
          </button>
          <button
            onClick={() => setFilterType('payment')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              filterType === 'payment' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            سندات الصرف
          </button>
          <button
            onClick={() => setFilterType('journal')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              filterType === 'journal' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            سندات القيد
          </button>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم السند أو الطرف..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-1.5 pr-9 pl-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* 3. Vouchers Table & Mobile Cards */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        {filteredVouchers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">لا توجد سندات مسجلة</div>
        ) : (
          <>
            {/* Mobile Vouchers Cards */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
              {filteredVouchers.map(v => (
                <div
                  key={v.id}
                  className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                          v.type === 'receipt' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : v.type === 'payment' 
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' 
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                        }`}>
                          {v.type === 'receipt' ? 'سند قبض ↓' : v.type === 'payment' ? 'سند صرف ↑' : 'سند قيد ⇄'}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {v.voucherNumber}
                        </span>
                      </div>
                      <div className="font-extrabold text-xs text-slate-800 dark:text-slate-200 mt-1">
                        👤 {v.partyName || (v.type === 'journal' ? `${v.debitAccount} / ${v.creditAccount}` : 'طرف عام')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        📅 {new Date(v.date).toLocaleDateString('ar-EG')}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`حذف السند ${v.voucherNumber}؟ سيتم عكس أثره المالي على رصيد الطرف تلقائياً.`)) {
                          onDeleteVoucher(v.id);
                        }
                      }}
                      className="p-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 transition-colors"
                      title="حذف وعكس الرصيد"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Amount and Method */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">طريقة الدفع</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        {v.paymentMethod === 'cash' ? '💵 نقدي (الصندوق)' : `🏦 بنك: ${v.bankName || 'إلكتروني'}`}
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">المبلغ</span>
                      <span className="font-black text-sm text-slate-900 dark:text-white">
                        {v.amount.toFixed(2)} {settings.currency}
                      </span>
                    </div>
                  </div>

                  {v.statement && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                      💬 <span className="font-semibold">{v.statement}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Vouchers Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">رقم السند والنوع</th>
                    <th className="px-3 py-3 font-bold">التاريخ</th>
                    <th className="px-3 py-3 font-bold">الطرف المعني</th>
                    <th className="px-3 py-3 font-bold">المبلغ</th>
                    <th className="px-3 py-3 font-bold">طريقة الدفع / الحساب</th>
                    <th className="px-3 py-3 font-bold">البيان والسبب</th>
                    <th className="px-3 py-3 font-bold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            v.type === 'receipt' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                              : v.type === 'payment' 
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' 
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          }`}>
                            {v.type === 'receipt' ? 'قبض ↓' : v.type === 'payment' ? 'صرف ↑' : 'قيد ⇄'}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{v.voucherNumber}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                        {new Date(v.date).toLocaleDateString('ar-EG')}
                      </td>

                      <td className="px-3 py-3 font-bold text-slate-800 dark:text-slate-200">
                        {v.partyName || (v.type === 'journal' ? `${v.debitAccount} / ${v.creditAccount}` : 'طرف عام')}
                      </td>

                      <td className="px-3 py-3 font-black text-sm text-slate-900 dark:text-white">
                        {v.amount.toFixed(2)} {settings.currency}
                      </td>

                      <td className="px-3 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {v.paymentMethod === 'cash' ? 'نقدي (الصندوق)' : `بنك: ${v.bankName || 'إلكتروني'}`}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {v.statement || '-'}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              if (confirm(`حذف السند ${v.voucherNumber}؟ سيتم عكس أثره المالي على رصيد الطرف تلقائياً.`)) {
                                onDeleteVoucher(v.id);
                              }
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            title="حذف وعكس الرصيد"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ================= MODAL: ADD VOUCHER ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-3 text-white ${
              voucherType === 'receipt' ? 'bg-emerald-600' : voucherType === 'payment' ? 'bg-teal-600' : 'bg-indigo-600'
            }`}>
              <h3 className="font-extrabold text-sm">
                {voucherType === 'receipt' ? 'تسجيل سند قبض نقدية' : voucherType === 'payment' ? 'تسجيل سند صرف نقدية' : 'تسجيل سند قيد محاسبي'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
              {/* Party selection for receipt/payment */}
              {voucherType !== 'journal' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {voucherType === 'receipt' ? 'العميل المسدد *:' : 'المورد المستلم *:'}
                  </label>
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {voucherType === 'receipt' ? (
                      customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} - (الرصيد: {c.balance.toFixed(2)} {settings.currency})
                        </option>
                      ))
                    ) : (
                      suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} - (المستحق له: {s.balance.toFixed(2)} {settings.currency})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Journal Accounts */}
              {voucherType === 'journal' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">من حـ/ المدين:</label>
                    <input
                      type="text"
                      required
                      value={debitAccount}
                      onChange={(e) => setDebitAccount(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">إلى حـ/ الدائن:</label>
                    <input
                      type="text"
                      required
                      value={creditAccount}
                      onChange={(e) => setCreditAccount(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المبلغ ({settings.currency}) *:
                </label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.5"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-base font-black text-center text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-2 rounded-xl font-bold ${paymentMethod === 'cash' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-slate-100 text-slate-700'}`}
                  >
                    نقدي (الصندوق)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`p-2 rounded-xl font-bold ${paymentMethod === 'bank' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    حساب بنكي / محفظة
                  </button>
                </div>
              </div>

              {/* Bank selector */}
              {paymentMethod === 'bank' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اختر الحساب البنكي:</label>
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{b.name} - {b.accountName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Statement */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">البيان / الشرح *:</label>
                <input
                  type="text"
                  required
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="مثال: دفعة سداد من الحساب الآجل..."
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"
                >
                  حفظ السند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
