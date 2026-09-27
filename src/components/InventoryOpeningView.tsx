import React, { useState, useMemo } from 'react';
import { 
  PackageCheck, 
  Search, 
  Plus, 
  Save, 
  Printer, 
  AlertCircle, 
  Layers, 
  DollarSign, 
  Check, 
  Sparkles,
  TrendingUp,
  Boxes,
  FileSpreadsheet,
  RefreshCw,
  Camera,
  X
} from 'lucide-react';
import { 
  Product, 
  Category, 
  Manufacturer, 
  Settings, 
  StockMovement, 
  ProductUnit 
} from '../types/pharmacy';
import { recalculateUnitHierarchyPrices } from '../utils/unitsHelper';

interface InventoryOpeningRow {
  productId: string;
  nameAr: string;
  nameEn: string;
  barcode: string;
  categoryName: string;
  manufacturerName: string;
  unitId: string;
  unitName: string;
  unitFactor: number;
  openingQty: number; // بالوحدة المختارة
  costPrice: number;  // سعر الجملة / التكلفة عليّ
  salePrice: number;  // سعر البيع للجمهور
  expiryDate?: string;
  batchNumber?: string;
  isModified?: boolean;
}

interface InventoryOpeningViewProps {
  products: Product[];
  categories: Category[];
  manufacturers: Manufacturer[];
  settings: Settings;
  onSaveProduct: (product: Product) => void;
  onOpenScanner?: (callback?: (barcode: string) => void) => void;
}

export const InventoryOpeningView: React.FC<InventoryOpeningViewProps> = ({
  products,
  categories,
  manufacturers,
  settings,
  onSaveProduct,
  onOpenScanner,
}) => {
  const currency = settings.currency || '₪';
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const manufacturersMap = useMemo(() => new Map(manufacturers.map(m => [m.id, m.name])), [manufacturers]);

  // Initial State from products
  const [rows, setRows] = useState<InventoryOpeningRow[]>(() => {
    return products.map(p => {
      const defaultUnit = p.units.find(u => !u.isBaseUnit && u.factor > 1) || p.units[0];
      const factor = defaultUnit?.factor || 1;
      const openingQty = factor > 1 ? Math.floor(p.stock / factor) : p.stock;
      return {
        productId: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        barcode: p.barcode,
        categoryName: categoriesMap.get(p.categoryId) || 'عام',
        manufacturerName: manufacturersMap.get(p.manufacturerId) || '',
        unitId: defaultUnit?.id || 'u-1',
        unitName: defaultUnit?.name || 'عبوة',
        unitFactor: factor,
        openingQty: openingQty,
        costPrice: defaultUnit?.costPrice || p.lastCostPrice || 0,
        salePrice: defaultUnit?.salePrice || p.lastSalePrice || 0,
        isModified: false,
      };
    });
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Row update handler
  const handleUpdateRow = (productId: string, field: keyof InventoryOpeningRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.productId === productId) {
        return {
          ...r,
          [field]: value,
          isModified: true,
        };
      }
      return r;
    }));
  };

  // Unit changed for a product
  const handleUnitChange = (productId: string, unitId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const unit = prod.units.find(u => u.id === unitId) || prod.units[0];
    if (!unit) return;

    setRows(prev => prev.map(r => {
      if (r.productId === productId) {
        return {
          ...r,
          unitId: unit.id,
          unitName: unit.name,
          unitFactor: unit.factor,
          costPrice: unit.costPrice || r.costPrice,
          salePrice: unit.salePrice || r.salePrice,
          isModified: true,
        };
      }
      return r;
    }));
  };

  // Filtered Rows for display
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      const matchSearch = !q || 
        r.nameAr.toLowerCase().includes(q) || 
        r.nameEn.toLowerCase().includes(q) || 
        r.barcode.toLowerCase().includes(q);
      const matchCat = !selectedCategoryFilter || r.categoryName === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [rows, searchQuery, selectedCategoryFilter]);

  // Overall Totals
  const { totalItemsCount, totalOpeningCost, totalExpectedSale, estimatedProfit, profitMarginPercent } = useMemo(() => {
    let count = 0;
    let costSum = 0;
    let saleSum = 0;

    rows.forEach(r => {
      if (r.openingQty > 0) {
        count++;
        costSum += (r.openingQty * r.costPrice);
        saleSum += (r.openingQty * r.salePrice);
      }
    });

    const profit = Math.max(0, saleSum - costSum);
    const margin = saleSum > 0 ? (profit / saleSum) * 100 : 0;

    return {
      totalItemsCount: count,
      totalOpeningCost: costSum,
      totalExpectedSale: saleSum,
      estimatedProfit: profit,
      profitMarginPercent: margin.toFixed(1),
    };
  }, [rows]);

  // Save All Changes to Products & Stock
  const handleSaveAllOpeningStock = () => {
    const modifiedRows = rows.filter(r => r.isModified);
    if (modifiedRows.length === 0) {
      alert('لم تقم بإجراء أي تعديلات على الرصيد الافتتاحي لحفظها.');
      return;
    }

    modifiedRows.forEach(row => {
      const prod = products.find(p => p.id === row.productId);
      if (!prod) return;

      // حساب المخزون بالوحدة الأساسية
      const stockInBaseUnits = row.openingQty * row.unitFactor;

      // تحديث شجرة الوحدات بالأسعار الجديدة إن تم تعديلها
      const updatedUnits = recalculateUnitHierarchyPrices(
        prod.units,
        row.unitId,
        row.salePrice,
        row.costPrice,
        row.salePrice
      );

      const updatedProduct: Product = {
        ...prod,
        stock: stockInBaseUnits,
        lastCostPrice: row.costPrice,
        lastSalePrice: row.salePrice,
        units: updatedUnits,
        notes: row.batchNumber ? `${prod.notes || ''} [تشغيلة: ${row.batchNumber}]`.trim() : prod.notes,
        updatedAt: new Date().toISOString(),
      };

      onSaveProduct(updatedProduct);
    });

    // Reset isModified
    setRows(prev => prev.map(r => ({ ...r, isModified: false })));
    setSaveSuccessMessage(`تم بنجاح حفظ واعتماد الرصيد الافتتاحي وتحديث أسعار ومخزون ${modifiedRows.length} صنف!`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
            <PackageCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>إدارة المخزن وبضاعة أول المدة (الرصيد الافتتاحي)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold">
                جرد المخزن الافتتاحي
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              إدخال وتعديل كميات المخزون الافتتاحية وسعر الجملة (التكلفة) وسعر البيع للجمهور دفعة واحدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة كشف الجرد</span>
          </button>

          <button
            onClick={handleSaveAllOpeningStock}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>حفظ واعتماد الرصيد للمخزن ({rows.filter(r => r.isModified).length} معدّل)</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {saveSuccessMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800 text-xs font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inventory Valuation Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">الأصناف المتوفرة بالمخزن:</span>
            <Boxes className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {totalItemsCount} <span className="text-xs font-normal text-slate-500">صنف من أصل {products.length}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">إجمالي تكلفة بضاعة أول المدة:</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">
            {totalOpeningCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">القيمة البيعية التقديرية للجمهور:</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
            {totalExpectedSale.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">إجمالي الأرباح المتوقعة:</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-400 font-mono">
            {estimatedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            <span className="text-xs font-bold text-slate-500 mr-1.5">({profitMarginPercent}%)</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم العربي، الإنجليزي، أو الباركود لجرد الصنف..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pr-9 pl-9 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {onOpenScanner && (
            <button
              type="button"
              onClick={() => onOpenScanner((code) => setSearchQuery(code.trim()))}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 p-0.5"
              title="مسح باركود بالهاتف"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="sm:w-60">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">كل التصنيفات ({categories.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Inventory Opening Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 font-bold">
              <tr>
                <th className="py-3 px-3">الصنف والباركود</th>
                <th className="py-3 px-2">الوحدة</th>
                <th className="py-3 px-2 text-center">الرصيد الافتتاحي (كمية المخزن)</th>
                <th className="py-3 px-2 text-center text-amber-700 dark:text-amber-400">سعر الجملة (التكلفة عليّ)</th>
                <th className="py-3 px-2 text-center text-emerald-700 dark:text-emerald-400">سعر البيع للجمهور</th>
                <th className="py-3 px-2 text-center">إجمالي التكلفة</th>
                <th className="py-3 px-2 text-center">إجمالي القيمة البيعية</th>
                <th className="py-3 px-2 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد أصناف مطابقة لمعايير البحث
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const prod = products.find(p => p.id === row.productId);
                  const lineCost = row.openingQty * row.costPrice;
                  const lineSale = row.openingQty * row.salePrice;

                  return (
                    <tr 
                      key={row.productId} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        row.isModified ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Name & Barcode */}
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {row.nameAr}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span dir="ltr">{row.nameEn}</span>
                          <span>| باركود: {row.barcode}</span>
                        </div>
                      </td>

                      {/* Unit Selector */}
                      <td className="py-2.5 px-2">
                        {prod && prod.units.length > 1 ? (
                          <select
                            value={row.unitId}
                            onChange={(e) => handleUnitChange(row.productId, e.target.value)}
                            className="rounded-lg border border-slate-300 p-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                          >
                            {prod.units.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name} (معامل {u.factor})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-700 dark:text-slate-300">{row.unitName}</span>
                        )}
                      </td>

                      {/* Opening Quantity Input */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.openingQty}
                          onChange={(e) => handleUpdateRow(row.productId, 'openingQty', parseInt(e.target.value, 10) || 0)}
                          className="w-20 rounded-xl border border-slate-300 p-1.5 text-center font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-sky-500"
                        />
                      </td>

                      {/* Wholesale / Cost Price Input */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.costPrice}
                          onChange={(e) => handleUpdateRow(row.productId, 'costPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 rounded-xl border border-amber-300 bg-amber-50/50 p-1.5 text-center font-mono font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 focus:border-amber-500"
                        />
                      </td>

                      {/* Retail Sale Price Input */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.salePrice}
                          onChange={(e) => handleUpdateRow(row.productId, 'salePrice', parseFloat(e.target.value) || 0)}
                          className="w-24 rounded-xl border border-emerald-300 bg-emerald-50/50 p-1.5 text-center font-mono font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 focus:border-emerald-500"
                        />
                      </td>

                      {/* Line Cost Total */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {lineCost.toFixed(2)} {currency}
                      </td>

                      {/* Line Sale Total */}
                      <td className="py-2.5 px-2 text-center font-mono font-black text-emerald-700 dark:text-emerald-400">
                        {lineSale.toFixed(2)} {currency}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-2 text-center">
                        {row.isModified ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            معدّل ✏️
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            معتمد ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
