import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Camera, 
  Pill, 
  ShoppingBag, 
  Layers, 
  Building2, 
  FlaskConical, 
  Tag, 
  Check, 
  X, 
  AlertCircle,
  Filter,
  Sparkles,
  FileSpreadsheet,
  Upload,
  Download,
  Printer,
  ShieldAlert,
  Zap,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { 
  Product, 
  ProductUnit, 
  Category, 
  Manufacturer, 
  Ingredient, 
  Settings 
} from '../types/pharmacy';
import { recalculateUnitHierarchyPrices } from '../utils/unitsHelper';
import { 
  buildPharmacySearchIndex, 
  executePharmacySearch, 
  SearchMode, 
  SearchResultItem 
} from '../utils/pharmaSearch';

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  manufacturers: Manufacturer[];
  ingredients: Ingredient[];
  settings: Settings;
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onSaveIngredient: (ingredient: Ingredient) => void;
  onDeleteIngredient: (id: string) => void;
  onSaveCategory: (category: Category) => void;
  onDeleteCategory: (id: string) => void;
  onSaveManufacturer: (manufacturer: Manufacturer) => void;
  onDeleteManufacturer: (id: string) => void;
  onOpenScanner: (callback?: (barcode: string) => void) => void;
  scannedBarcode?: string | null;
  onClearScannedBarcode?: () => void;
}

type SubTab = 'all' | 'ingredients' | 'categories' | 'manufacturers';

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  manufacturers,
  ingredients,
  settings,
  onSaveProduct,
  onDeleteProduct,
  onSaveIngredient,
  onDeleteIngredient,
  onSaveCategory,
  onDeleteCategory,
  onSaveManufacturer,
  onDeleteManufacturer,
  onOpenScanner,
  scannedBarcode,
  onClearScannedBarcode,
}) => {
  const [currentSubTab, setCurrentSubTab] = useState<SubTab>('all');

  // Filters for "All Products"
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('all'); // 'all' (متزامن) | 'trade' | 'ingredient' | 'barcode'
  const [selectedIngredientFilter, setSelectedIngredientFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedManufacturerFilter, setSelectedManufacturerFilter] = useState('');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState('');

  // Product Modal (Add / Edit)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State for Product
  const [prodType, setProdType] = useState<'medicine' | 'commercial'>('medicine');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manufacturerId, setManufacturerId] = useState('');
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [selectedIngIds, setSelectedIngIds] = useState<string[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([
    { id: 'u-1', name: 'حبة', factor: 1, salePrice: 1, costPrice: 0.5 },
  ]);

  // Low Stock & Shortage Filter
  const [onlyLowStockFilter, setOnlyLowStockFilter] = useState(false);
  const [isPrintingShortageList, setIsPrintingShortageList] = useState(false);

  // Excel / CSV Price List Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [importParsedRows, setImportParsedRows] = useState<Array<{
    barcode: string;
    nameAr: string;
    costPrice: number;
    salePrice: number;
    wholesalePrice: number;
    stock: number;
    existingProduct?: Product;
    status: 'update' | 'new';
  }>>([]);

  // Listen to background continuous & hardware scanner global events
  const handleProductBarcodeScanned = React.useCallback((code: string) => {
    const raw = code.trim();
    if (!raw) return;

    if (isProductModalOpen) {
      setBarcode(raw);
    } else {
      // Find matching product
      const rawLower = raw.toLowerCase();
      const cleanNumeric = raw.replace(/^0+/, '');
      const existing = products.find(p => {
        const pCode = (p.barcode || '').trim().toLowerCase();
        const pClean = pCode.replace(/^0+/, '');
        return pCode === rawLower || (cleanNumeric.length > 0 && pClean === cleanNumeric);
      });

      if (existing) {
        // Open directly for editing price / stock / units!
        handleOpenEditProduct(existing);
      } else {
        // Open Add Medicine modal with this barcode ready
        setEditingProduct(null);
        setProdType('medicine');
        setNameAr('');
        setNameEn('');
        setBarcode(raw);
        setCategoryId(categories.find(c => c.type !== 'commercial')?.id || categories[0]?.id || '');
        setManufacturerId(manufacturers[0]?.id || '');
        setStock(100);
        setMinStock(10);
        setNotes('');
        setSelectedIngIds([]);
        setUnits([
          { id: 'u-1', name: 'حبة', factor: 1, salePrice: 1.0, costPrice: 0.5, wholesalePrice: 0.8 },
          { id: 'u-2', name: 'شريط', factor: 10, salePrice: 9.0, costPrice: 4.5, wholesalePrice: 7.5 },
          { id: 'u-3', name: 'علبة (20 حبة)', factor: 20, salePrice: 17.0, costPrice: 8.5, wholesalePrice: 14.5 },
        ]);
        setIsProductModalOpen(true);
      }
    }
  }, [isProductModalOpen, products, categories, manufacturers]);

  React.useEffect(() => {
    const handleGlobalScan = (e: Event) => {
      const customEvent = e as CustomEvent<{ barcode: string }>;
      if (customEvent.detail?.barcode) {
        handleProductBarcodeScanned(customEvent.detail.barcode);
      }
    };
    window.addEventListener('pharmacy:barcode-scanned', handleGlobalScan);
    return () => window.removeEventListener('pharmacy:barcode-scanned', handleGlobalScan);
  }, [handleProductBarcodeScanned]);

  // Handle scannedBarcode prop if passed from parent
  React.useEffect(() => {
    if (scannedBarcode) {
      handleProductBarcodeScanned(scannedBarcode);
      if (onClearScannedBarcode) {
        onClearScannedBarcode();
      }
    }
  }, [scannedBarcode, handleProductBarcodeScanned, onClearScannedBarcode]);

  // Quick Inline Modals
  const [isQuickCategoryOpen, setIsQuickCategoryOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatType, setQuickCatType] = useState<'medicine' | 'commercial' | 'both'>('medicine');

  const [isQuickMfrOpen, setIsQuickMfrOpen] = useState(false);
  const [quickMfrName, setQuickMfrName] = useState('');
  const [quickMfrCountry, setQuickMfrCountry] = useState('فلسطين');

  const [isQuickIngOpen, setIsQuickIngOpen] = useState(false);
  const [quickIngNameAr, setQuickIngNameAr] = useState('');
  const [quickIngNameEn, setQuickIngNameEn] = useState('');

  // Sub-tabs management modals for Ingredients, Categories, Manufacturers
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [isIngModalOpen, setIsIngModalOpen] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  const [editingMfr, setEditingMfr] = useState<Manufacturer | null>(null);
  const [isMfrModalOpen, setIsMfrModalOpen] = useState(false);

  // Unique list of countries for filter
  const countries = useMemo(() => {
    const list = manufacturers.map(m => m.country).filter(Boolean);
    return Array.from(new Set(list));
  }, [manufacturers]);

  // Lookups
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const manufacturersMap = useMemo(() => new Map(manufacturers.map(m => [m.id, m])), [manufacturers]);
  const ingredientsMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);

  // 1. In-Memory Search Index (Ultra-Fast Pre-computed representation)
  const pharmaSearchIndex = useMemo(() => {
    return buildPharmacySearchIndex(products, ingredients, categories, manufacturers);
  }, [products, ingredients, categories, manufacturers]);

  // 2. Ultra-Fast Concurrent Search Execution
  const searchResult = useMemo(() => {
    return executePharmacySearch(pharmaSearchIndex, searchTerm, {
      mode: searchMode,
      categoryId: selectedCategoryFilter || undefined,
      manufacturerId: selectedManufacturerFilter || undefined,
      country: selectedCountryFilter || undefined,
      onlyLowStock: onlyLowStockFilter,
    });
  }, [pharmaSearchIndex, searchTerm, searchMode, selectedCategoryFilter, selectedManufacturerFilter, selectedCountryFilter, onlyLowStockFilter]);

  // 3. Filtered Products & Match Details Map (supports Active Ingredient filter)
  const { filteredProducts, searchMatchMap } = useMemo(() => {
    let items = searchResult.items;
    if (selectedIngredientFilter) {
      items = items.filter(item => item.product.ingredientIds?.includes(selectedIngredientFilter));
    }
    const map = new Map<string, SearchResultItem['matchDetails']>();
    for (const item of items) {
      map.set(item.product.id, item.matchDetails);
    }
    return {
      filteredProducts: items.map(item => item.product),
      searchMatchMap: map,
    };
  }, [searchResult, selectedIngredientFilter]);

  // Open Modal for New Medicine
  const handleOpenAddMedicine = () => {
    setEditingProduct(null);
    setProdType('medicine');
    setNameAr('');
    setNameEn('');
    setBarcode('');
    setCategoryId(categories.find(c => c.type !== 'commercial')?.id || categories[0]?.id || '');
    setManufacturerId(manufacturers[0]?.id || '');
    setStock(100);
    setMinStock(10);
    setNotes('');
    setSelectedIngIds([]);
    setUnits([
      { id: 'u-1', name: 'حبة', factor: 1, salePrice: 1.0, costPrice: 0.5, wholesalePrice: 0.8 },
      { id: 'u-2', name: 'شريط', factor: 10, salePrice: 9.0, costPrice: 4.5, wholesalePrice: 7.5 },
      { id: 'u-3', name: 'علبة (20 حبة)', factor: 20, salePrice: 17.0, costPrice: 8.5, wholesalePrice: 14.5 },
    ]);
    setIsProductModalOpen(true);
  };

  // Open Modal for New Commercial Item
  const handleOpenAddCommercial = () => {
    setEditingProduct(null);
    setProdType('commercial');
    setNameAr('');
    setNameEn('');
    setBarcode('');
    setCategoryId(categories.find(c => c.type !== 'medicine')?.id || categories[0]?.id || '');
    setManufacturerId(manufacturers[0]?.id || '');
    setStock(20);
    setMinStock(5);
    setNotes('');
    setSelectedIngIds([]);
    setUnits([
      { id: 'u-1', name: 'قطعة', factor: 1, salePrice: 15.0, costPrice: 10.0, wholesalePrice: 12.0 },
    ]);
    setIsProductModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdType(prod.type);
    setNameAr(prod.nameAr);
    setNameEn(prod.nameEn);
    setBarcode(prod.barcode);
    setCategoryId(prod.categoryId);
    setManufacturerId(prod.manufacturerId);
    setStock(prod.stock);
    setMinStock(prod.minStock ?? 5);
    setNotes(prod.notes || '');
    setSelectedIngIds(prod.ingredientIds || []);
    setUnits(prod.units.length > 0 ? [...prod.units] : [{ id: 'u-1', name: 'وحدة', factor: 1, salePrice: 1, costPrice: 0.5 }]);
    setIsProductModalOpen(true);
  };

  // Parse imported text (CSV, TSV, or Excel copy-paste)
  const handleParseImport = (text: string) => {
    setImportRawText(text);
    if (!text.trim()) {
      setImportParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    // Detect delimiter: tab, comma, or semicolon
    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(',')) delimiter = ',';
    else if (firstLine.includes(';')) delimiter = ';';

    // Check if first line is a header
    const hasHeader = /باركود|barcode|اسم|name|سعر|price|تكلفة|cost/i.test(firstLine);
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const parsed = dataLines.map(line => {
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      const barcode = parts[0] || '';
      const nameAr = parts[1] || 'صنف مستورد';
      const costPrice = parseFloat(parts[2]) || 0;
      const salePrice = parseFloat(parts[3]) || 0;
      const wholesalePrice = parseFloat(parts[4]) || 0;
      const stock = parseInt(parts[5] || '0', 10) || 0;

      const existing = products.find(p => p.barcode.toLowerCase() === barcode.toLowerCase());
      return {
        barcode,
        nameAr: existing?.nameAr || nameAr,
        costPrice,
        salePrice,
        wholesalePrice,
        stock,
        existingProduct: existing,
        status: (existing ? 'update' : 'new') as 'update' | 'new',
      };
    }).filter(row => row.barcode.length > 0);

    setImportParsedRows(parsed);
  };

  // Apply imported price list
  const handleApplyImport = () => {
    if (importParsedRows.length === 0) return;
    
    importParsedRows.forEach(row => {
      if (row.existingProduct) {
        // Update existing product
        const existing = row.existingProduct;
        const updatedUnits = existing.units.map((u, i) => {
          if (i === 0) {
            return {
              ...u,
              salePrice: row.salePrice > 0 ? row.salePrice : u.salePrice,
              costPrice: row.costPrice > 0 ? row.costPrice : u.costPrice,
              wholesalePrice: row.wholesalePrice > 0 ? row.wholesalePrice : u.wholesalePrice,
            };
          }
          return u;
        });

        onSaveProduct({
          ...existing,
          stock: row.stock > 0 ? row.stock : existing.stock,
          units: updatedUnits,
          lastCostPrice: row.costPrice > 0 ? row.costPrice : existing.lastCostPrice,
          lastSalePrice: row.salePrice > 0 ? row.salePrice : existing.lastSalePrice,
        });
      } else {
        // Create new product
        const newProd: Product = {
          id: 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          nameAr: row.nameAr,
          nameEn: row.nameAr,
          barcode: row.barcode,
          type: 'medicine',
          categoryId: categories[0]?.id || '',
          manufacturerId: manufacturers[0]?.id || '',
          ingredientIds: [],
          stock: row.stock || 20,
          minStock: 5,
          units: [
            {
              id: 'u-1',
              name: 'عبوة',
              factor: 1,
              salePrice: row.salePrice || 10,
              costPrice: row.costPrice || 7,
              wholesalePrice: row.wholesalePrice || 8.5,
            }
          ],
          createdAt: new Date().toISOString(),
        };
        onSaveProduct(newProd);
      }
    });

    alert(`تم بنجاح تحديث واستيراد ${importParsedRows.length} صنف إلى قاعدة البيانات!`);
    setIsImportModalOpen(false);
    setImportRawText('');
    setImportParsedRows([]);
  };

  // Add a unit row in Product Form
  const handleAddUnitRow = () => {
    const newUnitId = 'u-' + Date.now();
    const lastUnit = units[units.length - 1];
    const autoBarcode = barcode.trim() 
      ? `${barcode.trim()}-${units.length + 1}` 
      : `U${Date.now().toString().slice(-6)}${units.length + 1}`;

    setUnits(prev => [
      ...prev,
      {
        id: newUnitId,
        name: prev.length === 1 ? 'شريط' : 'علبة',
        factor: prev.length === 1 ? 10 : 20,
        containsQty: prev.length === 1 ? 10 : 2,
        parentUnitId: lastUnit ? lastUnit.id : undefined,
        barcode: autoBarcode,
        salePrice: 0,
        costPrice: 0,
      },
    ]);
  };

  // Remove unit row
  const handleRemoveUnitRow = (index: number) => {
    if (units.length <= 1) {
      alert('يجب أن يحتوي الصنف على وحدة بيع واحدة على الأقل');
      return;
    }
    setUnits(prev => prev.filter((_, i) => i !== index));
  };

  // Update unit row
  const handleUpdateUnitRow = (index: number, field: keyof ProductUnit, val: any) => {
    setUnits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Auto Recalculate Unit Hierarchy Prices
  const handleAutoRecalculatePrices = (targetUnitId?: string) => {
    const baseSale = editingProduct?.lastSalePrice || (units.find(u => u.salePrice > 0)?.salePrice) || 0;
    const recalculated = recalculateUnitHierarchyPrices(units, targetUnitId, undefined, undefined, baseSale);
    setUnits(recalculated);
  };

  // Save Product
  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      alert('الرجاء إدخال الاسم العربي للصنف');
      return;
    }
    if (!barcode.trim()) {
      alert('الرجاء إدخال أو مسح الباركود');
      return;
    }

    const newProd: Product = {
      id: editingProduct ? editingProduct.id : 'prod-' + Date.now(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      barcode: barcode.trim(),
      type: prodType,
      categoryId,
      ingredientIds: prodType === 'medicine' ? selectedIngIds : [],
      manufacturerId,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 5,
      notes: notes.trim(),
      units: units.map((u, i) => ({
        ...u,
        barcode: u.barcode?.trim() || `${barcode.trim() || 'PROD'}-${i + 1}`,
        factor: Number(u.factor) || 1,
        salePrice: Number(u.salePrice) || 0,
        costPrice: Number(u.costPrice) || 0,
        wholesalePrice: Number(u.wholesalePrice) || 0,
        specialPrice: Number(u.specialPrice) || 0,
      })),
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
    };

    onSaveProduct(newProd);
    setIsProductModalOpen(false);
  };

  // Quick Category Save
  const handleSaveQuickCategory = () => {
    if (!quickCatName.trim()) return;
    const cat: Category = {
      id: 'cat-' + Date.now(),
      name: quickCatName.trim(),
      type: quickCatType,
    };
    onSaveCategory(cat);
    setCategoryId(cat.id);
    setQuickCatName('');
    setIsQuickCategoryOpen(false);
  };

  // Quick Manufacturer Save
  const handleSaveQuickMfr = () => {
    if (!quickMfrName.trim()) return;
    const mfr: Manufacturer = {
      id: 'man-' + Date.now(),
      name: quickMfrName.trim(),
      country: quickMfrCountry.trim(),
    };
    onSaveManufacturer(mfr);
    setManufacturerId(mfr.id);
    setQuickMfrName('');
    setIsQuickMfrOpen(false);
  };

  // Quick Ingredient Save
  const handleSaveQuickIng = () => {
    if (!quickIngNameAr.trim()) return;
    const ing: Ingredient = {
      id: 'ing-' + Date.now(),
      nameAr: quickIngNameAr.trim(),
      nameEn: quickIngNameEn.trim() || quickIngNameAr.trim(),
      createdAt: new Date().toISOString(),
    };
    onSaveIngredient(ing);
    setSelectedIngIds(prev => [...prev, ing.id]);
    setQuickIngNameAr('');
    setQuickIngNameEn('');
    setIsQuickIngOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCurrentSubTab('all')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              currentSubTab === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>جميع الأصناف ({products.length})</span>
          </button>

          <button
            onClick={() => setCurrentSubTab('ingredients')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              currentSubTab === 'ingredients'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            <span>المواد الفعالة ({ingredients.length})</span>
          </button>

          <button
            onClick={() => setCurrentSubTab('categories')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              currentSubTab === 'categories'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Tag className="h-4 w-4" />
            <span>التصنيفات ({categories.length})</span>
          </button>

          <button
            onClick={() => setCurrentSubTab('manufacturers')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              currentSubTab === 'manufacturers'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>المصانع والدول ({manufacturers.length})</span>
          </button>
        </div>

        {/* Action Buttons for New Product & Excel Import */}
        {currentSubTab === 'all' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setImportRawText('');
                setImportParsedRows([]);
                setIsImportModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
              title="استيراد وتحديث الأسعار والمخزون من ملف إكسل أو كشف مورد"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>📊 استيراد أسعار إكسل</span>
            </button>
            <button
              onClick={handleOpenAddMedicine}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-sky-700 active:scale-95 transition-all"
            >
              <Pill className="h-4 w-4" />
              <span>💊 + دواء جديد</span>
            </button>
            <button
              onClick={handleOpenAddCommercial}
              className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition-all"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>🛍️ + صنف تجاري</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. SubTab: All Products */}
      {currentSubTab === 'all' && (
        <div className="space-y-4">
          {/* Multi-Filters & Ultra-Fast Concurrent Search Bar */}
          <div className="rounded-2xl bg-white p-3 sm:p-4 shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-3">
            {/* Search Input Box with Mode Selection */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-600 dark:text-sky-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث بالاسم التجاري أو المادة الفعالة (Paracetamol / باراسيتامول) أو الباركود متزامناً..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/80 py-2.5 pr-10 pl-20 text-xs sm:text-sm font-medium focus:border-sky-500 focus:bg-white focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white transition-all shadow-inner"
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      title="مسح نص البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenScanner((scanned) => setSearchTerm(scanned.trim()))}
                    className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-600 dark:bg-sky-950 dark:hover:bg-sky-900 dark:text-sky-300 transition"
                    title="مسح باركود للبحث المباشر"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Concurrent Search Mode Switcher Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1">نمط البحث:</span>
                <button
                  type="button"
                  onClick={() => setSearchMode('all')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    searchMode === 'all'
                      ? 'bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>⚡ متزامن (تجاري + مادة فعالة)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchMode('trade')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    searchMode === 'trade'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>الاسم التجاري فقط</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchMode('ingredient')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    searchMode === 'ingredient'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>المادة الفعالة فقط</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchMode('barcode')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    searchMode === 'barcode'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>الباركود</span>
                </button>
              </div>
            </div>

            {/* Dropdown Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {/* Active Ingredient Filter */}
              <div>
                <select
                  value={selectedIngredientFilter}
                  onChange={(e) => setSelectedIngredientFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">🧪 كل المواد الفعالة ({ingredients.length})</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.nameAr} {ing.nameEn ? `(${ing.nameEn})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">كل التصنيفات ({categories.length})</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Manufacturer Filter */}
              <div>
                <select
                  value={selectedManufacturerFilter}
                  onChange={(e) => setSelectedManufacturerFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">كل المصانع ({manufacturers.length})</option>
                  {manufacturers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.country})</option>
                  ))}
                </select>
              </div>

              {/* Country Filter */}
              <div>
                <select
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">كل البلدان ({countries.length})</option>
                  {countries.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Performance Bar & Active Filter Highlights */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                  <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    عُثر على {filteredProducts.length} صنف من أصل {products.length} ({searchResult.searchDurationMs} ms)
                  </span>
                </span>

                {selectedIngredientFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 font-bold border border-teal-300 dark:border-teal-800">
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>تصفية بدائل المادة: {ingredientsMap.get(selectedIngredientFilter)?.nameAr}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedIngredientFilter('')}
                      className="mr-1 p-0.5 hover:bg-teal-200 dark:hover:bg-teal-900 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(searchTerm || selectedIngredientFilter || selectedCategoryFilter || selectedManufacturerFilter || selectedCountryFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedIngredientFilter('');
                      setSelectedCategoryFilter('');
                      setSelectedManufacturerFilter('');
                      setSelectedCountryFilter('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>إلغاء الفلاتر</span>
                  </button>
                )}
              </div>

              {/* Quick Shortage and Reorder Bar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyLowStockFilter(!onlyLowStockFilter)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    onlyLowStockFilter
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>🚨 نواقص المخزون ({products.filter(p => p.stock <= (p.minStock ?? 5)).length})</span>
                </button>

                {onlyLowStockFilter && (
                  <button
                    type="button"
                    onClick={() => setIsPrintingShortageList(true)}
                    className="px-3 py-1 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة الكشف</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Products Table & Mobile Cards */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                لا توجد أصناف تطابق معايير البحث
              </div>
            ) : (
              <>
                {/* Mobile Cards View (Visible on phones and small tablets) */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2.5 space-y-2.5">
                  {filteredProducts.map(p => {
                    const mfr = manufacturersMap.get(p.manufacturerId);
                    const catName = categoriesMap.get(p.categoryId) || 'عام';
                    return (
                      <div
                        key={p.id}
                        className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 space-y-2.5"
                      >
                        {/* Name & Type & Barcode */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                p.type === 'medicine' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                              }`}>
                                {p.type === 'medicine' ? '💊 دواء' : '🛍️ تجاري'}
                              </span>
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                {p.nameAr}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                              {p.nameEn}
                            </div>
                            {/* Match details when searching */}
                            {searchTerm && searchMatchMap.get(p.id)?.matchedInIngredient && (
                              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100/90 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-[10px] font-bold">
                                <FlaskConical className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                                <span>تطابق مادة فعالة: {searchMatchMap.get(p.id)?.matchedIngredientNames.join('، ')}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-2 rounded-xl text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 transition-colors"
                              title="تعديل الصنف"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف الصنف "${p.nameAr}"؟`)) {
                                  onDeleteProduct(p.id);
                                }
                              }}
                              className="p-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 transition-colors"
                              title="حذف الصنف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Barcode & Category & Manufacturer */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700">
                          <div>
                            <span className="text-[10px] text-slate-400 block">الباركود:</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate block">
                              {p.barcode}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">التصنيف:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate block">
                              {catName}
                            </span>
                          </div>
                          {mfr?.name && (
                            <div className="col-span-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span>المصنع: </span>
                              <strong className="text-slate-700 dark:text-slate-300">{mfr.name}</strong>
                              {mfr.country && <span> ({mfr.country})</span>}
                            </div>
                          )}
                        </div>

                        {/* Ingredients (if medicine) */}
                        {p.ingredientIds && p.ingredientIds.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-400">المواد الفعالة:</span>
                            {p.ingredientIds.map(ingId => {
                              const ing = ingredientsMap.get(ingId);
                              const isSelected = selectedIngredientFilter === ingId;
                              return (
                                <button
                                  key={ingId}
                                  type="button"
                                  onClick={() => setSelectedIngredientFilter(isSelected ? '' : ingId)}
                                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border transition-all ${
                                    isSelected
                                      ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 border-sky-100 dark:border-sky-900'
                                  }`}
                                  title="انقر لتصفية وعرض جميع بدائل هذه المادة الفعالة"
                                >
                                  🧪 {ing?.nameAr || ingId} {isSelected && '✓'}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Stock & Units Breakdown */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                          {/* Stock Status */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">المخزون:</span>
                            <span className={`px-2 py-0.5 rounded-full font-black text-xs ${
                              p.stock > (p.minStock ?? 5)
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : p.stock > 0 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {p.stock}
                            </span>
                            {p.stock <= (p.minStock ?? 5) && (
                              <span className="text-[10px] text-rose-600 font-bold">
                                ⚠️ ناقص
                              </span>
                            )}
                          </div>

                          {/* Primary Unit Price */}
                          <div className="text-left">
                            <span className="text-[10px] text-slate-400 block">سعر البيع</span>
                            <span className="font-black text-sm text-sky-700 dark:text-sky-400">
                              {p.units[0]?.salePrice} {settings.currency}
                              <span className="text-[10px] font-normal text-slate-400 mr-1">({p.units[0]?.name})</span>
                            </span>
                          </div>
                        </div>

                        {/* Additional Units if any */}
                        {p.units.length > 1 && (
                          <div className="flex flex-wrap gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg">
                            <span className="text-[10px] text-slate-400 w-full font-bold">باقي الوحدات:</span>
                            {p.units.slice(1).map((u, i) => (
                              <span key={i} className="text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                {u.name}: <strong>{u.salePrice} {settings.currency}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (hidden on mobile, visible on md and up) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3 font-bold">الصنف والنوع</th>
                        <th className="px-3 py-3 font-bold">الباركود</th>
                        <th className="px-3 py-3 font-bold">التصنيف</th>
                        <th className="px-3 py-3 font-bold">المواد الفعالة</th>
                        <th className="px-3 py-3 font-bold">المصنع والدولة</th>
                        <th className="px-3 py-3 font-bold text-center">المخزون</th>
                        <th className="px-3 py-3 font-bold text-center">الوحدات والأسعار</th>
                        <th className="px-3 py-3 font-bold text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredProducts.map(p => {
                        const mfr = manufacturersMap.get(p.manufacturerId);
                        const catName = categoriesMap.get(p.categoryId) || 'عام';
                        const matchDetails = searchMatchMap.get(p.id);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${p.type === 'medicine' ? 'bg-sky-500' : 'bg-teal-500'}`} />
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-extrabold text-slate-900 dark:text-white block">{p.nameAr}</span>
                                    {searchTerm && matchDetails?.matchedInIngredient && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                                        <FlaskConical className="w-2.5 h-2.5" />
                                        <span>تطابق مادة فعالة</span>
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-medium" dir="ltr">{p.nameEn}</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-300">
                              {p.barcode}
                            </td>

                            <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">
                              {catName}
                            </td>

                            {/* Ingredients */}
                            <td className="px-3 py-3">
                              {p.ingredientIds && p.ingredientIds.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {p.ingredientIds.map(ingId => {
                                    const ing = ingredientsMap.get(ingId);
                                    const isSelected = selectedIngredientFilter === ingId;
                                    return (
                                      <button
                                        key={ingId}
                                        type="button"
                                        onClick={() => setSelectedIngredientFilter(isSelected ? '' : ingId)}
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-all ${
                                          isSelected
                                            ? 'bg-teal-600 text-white shadow-xs'
                                            : 'bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:text-sky-300 border border-sky-100 dark:border-sky-900'
                                        }`}
                                        title="انقر لتصفية وعرض جميع بدائل هذه المادة الفعالة"
                                      >
                                        🧪 {ing?.nameAr || ingId} {isSelected && '✓'}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">- صنف تجاري -</span>
                              )}
                            </td>

                            <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                              <div>{mfr?.name || '-'}</div>
                              <span className="text-[10px] text-slate-400">{mfr?.country || ''}</span>
                            </td>

                            {/* Stock */}
                            <td className="px-3 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  p.stock > (p.minStock ?? 5)
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                    : p.stock > 0 
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {p.stock}
                                </span>

                                {p.stock <= (p.minStock ?? 5) && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                    <AlertCircle className="w-3 h-3 text-rose-500" />
                                    <span>ناقص (حد الطلب: {p.minStock ?? 5})</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Units */}
                            <td className="px-3 py-3 text-center">
                              <div className="flex flex-col gap-0.5">
                                {p.units.map((u, i) => (
                                  <span key={i} className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                    {u.name}: <strong className="text-sky-700 dark:text-sky-400">{u.salePrice} {settings.currency}</strong>
                                    {u.wholesalePrice ? (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mr-1 font-bold">
                                        (جملة: {u.wholesalePrice})
                                      </span>
                                    ) : null}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditProduct(p)}
                                  className="rounded-lg p-1 text-slate-500 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-slate-800"
                                  title="تعديل"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`هل أنت متأكد من حذف الصنف "${p.nameAr}"؟`)) {
                                      onDeleteProduct(p.id);
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. SubTab: Active Ingredients (المواد الفعالة) */}
      {currentSubTab === 'ingredients' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">سجل المواد الفعالة والبدائل</h3>
            <button
              onClick={() => {
                setEditingIngredient(null);
                setQuickIngNameAr('');
                setQuickIngNameEn('');
                setIsIngModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>+ مادة فعالة جديدة</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-bold">الاسم بالعربية</th>
                  <th className="px-4 py-3 font-bold">الاسم بالإنجليزية</th>
                  <th className="px-4 py-3 font-bold">الوصف والتأثير</th>
                  <th className="px-4 py-3 font-bold text-center">الأدوية المرتبطة</th>
                  <th className="px-4 py-3 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ingredients.map(ing => {
                  const linkedCount = products.filter(p => p.ingredientIds?.includes(ing.id)).length;
                  return (
                    <tr key={ing.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{ing.nameAr}</td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400" dir="ltr">{ing.nameEn}</td>
                      <td className="px-4 py-3 text-slate-500">{ing.description || '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-teal-600">{linkedCount} دواء</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingIngredient(ing);
                              setQuickIngNameAr(ing.nameAr);
                              setQuickIngNameEn(ing.nameEn);
                              setIsIngModalOpen(true);
                            }}
                            className="rounded-lg p-1 text-slate-500 hover:text-sky-600"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`حذف المادة الفعالة "${ing.nameAr}"؟`)) {
                                onDeleteIngredient(ing.id);
                              }
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
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
        </div>
      )}

      {/* 3. SubTab: Categories (التصنيفات) */}
      {currentSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">إدارة التصنيفات والأقسام</h3>
            <button
              onClick={() => {
                setEditingCategory(null);
                setQuickCatName('');
                setQuickCatType('medicine');
                setIsCatModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              <span>+ تصنيف جديد</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-bold">اسم التصنيف</th>
                  <th className="px-4 py-3 font-bold">النوع المسموح</th>
                  <th className="px-4 py-3 font-bold">الوصف</th>
                  <th className="px-4 py-3 font-bold text-center">عدد الأصناف</th>
                  <th className="px-4 py-3 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categories.map(cat => {
                  const count = products.filter(p => p.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{cat.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {cat.type === 'medicine' ? 'أدوية فقط' : cat.type === 'commercial' ? 'تجاري فقط' : 'دواء وتجاري'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{cat.description || '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-indigo-600">{count} صنف</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setQuickCatName(cat.name);
                              setQuickCatType(cat.type);
                              setIsCatModalOpen(true);
                            }}
                            className="rounded-lg p-1 text-slate-500 hover:text-sky-600"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`حذف التصنيف "${cat.name}"؟`)) {
                                onDeleteCategory(cat.id);
                              }
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
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
        </div>
      )}

      {/* 4. SubTab: Manufacturers & Countries (المصانع والدول) */}
      {currentSubTab === 'manufacturers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">سجل المصانع الدوائية والدول</h3>
            <button
              onClick={() => {
                setEditingMfr(null);
                setQuickMfrName('');
                setQuickMfrCountry('فلسطين');
                setIsMfrModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              <span>+ مصنع جديد</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-xs border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-bold">اسم المصنع</th>
                  <th className="px-4 py-3 font-bold">بلد المنشأ</th>
                  <th className="px-4 py-3 font-bold text-center">عدد الأصناف المسجلة</th>
                  <th className="px-4 py-3 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {manufacturers.map(mfr => {
                  const count = products.filter(p => p.manufacturerId === mfr.id).length;
                  return (
                    <tr key={mfr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{mfr.name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{mfr.country}</td>
                      <td className="px-4 py-3 text-center font-bold text-purple-600">{count} صنف</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMfr(mfr);
                              setQuickMfrName(mfr.name);
                              setQuickMfrCountry(mfr.country);
                              setIsMfrModalOpen(true);
                            }}
                            className="rounded-lg p-1 text-slate-500 hover:text-sky-600"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`حذف المصنع "${mfr.name}"؟`)) {
                                onDeleteManufacturer(mfr.id);
                              }
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:text-rose-600"
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
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT PRODUCT ================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs">
          <div className="w-[calc(100%-16px)] sm:w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b px-4 py-3 text-white shrink-0 ${
              prodType === 'medicine' ? 'bg-sky-600' : 'bg-teal-600'
            }`}>
              <div className="flex items-center gap-2">
                {prodType === 'medicine' ? <Pill className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                <h3 className="font-extrabold text-sm sm:text-base truncate">
                  {editingProduct ? `تعديل صنف: ${editingProduct.nameAr}` : prodType === 'medicine' ? 'إضافة دواء جديد' : 'إضافة صنف تجاري جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitProduct} className="p-3 sm:p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Type Switcher */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProdType('medicine')}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                    prodType === 'medicine' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 dark:bg-slate-800'
                  }`}
                >
                  💊 دواء (يحتوي مواد فعالة وبدائل)
                </button>
                <button
                  type="button"
                  onClick={() => setProdType('commercial')}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                    prodType === 'commercial' ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 dark:bg-slate-800'
                  }`}
                >
                  🛍️ صنف تجاري (مستلزمات، تجميل، بدون مواد فعالة)
                </button>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم بالعربية <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: أكامول 500 ملغم"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم بالإنجليزية:
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="مثال: Acamol 500mg"
                    dir="ltr"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white text-left font-mono"
                  />
                </div>
              </div>

              {/* Barcode with Camera Scan Button */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الباركود الدولي <span className="text-rose-500">*</span>:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="امسح الباركود أو اكتبه هنا..."
                    dir="ltr"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white text-center"
                  />
                  <button
                    type="button"
                    onClick={() => onOpenScanner((scanned) => setBarcode(scanned.trim()))}
                    className="flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 active:scale-95 transition"
                    title="مسح بالكاميرا"
                  >
                    <Camera className="h-4 w-4" />
                    <span>مسح 📷</span>
                  </button>
                </div>
              </div>

              {/* Category & Manufacturer with Instant "+" Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      التصنيف <span className="text-rose-500">*</span>:
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickCategoryOpen(true)}
                      className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      إضافة تصنيف
                    </button>
                  </div>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Manufacturer */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      المصنع والدولة <span className="text-rose-500">*</span>:
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsQuickMfrOpen(true)}
                      className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      إضافة مصنع
                    </button>
                  </div>
                  <select
                    value={manufacturerId}
                    onChange={(e) => setManufacturerId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {manufacturers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.country})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Ingredients (Shown only for medicine) */}
              {prodType === 'medicine' && (
                <div className="rounded-xl bg-sky-50/70 p-3 border border-sky-200 dark:bg-sky-950/30 dark:border-sky-900">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-sky-600" />
                      <label className="text-xs font-extrabold text-sky-900 dark:text-sky-200">
                        المواد الفعالة (لاكتشاف البدائل تلقائياً):
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQuickIngOpen(true)}
                      className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      + مادة فعالة جديدة
                    </button>
                  </div>

                  {/* Active Selected Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedIngIds.length === 0 ? (
                      <span className="text-xs text-slate-400">لم يتم اختيار مواد فعالة بعد</span>
                    ) : (
                      selectedIngIds.map(id => {
                        const ing = ingredientsMap.get(id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white"
                          >
                            <span>{ing?.nameAr || id}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedIngIds(prev => prev.filter(i => i !== id))}
                              className="hover:bg-white/20 rounded p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  {/* Ingredients Dropdown Selector */}
                  <div className="flex gap-2">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !selectedIngIds.includes(val)) {
                          setSelectedIngIds(prev => [...prev, val]);
                        }
                      }}
                      value=""
                      className="w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">اختر مادة فعالة لإضافتها...</option>
                      {ingredients
                        .filter(i => !selectedIngIds.includes(i.id))
                        .map(i => (
                          <option key={i.id} value={i.id}>{i.nameAr} - {i.nameEn}</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Initial Stock & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المخزون الأولي (بالوحدة الأساسية كالحبة):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                    حد إعادة الطلب (تنبيه النواقص):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(parseInt(e.target.value, 10) || 0)}
                    placeholder="مثلاً: 5 علب"
                    className="w-full rounded-xl border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ملاحظات أو طريقة الحفظ:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="مثلاً: يحفظ في الثلاجة 2-8 درجات"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Units Manager (الأهم - محرر الوحدات الذكي المتسلسل) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-sky-600" />
                      <span>شجرة وحدات البيع والتسعير المتعدد (قطاعي / جملة / خاص)</span>
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      حدد السعر لأي وحدة وسيتم تقسيم الأسعار آلياً. إذا تُرك السعر 0 يعتمد على آخر سعر بيع مسجل.
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAutoRecalculatePrices()}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                      title="حساب وتوزيع الأسعار التلقائي"
                    >
                      <span>⚡ تقسيم الأسعار تلقائياً</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddUnitRow}
                      className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-900 dark:bg-slate-700"
                    >
                      <Plus className="h-3 w-3" />
                      <span>+ إضافة وحدة</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {units.map((u, idx) => (
                    <div
                      key={u.id || idx}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2 items-start sm:items-center">
                        <div className="col-span-2 sm:col-span-1 lg:col-span-3">
                          <label className="block text-[10px] font-bold text-slate-400">اسم الوحدة:</label>
                          <input
                            type="text"
                            value={u.name}
                            placeholder="حبة / شريط / علبة"
                            onChange={(e) => handleUpdateUnitRow(idx, 'name', e.target.value)}
                            className="w-full rounded-md border border-slate-300 p-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>

                        <div className="col-span-1 lg:col-span-1">
                          <label className="block text-[10px] font-bold text-slate-400">المعامل:</label>
                          <input
                            type="number"
                            min="1"
                            value={u.factor}
                            onChange={(e) => handleUpdateUnitRow(idx, 'factor', parseInt(e.target.value, 10) || 1)}
                            className="w-full rounded-md border border-slate-300 p-1 text-xs font-bold text-center dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>

                        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-400">التكلفة ({settings.currency}):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={u.costPrice}
                            onChange={(e) => handleUpdateUnitRow(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-md border border-slate-300 p-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>

                        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                          <label className="block text-[10px] font-bold text-sky-600">سعر الجمهور:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={u.salePrice}
                            onChange={(e) => handleUpdateUnitRow(idx, 'salePrice', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-md border border-slate-300 p-1 text-xs font-bold text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400"
                          />
                        </div>

                        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                          <label className="block text-[10px] font-bold text-emerald-600">سعر الجملة:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={u.wholesalePrice || 0}
                            onChange={(e) => handleUpdateUnitRow(idx, 'wholesalePrice', parseFloat(e.target.value) || 0)}
                            placeholder="اختياري"
                            className="w-full rounded-md border border-emerald-300 p-1 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-400"
                          />
                        </div>

                        <div className="col-span-2 sm:col-span-1 lg:col-span-2 flex justify-end lg:justify-center pt-1 lg:pt-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveUnitRow(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="حذف الوحدة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Parent unit linking & contains quantity */}
                      {idx > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <span>الوحدة التي تتبع لها:</span>
                            <select
                              value={u.parentUnitId || ''}
                              onChange={(e) => handleUpdateUnitRow(idx, 'parentUnitId', e.target.value || undefined)}
                              className="rounded border border-slate-200 dark:border-slate-700 p-1 text-xs font-semibold dark:bg-slate-800"
                            >
                              <option value="">لا يوجد ارتباط مباشر</option>
                              {units.slice(0, idx).map(pu => (
                                <option key={pu.id} value={pu.id}>
                                  {pu.name} (معامل {pu.factor})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 justify-end">
                            <span>تحتوي على:</span>
                            <input
                              type="number"
                              min="1"
                              value={u.containsQty || u.factor}
                              onChange={(e) => handleUpdateUnitRow(idx, 'containsQty', parseInt(e.target.value) || 1)}
                              className="w-16 rounded border border-slate-200 dark:border-slate-700 p-1 text-center font-bold dark:bg-slate-800 text-xs"
                            />
                            <span>من الوحدة السابقة</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-6 py-2 text-xs font-extrabold text-white shadow-md hover:bg-sky-700"
                >
                  💾 حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= QUICK MODALS FOR INSTANT ADDING ================= */}
      {/* Quick Category Modal */}
      {isQuickCategoryOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">إضافة تصنيف فوري</h4>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">اسم التصنيف:</label>
              <input
                type="text"
                value={quickCatName}
                onChange={(e) => setQuickCatName(e.target.value)}
                placeholder="مثال: قطرات عيون، مهدئات"
                className="w-full rounded-xl border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">نوع التصنيف:</label>
              <select
                value={quickCatType}
                onChange={(e) => setQuickCatType(e.target.value as 'medicine' | 'commercial' | 'both')}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="medicine">دواء فقط</option>
                <option value="commercial">تجاري فقط</option>
                <option value="both">كلاهما</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQuickCategoryOpen(false)}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveQuickCategory}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Manufacturer Modal */}
      {isQuickMfrOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">إضافة مصنع جديد</h4>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">اسم المصنع:</label>
              <input
                type="text"
                value={quickMfrName}
                onChange={(e) => setQuickMfrName(e.target.value)}
                placeholder="مثال: شركة تبوك للأدوية"
                className="w-full rounded-xl border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">الدولة:</label>
              <input
                type="text"
                value={quickMfrCountry}
                onChange={(e) => setQuickMfrCountry(e.target.value)}
                placeholder="مثال: فلسطين، الأردن، مصر..."
                className="w-full rounded-xl border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQuickMfrOpen(false)}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveQuickMfr}
                className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Ingredient Modal */}
      {isQuickIngOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">إضافة مادة فعالة جديدة</h4>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">الاسم بالعربية:</label>
              <input
                type="text"
                value={quickIngNameAr}
                onChange={(e) => setQuickIngNameAr(e.target.value)}
                placeholder="مثال: لوراتادين"
                className="w-full rounded-xl border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">الاسم بالإنجليزية:</label>
              <input
                type="text"
                value={quickIngNameEn}
                onChange={(e) => setQuickIngNameEn(e.target.value)}
                placeholder="Loratadine"
                dir="ltr"
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-left dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQuickIngOpen(false)}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveQuickIng}
                className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL / CSV PRICE LIST IMPORT MODAL (الميزة 13) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    استيراد وتحديث الأسعار والمخزون من ملف Excel / CSV
                  </h3>
                  <p className="text-xs text-slate-500">
                    يمكنك لصق جدول الإكسل مباشرة (نسخ ولصق) أو رفع ملف CSV/TSV
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Instructions Banner */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                  💡 التنسيق المدعوم للأعمدة (انسخها من إكسل والصقها أدناه):
                </div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  العمود 1: الباركود | العمود 2: اسم الصنف | العمود 3: سعر التكلفة | العمود 4: سعر البيع | العمود 5: سعر الجملة | العمود 6: الكمية
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  * إذا كان الباركود موجوداً في الصيدلية، سيتم تحديث أسعاره ومخزونه تلقائياً. وإذا كان جديداً، سيتم إنشاؤه تلقائياً.
                </div>
              </div>

              {/* Paste or Upload Area */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الصق البيانات من Excel هنا:
                  </label>
                  <label className="cursor-pointer text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>أو اختر ملف .csv / .txt</span>
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            if (content) handleParseImport(content);
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  rows={5}
                  value={importRawText}
                  onChange={(e) => handleParseImport(e.target.value)}
                  placeholder="الصق بيانات جدول الإكسل المنسوخة هنا مباشرة..."
                  className="w-full font-mono text-xs rounded-xl border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Preview Table */}
              {importParsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                      معاينة البيانات قبل التطبيق ({importParsedRows.length} صنف تم التعرف عليه):
                    </h4>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold">
                        تحديث قائم: {importParsedRows.filter(r => r.status === 'update').length}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                        أصناف جديدة: {importParsedRows.filter(r => r.status === 'new').length}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                        <tr>
                          <th className="p-2">الباركود</th>
                          <th className="p-2">اسم الصنف</th>
                          <th className="p-2 text-center">التكلفة</th>
                          <th className="p-2 text-center">سعر البيع</th>
                          <th className="p-2 text-center">الجملة</th>
                          <th className="p-2 text-center">الكمية</th>
                          <th className="p-2 text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {importParsedRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-2 font-mono">{r.barcode}</td>
                            <td className="p-2 font-bold">{r.nameAr}</td>
                            <td className="p-2 text-center font-mono">{r.costPrice}</td>
                            <td className="p-2 text-center font-mono font-bold text-sky-600">{r.salePrice}</td>
                            <td className="p-2 text-center font-mono text-emerald-600">{r.wholesalePrice || '-'}</td>
                            <td className="p-2 text-center font-mono">{r.stock || '-'}</td>
                            <td className="p-2 text-center">
                              {r.status === 'update' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-bold">
                                  تحديث أسعار ومخزون
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                                  + إضافة صنف جديد
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={importParsedRows.length === 0}
                onClick={handleApplyImport}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>تطبيق الاستيراد والتحديث ({importParsedRows.length} صنف)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHORTAGE & REORDER PRINT MODAL (الميزة 3 - كشف النواقص لمستودعات الأدوية) */}
      {isPrintingShortageList && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-6 h-6 text-rose-600" />
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    كشف طلبية النواقص وحد إعادة الطلب (أمر شراء مقترح)
                  </h3>
                  <p className="text-xs text-slate-500">
                    تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')} - {settings.pharmacyName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintingShortageList(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5">الباركود</th>
                    <th className="p-2.5 text-center">الرصيد الحالي</th>
                    <th className="p-2.5 text-center">حد الطلب</th>
                    <th className="p-2.5 text-center">الكمية المقترح طلبها</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products
                    .filter(p => p.stock <= (p.minStock ?? 5))
                    .map((p, idx) => {
                      const suggestedOrder = Math.max(10, ((p.minStock ?? 5) * 3) - p.stock);
                      return (
                        <tr key={p.id || idx}>
                          <td className="p-2.5 font-extrabold text-slate-900 dark:text-white">{p.nameAr}</td>
                          <td className="p-2.5 font-mono text-slate-500">{p.barcode}</td>
                          <td className="p-2.5 text-center font-bold text-rose-600">{p.stock}</td>
                          <td className="p-2.5 text-center text-slate-500">{p.minStock ?? 5}</td>
                          <td className="p-2.5 text-center font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">
                            {suggestedOrder} {p.units[0]?.name || 'عبوة'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3 border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPrintingShortageList(false)}
                className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-sky-700"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الكشف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
