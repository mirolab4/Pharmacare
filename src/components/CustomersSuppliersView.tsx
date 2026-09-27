import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Truck, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Phone, 
  MapPin, 
  X,
  Printer
} from 'lucide-react';
import { Customer, Supplier, Invoice, Voucher, Settings } from '../types/pharmacy';

interface CustomersSuppliersViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  vouchers: Voucher[];
  settings: Settings;
  onSaveCustomer: (c: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onSaveSupplier: (s: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onQuickVoucher: (voucher: Voucher) => void;
}

export const CustomersSuppliersView: React.FC<CustomersSuppliersViewProps> = ({
  customers,
  suppliers,
  invoices,
  vouchers,
  settings,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveSupplier,
  onDeleteSupplier,
  onQuickVoucher,
}) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Modals
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custBalance, setCustBalance] = useState<number>(0);
  const [custCreditLimit, setCustCreditLimit] = useState<number>(0);
  const [custMaxDebtDays, setCustMaxDebtDays] = useState<number>(30);
  const [custNotes, setCustNotes] = useState('');

  // Supplier Modals
  const [isSupModalOpen, setIsSupModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supBalance, setSupBalance] = useState<number>(0);
  const [supNotes, setSupNotes] = useState('');

  // Account Statement Modal (كشف الحساب)
  const [selectedStatementCustomer, setSelectedStatementCustomer] = useState<Customer | null>(null);

  // Quick Voucher Modal (سند قبض من عميل أو سند صرف لمورد)
  const [voucherModalType, setVoucherModalType] = useState<'receipt' | 'payment' | null>(null);
  const [voucherParty, setVoucherParty] = useState<{ id: string; name: string; type: 'customer' | 'supplier' } | null>(null);
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
  const [voucherStatement, setVoucherStatement] = useState<string>('');
  const [voucherMethod, setVoucherMethod] = useState<'cash' | 'bank'>('cash');

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter(c => 
      !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, searchQuery]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return suppliers.filter(s => 
      !q || s.name.toLowerCase().includes(q) || s.phone.includes(q)
    );
  }, [suppliers, searchQuery]);

  // Open Add Customer
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustBalance(0);
    setCustCreditLimit(0);
    setCustMaxDebtDays(30);
    setCustNotes('');
    setIsCustModalOpen(true);
  };

  // Open Edit Customer
  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustName(c.name);
    setCustPhone(c.phone);
    setCustAddress(c.address || '');
    setCustBalance(c.balance);
    setCustCreditLimit(c.creditLimit || 0);
    setCustMaxDebtDays(c.maxDebtDays || 30);
    setCustNotes(c.notes || '');
    setIsCustModalOpen(true);
  };

  // Save Customer
  const handleSubmitCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    const item: Customer = {
      id: editingCustomer ? editingCustomer.id : 'cust-' + Date.now(),
      name: custName.trim(),
      phone: custPhone.trim(),
      address: custAddress.trim(),
      balance: Number(custBalance) || 0,
      creditLimit: Number(custCreditLimit) || 0,
      maxDebtDays: Number(custMaxDebtDays) || 30,
      notes: custNotes.trim(),
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
    };

    onSaveCustomer(item);
    setIsCustModalOpen(false);
  };

  // Open Add Supplier
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupAddress('');
    setSupBalance(0);
    setSupNotes('');
    setIsSupModalOpen(true);
  };

  // Open Edit Supplier
  const handleOpenEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupName(s.name);
    setSupPhone(s.phone);
    setSupAddress(s.address || '');
    setSupBalance(s.balance);
    setSupNotes(s.notes || '');
    setIsSupModalOpen(true);
  };

  // Save Supplier
  const handleSubmitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    const item: Supplier = {
      id: editingSupplier ? editingSupplier.id : 'sup-' + Date.now(),
      name: supName.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      balance: Number(supBalance) || 0,
      notes: supNotes.trim(),
      createdAt: editingSupplier ? editingSupplier.createdAt : new Date().toISOString(),
    };

    onSaveSupplier(item);
    setIsSupModalOpen(false);
  };

  // Open Quick Receipt Voucher for Customer
  const handleOpenReceiptForCustomer = (c: Customer) => {
    setVoucherModalType('receipt');
    setVoucherParty({ id: c.id, name: c.name, type: 'customer' });
    setVoucherAmount(c.balance > 0 ? c.balance : 0);
    setVoucherStatement(`سداد دفعة من الحساب نقداً من الزبون ${c.name}`);
    setVoucherMethod('cash');
  };

  // Open Quick Payment Voucher for Supplier
  const handleOpenPaymentForSupplier = (s: Supplier) => {
    setVoucherModalType('payment');
    setVoucherParty({ id: s.id, name: s.name, type: 'supplier' });
    setVoucherAmount(s.balance > 0 ? s.balance : 0);
    setVoucherStatement(`دفعة سداد حساب المورد ${s.name}`);
    setVoucherMethod('cash');
  };

  // Submit Voucher
  const handleSubmitVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherParty || !voucherModalType || voucherAmount <= 0) return;

    const vch: Voucher = {
      id: 'vch-' + Date.now(),
      voucherNumber: (voucherModalType === 'receipt' ? 'REC-' : 'PAY-') + Math.floor(100 + Math.random() * 900),
      type: voucherModalType,
      date: new Date().toISOString(),
      partyType: voucherParty.type,
      partyId: voucherParty.id,
      partyName: voucherParty.name,
      amount: Number(voucherAmount),
      paymentMethod: voucherMethod,
      statement: voucherStatement.trim(),
      createdAt: new Date().toISOString(),
    };

    onQuickVoucher(vch);
    setVoucherModalType(null);
  };

  // Customer statement rows: Invoices + Receipts combined & sorted by date
  const customerStatementRows = useMemo(() => {
    if (!selectedStatementCustomer) return [];

    const custInvoices = invoices.filter(i => i.customerId === selectedStatementCustomer.id);
    const custVouchers = vouchers.filter(v => v.partyType === 'customer' && v.partyId === selectedStatementCustomer.id);

    const events = [
      ...custInvoices.map(inv => ({
        id: inv.id,
        date: inv.date,
        type: 'invoice',
        reference: inv.invoiceNumber,
        description: `فاتورة مبيعات (${inv.paymentMethod === 'credit' ? 'آجل' : 'نقدي'}) - ${inv.items.length} صنف`,
        debit: inv.remainingAmount > 0 ? inv.remainingAmount : (inv.paymentMethod === 'credit' ? inv.totalAmount : 0), // يزيد المديونية
        credit: 0,
        status: inv.status,
      })),
      ...custVouchers.map(vch => ({
        id: vch.id,
        date: vch.date,
        type: 'voucher',
        reference: vch.voucherNumber,
        description: vch.statement || (vch.type === 'receipt' ? 'سند قبض - دفعة نقدية' : 'سند صرف'),
        debit: vch.type === 'payment' ? vch.amount : 0,
        credit: vch.type === 'receipt' ? vch.amount : 0, // يقلل المديونية
        status: 'active',
      })),
    ];

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedStatementCustomer, invoices, vouchers]);

  return (
    <div className="space-y-4">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white p-3 sm:p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'customers'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>سجل العملاء ({customers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'suppliers'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>سجل الموردين ({suppliers.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`بحث بالاسم أو الهاتف...`}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pr-9 pl-3 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Add Button */}
          {activeTab === 'customers' ? (
            <button
              onClick={handleOpenAddCustomer}
              className="flex items-center gap-1 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>+ عميل جديد</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddSupplier}
              className="flex items-center gap-1 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>+ مورد جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Customers Table & Mobile Cards */}
      {activeTab === 'customers' && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">لا يوجد عملاء مطابقون للبحث</div>
          ) : (
            <>
              {/* Mobile Customers Cards */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
                {filteredCustomers.map(c => (
                  <div
                    key={c.id}
                    className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {c.name}
                        </div>
                        {c.phone && (
                          <div className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                            📞 {c.phone}
                          </div>
                        )}
                        {c.address && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            📍 {c.address}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCustomer(c)}
                          className="p-2 rounded-xl text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 transition-colors"
                          title="تعديل"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`حذف العميل "${c.name}"؟`)) {
                              onDeleteCustomer(c.id);
                            }
                          }}
                          className="p-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 text-xs">
                      <span className="text-slate-500 font-bold">الرصيد الحالي:</span>
                      <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                        c.balance > 0
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {c.balance.toFixed(2)} {settings.currency}
                        {c.balance > 0 && <span className="mr-1 text-[10px] font-normal">(مديونية)</span>}
                      </span>
                    </div>

                    {/* Credit Limit & Debt Progress */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] space-y-1.5">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>سقف الائتمان:</span>
                        <strong className="font-bold text-sky-700 dark:text-sky-400">
                          {c.creditLimit ? `${c.creditLimit.toFixed(2)} ${settings.currency}` : 'غير محدد'}
                        </strong>
                      </div>
                      {c.creditLimit && c.creditLimit > 0 ? (
                        <>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (c.balance / c.creditLimit) >= 1
                                  ? 'bg-rose-600'
                                  : (c.balance / c.creditLimit) >= 0.8
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.round((c.balance / c.creditLimit) * 100))}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>نسبة الاستهلاك: {Math.round((c.balance / c.creditLimit) * 100)}%</span>
                            <span className={c.balance > c.creditLimit ? 'text-rose-600 font-bold' : ''}>
                              {c.balance > c.creditLimit ? '🚨 تجاوز الحد' : 'ضمن الحد المسموح'}
                            </span>
                          </div>
                        </>
                      ) : null}
                    </div>

                    {c.notes && (
                      <div className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                        📝 {c.notes}
                      </div>
                    )}

                    {/* Quick Statement & Receipt Voucher */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <button
                        onClick={() => setSelectedStatementCustomer(c)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-50 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 border border-sky-200/60 dark:border-sky-900"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>كشف حساب</span>
                      </button>
                      <button
                        onClick={() => handleOpenReceiptForCustomer(c)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900"
                      >
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                        <span>سند قبض</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Customers Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-bold">اسم العميل</th>
                      <th className="px-3 py-3 font-bold">رقم الهاتف</th>
                      <th className="px-3 py-3 font-bold">العنوان</th>
                      <th className="px-3 py-3 font-bold text-center">الرصيد الحالي (المديونية)</th>
                      <th className="px-3 py-3 font-bold">ملاحظات</th>
                      <th className="px-3 py-3 font-bold text-center">كشف الحساب والسندات</th>
                      <th className="px-3 py-3 font-bold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredCustomers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{c.name}</td>
                        <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-300" dir="ltr">{c.phone || '-'}</td>
                        <td className="px-3 py-3 text-slate-500">{c.address || '-'}</td>

                        {/* Balance (Debt) */}
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full font-black text-xs ${
                            c.balance > 0 
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800' 
                              : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {c.balance.toFixed(2)} {settings.currency}
                            {c.balance > 0 && <span className="block text-[9px] font-normal">مديونية</span>}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-slate-500">{c.notes || '-'}</td>

                        {/* Statement & Receipt Voucher */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedStatementCustomer(c)}
                              className="flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300"
                              title="كشف حساب تفصيلي"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>كشف حساب</span>
                            </button>

                            <button
                              onClick={() => handleOpenReceiptForCustomer(c)}
                              className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                              title="تسجيل دفعة نقدية (سند قبض)"
                            >
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                              <span>سند قبض</span>
                            </button>
                          </div>
                        </td>

                        {/* Edit / Delete */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditCustomer(c)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                              title="تعديل"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`حذف العميل "${c.name}"؟`)) {
                                  onDeleteCustomer(c.id);
                                }
                              }}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              title="حذف"
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
      )}

      {/* 2. Suppliers Table & Mobile Cards */}
      {activeTab === 'suppliers' && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          {filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">لا يوجد موردون مطابقون للبحث</div>
          ) : (
            <>
              {/* Mobile Suppliers Cards */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
                {filteredSuppliers.map(s => (
                  <div
                    key={s.id}
                    className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {s.name}
                        </div>
                        {s.phone && (
                          <div className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                            📞 {s.phone}
                          </div>
                        )}
                        {s.address && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            📍 {s.address}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditSupplier(s)}
                          className="p-2 rounded-xl text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 transition-colors"
                          title="تعديل"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`حذف المورد "${s.name}"؟`)) {
                              onDeleteSupplier(s.id);
                            }
                          }}
                          className="p-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 text-xs">
                      <span className="text-slate-500 font-bold">المستحق له:</span>
                      <span className="px-2.5 py-1 rounded-full font-black text-xs bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300">
                        {s.balance.toFixed(2)} {settings.currency}
                      </span>
                    </div>

                    {s.notes && (
                      <div className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                        📝 {s.notes}
                      </div>
                    )}

                    {/* Payment Voucher Button */}
                    <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <button
                        onClick={() => handleOpenPaymentForSupplier(s)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-50 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 border border-teal-200/60 dark:border-teal-900"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>سند صرف للمورد (تسديد دفعة)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Suppliers Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-bold">اسم المورد / الشركة</th>
                      <th className="px-3 py-3 font-bold">رقم الهاتف</th>
                      <th className="px-3 py-3 font-bold">العنوان</th>
                      <th className="px-3 py-3 font-bold text-center">المبلغ المستحق له</th>
                      <th className="px-3 py-3 font-bold">ملاحظات والتوريد</th>
                      <th className="px-3 py-3 font-bold text-center">المدفوعات</th>
                      <th className="px-3 py-3 font-bold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredSuppliers.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{s.name}</td>
                        <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-300" dir="ltr">{s.phone || '-'}</td>
                        <td className="px-3 py-3 text-slate-500">{s.address || '-'}</td>

                        {/* Balance */}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-full font-black text-xs bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300">
                            {s.balance.toFixed(2)} {settings.currency}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-slate-500">{s.notes || '-'}</td>

                        {/* Payment Voucher Button */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleOpenPaymentForSupplier(s)}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            <span>سند صرف للمورد</span>
                          </button>
                        </td>

                        {/* Edit / Delete */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditSupplier(s)}
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800"
                              title="تعديل"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`حذف المورد "${s.name}"؟`)) {
                                  onDeleteSupplier(s.id);
                                }
                              }}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              title="حذف"
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
      )}

      {/* ================= MODAL: ACCOUNT STATEMENT (كشف حساب العميل) ================= */}
      {selectedStatementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between border-b bg-sky-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <h3 className="font-extrabold text-sm">
                  كشف حساب تفصيلي: {selectedStatementCustomer.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStatementCustomer(null)}
                className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Header Info */}
              <div className="flex flex-wrap justify-between items-center rounded-xl bg-sky-50 p-3 text-xs dark:bg-sky-950/40 text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">الهاتف: </span>
                  <strong className="font-mono">{selectedStatementCustomer.phone}</strong>
                </div>
                <div>
                  <span className="text-slate-400">العنوان: </span>
                  <strong>{selectedStatementCustomer.address || 'غير محدد'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">الرصيد الحالي: </span>
                  <strong className="text-amber-700 dark:text-amber-400 font-bold text-sm">
                    {selectedStatementCustomer.balance.toFixed(2)} {settings.currency}
                  </strong>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">المرجع</th>
                      <th className="p-2">البيان والتفاصيل</th>
                      <th className="p-2 text-center text-amber-700">مدين (+)</th>
                      <th className="p-2 text-center text-emerald-700">دائن (-)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {customerStatementRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">
                          لا توجد حركات مسجلة لهذا العميل حتى الآن
                        </td>
                      </tr>
                    ) : (
                      customerStatementRows.map((row, idx) => (
                        <tr key={idx} className={row.status === 'cancelled' ? 'opacity-40 line-through' : ''}>
                          <td className="p-2 font-mono text-[11px] text-slate-500">
                            {new Date(row.date).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="p-2 font-mono font-bold text-sky-700 dark:text-sky-400">{row.reference}</td>
                          <td className="p-2 text-slate-700 dark:text-slate-300">{row.description}</td>
                          <td className="p-2 text-center font-bold text-amber-700">
                            {row.debit > 0 ? `${row.debit.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-2 text-center font-bold text-emerald-700">
                            {row.credit > 0 ? `${row.credit.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK VOUCHER (سند قبض / سند صرف) ================= */}
      {voucherModalType && voucherParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-3 text-white ${
              voucherModalType === 'receipt' ? 'bg-emerald-600' : 'bg-teal-600'
            }`}>
              <h3 className="font-extrabold text-sm">
                {voucherModalType === 'receipt' ? 'تسجيل سند قبض نقدية' : 'تسجيل سند صرف مالي'}
              </h3>
              <button onClick={() => setVoucherModalType(null)} className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitVoucher} className="p-4 space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-700 dark:text-slate-300">
                <span className="text-slate-400">الطرف المعني: </span>
                <strong className="text-sm font-extrabold">{voucherParty.name}</strong>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المبلغ ({settings.currency}) *:
                </label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.5"
                  value={voucherAmount || ''}
                  onChange={(e) => setVoucherAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-base font-black text-emerald-600 dark:border-slate-700 dark:bg-slate-800 text-center"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">البيان / السبب:</label>
                <input
                  type="text"
                  required
                  value={voucherStatement}
                  onChange={(e) => setVoucherStatement(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع:</label>
                <select
                  value={voucherMethod}
                  onChange={(e) => setVoucherMethod(e.target.value as 'cash' | 'bank')}
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
                >
                  <option value="cash">نقداً من الصندوق</option>
                  <option value="bank">حوالة بنكية / محفظة</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setVoucherModalType(null)}
                  className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`rounded-xl px-5 py-2 font-bold text-white shadow-xs ${
                    voucherModalType === 'receipt' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                >
                  حفظ وتأكيد السند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT CUSTOMER ================= */}
      {isCustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between border-b bg-sky-600 px-4 py-3 text-white">
              <h3 className="font-extrabold text-sm">
                {editingCustomer ? 'تعديل بيانات عميل' : 'إضافة عميل جديد'}
              </h3>
              <button onClick={() => setIsCustModalOpen(false)} className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomer} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم العميل *:</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="مثال: أحمد خليل النجار"
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف / الجوال:</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="059xxxxxxx"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 p-2 text-center font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العنوان / المنطقة:</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="المدينة والحي..."
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سقف الائتمان (الحد الأقصى للدين):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={custCreditLimit}
                    onChange={(e) => setCustCreditLimit(parseFloat(e.target.value) || 0)}
                    placeholder="0 = غير محدد"
                    className="w-full rounded-xl border border-slate-300 p-2 font-bold text-sky-700 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    فترة السداد (أيام):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={custMaxDebtDays}
                    onChange={(e) => setCustMaxDebtDays(parseInt(e.target.value, 10) || 30)}
                    placeholder="30"
                    className="w-full rounded-xl border border-slate-300 p-2 text-center font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الرصيد الافتتاحي (مديونية سابقة):</label>
                <input
                  type="number"
                  step="0.5"
                  value={custBalance}
                  onChange={(e) => setCustBalance(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 p-2 font-bold text-amber-700 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية:</label>
                <input
                  type="text"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustModalOpen(false)}
                  className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"
                >
                  حفظ العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT SUPPLIER ================= */}
      {isSupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between border-b bg-teal-600 px-4 py-3 text-white">
              <h3 className="font-extrabold text-sm">
                {editingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد / مستودع جديد'}
              </h3>
              <button onClick={() => setIsSupModalOpen(false)} className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المورد / الشركة *:</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="مثال: مستودع دار الشفاء المركزي"
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف / المندوب:</label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 p-2 text-center font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العنوان:</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="المدينة والمنطقة الصناعية..."
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الرصيد المستحق له حالياً:</label>
                <input
                  type="number"
                  step="0.5"
                  value={supBalance}
                  onChange={(e) => setSupBalance(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-300 p-2 font-bold text-purple-700 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات التوريد:</label>
                <input
                  type="text"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="أيام التوريد، مواعيد الدفع..."
                  className="w-full rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSupModalOpen(false)}
                  className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-700"
                >
                  حفظ المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
