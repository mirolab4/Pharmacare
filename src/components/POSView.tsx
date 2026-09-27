import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Camera, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Printer, 
  Save, 
  CreditCard, 
  Banknote, 
  Building2, 
  UserCheck, 
  Sparkles, 
  AlertTriangle, 
  AlertCircle,
  Layers, 
  CheckCircle2, 
  X, 
  DollarSign, 
  Pill,
  ShoppingBag,
  ArrowRightLeft,
  MessageCircle,
  ShieldAlert,
  Info,
  AlertOctagon,
  CameraOff,
  Monitor,
  FlaskConical
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  Product, 
  ProductUnit, 
  Invoice, 
  InvoiceItem, 
  Customer, 
  Bank, 
  Category, 
  Manufacturer, 
  Ingredient, 
  Settings,
  PriceTier 
} from '../types/pharmacy';
import { sounds } from '../utils/audio';
import { checkCartDrugInteractions, DrugInteractionAlert } from '../utils/drugInteractions';
import { sendInvoiceViaWhatsApp } from '../utils/whatsapp';
import { 
  buildPharmacySearchIndex, 
  executePharmacySearch 
} from '../utils/pharmaSearch';

interface POSViewProps {
  products: Product[];
  categories: Category[];
  manufacturers: Manufacturer[];
  ingredients: Ingredient[];
  customers: Customer[];
  banks: Bank[];
  settings: Settings;
  onSaveInvoice: (invoice: Invoice, printAfterSave?: boolean) => void;
  onOpenScanner: () => void;
  scannedBarcode: string | null;
  onClearScannedBarcode: () => void;
  findAlternatives: (product: Product) => Product[];
  isContinuousScannerOn?: boolean;
  onToggleContinuousScanner?: () => void;
  onOpenCustomerDisplay?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  categories,
  manufacturers,
  ingredients,
  customers,
  banks,
  settings,
  onSaveInvoice,
  onOpenScanner,
  scannedBarcode,
  onClearScannedBarcode,
  findAlternatives,
  isContinuousScannerOn = false,
  onToggleContinuousScanner,
  onOpenCustomerDisplay,
}) => {
  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart / Current Draft Invoice
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  const [priceTier, setPriceTier] = useState<PriceTier>('retail');
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(settings.defaultTaxRate || 0);
  const [manualTotal, setManualTotal] = useState<string>('');

  // Payment Options
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank' | 'credit'>('cash');
  const [selectedBankId, setSelectedBankId] = useState<string>(banks[0]?.id || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');

  // Post-sale / Success Modal State
  const [lastSavedInvoice, setLastSavedInvoice] = useState<Invoice | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Alternatives Modal State
  const [isAltModalOpen, setIsAltModalOpen] = useState(false);
  const [altTargetIndex, setAltTargetIndex] = useState<number | null>(null); // if replacing from cart row

  // Barcode Scanning Toast / Feedback
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (scanFeedback) {
      const timer = setTimeout(() => setScanFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [scanFeedback]);

  // Drug Interactions Alert
  const drugInteractions = useMemo(() => {
    return checkCartDrugInteractions(cartItems, products, ingredients);
  }, [cartItems, products, ingredients]);
  const [showInteractionsModal, setShowInteractionsModal] = useState(false);

  // Map lookups for quick labels
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const manufacturersMap = useMemo(() => new Map(manufacturers.map(m => [m.id, m])), [manufacturers]);
  const ingredientsMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);

  // Handle scanned barcode input
  useEffect(() => {
    if (scannedBarcode) {
      handleBarcodeScanned(scannedBarcode);
      onClearScannedBarcode();
    }
  }, [scannedBarcode]);

  // Listen to background continuous scanner global events
  useEffect(() => {
    const handleGlobalScan = (e: Event) => {
      const customEvent = e as CustomEvent<{ barcode: string }>;
      if (customEvent.detail?.barcode) {
        handleBarcodeScanned(customEvent.detail.barcode);
      }
    };
    window.addEventListener('pharmacy:barcode-scanned', handleGlobalScan);
    return () => window.removeEventListener('pharmacy:barcode-scanned', handleGlobalScan);
  }, [products]);

  // Price helper by tier
  const getUnitPriceByTier = (unit: ProductUnit, tier: PriceTier = priceTier): number => {
    if (tier === 'wholesale' && unit.wholesalePrice && unit.wholesalePrice > 0) {
      return unit.wholesalePrice;
    }
    if (tier === 'special' && unit.specialPrice && unit.specialPrice > 0) {
      return unit.specialPrice;
    }
    return unit.salePrice;
  };

  // Change active price tier and recalculate cart
  const handleChangePriceTier = (newTier: PriceTier) => {
    setPriceTier(newTier);
    setCartItems(prev => prev.map(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return item;
      const unit = prod.units[item.unitIndex] || prod.units[0];
      if (!unit) return item;

      const newUnitPrice = getUnitPriceByTier(unit, newTier);
      const total = item.quantity * newUnitPrice;
      const profit = total - (item.quantity * item.costPrice);
      return {
        ...item,
        salePrice: newUnitPrice,
        total,
        profit,
      };
    }));
  };

  // Barcode or text auto-match
  const handleBarcodeScanned = (code: string) => {
    const raw = code.trim();
    if (!raw) return;
    const trimmed = raw.toLowerCase();
    const cleanNumeric = raw.replace(/^0+/, '');

    // 1. Search products by barcode
    let match = products.find(p => {
      const pCode = (p.barcode || '').trim().toLowerCase();
      const pClean = pCode.replace(/^0+/, '');
      return pCode === trimmed || (cleanNumeric.length > 0 && pClean === cleanNumeric);
    });

    let targetUnitIndex = 0;

    // 2. If not matched on product barcode, check unit barcodes
    if (!match) {
      for (const p of products) {
        const uIdx = p.units.findIndex(u => {
          const uCode = ((u as { barcode?: string }).barcode || '').trim().toLowerCase();
          const uClean = uCode.replace(/^0+/, '');
          return uCode === trimmed || (cleanNumeric.length > 0 && uClean === cleanNumeric);
        });
        if (uIdx !== -1) {
          match = p;
          targetUnitIndex = uIdx;
          break;
        }
      }
    }

    if (match) {
      // Pick packaging unit (default to box/pack or matched unit)
      if (targetUnitIndex === 0 && match.units.length > 1) {
        targetUnitIndex = match.units.length - 1;
      }
      handleSelectProduct(match);
      setSelectedUnitIndex(targetUnitIndex);
      // Automatically add 1 unit to cart directly according to database
      addItemToCart(match, targetUnitIndex, 1);

      if (settings.enableScannerSound) {
        sounds.playScanBeep();
      }

      setScanFeedback({
        type: 'success',
        message: `تمت إضافة (${match.nameAr}) إلى السلة تلقائياً بنجاح`,
      });
    } else {
      // DO NOT put barcode in search query! Keep search clean as requested.
      if (settings.enableScannerSound) {
        sounds.playWarning();
      }

      setScanFeedback({
        type: 'error',
        message: `الصنف غير موجود في قاعدة البيانات: (${raw})`,
      });
    }
  };

  // In-Memory Fast Pharma Search Index
  const posSearchIndex = useMemo(() => {
    return buildPharmacySearchIndex(products, ingredients, categories, manufacturers);
  }, [products, ingredients, categories, manufacturers]);

  // Filtered Products for quick search (supports Trade name & Active Ingredient simultaneously)
  const { filteredProducts, posSearchMatchMap } = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return { filteredProducts: [] as Product[], posSearchMatchMap: new Map<string, any>() };
    const searchRes = executePharmacySearch(posSearchIndex, q, { limit: 16 });
    const map = new Map<string, any>();
    for (const item of searchRes.items) {
      map.set(item.product.id, item.matchDetails);
    }
    return {
      filteredProducts: searchRes.items.map(i => i.product),
      posSearchMatchMap: map,
    };
  }, [posSearchIndex, searchQuery]);

  // Select a product to view details in the Active Card
  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    // default to largest packaging unit (e.g. box) or basic unit
    const defaultIdx = prod.units.length > 1 ? prod.units.length - 1 : 0;
    setSelectedUnitIndex(defaultIdx);
  };

  // Add an item to cart
  const addItemToCart = (product: Product, unitIdx: number, qty: number = 1) => {
    const unit = product.units[unitIdx] || product.units[0];
    if (!unit) return;

    setCartItems(prev => {
      const tierPrice = getUnitPriceByTier(unit);
      // check if identical product AND identical unit exists
      const existingIdx = prev.findIndex(item => item.productId === product.id && item.unitIndex === unitIdx);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + qty;
        const total = newQty * updated[existingIdx].salePrice;
        const profit = total - (newQty * updated[existingIdx].costPrice);
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          total,
          profit,
        };
        return updated;
      } else {
        const total = qty * tierPrice;
        const profit = total - (qty * unit.costPrice);
        const newItem: InvoiceItem = {
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          productId: product.id,
          productName: product.nameAr,
          unitIndex: unitIdx,
          unitName: unit.name,
          unitFactor: unit.factor,
          quantity: qty,
          salePrice: tierPrice,
          costPrice: unit.costPrice,
          total,
          profit,
        };
        return [newItem, ...prev];
      }
    });

    if (settings.enableScannerSound) {
      sounds.playScanBeep();
    }
  };

  // Update Cart Item Quantity
  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setCartItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      const total = newQty * item.salePrice;
      const profit = total - (newQty * item.costPrice);
      updated[index] = { ...item, quantity: newQty, total, profit };
      return updated;
    });
  };

  // Update Cart Item Price manually
  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    setCartItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      const price = Math.max(0, newPrice);
      const total = item.quantity * price;
      const profit = total - (item.quantity * item.costPrice);
      updated[index] = { ...item, salePrice: price, total, profit };
      return updated;
    });
  };

  // Change Unit from line dropdown
  const handleChangeItemUnit = (itemIndex: number, newUnitIndex: number) => {
    setCartItems(prev => {
      const updated = [...prev];
      const item = updated[itemIndex];
      const prod = products.find(p => p.id === item.productId);
      if (!prod || !prod.units[newUnitIndex]) return prev;

      const newUnit = prod.units[newUnitIndex];
      const total = item.quantity * newUnit.salePrice;
      const profit = total - (item.quantity * newUnit.costPrice);

      updated[itemIndex] = {
        ...item,
        unitIndex: newUnitIndex,
        unitName: newUnit.name,
        unitFactor: newUnit.factor,
        salePrice: newUnit.salePrice,
        costPrice: newUnit.costPrice,
        total,
        profit,
      };
      return updated;
    });
  };

  // Remove single line from cart
  const handleRemoveItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  // Clear entire cart
  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (confirm('هل أنت متأكد من رغبتك في إلغاء الفاتورة الحالية وتفريغ السلة؟')) {
      setCartItems([]);
      setDiscountValue(0);
      setManualTotal('');
      setSelectedCustomerId('');
      setPaidAmount(0);
    }
  };

  // Totals Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total, 0);
  }, [cartItems]);

  const totalCost = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return (subtotal * Math.min(100, Math.max(0, discountValue))) / 100;
    }
    return Math.min(subtotal, Math.max(0, discountValue));
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = Math.max(0, subtotal - discountAmount);

  const taxAmount = useMemo(() => {
    return (afterDiscount * Math.max(0, taxRate)) / 100;
  }, [afterDiscount, taxRate]);

  const calculatedTotal = Number((afterDiscount + taxAmount).toFixed(2));

  // Handle Manual Final Total Override (تعديل الإجمالي اليدوي)
  const handleApplyManualTotal = (newTotalVal: number) => {
    if (newTotalVal < 0 || cartItems.length === 0 || subtotal === 0) return;

    const ratio = newTotalVal / calculatedTotal;

    if (settings.editMode === 'quantity') {
      // تعديل الكميات
      setCartItems(prev => prev.map(item => {
        const newQty = Math.max(1, Math.round(item.quantity * ratio));
        const total = newQty * item.salePrice;
        const profit = total - (newQty * item.costPrice);
        return { ...item, quantity: newQty, total, profit };
      }));
    } else {
      // تعديل الأسعار
      setCartItems(prev => prev.map(item => {
        const newPrice = Number((item.salePrice * ratio).toFixed(2));
        const total = item.quantity * newPrice;
        const profit = total - (item.quantity * item.costPrice);
        return { ...item, salePrice: newPrice, total, profit };
      }));
    }
    setManualTotal('');
  };

  // 1. Suggest cheaper alternatives automatically (اقتراح البدائل الأرخص تلقائياً)
  const cheaperAlternative = useMemo(() => {
    if (!selectedProduct || !selectedProduct.ingredientIds || selectedProduct.ingredientIds.length === 0) {
      return null;
    }
    const currentPrice = selectedProduct.lastSalePrice || (selectedProduct.units[selectedProduct.units.length - 1]?.salePrice) || 0;
    if (currentPrice <= 0) return null;

    const alts = products.filter(p => {
      if (p.id === selectedProduct.id) return false;
      if (!p.ingredientIds || p.ingredientIds.length === 0) return false;
      const shares = selectedProduct.ingredientIds.some(id => p.ingredientIds.includes(id));
      if (!shares) return false;

      const altPrice = p.lastSalePrice || (p.units[p.units.length - 1]?.salePrice) || 0;
      return altPrice > 0 && altPrice < currentPrice;
    });

    if (alts.length === 0) return null;

    alts.sort((a, b) => {
      const pA = a.lastSalePrice || (a.units[a.units.length - 1]?.salePrice) || 0;
      const pB = b.lastSalePrice || (b.units[b.units.length - 1]?.salePrice) || 0;
      return pA - pB;
    });

    const cheapest = alts[0];
    const cheapPrice = cheapest.lastSalePrice || (cheapest.units[cheapest.units.length - 1]?.salePrice) || 0;
    const savings = currentPrice - cheapPrice;
    const savingsPercent = Math.round((savings / currentPrice) * 100);

    return {
      product: cheapest,
      cheapPrice,
      currentPrice,
      savings,
      savingsPercent,
    };
  }, [selectedProduct, products]);

  // 2. Customer Credit & Limit Calculation (حسابات الزبائن الآجلة والحد الائتماني)
  const remainingAmount = Math.max(0, calculatedTotal - paidAmount);

  const selectedCustomerObj = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const customerCreditWarning = useMemo(() => {
    if (!selectedCustomerObj) return null;
    const currentBalance = selectedCustomerObj.balance || 0;
    const creditLimit = selectedCustomerObj.creditLimit || 0;
    const newProjectedBalance = currentBalance + remainingAmount;

    if (creditLimit > 0 && newProjectedBalance > creditLimit && remainingAmount > 0) {
      return {
        currentBalance,
        creditLimit,
        newProjectedBalance,
        exceededAmount: newProjectedBalance - creditLimit,
      };
    }
    return null;
  }, [selectedCustomerObj, remainingAmount]);

  // 3. Real-time Customer Display Broadcast (بث مباشر لشاشة الزبون المزدوجة)
  useEffect(() => {
    const payload = {
      items: cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        unitName: item.unitName,
        quantity: item.quantity,
        salePrice: item.salePrice,
        total: item.total,
      })),
      subtotal,
      discountAmount,
      taxAmount,
      total: calculatedTotal,
      paidAmount,
      remainingAmount,
      customerName: selectedCustomerObj?.name,
    };

    try {
      localStorage.setItem('pharmacare_customer_cart', JSON.stringify(payload));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('pharmacare_customer_display');
        bc.postMessage(payload);
        bc.close();
      }
    } catch {}
  }, [cartItems, subtotal, discountAmount, taxAmount, calculatedTotal, paidAmount, remainingAmount, selectedCustomerObj]);

  // Auto update paid amount when total changes in Cash / Card / Bank mode
  useEffect(() => {
    if (paymentMethod !== 'credit') {
      setPaidAmount(calculatedTotal);
    } else {
      setPaidAmount(0); // in credit, default paid is 0 unless down payment specified
    }
  }, [calculatedTotal, paymentMethod]);

  // Selected item active ingredients list & alternatives
  const selectedProductIngredients = useMemo(() => {
    if (!selectedProduct?.ingredientIds) return [];
    return selectedProduct.ingredientIds
      .map(id => ingredientsMap.get(id))
      .filter((ing): ing is Ingredient => Boolean(ing));
  }, [selectedProduct, ingredientsMap]);

  const currentAlternatives = useMemo(() => {
    if (!selectedProduct) return [];
    return findAlternatives(selectedProduct);
  }, [selectedProduct, findAlternatives]);

  // Save and Complete Invoice
  const handleFinalizeInvoice = (print: boolean = false) => {
    if (cartItems.length === 0) {
      alert('الرجاء إضافة أصناف إلى الفاتورة أولاً');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      alert('يجب تحديد العميل لتسجيل الفاتورة على حسابه الآجل');
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    const bank = banks.find(b => b.id === selectedBankId);

    const actualPaid = paymentMethod === 'credit' ? Math.max(0, paidAmount) : calculatedTotal;
    const remaining = Math.max(0, calculatedTotal - actualPaid);

    const invoice: Invoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: 'INV-' + Math.floor(1000 + Math.random() * 9000), // storage service will standardize
      date: new Date().toISOString(),
      type: 'sale',
      customerId: selectedCustomerId || undefined,
      customerName: customer?.name || undefined,
      items: [...cartItems],
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      taxRate,
      taxAmount,
      totalAmount: calculatedTotal,
      totalCost,
      totalProfit: calculatedTotal - totalCost,
      paymentMethod,
      bankId: paymentMethod === 'bank' ? selectedBankId : undefined,
      bankName: paymentMethod === 'bank' ? bank?.name : undefined,
      paidAmount: actualPaid,
      remainingAmount: remaining,
      status: 'active',
      priceTier,
      notes: invoiceNotes,
      createdAt: new Date().toISOString(),
    };

    onSaveInvoice(invoice, print);
    setLastSavedInvoice(invoice);
    setShowSuccessModal(true);

    if (settings.enableScannerSound) {
      sounds.playCashSuccess();
    }

    // Celebration confetti
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }

    // Reset Form
    setCartItems([]);
    setDiscountValue(0);
    setManualTotal('');
    setInvoiceNotes('');
    setSelectedCustomerId('');
    setPaidAmount(0);
    setPaymentMethod('cash');
  };

  const activeUnit = selectedProduct?.units[selectedUnitIndex] || selectedProduct?.units[0];
  const unitProfit = activeUnit ? (activeUnit.salePrice - activeUnit.costPrice) : 0;
  const unitProfitMargin = activeUnit && activeUnit.salePrice > 0 
    ? ((unitProfit / activeUnit.salePrice) * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-4">
      {/* 1. Barcode Scanning & Smart Search Bar */}
      <div className="rounded-2xl bg-white p-3 sm:p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Smart Search Bar (First on mobile as requested) */}
          <div className="relative flex-1 order-1 sm:order-2">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم التجاري، المادة الفعالة (Paracetamol / باراسيتامول)، أو اكتب/امسح الباركود..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pr-11 pl-4 text-sm font-medium focus:border-sky-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                مسح ✕
              </button>
            )}
          </div>

          {/* Camera Scanner Toggle Button & Dual Screen Button */}
          <div className="order-2 sm:order-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onToggleContinuousScanner) {
                  onToggleContinuousScanner();
                } else {
                  onOpenScanner();
                }
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-xs active:scale-95 transition-all min-h-[44px] ${
                isContinuousScannerOn
                  ? 'bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-400 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
              title={isContinuousScannerOn ? 'إطفاء الكاميرا بالكامل ⏹️' : 'تشغيل الكاميرا لمسح الباركود ▶️'}
            >
              {isContinuousScannerOn ? (
                <>
                  <CameraOff className="h-5 w-5" />
                  <span>إطفاء الكاميرا ⏹️</span>
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  <span>تشغيل الكاميرا 📷</span>
                </>
              )}
            </button>

            {/* Quick Single Scan Button */}
            <button
              type="button"
              onClick={onOpenScanner}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-3 py-2.5 text-xs font-bold transition-all min-h-[44px]"
              title="مسح لمرة واحدة عبر نافذة منبثقة"
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">مسحة واحدة</span>
            </button>

            {/* Customer Display Button */}
            {onOpenCustomerDisplay && (
              <button
                type="button"
                onClick={onOpenCustomerDisplay}
                className="hidden md:flex items-center justify-center gap-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 px-3 py-2.5 text-xs font-bold transition-all min-h-[44px]"
                title="فتح شاشة الزبون المزدوجة في نافذة منفصلة للشاشة الثانية"
              >
                <Monitor className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>شاشة الزبون 🖥️</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Barcode Scan Notification */}
        {scanFeedback && (
          <div
            className={`mt-3 flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all shadow-xs ${
              scanFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {scanFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="text-sm">{scanFeedback.message}</span>
            </div>
            <button
              onClick={() => setScanFeedback(null)}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Live Search Results Dropdown/Grid */}
        {filteredProducts.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {filteredProducts.map(p => {
              const defaultUnit = p.units[p.units.length - 1] || p.units[0];
              const isSelected = selectedProduct?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    handleSelectProduct(p);
                    setSearchQuery('');
                  }}
                  className={`flex flex-col justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' 
                      : 'border-slate-200 bg-slate-50/70 hover:border-sky-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{p.nameAr}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                        {p.units.length > 1 ? `${p.units.length} وحدات` : 'وحدة 1'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate" dir="ltr">{p.nameEn}</div>
                    {posSearchMatchMap.get(p.id)?.matchedInIngredient && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-700 dark:text-teal-300 font-bold bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                        <FlaskConical className="w-2.5 h-2.5 shrink-0 text-teal-600" />
                        <span className="truncate">مادة: {posSearchMatchMap.get(p.id)?.matchedIngredientNames.join('، ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                    <span className="font-bold text-sky-700 dark:text-sky-400">
                      {defaultUnit?.salePrice} {settings.currency} <span className="text-[10px] font-normal text-slate-500">({defaultUnit?.name})</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      p.stock > 20 ? 'bg-emerald-100 text-emerald-800' : p.stock > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      المخزون: {p.stock}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Items Status Bar */}
      {cartItems.length > 0 && (
        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-500 font-medium">
          <span>سلة المبيعات الحالية:</span>
          <span>عدد الأصناف بالسلة: <strong className="text-sky-700 dark:text-sky-400 font-bold">{cartItems.length}</strong></span>
        </div>
      )}

      {/* Clinical Drug-Drug Interaction Warning Alert Banner */}
      {drugInteractions.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-400 bg-rose-50/95 dark:bg-rose-950/40 dark:border-rose-800 p-3.5 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-rose-700 dark:text-rose-300">
                  ⚠️ تحذير سريري هام: تم رصد {drugInteractions.length} تعارضات دوائية في الفاتورة!
                </span>
                <span className="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  انتباه الصيدلي
                </span>
              </div>
              <p className="text-xs text-rose-800/90 dark:text-rose-300/90 mt-0.5">
                الأدوية المحددة في السلة تحتوي مواد فعالة قد تتفاعل عكسياً أو تشكل تكراراً علاجياً خطيراً للمريض.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInteractionsModal(true)}
            className="self-end sm:self-center px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all shrink-0"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>عرض تفاصيل التعارضات والبدائل</span>
          </button>
        </div>
      )}

      {/* 2. Selected Product Card (بطاقة الصنف المحدد والتفاصيل والبدائل) */}
      {selectedProduct && (
        <div className="rounded-2xl bg-gradient-to-br from-sky-50/90 via-white to-teal-50/50 p-4 border border-sky-200 shadow-xs dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 dark:border-sky-900/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Medication Info */}
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  selectedProduct.type === 'medicine' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-teal-600 text-white'
                }`}>
                  {selectedProduct.type === 'medicine' ? '💊 دواء طبي' : '🛍️ صنف تجاري'}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {selectedProduct.nameAr}
                </h3>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400" dir="ltr">
                  ({selectedProduct.nameEn})
                </span>
                <span className="font-mono text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {selectedProduct.barcode}
                </span>
              </div>

              {/* Active Ingredients & Manufacturer */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400">التصنيف: </span>
                  <span className="font-semibold">{categoriesMap.get(selectedProduct.categoryId) || 'عام'}</span>
                </div>
                <div>
                  <span className="text-slate-400">المصنع والدولة: </span>
                  <span className="font-semibold">
                    {manufacturersMap.get(selectedProduct.manufacturerId)?.name || 'غير محدد'} 
                    {manufacturersMap.get(selectedProduct.manufacturerId)?.country && (
                      <span className="text-slate-500"> ({manufacturersMap.get(selectedProduct.manufacturerId)?.country})</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">المخزون الإجمالي: </span>
                  <span className={`font-bold ${selectedProduct.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedProduct.stock} وحدة أساسية
                  </span>
                  {selectedProduct.stock <= (selectedProduct.minStock ?? 5) && (
                    <span className="mr-2 inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[11px] font-extrabold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      ⚠️ قارب على النفاد (حد الطلب: {selectedProduct.minStock ?? 5})
                    </span>
                  )}
                </div>
              </div>

              {/* Active Ingredients Chips */}
              {selectedProductIngredients.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300">المواد الفعالة:</span>
                  {selectedProductIngredients.map(ing => (
                    <span
                      key={ing.id}
                      className="rounded-lg bg-sky-100/90 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200 border border-sky-200 dark:border-sky-800"
                    >
                      {ing.nameAr} ({ing.nameEn})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Units Switcher Pills & Pricing Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              {/* Unit Buttons */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">الوحدة:</label>
                <div className="flex gap-1">
                  {selectedProduct.units.map((unit, idx) => {
                    const isUnitSelected = selectedUnitIndex === idx;
                    return (
                      <button
                        key={unit.id || idx}
                        onClick={() => setSelectedUnitIndex(idx)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                          isUnitSelected
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {unit.name}
                        {unit.factor > 1 && <span className="text-[10px] opacity-80 block font-normal">({unit.factor} حبة)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price, Cost & Profit Preview */}
              <div className="border-r sm:border-r border-slate-200 dark:border-slate-700 pr-3 mr-1 space-y-0.5 text-xs">
                <div className="flex items-baseline gap-1">
                  <span className="text-slate-500 text-[11px]">سعر البيع:</span>
                  <span className="text-base font-extrabold text-sky-700 dark:text-sky-400">
                    {activeUnit?.salePrice} {settings.currency}
                  </span>
                </div>

                {/* Hide Cost and Profit when Magic Eye is active */}
                {!settings.hideCostAndProfit && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>التكلفة: <strong className="text-slate-700 dark:text-slate-300">{activeUnit?.costPrice} {settings.currency}</strong></span>
                    <span>الربح: <strong className="text-emerald-600">+{unitProfit.toFixed(2)} ({unitProfitMargin}%)</strong></span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Add & Alternatives */}
              <div className="flex items-center gap-1.5 self-stretch sm:self-auto">
                {/* Alternatives Button (البدائل) */}
                {selectedProduct.type === 'medicine' && (
                  <button
                    onClick={() => {
                      setAltTargetIndex(null);
                      setIsAltModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-teal-500 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-300 transition-colors"
                    title="البحث عن أدوية بديلة بنفس المادة الفعالة"
                  >
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    <span>البدائل ({currentAlternatives.length})</span>
                  </button>
                )}

                {/* Add to Cart Button */}
                <button
                  onClick={() => {
                    addItemToCart(selectedProduct, selectedUnitIndex, 1);
                  }}
                  className="flex flex-1 sm:flex-initial items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة للفاتورة</span>
                </button>
              </div>
            </div>
          </div>

          {/* Auto Cheaper Alternative Suggestion Banner (اقتراح البديل الأرخص تلقائياً) */}
          {cheaperAlternative && (
            <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/70 dark:to-teal-950/70 border border-emerald-300 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-black text-emerald-800 dark:text-emerald-200">
                    <span>💡 بديل أرخص متوفر لنفس المادة الفعالة:</span>
                    <strong className="underline decoration-emerald-500 text-slate-900 dark:text-white">{cheaperAlternative.product.nameAr}</strong>
                    <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      توفير {cheaperAlternative.savings.toFixed(2)} {settings.currency} ({cheaperAlternative.savingsPercent}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    سعر البديل: {cheaperAlternative.cheapPrice} {settings.currency} بدلاً من {cheaperAlternative.currentPrice} {settings.currency} • متوفر بالمخزون ({cheaperAlternative.product.stock})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSelectProduct(cheaperAlternative.product)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 shrink-0 self-end sm:self-center"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>استبدال بالبديل الأرخص 🔄</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Invoice Cart Table & Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Cart Table */}
        <div className="lg:col-span-8 rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden flex flex-col justify-between dark:bg-slate-900 dark:border-slate-800">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-sky-600" />
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  بنود الفاتورة الحالية ({cartItems.length} صنف)
                </h3>
              </div>
              {cartItems.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>إلغاء الفاتورة</span>
                </button>
              )}
            </div>

            {/* Table or Cards */}
            {cartItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Pill className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-400">الفاتورة فارغة</p>
                <p className="text-xs text-slate-400 mt-1">امسح باركود الدواء أو اختر صنفاً من البحث لإضافته هنا</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View (Visible on phones and small tablets) */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
                  {cartItems.map((item, idx) => {
                    const prod = products.find(p => p.id === item.productId);
                    return (
                      <div
                        key={item.id}
                        className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2.5"
                      >
                        {/* Header: Product Name + Index + Delete */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[10px] font-black shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {item.productName}
                              </span>
                            </div>
                            {prod?.type === 'medicine' && (
                              <button
                                onClick={() => {
                                  if (prod) {
                                    handleSelectProduct(prod);
                                    setAltTargetIndex(idx);
                                    setIsAltModalOpen(true);
                                  }
                                }}
                                className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 mt-1 font-semibold"
                              >
                                <Sparkles className="h-3 w-3" />
                                <span>البدائل المتوفرة</span>
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 transition-colors"
                            title="حذف الصنف من الفاتورة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Units & Price row */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Unit Selector */}
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 block mb-1">الوحدة:</span>
                            {prod && prod.units.length > 1 ? (
                              <select
                                value={item.unitIndex}
                                onChange={(e) => handleChangeItemUnit(idx, parseInt(e.target.value, 10))}
                                className="w-full rounded-lg border border-slate-300 bg-white p-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              >
                                {prod.units.map((u, uIdx) => (
                                  <option key={uIdx} value={uIdx}>
                                    {u.name} ({u.salePrice} {settings.currency})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">{item.unitName}</span>
                            )}
                          </div>

                          {/* Editable Price */}
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 block mb-1">سعر الوحدة:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                value={item.salePrice}
                                onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-slate-300 p-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">{settings.currency}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Stepper & Subtotal row */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          {/* Stepper with touch-friendly 36px+ targets */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500">الكمية:</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleUpdateItemQty(idx, item.quantity - 1)}
                                className="h-8 w-8 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-white flex items-center justify-center text-sm active:scale-95 shadow-2xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value, 10) || 1)}
                                className="w-12 h-8 rounded-lg border border-slate-300 py-0.5 text-center text-xs font-black dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                              <button
                                onClick={() => handleUpdateItemQty(idx, item.quantity + 1)}
                                className="h-8 w-8 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-white flex items-center justify-center text-sm active:scale-95 shadow-2xs"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Line Total */}
                          <div className="text-left">
                            <span className="text-[10px] text-slate-400 block leading-tight">الإجمالي</span>
                            <span className="font-black text-sm text-sky-700 dark:text-sky-400">
                              {item.total.toFixed(2)} {settings.currency}
                            </span>
                          </div>
                        </div>

                        {/* Cost & Profit (if Magic Eye not hiding) */}
                        {!settings.hideCostAndProfit && (
                          <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200 dark:border-slate-700 text-[10px] text-slate-500">
                            <span>التكلفة: {(item.costPrice * item.quantity).toFixed(2)} {settings.currency}</span>
                            <span className="text-emerald-600 font-bold">الربح: +{item.profit.toFixed(2)} {settings.currency}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (hidden on small screens, visible on md and up) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2.5 font-bold">#</th>
                        <th className="px-3 py-2.5 font-bold">الصنف</th>
                        <th className="px-3 py-2.5 font-bold">الوحدة</th>
                        <th className="px-3 py-2.5 font-bold text-center">الكمية</th>
                        <th className="px-3 py-2.5 font-bold">السعر</th>
                        <th className="px-3 py-2.5 font-bold">الإجمالي</th>
                        {!settings.hideCostAndProfit && (
                          <>
                            <th className="px-3 py-2.5 font-bold text-slate-500">التكلفة</th>
                            <th className="px-3 py-2.5 font-bold text-emerald-600">الربح</th>
                          </>
                        )}
                        <th className="px-2 py-2.5 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {cartItems.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900 dark:text-white">{item.productName}</div>
                              {prod?.type === 'medicine' && (
                                <button
                                  onClick={() => {
                                    if (prod) {
                                      handleSelectProduct(prod);
                                      setAltTargetIndex(idx);
                                      setIsAltModalOpen(true);
                                    }
                                  }}
                                  className="text-[10px] text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-0.5 mt-0.5"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  بدائل الصنف
                                </button>
                              )}
                            </td>

                            {/* Unit Dropdown */}
                            <td className="px-3 py-2">
                              {prod && prod.units.length > 1 ? (
                                <select
                                  value={item.unitIndex}
                                  onChange={(e) => handleChangeItemUnit(idx, parseInt(e.target.value, 10))}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                >
                                  {prod.units.map((u, uIdx) => (
                                    <option key={uIdx} value={uIdx}>
                                      {u.name} ({u.salePrice} {settings.currency})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{item.unitName}</span>
                              )}
                            </td>

                            {/* Quantity Stepper */}
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleUpdateItemQty(idx, item.quantity - 1)}
                                  className="h-6 w-6 rounded-md bg-slate-100 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value, 10) || 1)}
                                  className="w-12 rounded-md border border-slate-300 py-0.5 text-center text-xs font-bold focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                                <button
                                  onClick={() => handleUpdateItemQty(idx, item.quantity + 1)}
                                  className="h-6 w-6 rounded-md bg-slate-100 font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* Editable Line Price */}
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.1"
                                value={item.salePrice}
                                onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                                className="w-16 rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-bold text-slate-800 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </td>

                            {/* Line Total */}
                            <td className="px-3 py-2 font-extrabold text-slate-900 dark:text-white">
                              {item.total.toFixed(2)} {settings.currency}
                            </td>

                            {/* Cost and Profit (hidden when Eye active) */}
                            {!settings.hideCostAndProfit && (
                              <>
                                <td className="px-3 py-2 text-slate-500 font-mono">
                                  {(item.costPrice * item.quantity).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-emerald-600 font-bold font-mono">
                                  +{item.profit.toFixed(2)}
                                </td>
                              </>
                            )}

                            {/* Delete Item */}
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(idx)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                title="حذف من السلة"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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

          {/* Quick Item Entry Footer */}
          <div className="border-t border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-500 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800/30">
            <span>💡 نصيحة: يمكنك تعديل الكمية أو السعر مباشرة في الجدول لكل سطر.</span>
            <span className="font-semibold">عدد الوحدات المباعة: {cartItems.reduce((acc, i) => acc + i.quantity, 0)}</span>
          </div>
        </div>

        {/* Right Column (4 cols): Summary & Checkout Drawer */}
        <div className="lg:col-span-4 space-y-4">
          {/* Invoice Summary Box */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>ملخص الحساب</span>
              <span className="text-xs font-normal text-slate-500">طريقة التعديل: {settings.editMode === 'quantity' ? 'كمية' : 'سعر'}</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>المجموع قبل الخصم:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{subtotal.toFixed(2)} {settings.currency}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1">
                  <span>الخصم:</span>
                  <div className="flex rounded-md border border-slate-300 text-[10px] overflow-hidden dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-1.5 py-0.5 ${discountType === 'fixed' ? 'bg-sky-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                    >
                      {settings.currency}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-1.5 py-0.5 ${discountType === 'percent' ? 'bg-sky-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-16 rounded-md border border-slate-300 px-1.5 py-0.5 text-center text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  {discountAmount > 0 && (
                    <span className="text-rose-600 font-bold text-[11px]">- {discountAmount.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Tax (VAT) Input */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-400">ضريبة القيمة المضافة:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-12 rounded-md border border-slate-300 px-1 py-0.5 text-center text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <span>%</span>
                  {taxAmount > 0 && (
                    <span className="text-sky-600 font-bold text-[11px]">+ {taxAmount.toFixed(2)}</span>
                  )}
                </div>
              </div>

              {/* Cost and Profit totals (Eye toggleable) */}
              {!settings.hideCostAndProfit && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl space-y-1 text-[11px] border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between text-slate-500">
                    <span>إجمالي تكلفة الفاتورة:</span>
                    <span className="font-bold">{totalCost.toFixed(2)} {settings.currency}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>صافي ربح الفاتورة:</span>
                    <span>+{(calculatedTotal - totalCost).toFixed(2)} {settings.currency}</span>
                  </div>
                </div>
              )}

              {/* Final Total Display */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-900 dark:text-white">
                  <span className="text-sm font-extrabold">الإجمالي النهائي:</span>
                  <span className="text-xl font-black text-sky-600 dark:text-sky-400">
                    {calculatedTotal.toFixed(2)} {settings.currency}
                  </span>
                </div>
              </div>

              {/* Manual Total Override (تعديل الإجمالي اليدوي) */}
              <div className="pt-1">
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                  تعديل يدوي للإجمالي (يعدّل {settings.editMode === 'quantity' ? 'الكميات' : 'الأسعار'} تلقائياً):
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    value={manualTotal}
                    onChange={(e) => setManualTotal(e.target.value)}
                    placeholder="مبلغ جديد..."
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualTotal) {
                        handleApplyManualTotal(parseFloat(manualTotal));
                      }
                    }}
                    className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-white hover:bg-slate-950 dark:bg-slate-700"
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">طريقة الدفع والتسديد</h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Banknote className="h-4 w-4" />
                <span>نقدي (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>بطاقة بنكية</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold transition-all ${
                  paymentMethod === 'bank'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>بنك / محفظة</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credit')}
                className={`flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold transition-all ${
                  paymentMethod === 'credit'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <span>آجل (ذمة زبون)</span>
              </button>
            </div>

            {/* If Bank / Wallet Selected */}
            {paymentMethod === 'bank' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  اختر البنك أو المحفظة الإلكترونية:
                </label>
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.type === 'wallet' ? '📱 محفظة: ' : '🏦 بنك: '} {b.name} ({b.accountName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* If Credit (آجل) Selected */}
            {paymentMethod === 'credit' && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    اختر العميل (إجباري في البيع الآجل):
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- اختر العميل --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} - (رصيده: {c.balance.toFixed(2)} {settings.currency}{c.creditLimit ? ` | سقف: ${c.creditLimit} ${settings.currency}` : ''})
                      </option>
                    ))}
                  </select>

                  {/* Customer Credit Limit & Debt Warning (حسابات الزبائن الآجلة والحد الائتماني) */}
                  {selectedCustomerObj && (
                    <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>الرصيد السابق: <strong>{(selectedCustomerObj.balance || 0).toFixed(2)} {settings.currency}</strong></span>
                        <span>سقف الدين المسموح: <strong>{selectedCustomerObj.creditLimit ? `${selectedCustomerObj.creditLimit} ${settings.currency}` : 'مفتوح'}</strong></span>
                      </div>
                      {selectedCustomerObj.creditLimit && (
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              ((selectedCustomerObj.balance || 0) / selectedCustomerObj.creditLimit) >= 1 
                                ? 'bg-rose-600' 
                                : ((selectedCustomerObj.balance || 0) / selectedCustomerObj.creditLimit) >= 0.8 
                                ? 'bg-amber-500' 
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round(((selectedCustomerObj.balance || 0) / selectedCustomerObj.creditLimit) * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Red Alert if Credit Limit Exceeded */}
                  {customerCreditWarning && (
                    <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border-2 border-rose-400 dark:bg-rose-950/80 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-1 animate-pulse">
                      <div className="flex items-center gap-1.5 font-black text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>⚠️ تحذير: تجاوز السقف الائتماني للعميل!</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        الحد المسموح به: <strong>{customerCreditWarning.creditLimit} {settings.currency}</strong>.
                        رصيد العميل بعد الفاتورة سيصبح: <strong className="text-rose-600 dark:text-rose-400 font-bold">{customerCreditWarning.newProjectedBalance.toFixed(2)} {settings.currency}</strong> (تجاوز بمقدار {customerCreditWarning.exceededAmount.toFixed(2)} {settings.currency}).
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">المدفوع مقدماً:</label>
                    <input
                      type="number"
                      min="0"
                      max={calculatedTotal}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-emerald-600 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">المتبقي على الحساب:</label>
                    <div className="w-full rounded-xl bg-amber-50 border border-amber-200 p-2 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                      {Math.max(0, calculatedTotal - paidAmount).toFixed(2)} {settings.currency}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fast Cash Calculator Buttons */}
            {paymentMethod === 'cash' && (
              <div className="pt-2">
                <span className="block text-[10px] font-bold text-slate-400 mb-1">أزرار سريعة للنقد:</span>
                <div className="flex flex-wrap gap-1">
                  {[10, 20, 50, 100, 200].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPaidAmount(val)}
                      className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-mono font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPaidAmount(calculatedTotal)}
                    className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-300"
                  >
                    المبلغ بالتمام
                  </button>
                </div>
                {paidAmount > calculatedTotal && (
                  <div className="mt-2 rounded-xl bg-emerald-50 p-2 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex justify-between">
                    <span>الباقي للزبون:</span>
                    <span>{(paidAmount - calculatedTotal).toFixed(2)} {settings.currency}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <input
                type="text"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="ملاحظات اختيارية على الفاتورة..."
                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Action Buttons: Save & Print */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleFinalizeInvoice(false)}
                disabled={cartItems.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 p-3 text-sm font-extrabold text-white shadow-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Save className="h-4 w-4" />
                <span>💾 حفظ الفاتورة</span>
              </button>

              <button
                type="button"
                onClick={() => handleFinalizeInvoice(true)}
                disabled={cartItems.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 p-3 text-sm font-extrabold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Printer className="h-4 w-4" />
                <span>🖨️ حفظ وطباعة</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Alternatives Modal (نافذة البدائل الدوائية المطابقة للمادة الفعالة) */}
      {isAltModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
          <div className="w-[calc(100%-16px)] sm:w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 bg-teal-600 px-4 py-3 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  البدائل الدوائية لـ ({selectedProduct.nameAr})
                </h3>
              </div>
              <button
                onClick={() => setIsAltModalOpen(false)}
                className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div className="rounded-xl bg-teal-50 p-3 text-xs text-teal-900 dark:bg-teal-950/50 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                <p className="font-bold">المواد الفعالة المشتركة:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedProductIngredients.map(ing => (
                    <span key={ing.id} className="rounded bg-white/80 px-2 py-0.5 text-teal-800 font-bold dark:bg-teal-900 dark:text-teal-200">
                      {ing.nameAr} - {ing.nameEn}
                    </span>
                  ))}
                </div>
              </div>

              {currentAlternatives.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="font-bold text-sm">لا توجد بدائل مسجلة لهذا الصنف حالياً</p>
                  <p className="text-xs mt-1">يمكنك إضافة أدوية جديدة بنفس المادة الفعالة من تبويب الأصناف.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentAlternatives.map(alt => {
                    const altUnit = alt.units[alt.units.length - 1] || alt.units[0];
                    const altMfr = manufacturersMap.get(alt.manufacturerId);
                    return (
                      <div
                        key={alt.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white dark:border-slate-800 dark:bg-slate-800/50 transition-all"
                      >
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white">{alt.nameAr}</div>
                          <div className="text-xs text-slate-500" dir="ltr">{alt.nameEn}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5">
                            <span>المصنع: <strong>{altMfr?.name || 'غير محدد'} ({altMfr?.country || ''})</strong></span>
                            <span>المخزون: <strong className={alt.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}>{alt.stock}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                          <div className="text-left font-bold text-sm text-sky-700 dark:text-sky-400">
                            {altUnit?.salePrice} {settings.currency}
                            <span className="block text-[10px] font-normal text-slate-500">({altUnit?.name})</span>
                          </div>

                          <div className="flex gap-1.5">
                            {/* Add as extra item */}
                            <button
                              onClick={() => {
                                addItemToCart(alt, alt.units.length - 1, 1);
                                setIsAltModalOpen(false);
                              }}
                              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>إضافة</span>
                            </button>

                            {/* Replace Current Item in cart (إذا فتح من سطر في الفاتورة) */}
                            {altTargetIndex !== null && (
                              <button
                                onClick={() => {
                                  // Replace row item
                                  setCartItems(prev => {
                                    const updated = [...prev];
                                    const old = updated[altTargetIndex];
                                    const uIdx = alt.units.length - 1;
                                    const u = alt.units[uIdx] || alt.units[0];
                                    const qty = old.quantity;
                                    const total = qty * u.salePrice;
                                    const profit = total - (qty * u.costPrice);
                                    updated[altTargetIndex] = {
                                      id: 'item-' + Date.now(),
                                      productId: alt.id,
                                      productName: alt.nameAr,
                                      unitIndex: uIdx,
                                      unitName: u.name,
                                      unitFactor: u.factor,
                                      quantity: qty,
                                      salePrice: u.salePrice,
                                      costPrice: u.costPrice,
                                      total,
                                      profit,
                                    };
                                    return updated;
                                  });
                                  setIsAltModalOpen(false);
                                }}
                                className="flex items-center gap-1 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-xs"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                                <span>استبدال 🔄</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Drug-Drug Interactions Clinical Details Modal */}
      {showInteractionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-[calc(100%-16px)] sm:w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white p-3.5 sm:p-5 shadow-2xl border-2 border-rose-300 dark:bg-slate-900 dark:border-rose-800 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3 dark:border-rose-900/50 shrink-0">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                <h3 className="text-sm sm:text-base font-black truncate">
                  تقرير التداخلات والتعارضات الدوائية ({drugInteractions.length})
                </h3>
              </div>
              <button
                onClick={() => setShowInteractionsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {drugInteractions.map((alert, idx) => (
                <div
                  key={alert.id || idx}
                  className={`rounded-xl p-3 sm:p-4 border text-xs space-y-2 ${
                    alert.severity === 'danger'
                      ? 'bg-rose-50 border-rose-300 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                      : alert.severity === 'duplicate'
                      ? 'bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                      : 'bg-orange-50 border-orange-300 text-orange-950 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                      {alert.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      alert.severity === 'danger'
                        ? 'bg-rose-600 text-white'
                        : alert.severity === 'duplicate'
                        ? 'bg-amber-600 text-white'
                        : 'bg-orange-600 text-white'
                    }`}>
                      {alert.severity === 'danger' ? 'خطر حاد 🔴' : alert.severity === 'duplicate' ? 'تكرار علاجي ⚠️' : 'تنبيه متوسط 🟠'}
                    </span>
                  </div>

                  <div className="bg-white/80 dark:bg-slate-900/80 p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] sm:text-xs font-bold">
                    <span className="text-slate-800 dark:text-slate-200">الصنف الأول: {alert.drugA}</span>
                    <span className="text-rose-600">⚡ يتعارض مع ⚡</span>
                    <span className="text-slate-800 dark:text-slate-200">الصنف الثاني: {alert.drugB}</span>
                  </div>

                  <p className="leading-relaxed font-medium">
                    <strong className="font-bold">التفسير السريري: </strong>
                    {alert.description}
                  </p>

                  <div className="rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 p-2 text-teal-950 dark:text-teal-200">
                    <strong className="font-bold">التوصية الصيدلانية: </strong>
                    {alert.recommendation}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setShowInteractionsModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 min-h-[44px]"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Invoice Success & WhatsApp e-Receipt Modal */}
      {showSuccessModal && lastSavedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="relative w-[calc(100%-16px)] sm:w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                تم حفظ الفاتورة بنجاح!
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-1">
                رقم الفاتورة: {lastSavedInvoice.invoiceNumber}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>إجمالي الأصناف:</span>
                <span className="font-bold text-slate-900 dark:text-white">{lastSavedInvoice.items.length} صنف</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>المبلغ الإجمالي:</span>
                <span className="font-extrabold text-emerald-600 text-sm">{lastSavedInvoice.totalAmount.toFixed(2)} {settings.currency}</span>
              </div>
              {lastSavedInvoice.customerName && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>العميل:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{lastSavedInvoice.customerName}</span>
                </div>
              )}
            </div>

            {/* Quick Actions (WhatsApp + Print + New Invoice) */}
            <div className="space-y-2 pt-2">
              {/* WhatsApp e-Receipt Button */}
              <button
                type="button"
                onClick={() => {
                  const cust = customers.find(c => c.id === lastSavedInvoice.customerId);
                  const phone = cust?.phone || prompt('أدخل رقم هاتف العميل لإرسال الفاتورة عبر واتساب:') || '';
                  if (phone) {
                    sendInvoiceViaWhatsApp(lastSavedInvoice, settings, phone);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs shadow-md transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>إرسال الفاتورة عبر واتساب (WhatsApp e-Receipt) 💬</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSaveInvoice(lastSavedInvoice, true);
                    setShowSuccessModal(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة إيصال حراري</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    setLastSavedInvoice(null);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all"
                >
                  فاتورة جديدة ➕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
