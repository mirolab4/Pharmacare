import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, 
  Search, 
  Barcode, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Printer, 
  User, 
  Building2, 
  FileText, 
  AlertCircle,
  Receipt
} from 'lucide-react';
import { 
  Product, 
  Customer, 
  Bank, 
  Invoice, 
  InvoiceItem, 
  Settings 
} from '../types/pharmacy';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface SalesReturnsViewProps {
  products: Product[];
  customers: Customer[];
  banks: Bank[];
  invoices: Invoice[];
  settings: Settings;
  onSaveReturnInvoice: (invoice: Invoice) => void;
}

export const SalesReturnsView: React.FC<SalesReturnsViewProps> = ({
  products,
  customers,
  banks,
  invoices,
  settings,
  onSaveReturnInvoice,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'credit'>('cash');
  const [selectedBankId, setSelectedBankId] = useState<string>(banks[0]?.id || '');
  const [notes, setNotes] = useState<string>('');

  // Invoice Lookup to return from
  const [lookupInvoiceNumber, setLookupInvoiceNumber] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState<Invoice | null>(null);

  // Return cart items
  const [returnItems, setReturnItems] = useState<InvoiceItem[]>([]);

  // Manual Product search & scanner
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number>(0);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [refundPrice, setRefundPrice] = useState<number>(0);

  // Last completed return for printing receipt
  const [lastReturnInvoice, setLastReturnInvoice] = useState<Invoice | null>(null);

  const currency = settings.currency || '₪';

  // Find invoice by number
  const handleLookupInvoice = () => {
    if (!lookupInvoiceNumber.trim()) return;
    const found = invoices.find(
      i => i.invoiceNumber.toLowerCase() === lookupInvoiceNumber.trim().toLowerCase() && i.status === 'active'
    );
    if (found) {
      setMatchedInvoice(found);
      if (found.customerId) setSelectedCustomerId(found.customerId);
      const method = found.paymentMethod === 'card' ? 'bank' : found.paymentMethod;
      setPaymentMethod(method);
      if (found.bankId) setSelectedBankId(found.bankId);
    } else {
      alert(`لم يتم العثور على فاتورة نشطة برقم: ${lookupInvoiceNumber}`);
    }
  };

  // Add item from matched invoice into return list
  const handleAddFromInvoice = (item: InvoiceItem) => {
    const existing = returnItems.find(it => it.productId === item.productId && it.unitIndex === item.unitIndex);
    if (existing) {
      alert('تمت إضافة هذا الصنف مسبقاً في قائمة المرتجع');
      return;
    }

    setReturnItems([...returnItems, { ...item, quantity: 1, total: item.salePrice }]);
  };

  // Manual Product Search Filter
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p =>
      p.nameAr.toLowerCase().includes(q) ||
      p.nameEn?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    ).slice(0, 6);
  }, [products, searchQuery]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedUnitIndex(0);
    setReturnQty(1);
    setRefundPrice(product.units[0]?.salePrice || product.lastSalePrice || 0);
    setSearchQuery('');
  };

  const handleBarcodeScanned = (barcode: string) => {
    const found = products.find(p => p.barcode === barcode);
    if (found) {
      handleSelectProduct(found);
    } else {
      alert(`لم يتم العثور على صنف بالباركود: ${barcode}`);
    }
    setIsScannerOpen(false);
  };

  // Add Manual Item to Return
  const handleAddManualItem = () => {
    if (!selectedProduct) return;
    const unit = selectedProduct.units[selectedUnitIndex] || selectedProduct.units[0];
    if (!unit) return;

    const newItem: InvoiceItem = {
      id: 'ritem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      productId: selectedProduct.id,
      productName: selectedProduct.nameAr,
      unitIndex: selectedUnitIndex,
      unitName: unit.name,
      unitFactor: unit.factor,
      quantity: returnQty,
      salePrice: refundPrice,
      costPrice: unit.costPrice || 0,
      total: returnQty * refundPrice,
      profit: 0,
    };

    setReturnItems([...returnItems, newItem]);
    setSelectedProduct(null);
  };

  const handleRemoveReturnItem = (idx: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== idx));
  };

  const handleUpdateItemQty = (idx: number, qty: number) => {
    const updated = [...returnItems];
    updated[idx].quantity = Math.max(1, qty);
    updated[idx].total = updated[idx].quantity * updated[idx].salePrice;
    setReturnItems(updated);
  };

  // Totals
  const totalRefundAmount = returnItems.reduce((sum, item) => sum + item.total, 0);

  // Submit Sales Return
  const handleSubmitReturn = () => {
    if (returnItems.length === 0) {
      alert('الرجاء اختيار أصناف للإرجاع');
      return;
    }

    const returnNumber = 'RET-' + Date.now().toString().slice(-6);
    const customer = customers.find(c => c.id === selectedCustomerId);

    const returnInvoice: Invoice = {
      id: 'inv-ret-' + Date.now(),
      invoiceNumber: returnNumber,
      date: new Date().toISOString(),
      type: 'sale_return',
      customerId: selectedCustomerId || undefined,
      customerName: customer ? customer.name : 'زبون نقدي',
      items: returnItems,
      subtotal: totalRefundAmount,
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: totalRefundAmount,
      totalCost: returnItems.reduce((sum, i) => sum + (i.costPrice * i.quantity), 0),
      totalProfit: 0,
      paymentMethod,
      bankId: paymentMethod === 'bank' ? selectedBankId : undefined,
      paidAmount: paymentMethod === 'credit' ? 0 : totalRefundAmount,
      remainingAmount: paymentMethod === 'credit' ? totalRefundAmount : 0,
      status: 'active',
      notes: `مرتجع كاشير${matchedInvoice ? ` عن الفاتورة الأصلية ${matchedInvoice.invoiceNumber}` : ''}${notes ? ` - ${notes}` : ''}`,
      createdAt: new Date().toISOString(),
    };

    onSaveReturnInvoice(returnInvoice);
    setLastReturnInvoice(returnInvoice);

    // Reset
    setReturnItems([]);
    setMatchedInvoice(null);
    setLookupInvoiceNumber('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-rose-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              صفحة مرجع الكاشير (مردودات مبيعات الزبائن)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إرجاع الأدوية المباعة إلى المخزون، واسترداد القيمة نقداً أو بنكياً أو خصمها من رصيد العميل الآجل
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Search / Lookup & Return Cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Lookup Original Invoice */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-indigo-600" />
              <span>بحث عن فاتورة مبيعات سابقة لاسترجاع أصنافها (اختياري)</span>
            </span>

            <div className="flex gap-2">
              <input
                type="text"
                value={lookupInvoiceNumber}
                onChange={(e) => setLookupInvoiceNumber(e.target.value)}
                placeholder="أدخل رقم الفاتورة (مثلاً: INV-1001)..."
                className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <button
                type="button"
                onClick={handleLookupInvoice}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                جلب الفاتورة
              </button>
            </div>

            {matchedInvoice && (
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900 space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span>الفاتورة: {matchedInvoice.invoiceNumber} ({matchedInvoice.customerName})</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                    القيمة: {matchedInvoice.totalAmount} {currency}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  انقر على الصنف لإضافته إلى قائمة المرتجع:
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {matchedInvoice.items.map(it => (
                    <button
                      key={it.id}
                      onClick={() => handleAddFromInvoice(it)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold hover:bg-indigo-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                    >
                      + {it.productName} ({it.unitName}) - {it.salePrice} {currency}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual Search or Barcode Scanner */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Search className="h-4 w-4 text-rose-600" />
                <span>أو إضافة صنف يدوي للإرجاع بالاسم أو الباركود</span>
              </span>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
              >
                <Barcode className="h-4 w-4 text-indigo-600" />
                <span>مسح باركود</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن الصنف المرتجع..."
                className="w-full rounded-xl border border-slate-200 p-2.5 pl-10 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

              {filteredProducts.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl bg-white p-1.5 shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  {filteredProducts.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{p.nameAr}</span>
                      <span className="text-xs text-slate-500 font-mono">المخزون الحالي: {p.stock}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span>{selectedProduct.nameAr}</span>
                  <button onClick={() => setSelectedProduct(null)} className="text-rose-600 font-bold">إلغاء ✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">الوحدة</label>
                    <select
                      value={selectedUnitIndex}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        setSelectedUnitIndex(idx);
                        setRefundPrice(selectedProduct.units[idx]?.salePrice || 0);
                      }}
                      className="w-full rounded-lg border p-1.5 font-bold dark:bg-slate-800"
                    >
                      {selectedProduct.units.map((u, i) => (
                        <option key={u.id} value={i}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">الكمية المرتجعة</label>
                    <input
                      type="number"
                      min="1"
                      value={returnQty}
                      onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-lg border p-1.5 font-bold text-center dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">سعر الاسترداد ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={refundPrice}
                      onChange={(e) => setRefundPrice(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border p-1.5 font-bold text-center dark:bg-slate-800"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddManualItem}
                  className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs mt-1"
                >
                  + إضافة إلى قائمة المرتجع
                </button>
              </div>
            )}
          </div>

          {/* Return Items Cart */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                الأدوية المراد إرجاعها للمخزون ({returnItems.length})
              </span>
              {returnItems.length > 0 && (
                <button onClick={() => setReturnItems([])} className="text-xs text-rose-500 font-bold">
                  مسح القائمة
                </button>
              )}
            </div>

            {returnItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                لا توجد أصناف في قائمة المرتجع حالياً
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-2 px-2">الصنف</th>
                      <th className="py-2 px-2">الوحدة</th>
                      <th className="py-2 px-2 text-center">الكمية</th>
                      <th className="py-2 px-2 text-center">السعر</th>
                      <th className="py-2 px-2 text-center">إجمالي الاسترداد</th>
                      <th className="py-2 px-2 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {returnItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-2 font-bold">{item.productName}</td>
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">{item.unitName}</td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                            className="w-16 rounded border text-center p-1 font-bold dark:bg-slate-800"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">{item.salePrice.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-600">
                          {item.total.toFixed(2)} {currency}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            onClick={() => handleRemoveReturnItem(idx)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Refund Payment & Confirmation */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4 text-rose-600" />
              <span>تفاصيل رد المبلغ للزبون</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                العميل (اختياري)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                <option value="">-- زبون نقدي عام --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (ذمته: {c.balance} {currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                طريقة استرجاع المبلغ:
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 rounded-xl border transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'border-slate-200 text-slate-600 dark:border-slate-800'
                  }`}
                >
                  نقداً من الصندوق 💵
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`py-2 rounded-xl border transition-all ${
                    paymentMethod === 'bank'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 dark:border-slate-800'
                  }`}
                >
                  تحويل بنكي 🏦
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`py-2 rounded-xl border transition-all ${
                    paymentMethod === 'credit'
                      ? 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'border-slate-200 text-slate-600 dark:border-slate-800'
                  }`}
                >
                  خصم من ذمة العميل ⏳
                </button>
              </div>
            </div>

            {paymentMethod === 'bank' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البنك المخصوم منه المبلغ:
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                سبب الإرجاع وملاحظات
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="سبب الإرجاع: خطأ في الصنف، زيادة عن الحاجة..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            {/* Total Refund Banner */}
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                إجمالي المبلغ المسترد للزبون:
              </span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {totalRefundAmount.toFixed(2)} {currency}
              </span>
              <p className="text-[10px] text-slate-500 pt-1">
                سيتم إعادة كميات الأصناف تلقائياً إلى رصيد المخزون فور تأكيد الإرجاع.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmitReturn}
              disabled={returnItems.length === 0}
              className="w-full py-3 rounded-xl font-black text-sm bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="h-5 w-5" />
              <span>تأكيد المرتجع وإعادة الأصناف للمخزون</span>
            </button>
          </div>

          {/* Last Return Receipt Modal / View */}
          {lastReturnInvoice && (
            <div className="rounded-2xl bg-white p-4 shadow-xs border border-emerald-200 dark:bg-slate-900 dark:border-emerald-800 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span>تم تسجيل مرتجع الكاشير بنجاح!</span>
                <span className="font-mono">#{lastReturnInvoice.invoiceNumber}</span>
              </div>
              <button
                onClick={() => window.print()}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة إيصال المرتجع</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScanned}
        />
      )}
    </div>
  );
};
