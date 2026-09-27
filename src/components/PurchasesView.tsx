import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Barcode, 
  Plus, 
  Trash2, 
  CheckCircle, 
  RotateCcw, 
  Building2, 
  User, 
  CreditCard, 
  DollarSign, 
  Calendar, 
  FileText, 
  Filter, 
  Printer, 
  AlertCircle,
  Layers,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { 
  Product, 
  Supplier, 
  Customer, 
  Bank, 
  Purchase, 
  PurchaseItem, 
  Settings 
} from '../types/pharmacy';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { recalculateUnitHierarchyPrices } from '../utils/unitsHelper';

interface PurchasesViewProps {
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  banks: Bank[];
  purchases?: Purchase[];
  settings: Settings;
  defaultType?: 'purchase' | 'purchase_return';
  initialMode?: 'purchase' | 'purchase_return';
  onSavePurchase?: (purchase: Purchase) => void;
  onSaveInvoice?: (purchase: any) => void;
  onCancelPurchase?: (purchaseId: string) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  products,
  suppliers,
  customers,
  banks,
  purchases = [],
  settings,
  defaultType = 'purchase',
  initialMode,
  onSavePurchase,
  onSaveInvoice,
  onCancelPurchase,
}) => {
  // Mode: 'purchase' (فاتورة مشتريات) vs 'purchase_return' (مرتجع مشتريات)
  const [purchaseType, setPurchaseType] = useState<'purchase' | 'purchase_return'>(initialMode || defaultType);

  // Tab: 'create' (إنشاء فاتورة) or 'history' (سجل فواتير ومردودات المشتريات)
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Party selection: 'supplier' or 'customer'
  const [partyType, setPartyType] = useState<'supplier' | 'customer'>('supplier');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [customPartyName, setCustomPartyName] = useState<string>('');

  // Payment details
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'credit'>('cash');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [selectedSubAccountId, setSelectedSubAccountId] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Cart / Items in current purchase
  const [cartItems, setCartItems] = useState<PurchaseItem[]>([]);

  // Product Search & Barcode
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<Product | null>(null);
  const [selectedUnitIdToAdd, setSelectedUnitIdToAdd] = useState<string>('');
  const [qtyToAdd, setQtyToAdd] = useState<number>(1);
  const [costPriceToAdd, setCostPriceToAdd] = useState<number>(0);
  const [salePriceToAdd, setSalePriceToAdd] = useState<number>(0);

  // Selected purchase for receipt/details modal
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  // Filter for history
  const [historyFilterType, setHistoryFilterType] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState<string>('');

  const currency = settings.currency || '₪';

  // Available banks with default
  useEffect(() => {
    if (banks.length > 0 && !selectedBankId) {
      setSelectedBankId(banks[0].id);
    }
  }, [banks]);

  // Update default party
  useEffect(() => {
    if (partyType === 'supplier' && suppliers.length > 0 && !selectedPartyId) {
      setSelectedPartyId(suppliers[0].id);
    } else if (partyType === 'customer' && customers.length > 0 && !selectedPartyId) {
      setSelectedPartyId(customers[0].id);
    }
  }, [partyType, suppliers, customers]);

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => 
      p.nameAr.toLowerCase().includes(q) ||
      p.nameEn?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    ).slice(0, 8);
  }, [products, searchQuery]);

  // When a product is selected from search
  const handleSelectProduct = (product: Product) => {
    setSelectedProductToAdd(product);
    const defaultUnit = product.units.find(u => !u.isBaseUnit && u.factor > 1) || product.units[0];
    setSelectedUnitIdToAdd(defaultUnit ? defaultUnit.id : '');
    setQtyToAdd(1);

    // Initial cost and sale price from unit or last recorded
    const unitCost = defaultUnit?.costPrice || product.lastCostPrice || 0;
    const unitSale = defaultUnit?.salePrice || product.lastSalePrice || 0;
    setCostPriceToAdd(unitCost);
    setSalePriceToAdd(unitSale);
    setSearchQuery('');
  };

  // When unit is changed in selection dialog
  const handleUnitChange = (unitId: string) => {
    setSelectedUnitIdToAdd(unitId);
    if (!selectedProductToAdd) return;
    const unit = selectedProductToAdd.units.find(u => u.id === unitId);
    if (unit) {
      setCostPriceToAdd(unit.costPrice || 0);
      setSalePriceToAdd(unit.salePrice || 0);
    }
  };

  // Add item to purchase cart
  const handleAddItemToCart = () => {
    if (!selectedProductToAdd || !selectedUnitIdToAdd) return;
    const unit = selectedProductToAdd.units.find(u => u.id === selectedUnitIdToAdd);
    if (!unit) return;

    const existingIndex = cartItems.findIndex(
      item => item.productId === selectedProductToAdd.id && item.unitId === selectedUnitIdToAdd
    );

    const total = qtyToAdd * costPriceToAdd;

    if (existingIndex >= 0) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += qtyToAdd;
      updated[existingIndex].costPrice = costPriceToAdd;
      updated[existingIndex].salePrice = salePriceToAdd;
      updated[existingIndex].total = updated[existingIndex].quantity * costPriceToAdd;
      setCartItems(updated);
    } else {
      const newItem: PurchaseItem = {
        id: 'pitem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        productId: selectedProductToAdd.id,
        productName: selectedProductToAdd.nameAr,
        barcode: selectedProductToAdd.barcode,
        unitId: unit.id,
        unitName: unit.name,
        unitFactor: unit.factor,
        quantity: qtyToAdd,
        costPrice: costPriceToAdd,
        salePrice: salePriceToAdd,
        total: total,
      };
      setCartItems([...cartItems, newItem]);
    }

    // Reset selection
    setSelectedProductToAdd(null);
    setSelectedUnitIdToAdd('');
    setQtyToAdd(1);
    setCostPriceToAdd(0);
    setSalePriceToAdd(0);
  };

  // Handle barcode scanned
  const handleBarcodeScanned = (barcode: string) => {
    const found = products.find(p => p.barcode === barcode);
    if (found) {
      handleSelectProduct(found);
    } else {
      alert(`لم يتم العثور على صنف بالباركود: ${barcode}`);
    }
    setIsScannerOpen(false);
  };

  // Remove cart item
  const handleRemoveItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const totalAmount = Math.max(0, subtotal - discount);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  // Auto-set paid amount if cash or bank
  useEffect(() => {
    if (paymentMethod === 'cash' || paymentMethod === 'bank') {
      setPaidAmount(totalAmount);
    } else if (paymentMethod === 'credit') {
      setPaidAmount(0);
    }
  }, [paymentMethod, totalAmount]);

  // Submit Purchase or Return
  const handleSavePurchase = () => {
    if (cartItems.length === 0) {
      alert('الرجاء إضافة أصناف إلى الفاتورة أولاً');
      return;
    }

    let partyName = customPartyName.trim();
    if (!partyName) {
      if (partyType === 'supplier') {
        const s = suppliers.find(sup => sup.id === selectedPartyId);
        partyName = s ? s.name : 'مورد عام';
      } else {
        const c = customers.find(cust => cust.id === selectedPartyId);
        partyName = c ? c.name : 'زبون عام';
      }
    }

    const purchaseNumber = (purchaseType === 'purchase' ? 'PUR-' : 'PRET-') + (Date.now().toString().slice(-6));

    const newPurchase: Purchase = {
      id: 'pur-' + Date.now(),
      purchaseNumber,
      date: new Date().toISOString(),
      type: purchaseType,
      partyType,
      partyId: selectedPartyId || undefined,
      partyName,
      items: cartItems,
      subtotal,
      discount,
      totalAmount,
      paidAmount: paymentMethod === 'credit' ? 0 : paidAmount,
      remainingAmount,
      paymentMethod,
      bankId: paymentMethod === 'bank' ? selectedBankId : undefined,
      bankSubAccountId: paymentMethod === 'bank' && selectedSubAccountId ? selectedSubAccountId : undefined,
      notes: notes.trim() || undefined,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    if (onSavePurchase) {
      onSavePurchase(newPurchase);
    } else if (onSaveInvoice) {
      onSaveInvoice(newPurchase);
    }

    // Show receipt
    setViewingPurchase(newPurchase);

    // Reset Form
    setCartItems([]);
    setDiscount(0);
    setNotes('');
    setCustomPartyName('');
  };

  // Filtered History
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (historyFilterType === 'purchase' && p.type !== 'purchase') return false;
      if (historyFilterType === 'purchase_return' && p.type !== 'purchase_return') return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        return (
          p.purchaseNumber.toLowerCase().includes(q) ||
          p.partyName.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [purchases, historyFilterType, historySearch]);

  const selectedBank = banks.find(b => b.id === selectedBankId);
  const availableSubAccounts = selectedBank?.subAccounts || [];

  return (
    <div className="space-y-4">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              {purchaseType === 'purchase' ? 'إدارة المشتريات وتوريد الأدوية' : 'صفحة مردودات المشتريات (مرجع الموردين)'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل فواتير الشراء، التبديل بين المورد والزبون، تقسيم الوحدات الذكي للأسعار، والدفع نقداً أو بنكياً
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch purchase type */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => { setPurchaseType('purchase'); setActiveTab('create'); }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                purchaseType === 'purchase'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>فاتورة شراء 📥</span>
            </button>
            <button
              onClick={() => { setPurchaseType('purchase_return'); setActiveTab('create'); }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                purchaseType === 'purchase_return'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>مرتجع مشتريات 📤</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Switch tab */}
          <button
            onClick={() => setActiveTab(activeTab === 'create' ? 'history' : 'create')}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <FileText className="h-4 w-4 text-indigo-500" />
            <span>{activeTab === 'create' ? 'سجل العمليات السابقة' : 'إنشاء فاتورة جديدة'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left/Middle 2 Columns: Items Entry & Cart */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search and Product Selection Card */}
            <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Search className="h-4 w-4 text-emerald-600" />
                  <span>البحث عن الصنف بالاسم أو مسح الباركود</span>
                </span>
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                >
                  <Barcode className="h-4 w-4 text-indigo-600" />
                  <span>قارئ الباركود (كاميرا)</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم العربي، اللاتيني، أو الباركود..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 pl-10 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

                {/* Dropdown Results */}
                {filteredProducts.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl bg-white p-1.5 shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="font-bold text-xs text-slate-900 dark:text-white block">{p.nameAr}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.nameEn || p.barcode}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-bold text-emerald-600 block">
                            المخزون: {p.stock} حبة
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {p.units.length} وحدات متاحة
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Product Configuration Card (Unit, Quantities, Prices) */}
              {selectedProductToAdd && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/60 pb-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {selectedProductToAdd.nameAr}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono">
                        باركود: {selectedProductToAdd.barcode} | التكلفة السابقة: {selectedProductToAdd.lastCostPrice || 0} {currency}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedProductToAdd(null)}
                      className="text-slate-400 hover:text-rose-600 text-xs font-bold"
                    >
                      إلغاء التحديد ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {/* Unit Selection */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        الوحدة المشتراة *
                      </label>
                      <select
                        value={selectedUnitIdToAdd}
                        onChange={(e) => handleUnitChange(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-2 font-bold text-slate-800 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      >
                        {selectedProductToAdd.units.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} (معامل {u.factor})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        الكمية *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={qtyToAdd}
                        onChange={(e) => setQtyToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full rounded-xl border border-slate-200 p-2 font-bold text-slate-900 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white text-center"
                      />
                    </div>

                    {/* Cost Price */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        سعر التكلفة للوحدة ({currency}) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={costPriceToAdd}
                        onChange={(e) => setCostPriceToAdd(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-200 p-2 font-bold text-slate-900 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white text-center"
                      />
                    </div>

                    {/* Sale Price */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        سعر البيع المقترح ({currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={salePriceToAdd}
                        onChange={(e) => setSalePriceToAdd(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-200 p-2 font-bold text-emerald-700 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-emerald-400 text-center"
                      />
                    </div>
                  </div>

                  {/* Auto Unit Division Preview */}
                  {selectedProductToAdd.units.length > 1 && (
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-emerald-100 dark:border-emerald-900/40 text-[11px]">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                        ⚡ تقسيم تلقائي لأسعار الوحدات الفرعية بناءً على التكلفة والبيع:
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {recalculateUnitHierarchyPrices(
                          selectedProductToAdd.units,
                          selectedUnitIdToAdd,
                          salePriceToAdd,
                          costPriceToAdd,
                          salePriceToAdd
                        ).map(u => (
                          <span key={u.id} className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-200">
                            {u.name}: تكلفة <b className="font-mono">{u.costPrice}</b> | بيع <b className="font-mono text-emerald-600 dark:text-emerald-400">{u.salePrice}</b> {currency}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={handleAddItemToCart}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>إدراج الصنف في الفاتورة ({(qtyToAdd * costPriceToAdd).toFixed(2)} {currency})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Table Card */}
            <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  قائمة الأصناف المدرجة ({cartItems.length})
                </span>
                {cartItems.length > 0 && (
                  <button
                    onClick={() => setCartItems([])}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                  >
                    تفريغ القائمة
                  </button>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  لم يتم إدراج أي أصناف في الفاتورة بعد. استخدم خانة البحث أو الباركود أعلاه لإضافة الأصناف.
                </div>
              ) : (
                <>
                  {/* Mobile Cards View */}
                  <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 space-y-2.5">
                    {cartItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="bg-slate-50/80 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                              {item.productName}
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold">
                              الوحدة: {item.unitName}
                            </span>
                          </div>

                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="حذف الصنف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block">الكمية:</span>
                            <span className="font-black text-slate-800 dark:text-slate-200">{item.quantity}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">سعر التكلفة:</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.costPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">سعر البيع:</span>
                            <span className="font-mono font-bold text-emerald-600">{item.salePrice.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                          <span className="text-slate-500 font-bold">الإجمالي للصنف:</span>
                          <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
                            {item.total.toFixed(2)} {currency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                          <th className="py-2 px-2">الصنف</th>
                          <th className="py-2 px-2">الوحدة</th>
                          <th className="py-2 px-2 text-center">الكمية</th>
                          <th className="py-2 px-2 text-center">سعر التكلفة</th>
                          <th className="py-2 px-2 text-center">سعر البيع</th>
                          <th className="py-2 px-2 text-center">الإجمالي</th>
                          <th className="py-2 px-2 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {cartItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-2 font-bold text-slate-900 dark:text-white">
                              {item.productName}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">
                              {item.unitName}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">
                              {item.costPrice.toFixed(2)} {currency}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-emerald-600 dark:text-emerald-400">
                              {item.salePrice.toFixed(2)} {currency}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                              {item.total.toFixed(2)} {currency}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                                title="حذف"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Invoice Details & Checkout */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>بيانات الطرف والدفع</span>
              </h3>

              {/* Party Type Toggle: Supplier vs Customer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع الطرف المتعامل معه:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPartyType('supplier'); setSelectedPartyId(suppliers[0]?.id || ''); }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      partyType === 'supplier'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>مورد (مستودع أدوية) 🏢</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPartyType('customer'); setSelectedPartyId(customers[0]?.id || ''); }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      partyType === 'customer'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    <span>زبون / عميل 👤</span>
                  </button>
                </div>
              </div>

              {/* Party Selection Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {partyType === 'supplier' ? 'اختر المورد *' : 'اختر العميل *'}
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="">-- اكتب اسماً مخصصاً أدناه --</option>
                  {partyType === 'supplier' ? (
                    suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (رصيد مستحق: {s.balance} {currency})
                      </option>
                    ))
                  ) : (
                    customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (ذمة: {c.balance} {currency})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {!selectedPartyId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    أو اكتب اسم {partyType === 'supplier' ? 'المورد' : 'العميل'} الجديد
                  </label>
                  <input
                    type="text"
                    value={customPartyName}
                    onChange={(e) => setCustomPartyName(e.target.value)}
                    placeholder="اسم الطرف..."
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  طريقة الدفع:
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 rounded-xl border transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800'
                    }`}
                  >
                    نقدي (الصندوق) 💵
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
                    حساب بنكي 🏦
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
                    آجل (ذمم) ⏳
                  </button>
                </div>
              </div>

              {/* Bank & Sub Account Selection if Payment is Bank */}
              {paymentMethod === 'bank' && (
                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-slate-800 border border-indigo-100 dark:border-indigo-950 space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      اختر البنك أو المحفظة:
                    </label>
                    <select
                      value={selectedBankId}
                      onChange={(e) => {
                        setSelectedBankId(e.target.value);
                        setSelectedSubAccountId('');
                      }}
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-900 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} (إجمالي الرصيد: {b.totalBalance ?? b.balance} {currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {availableSubAccounts.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        اختر الحساب الفرعي (اختياري):
                      </label>
                      <select
                        value={selectedSubAccountId}
                        onChange={(e) => setSelectedSubAccountId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-900 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      >
                        <option value="">الحساب الرئيسي الافتراضي</option>
                        {availableSubAccounts.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} (رصيد: {s.balance} {currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Discount & Notes */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    مبلغ الخصم ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full rounded-xl border border-slate-200 p-2 font-bold text-center dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    المبلغ المدفوع ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full rounded-xl border border-slate-200 p-2 font-bold text-center dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات الفاتورة
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="رقم إرسالية المورد، شروط الدفع، أو أي ملاحظات أخرى..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              {/* Totals Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono font-bold">{subtotal.toFixed(2)} {currency}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                    <span>الخصم المكتسب:</span>
                    <span className="font-mono">-{discount.toFixed(2)} {currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>الصافي الإجمالي:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{totalAmount.toFixed(2)} {currency}</span>
                </div>
                {remainingAmount > 0 && (
                  <div className="flex justify-between text-amber-600 font-bold">
                    <span>المتبقي (آجل مسجل في الذمة):</span>
                    <span className="font-mono">{remainingAmount.toFixed(2)} {currency}</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSavePurchase}
                disabled={cartItems.length === 0}
                className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
                  purchaseType === 'purchase'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <CheckCircle className="h-5 w-5" />
                <span>
                  {purchaseType === 'purchase' ? 'حفظ وترحيل فاتورة المشتريات' : 'حفظ وترحيل مرتجع المشتريات'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="ابحث برقم الفاتورة أو اسم الطرف..."
                className="rounded-xl border border-slate-200 p-2 text-xs w-full sm:w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <select
                value={historyFilterType}
                onChange={(e) => setHistoryFilterType(e.target.value)}
                className="rounded-xl border border-slate-200 p-2 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                <option value="all">جميع الحركات (مشتريات + مردودات)</option>
                <option value="purchase">فواتير الشراء فقط</option>
                <option value="purchase_return">مردودات المشتريات فقط</option>
              </select>
            </div>

            <span className="text-xs text-slate-400">
              إجمالي الحركات: <b>{filteredPurchases.length}</b>
            </span>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              لا توجد فواتير أو مردودات مطابقة للبحث
            </div>
          ) : (
            <>
              {/* Mobile Cards for Purchases History */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 space-y-2.5">
                {filteredPurchases.map(p => (
                  <div
                    key={p.id}
                    className="bg-slate-50/80 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.type === 'purchase'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {p.type === 'purchase' ? 'شراء 📥' : 'مرتجع 📤'}
                          </span>
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {p.purchaseNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                          {new Date(p.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'cancelled'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                      }`}>
                        {p.status === 'cancelled' ? 'ملغاة' : 'نشطة'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">الطرف:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{p.partyName}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block">الدفع:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {p.paymentMethod === 'cash' ? 'نقدي 💵' : p.paymentMethod === 'bank' ? 'بنكي 🏦' : 'آجل ⏳'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">المبلغ الإجمالي</span>
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {p.totalAmount.toLocaleString()} {currency}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewingPurchase(p)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold transition-colors"
                        >
                          عرض
                        </button>
                        {p.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من إلغاء حركة الشراء ${p.purchaseNumber} وعكس أثر المخزون والحسابات المالية؟`)) {
                                if (onCancelPurchase) onCancelPurchase(p.id);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-xs font-bold transition-colors"
                          >
                            إلغاء
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5 px-3">رقم الحركة</th>
                      <th className="py-2.5 px-3">النوع</th>
                      <th className="py-2.5 px-3">التاريخ والوقت</th>
                      <th className="py-2.5 px-3">الطرف</th>
                      <th className="py-2.5 px-3 text-center">طريقة الدفع</th>
                      <th className="py-2.5 px-3 text-center">الإجمالي</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                      <th className="py-2.5 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPurchases.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {p.purchaseNumber}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.type === 'purchase'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {p.type === 'purchase' ? 'شراء 📥' : 'مرتجع 📤'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {new Date(p.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                          {p.partyName}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            {p.paymentMethod === 'cash' ? 'نقدي 💵' : p.paymentMethod === 'bank' ? 'بنكي 🏦' : 'آجل ⏳'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                          {p.totalAmount.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'cancelled'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                          }`}>
                            {p.status === 'cancelled' ? 'ملغاة' : 'نشطة ومرحلة'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingPurchase(p)}
                              className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[11px] font-bold"
                              title="عرض الفاتورة"
                            >
                              عرض
                            </button>
                            {p.status !== 'cancelled' && (
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من إلغاء حركة الشراء ${p.purchaseNumber} وعكس أثر المخزون والحسابات المالية؟`)) {
                                    if (onCancelPurchase) onCancelPurchase(p.id);
                                  }
                                }}
                                className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[11px] font-bold"
                                title="إلغاء الحركة"
                              >
                                إلغاء
                              </button>
                            )}
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

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScanned}
        />
      )}

      {/* Viewing Purchase / Receipt Details Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {viewingPurchase.type === 'purchase' ? 'فاتورة مشتريات' : 'سند مرتجع مشتريات'} #{viewingPurchase.purchaseNumber}
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(viewingPurchase.date).toLocaleString('ar-EG')}
                </span>
              </div>
              <button
                onClick={() => setViewingPurchase(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
              <div className="flex justify-between">
                <span className="text-slate-400">الطرف:</span>
                <span className="font-bold">{viewingPurchase.partyName} ({viewingPurchase.partyType === 'supplier' ? 'مورد' : 'زبون'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">طريقة الدفع:</span>
                <span className="font-bold">
                  {viewingPurchase.paymentMethod === 'cash' ? 'نقدي' : viewingPurchase.paymentMethod === 'bank' ? 'بنكي' : 'آجل'}
                </span>
              </div>
              {viewingPurchase.notes && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ملاحظات:</span>
                  <span>{viewingPurchase.notes}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                    <th className="py-2">الصنف</th>
                    <th className="py-2">الوحدة</th>
                    <th className="py-2 text-center">الكمية</th>
                    <th className="py-2 text-center">السعر</th>
                    <th className="py-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {viewingPurchase.items.map(it => (
                    <tr key={it.id}>
                      <td className="py-2 font-bold">{it.productName}</td>
                      <td className="py-2">{it.unitName}</td>
                      <td className="py-2 text-center">{it.quantity}</td>
                      <td className="py-2 text-center font-mono">{it.costPrice.toFixed(2)}</td>
                      <td className="py-2 text-center font-mono font-bold">{it.total.toFixed(2)} {currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center text-sm font-extrabold">
              <span>الإجمالي الكلي:</span>
              <span className="text-emerald-600 font-mono">{viewingPurchase.totalAmount.toFixed(2)} {currency}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة</span>
              </button>
              <button
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
