import React, { useState } from 'react';
import { Building2, Smartphone, Plus, Edit3, Trash2, X, Check, ShieldCheck, ChevronDown, ChevronUp, Layers, DollarSign } from 'lucide-react';
import { Bank, BankSubAccount } from '../types/pharmacy';

interface BanksWalletsViewProps {
  banks: Bank[];
  currency?: string;
  onSaveBank: (bank: Bank) => void;
  onDeleteBank: (id: string) => void;
  onSaveSubAccount?: (subAccount: BankSubAccount) => void;
  onDeleteSubAccount?: (bankId: string, subId: string) => void;
}

export const BanksWalletsView: React.FC<BanksWalletsViewProps> = ({
  banks,
  currency = '₪',
  onSaveBank,
  onDeleteBank,
  onSaveSubAccount,
  onDeleteSubAccount,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  // Sub-account modal state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedBankForSub, setSelectedBankForSub] = useState<Bank | null>(null);
  const [editingSub, setEditingSub] = useState<BankSubAccount | null>(null);
  const [subName, setSubName] = useState('');
  const [subAccountNumber, setSubAccountNumber] = useState('');
  const [subBalance, setSubBalance] = useState(0);

  // Bank Form State
  const [type, setType] = useState<'bank' | 'wallet'>('bank');
  const [name, setName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ibanOrEmail, setIbanOrEmail] = useState('');
  const [balance, setBalance] = useState(0);
  const [notes, setNotes] = useState('');

  // Expanded sub-accounts accordion
  const [expandedBankIds, setExpandedBankIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (bankId: string) => {
    setExpandedBankIds(prev => ({ ...prev, [bankId]: !prev[bankId] }));
  };

  const handleOpenAdd = () => {
    setEditingBank(null);
    setType('bank');
    setName('');
    setAccountName('');
    setAccountNumber('');
    setIbanOrEmail('');
    setBalance(0);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: Bank) => {
    setEditingBank(b);
    setType(b.type);
    setName(b.name);
    setAccountName(b.accountName || b.name);
    setAccountNumber(b.accountNumber);
    setIbanOrEmail(b.ibanOrEmail);
    setBalance(b.balance || 0);
    setNotes(b.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('الرجاء كتابة اسم البنك أو المحفظة');
      return;
    }

    const item: Bank = {
      id: editingBank ? editingBank.id : 'bank-' + Date.now(),
      type,
      name: name.trim(),
      accountName: accountName.trim() || name.trim(),
      accountNumber: accountNumber.trim(),
      ibanOrEmail: ibanOrEmail.trim(),
      balance: Number(balance) || 0,
      subAccounts: editingBank?.subAccounts || [],
      notes: notes.trim(),
    };

    onSaveBank(item);
    setIsModalOpen(false);
  };

  const handleOpenAddSub = (b: Bank) => {
    setSelectedBankForSub(b);
    setEditingSub(null);
    setSubName('');
    setSubAccountNumber('');
    setSubBalance(0);
    setIsSubModalOpen(true);
  };

  const handleOpenEditSub = (b: Bank, s: BankSubAccount) => {
    setSelectedBankForSub(b);
    setEditingSub(s);
    setSubName(s.name);
    setSubAccountNumber(s.accountNumber);
    setSubBalance(s.balance || 0);
    setIsSubModalOpen(true);
  };

  const handleSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankForSub || !subName.trim()) {
      alert('يرجى إدخال اسم الحساب الفرعي');
      return;
    }

    const subItem: BankSubAccount = {
      id: editingSub ? editingSub.id : 'sub-' + Date.now(),
      bankId: selectedBankForSub.id,
      name: subName.trim(),
      accountNumber: subAccountNumber.trim(),
      balance: Number(subBalance) || 0,
    };

    if (onSaveSubAccount) {
      onSaveSubAccount(subItem);
    } else {
      // Fallback update on bank object directly
      const updatedSubs = [...(selectedBankForSub.subAccounts || [])];
      const existingIdx = updatedSubs.findIndex(s => s.id === subItem.id);
      if (existingIdx >= 0) updatedSubs[existingIdx] = subItem;
      else updatedSubs.push(subItem);
      onSaveBank({ ...selectedBankForSub, subAccounts: updatedSubs });
    }

    setIsSubModalOpen(false);
  };

  const handleDeleteSub = (b: Bank, subId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب الفرعي؟')) return;
    if (onDeleteSubAccount) {
      onDeleteSubAccount(b.id, subId);
    } else {
      const updatedSubs = (b.subAccounts || []).filter(s => s.id !== subId);
      onSaveBank({ ...b, subAccounts: updatedSubs });
    }
  };

  // Grand total of all banks & sub-accounts
  const grandTotal = banks.reduce((sum, b) => sum + (b.totalBalance ?? b.balance ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-white p-4 sm:p-5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <span>الحسابات البنكية والمحافظ والحسابات الفرعية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الحسابات البنكية، والمحافظ الإلكترونية، مع الحسابات الفرعية لكل بنك وعرض إجمالي الرصيد موحداً
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 sm:px-4 py-2 text-right dark:bg-emerald-950/40 dark:border-emerald-800 flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">إجمالي كافة الأرصدة</span>
            <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300">
              {grandTotal.toLocaleString()} {currency}
            </span>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all flex-1 sm:flex-initial"
          >
            <Plus className="h-4 w-4" />
            <span>+ إضافة بنك / محفظة</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {banks.map((b) => {
          const subs = b.subAccounts || [];
          const subsSum = subs.reduce((sum, s) => sum + (s.balance || 0), 0);
          const computedTotal = (b.balance || 0) + subsSum;
          const isExpanded = expandedBankIds[b.id];

          return (
            <div
              key={b.id}
              className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 hover:border-indigo-300 transition-all dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between"
            >
              <div>
                {/* Bank Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      b.type === 'wallet' 
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' 
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}>
                      {b.type === 'wallet' ? <Smartphone className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">
                        {b.type === 'wallet' ? '📱 محفظة رقمية' : '🏦 حساب بنكي'}
                      </span>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{b.name}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(b)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                      title="تعديل"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف ${b.name}؟`)) {
                          onDeleteBank(b.id);
                        }
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800"
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Account Details */}
                <div className="mt-3 space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">رقم الحساب الرئيسي:</span>
                    <span className="font-mono font-bold">{b.accountNumber || '—'}</span>
                  </div>
                  {b.ibanOrEmail && (
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">الأيبان / المعرّف:</span>
                      <span className="font-mono text-[11px] truncate max-w-[180px]">{b.ibanOrEmail}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400">رصيد الحساب الرئيسي:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{b.balance?.toLocaleString()} {currency}</span>
                  </div>
                </div>

                {/* Total Balance Badge (Main + Sub-Accounts) */}
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 dark:from-slate-800 dark:to-slate-800/80 dark:border-indigo-950 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">إجمالي الرصيد (مع الفروع):</span>
                  </div>
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                    {computedTotal.toLocaleString()} {currency}
                  </span>
                </div>

                {/* Sub-Accounts Accordion Header */}
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => toggleExpand(b.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5 text-indigo-500" />
                    <span>الحسابات الفرعية ({subs.length})</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={() => handleOpenAddSub(b)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>فرعي جديد</span>
                  </button>
                </div>

                {/* Sub-Accounts List */}
                {isExpanded && (
                  <div className="mt-2 space-y-1.5 pl-1 pr-1">
                    {subs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                        لا توجد حسابات فرعية مضافة بعد لهذا البنك
                      </p>
                    ) : (
                      subs.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{s.accountNumber}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {s.balance.toLocaleString()} {currency}
                            </span>
                            <button
                              onClick={() => handleOpenEditSub(b, s)}
                              className="text-slate-400 hover:text-indigo-600 p-0.5"
                              title="تعديل الحساب الفرعي"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteSub(b, s.id)}
                              className="text-slate-400 hover:text-rose-600 p-0.5"
                              title="حذف الحساب الفرعي"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Bank Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-600" />
                <span>{editingBank ? 'تعديل الحساب / المحفظة' : 'إضافة بنك أو محفظة جديدة'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">النوع</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('bank')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      type === 'bank'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>حساب بنكي 🏦</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('wallet')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      type === 'wallet'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800'
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>محفظة رقمية 📱</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم البنك أو المحفظة *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثل: بنك فلسطين، PalPay، جوال باي"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الحساب الأساسي
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="مثال: 1234567"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الرصيد الافتتاحي الرئيسي
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الآيبان الدولي (IBAN) أو الإيميل
                </label>
                <input
                  type="text"
                  value={ibanOrEmail}
                  onChange={(e) => setIbanOrEmail(e.target.value)}
                  placeholder="PS00... أو بريد PayPal"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="فرع البنك، أو الغرض من الحساب..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
                >
                  <Check className="h-4 w-4" />
                  <span>حفظ الحساب</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Account Modal */}
      {isSubModalOpen && selectedBankForSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <span>
                  {editingSub ? 'تعديل الحساب الفرعي' : `إضافة حساب فرعي تابع لـ (${selectedBankForSub.name})`}
                </span>
              </h3>
              <button onClick={() => setIsSubModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الحساب الفرعي / الفرع *
                </label>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="مثل: فرع جنين - جاري، حساب شيكات، نقطة بيع"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رقم الحساب الفرعي
                </label>
                <input
                  type="text"
                  value={subAccountNumber}
                  onChange={(e) => setSubAccountNumber(e.target.value)}
                  placeholder="رقم الحساب أو الآيبان الفرعي"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الرصيد الحالي لهذا الفرع
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={subBalance}
                  onChange={(e) => setSubBalance(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-900 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
                >
                  <Check className="h-4 w-4" />
                  <span>حفظ الفرعي</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
