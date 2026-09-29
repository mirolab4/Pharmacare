import { 
  Settings, 
  Ingredient, 
  Category, 
  Manufacturer, 
  Product, 
  Bank, 
  BankSubAccount,
  Customer, 
  Supplier, 
  Invoice, 
  Purchase,
  Voucher, 
  StockMovement 
} from '../types/pharmacy';
import { recalculateUnitHierarchyPrices } from '../utils/unitsHelper';
import { firebaseSync } from './firebaseSync';

const STORAGE_KEYS = {
  SETTINGS: 'pharmacare_settings',
  INGREDIENTS: 'pharmacare_ingredients',
  CATEGORIES: 'pharmacare_categories',
  MANUFACTURERS: 'pharmacare_manufacturers',
  PRODUCTS: 'pharmacare_products',
  BANKS: 'pharmacare_banks',
  BANK_SUB_ACCOUNTS: 'pharmacare_bank_sub_accounts',
  CUSTOMERS: 'pharmacare_customers',
  SUPPLIERS: 'pharmacare_suppliers',
  INVOICES: 'pharmacare_invoices',
  PURCHASES: 'pharmacare_purchases',
  VOUCHERS: 'pharmacare_vouchers',
  STOCK_MOVEMENTS: 'pharmacare_stock_movements',
  INITIALIZED: 'pharmacare_seeded_v2',
};

// إعدادات النظام الافتراضية
const DEFAULT_SETTINGS: Settings = {
  pharmacyName: 'صيدلية الأمل المركزية',
  phone: '059-9123456 / 02-2987654',
  address: 'فلسطين - رام الله - شارع الإرسال، مجمع القدس الطبي',
  taxNumber: '900456789',
  currency: '₪',
  defaultTaxRate: 0,
  editMode: 'price',
  manualTotalBehavior: 'price',
  hideCostAndProfit: false,
  enableScannerSound: true,
  soundEnabled: true,
  darkMode: false,
  receiptFooterMessage: 'طهور إن شاء الله.. مع تمنياتنا لكم بموفور الصحة والشفاء العاجل',
  receiptFooter: 'طهور إن شاء الله.. مع تمنياتنا لكم بموفور الصحة والشفاء العاجل',
  thermalPaperWidth: '58mm',
};

// بيانات أولية للمواد الفعالة
const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: 'ing-1', nameAr: 'باراسيتامول', nameEn: 'Paracetamol', description: 'مسكن للآلام وخافض للحرارة', createdAt: new Date().toISOString() },
  { id: 'ing-2', nameAr: 'إيبوبروفين', nameEn: 'Ibuprofen', description: 'مضاد التهاب غير ستيرويدي ومسكن', createdAt: new Date().toISOString() },
  { id: 'ing-3', nameAr: 'أموكسيسيلين', nameEn: 'Amoxicillin', description: 'مضاد حيوي واسع الطيف (بنسلين)', createdAt: new Date().toISOString() },
  { id: 'ing-4', nameAr: 'حمض الكلافولانيك', nameEn: 'Clavulanic Acid', description: 'مثبط لإنزيم البيتا لاكتاماز مع المضادات', createdAt: new Date().toISOString() },
  { id: 'ing-5', nameAr: 'سيتريزين', nameEn: 'Cetirizine', description: 'مضاد للحساسية والهيستامين الجيل الثاني', createdAt: new Date().toISOString() },
  { id: 'ing-6', nameAr: 'أوميبرازول', nameEn: 'Omeprazole', description: 'مثبط لمضخة البروتون لعلاج حموضة وقرحة المعدة', createdAt: new Date().toISOString() },
  { id: 'ing-7', nameAr: 'ديكلوفيناك الصوديوم', nameEn: 'Diclofenac Sodium', description: 'مسكن ومضاد قوي للالتهابات والمفاصل', createdAt: new Date().toISOString() },
  { id: 'ing-8', nameAr: 'ميتفورمين', nameEn: 'Metformin', description: 'خافض لسكر الدم للنوع الثاني', createdAt: new Date().toISOString() },
];

// بيانات التصنيفات
const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'مسكنات وخافضات حرارة', type: 'medicine', description: 'أدوية علاج الصداع والحرارة والألم' },
  { id: 'cat-2', name: 'مضادات حيوية', type: 'medicine', description: 'أدوية مكافحة العدوى البكتيرية' },
  { id: 'cat-3', name: 'حساسية وجهاز تنفسي', type: 'medicine', description: 'أدوية الحساسية، السعال، والرشح' },
  { id: 'cat-4', name: 'جهاز هضمي ومعدة', type: 'medicine', description: 'علاجات الحموضة والمغص والهضم' },
  { id: 'cat-5', name: 'فيتامينات ومكملات غذائية', type: 'both', description: 'مقويات، حديد، كالسيوم ومكملات' },
  { id: 'cat-6', name: 'عناية بالبشرة ومستحضرات تجميل', type: 'commercial', description: 'كريمات، غسولات، واقيات شمس' },
  { id: 'cat-7', name: 'مستلزمات وأجهزة طبية', type: 'commercial', description: 'أجهزة قياس السكر والضغط والضمادات' },
];

// المصانع والدول
const INITIAL_MANUFACTURERS: Manufacturer[] = [
  { id: 'man-1', name: 'دار الشفاء للأدوية', country: 'فلسطين' },
  { id: 'man-2', name: 'شركة بيرزيت للأدوية', country: 'فلسطين' },
  { id: 'man-3', name: 'شركة بيت جالا لصناعة الأدوية', country: 'فلسطين' },
  { id: 'man-4', name: 'القدس للمستحضرات الطبية', country: 'فلسطين' },
  { id: 'man-5', name: 'GSK - جلاكسو سميث كلاين', country: 'بريطانيا' },
  { id: 'man-6', name: 'Hikma - أدوية الحكمة', country: 'الأردن' },
  { id: 'man-7', name: 'Novartis - نوفارتس', country: 'سويسرا' },
  { id: 'man-8', name: 'Pfizer - فايزر', country: 'الولايات المتحدة' },
];

// الأصناف الأولية مع شجرة وحدات ذكية متكاملة
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    nameAr: 'أكامول 500 ملغم أقراص',
    nameEn: 'Acamol 500mg Tablets',
    barcode: '729000000101',
    type: 'medicine',
    categoryId: 'cat-1',
    ingredientIds: ['ing-1'], // باراسيتامول
    manufacturerId: 'man-1', // دار الشفاء
    stock: 300, // 300 حبة
    notes: 'يُحفظ بدرجة حرارة أقل من 25 مئوية',
    units: [
      { id: 'u-1', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-2', salePrice: 0.5, costPrice: 0.2, isBaseUnit: true },
      { id: 'u-2', name: 'شريط', factor: 10, containsQty: 10, parentUnitId: 'u-3', salePrice: 4.5, costPrice: 1.8 },
      { id: 'u-3', name: 'علبة (30 حبة)', factor: 30, containsQty: 3, salePrice: 12.0, costPrice: 5.4 },
    ],
    lastCostPrice: 5.4,
    lastSalePrice: 12.0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    nameAr: 'بنادول أزرق 500 ملغم',
    nameEn: 'Panadol Blue 500mg',
    barcode: '5000347060124',
    type: 'medicine',
    categoryId: 'cat-1',
    ingredientIds: ['ing-1'], // باراسيتامول (بديل لأكامول)
    manufacturerId: 'man-5', // GSK
    stock: 240, // 240 حبة
    notes: 'لطيف على المعدة، يحتوي باراسيتامول نقي',
    units: [
      { id: 'u-4', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-5', salePrice: 0.6, costPrice: 0.3, isBaseUnit: true },
      { id: 'u-5', name: 'شريط', factor: 12, containsQty: 12, parentUnitId: 'u-6', salePrice: 7.0, costPrice: 3.5 },
      { id: 'u-6', name: 'علبة (24 حبة)', factor: 24, containsQty: 2, salePrice: 13.5, costPrice: 7.0 },
    ],
    lastCostPrice: 7.0,
    lastSalePrice: 13.5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    nameAr: 'أوجمنتين 1 غرام أقراص',
    nameEn: 'Augmentin 1g Tablets',
    barcode: '5000347012345',
    type: 'medicine',
    categoryId: 'cat-2',
    ingredientIds: ['ing-3', 'ing-4'], // أموكسيسيلين + كلافولانيك
    manufacturerId: 'man-5', // GSK
    stock: 140, // 140 حبة = 10 علب (14 حبة)
    units: [
      { id: 'u-7', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-8', salePrice: 3.0, costPrice: 1.8, isBaseUnit: true },
      { id: 'u-8', name: 'شريط (7 حبات)', factor: 7, containsQty: 7, parentUnitId: 'u-9', salePrice: 20.0, costPrice: 12.0 },
      { id: 'u-9', name: 'علبة (14 حبة)', factor: 14, containsQty: 2, salePrice: 38.0, costPrice: 24.0 },
    ],
    lastCostPrice: 24.0,
    lastSalePrice: 38.0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    nameAr: 'كلافوكس 1 غرام أقراص',
    nameEn: 'Clavox 1g Tablets',
    barcode: '6251234567890',
    type: 'medicine',
    categoryId: 'cat-2',
    ingredientIds: ['ing-3', 'ing-4'], // بديل مباشر لأوجمنتين
    manufacturerId: 'man-6', // الحكمة
    stock: 154,
    units: [
      { id: 'u-10', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-11', salePrice: 2.5, costPrice: 1.5, isBaseUnit: true },
      { id: 'u-11', name: 'شريط (7 حبات)', factor: 7, containsQty: 7, parentUnitId: 'u-12', salePrice: 16.5, costPrice: 10.0 },
      { id: 'u-12', name: 'علبة (14 حبة)', factor: 14, containsQty: 2, salePrice: 32.0, costPrice: 20.0 },
    ],
    lastCostPrice: 20.0,
    lastSalePrice: 32.0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-5',
    nameAr: 'أدفيل 200 ملغم كبسولات جيلاتينية',
    nameEn: 'Advil 200mg Liquid-Gels',
    barcode: '305730160205',
    type: 'medicine',
    categoryId: 'cat-1',
    ingredientIds: ['ing-2'], // إيبوبروفين
    manufacturerId: 'man-8', // فايزر
    stock: 120,
    units: [
      { id: 'u-13', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-14', salePrice: 1.2, costPrice: 0.7, isBaseUnit: true },
      { id: 'u-14', name: 'شريط (10 حبات)', factor: 10, containsQty: 10, parentUnitId: 'u-15', salePrice: 11.0, costPrice: 6.5 },
      { id: 'u-15', name: 'علبة (20 حبة)', factor: 20, containsQty: 2, salePrice: 21.0, costPrice: 13.0 },
    ],
    lastCostPrice: 13.0,
    lastSalePrice: 21.0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-6',
    nameAr: 'فولتارين إيمولجل 50 غرام',
    nameEn: 'Voltaren Emulgel 50g',
    barcode: '761160000088',
    type: 'medicine',
    categoryId: 'cat-1',
    ingredientIds: ['ing-7'],
    manufacturerId: 'man-7', // نوفارتس
    stock: 45,
    notes: 'مرهم موضعي مسكن للآلام - وحدة واحدة',
    units: [
      { id: 'u-16', name: 'أنبوب', factor: 1, salePrice: 26.0, costPrice: 18.0, isBaseUnit: true },
    ],
    lastCostPrice: 18.0,
    lastSalePrice: 26.0,
    createdAt: new Date().toISOString(),
  },
];

// البنوك والمحافظ الإلكترونية
const INITIAL_BANKS: Bank[] = [
  { 
    id: 'bank-1', 
    type: 'bank', 
    name: 'بنك فلسطين', 
    accountName: 'صيدلية الأمل المركزية', 
    accountNumber: '1234567-001', 
    ibanOrEmail: 'PS44PALS00000000000001234567', 
    balance: 10000.0,
    subAccounts: [
      { id: 'sub-1', bankId: 'bank-1', name: 'فرع رام الله - الحساب الجاري', accountNumber: '1234567-001-A', balance: 7500.0 },
      { id: 'sub-2', bankId: 'bank-1', name: 'فرع رام الله - حساب الشيكات', accountNumber: '1234567-001-B', balance: 2500.0 },
    ],
    totalBalance: 10000.0,
    notes: 'الحساب الرئيسي للعمليات والتوريدات' 
  },
  { 
    id: 'bank-2', 
    type: 'wallet', 
    name: 'محفظة بال بي PalPay', 
    accountName: 'صيدلية الأمل', 
    accountNumber: '0599123456', 
    ibanOrEmail: 'palpay@alamal.ps', 
    balance: 3200.0,
    subAccounts: [
      { id: 'sub-3', bankId: 'bank-2', name: 'نقطة بيع الكاشير الرئيسية', accountNumber: '0599123456-POS', balance: 3200.0 },
    ],
    totalBalance: 3200.0,
    notes: 'دفع فوري عبر رمز QR' 
  },
  { 
    id: 'bank-3', 
    type: 'wallet', 
    name: 'محفظة جوال باي (Jawwal Pay)', 
    accountName: 'الأمل للمستحضرات', 
    accountNumber: '0599654321', 
    ibanOrEmail: 'jawwalpay:0599654321', 
    balance: 1850.0,
    subAccounts: [],
    totalBalance: 1850.0,
    notes: 'محفظة إلكترونية فورية' 
  },
];

// العملاء
const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'cust-1', name: 'أحمد خليل النجار', phone: '059-9234567', address: 'رام الله - عين مصباح', balance: 85.0, creditLimit: 250.0, maxDebtDays: 30, notes: 'عميل منتظم - رصيد آجل سابق', createdAt: new Date().toISOString() },
  { id: 'cust-2', name: 'د. مريم عبد الله', phone: '056-8123890', address: 'البيرة - حي الجنان', balance: 0.0, creditLimit: 500.0, maxDebtDays: 45, notes: 'طبيبة أطفال', createdAt: new Date().toISOString() },
  { id: 'cust-3', name: 'خالد سليم مصطفى', phone: '059-8765432', address: 'رام الله - الماصيون', balance: 40.0, creditLimit: 150.0, maxDebtDays: 20, notes: 'أدوية ضغط شهرية', createdAt: new Date().toISOString() },
];

// الموردون
const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'مستودع أدوية دار الشفاء المركزي', phone: '02-2980011', address: 'بيتونيا - المنطقة الصناعية', company: 'دار الشفاء', balance: 2400.0, notes: 'توريد أسبوعي كل يوم ثلاثاء', createdAt: new Date().toISOString() },
  { id: 'sup-2', name: 'شركة بيرزيت للتوزيع والخدمات', phone: '02-2965544', address: 'رام الله - شارع يافا', company: 'بيرزيت', balance: 1150.0, notes: 'موزع أدوية بيرزيت ومستلزمات', createdAt: new Date().toISOString() },
];

class PharmacyStorageService {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // استرجاع وحفظ عام في localStorage
  private getItem<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return fallback;
      return JSON.parse(data) as T;
    } catch (e) {
      console.error(`خطأ في قراءة ${key}:`, e);
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`خطأ في حفظ ${key}:`, e);
    }
  }

  // تهيئة البيانات الأولية
  initializeDefaultData(): void {
    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      this.setItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      this.setItem(STORAGE_KEYS.INGREDIENTS, INITIAL_INGREDIENTS);
      this.setItem(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
      this.setItem(STORAGE_KEYS.MANUFACTURERS, INITIAL_MANUFACTURERS);
      this.setItem(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
      this.setItem(STORAGE_KEYS.BANKS, INITIAL_BANKS);
      this.setItem(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
      this.setItem(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
      this.setItem(STORAGE_KEYS.INVOICES, []);
      this.setItem(STORAGE_KEYS.PURCHASES, []);
      this.setItem(STORAGE_KEYS.VOUCHERS, []);
      this.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, []);
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  }

  // الإعدادات
  getSettings(): Settings {
    return this.getItem<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  saveSettings(settings: Settings): void {
    this.setItem(STORAGE_KEYS.SETTINGS, settings);
    firebaseSync.saveDoc('settings', 'current', settings);
  }

  // المواد الفعالة
  getIngredients(): Ingredient[] {
    return this.getItem<Ingredient[]>(STORAGE_KEYS.INGREDIENTS, []);
  }

  saveIngredient(ingredient: Ingredient): void {
    const list = this.getIngredients();
    const index = list.findIndex(i => i.id === ingredient.id);
    if (index >= 0) list[index] = ingredient;
    else list.push(ingredient);
    this.setItem(STORAGE_KEYS.INGREDIENTS, list);
    firebaseSync.saveDoc('ingredients', ingredient.id, ingredient);
  }

  deleteIngredient(id: string): void {
    const list = this.getIngredients().filter(i => i.id !== id);
    this.setItem(STORAGE_KEYS.INGREDIENTS, list);
    firebaseSync.deleteDoc('ingredients', id);
  }

  // التصنيفات
  getCategories(): Category[] {
    return this.getItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
  }

  saveCategory(category: Category): void {
    const list = this.getCategories();
    const index = list.findIndex(c => c.id === category.id);
    if (index >= 0) list[index] = category;
    else list.push(category);
    this.setItem(STORAGE_KEYS.CATEGORIES, list);
    firebaseSync.saveDoc('categories', category.id, category);
  }

  deleteCategory(id: string): void {
    const list = this.getCategories().filter(c => c.id !== id);
    this.setItem(STORAGE_KEYS.CATEGORIES, list);
    firebaseSync.deleteDoc('categories', id);
  }

  // المصانع
  getManufacturers(): Manufacturer[] {
    return this.getItem<Manufacturer[]>(STORAGE_KEYS.MANUFACTURERS, []);
  }

  saveManufacturer(manufacturer: Manufacturer): void {
    const list = this.getManufacturers();
    const index = list.findIndex(m => m.id === manufacturer.id);
    if (index >= 0) list[index] = manufacturer;
    else list.push(manufacturer);
    this.setItem(STORAGE_KEYS.MANUFACTURERS, list);
    firebaseSync.saveDoc('manufacturers', manufacturer.id, manufacturer);
  }

  deleteManufacturer(id: string): void {
    const list = this.getManufacturers().filter(m => m.id !== id);
    this.setItem(STORAGE_KEYS.MANUFACTURERS, list);
    firebaseSync.deleteDoc('manufacturers', id);
  }

  // الأصناف مع الشجرة الذكية للوحدات والأسعار
  getProducts(): Product[] {
    return this.getItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
  }

  saveProduct(product: Product): void {
    const list = this.getProducts();
    const index = list.findIndex(p => p.id === product.id);
    
    // Automatically recalculate unit hierarchy prices if needed
    const recalculatedUnits = recalculateUnitHierarchyPrices(
      product.units,
      undefined,
      undefined,
      undefined,
      product.lastSalePrice
    );

    const updatedProduct = {
      ...product,
      units: recalculatedUnits,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      list[index] = updatedProduct;
    } else {
      list.unshift(updatedProduct);
    }
    this.setItem(STORAGE_KEYS.PRODUCTS, list);
    
    firebaseSync.saveDoc('products', updatedProduct.id, updatedProduct);
  }

  deleteProduct(id: string): void {
    const list = this.getProducts().filter(p => p.id !== id);
    this.setItem(STORAGE_KEYS.PRODUCTS, list);
    firebaseSync.deleteDoc('products', id);
  }

  // البنوك والمحافظ والحسابات الفرعية
  getBanks(): Bank[] {
    const banks = this.getItem<Bank[]>(STORAGE_KEYS.BANKS, []);
    // Recalculate total balance for each bank
    return banks.map(b => {
      const subs = b.subAccounts || [];
      const subsSum = subs.reduce((sum, s) => sum + (s.balance || 0), 0);
      return {
        ...b,
        totalBalance: (b.balance || 0) + subsSum,
      };
    });
  }

  saveBank(bank: Bank): void {
    const list = this.getBanks();
    const index = list.findIndex(b => b.id === bank.id);
    if (index >= 0) list[index] = bank;
    else list.push(bank);
    this.setItem(STORAGE_KEYS.BANKS, list);
    firebaseSync.saveDoc('banks', bank.id, bank);
  }

  deleteBank(id: string): void {
    const list = this.getBanks().filter(b => b.id !== id);
    this.setItem(STORAGE_KEYS.BANKS, list);
    firebaseSync.deleteDoc('banks', id);
  }

  // إضافة أو تعديل حساب فرعي لبنك محدد
  saveBankSubAccount(sub: BankSubAccount): void {
    const banks = this.getBanks();
    const bank = banks.find(b => b.id === sub.bankId);
    if (!bank) return;

    if (!bank.subAccounts) bank.subAccounts = [];
    const subIdx = bank.subAccounts.findIndex(s => s.id === sub.id);
    if (subIdx >= 0) bank.subAccounts[subIdx] = sub;
    else bank.subAccounts.push(sub);

    this.saveBank(bank);
  }

  deleteBankSubAccount(bankId: string, subId: string): void {
    const banks = this.getBanks();
    const bank = banks.find(b => b.id === bankId);
    if (!bank || !bank.subAccounts) return;

    bank.subAccounts = bank.subAccounts.filter(s => s.id !== subId);
    this.saveBank(bank);
  }

  // العملاء
  getCustomers(): Customer[] {
    return this.getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
  }

  saveCustomer(customer: Customer): void {
    const list = this.getCustomers();
    const index = list.findIndex(c => c.id === customer.id);
    if (index >= 0) list[index] = customer;
    else list.push(customer);
    this.setItem(STORAGE_KEYS.CUSTOMERS, list);
    firebaseSync.saveDoc('customers', customer.id, customer);
  }

  deleteCustomer(id: string): void {
    const list = this.getCustomers().filter(c => c.id !== id);
    this.setItem(STORAGE_KEYS.CUSTOMERS, list);
    firebaseSync.deleteDoc('customers', id);
  }

  // الموردون
  getSuppliers(): Supplier[] {
    return this.getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  }

  saveSupplier(supplier: Supplier): void {
    const list = this.getSuppliers();
    const index = list.findIndex(s => s.id === supplier.id);
    if (index >= 0) list[index] = supplier;
    else list.push(supplier);
    this.setItem(STORAGE_KEYS.SUPPLIERS, list);
    firebaseSync.saveDoc('suppliers', supplier.id, supplier);
  }

  deleteSupplier(id: string): void {
    const list = this.getSuppliers().filter(s => s.id !== id);
    this.setItem(STORAGE_KEYS.SUPPLIERS, list);
    firebaseSync.deleteDoc('suppliers', id);
  }

  // حركات المخزون
  getStockMovements(): StockMovement[] {
    return this.getItem<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
  }

  // الفواتير (مبيعات ومرتجع مبيعات الكاشير)
  getInvoices(): Invoice[] {
    return this.getItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
  }

  // إنشاء فاتورة بيع أو مرتجع بيع
  createInvoice(invoice: Invoice): void {
    const products = this.getProducts();
    const movements = this.getStockMovements();
    const isReturn = invoice.type === 'sale_return';
    const now = new Date().toISOString();

    // 1. تحديث المخزون (خصم في البيع، زيادة في المرتجع)
    invoice.items.forEach(item => {
      const prodIndex = products.findIndex(p => p.id === item.productId);
      if (prodIndex >= 0) {
        const factorUnits = item.quantity * item.unitFactor;
        const delta = isReturn ? factorUnits : -factorUnits;
        products[prodIndex].stock += delta;

        // تسجيل حركة مخزون
        movements.unshift({
          id: 'sm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          productId: item.productId,
          productName: item.productName,
          date: now,
          type: isReturn ? 'return' : 'sale',
          quantity: delta,
          referenceId: invoice.invoiceNumber,
          notes: `${isReturn ? 'مرتجع مبيعات' : 'بيع'} ${item.quantity} ${item.unitName} بالفاتورة ${invoice.invoiceNumber}`,
          balanceAfter: products[prodIndex].stock,
        });
      }
    });

    // 2. تحديث رصيد العميل الآجل
    if (invoice.customerId) {
      const customers = this.getCustomers();
      const custIndex = customers.findIndex(c => c.id === invoice.customerId);
      if (custIndex >= 0) {
        if (isReturn) {
          // المرتجع يقلل مديونية العميل
          customers[custIndex].balance = Math.max(0, (customers[custIndex].balance || 0) - invoice.totalAmount);
        } else if (invoice.remainingAmount > 0) {
          customers[custIndex].balance = (customers[custIndex].balance || 0) + invoice.remainingAmount;
        }
        this.setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    // 3. تحديث رصيد البنك إذا كان الدفع بنكياً
    if (invoice.paymentMethod === 'bank' && invoice.paidAmount > 0 && invoice.bankId) {
      const banks = this.getBanks();
      const bIndex = banks.findIndex(b => b.id === invoice.bankId);
      if (bIndex >= 0) {
        const delta = isReturn ? -invoice.paidAmount : invoice.paidAmount;
        if (invoice.bankSubAccountId && banks[bIndex].subAccounts) {
          const sIdx = banks[bIndex].subAccounts!.findIndex(s => s.id === invoice.bankSubAccountId);
          if (sIdx >= 0) banks[bIndex].subAccounts![sIdx].balance += delta;
        } else {
          banks[bIndex].balance = (banks[bIndex].balance || 0) + delta;
        }
        this.setItem(STORAGE_KEYS.BANKS, banks);
      }
    }

    // 4. حفظ الفاتورة محلياً
    const invoices = this.getInvoices();
    invoices.unshift(invoice);

    this.setItem(STORAGE_KEYS.PRODUCTS, products);
    this.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    this.setItem(STORAGE_KEYS.INVOICES, invoices);

    // مزامنة فورية مباشرة مع Firestore لكافة الأطراف المتأثرة
    firebaseSync.saveDoc('invoices', invoice.id, invoice);
    invoice.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) firebaseSync.saveDoc('products', p.id, p);
    });
    if (invoice.customerId) {
      const cust = this.getCustomers().find(c => c.id === invoice.customerId);
      if (cust) firebaseSync.saveDoc('customers', cust.id, cust);
    }
    if (invoice.bankId) {
      const bnk = this.getBanks().find(b => b.id === invoice.bankId);
      if (bnk) firebaseSync.saveDoc('banks', bnk.id, bnk);
    }
    movements.slice(0, invoice.items.length).forEach(m => {
      firebaseSync.saveDoc('stockMovements', m.id, m);
    });
  }

  // إلغاء فاتورة
  cancelInvoice(invoiceId: string): boolean {
    const invoices = this.getInvoices();
    const invIndex = invoices.findIndex(i => i.id === invoiceId);
    if (invIndex === -1) return false;

    const invoice = invoices[invIndex];
    if (invoice.status === 'cancelled') return false;

    const products = this.getProducts();
    const movements = this.getStockMovements();
    const isReturn = invoice.type === 'sale_return';
    const now = new Date().toISOString();

    // عكس المخزون
    invoice.items.forEach(item => {
      const prodIndex = products.findIndex(p => p.id === item.productId);
      if (prodIndex >= 0) {
        const factorUnits = item.quantity * item.unitFactor;
        const delta = isReturn ? -factorUnits : factorUnits;
        products[prodIndex].stock += delta;

        movements.unshift({
          id: 'sm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          productId: item.productId,
          productName: item.productName,
          date: now,
          type: 'cancellation',
          quantity: delta,
          referenceId: invoice.invoiceNumber,
          notes: `إلغاء الفاتورة ${invoice.invoiceNumber}`,
          balanceAfter: products[prodIndex].stock,
        });
      }
    });

    // عكس رصيد العميل
    if (invoice.customerId && invoice.remainingAmount > 0) {
      const customers = this.getCustomers();
      const custIndex = customers.findIndex(c => c.id === invoice.customerId);
      if (custIndex >= 0) {
        customers[custIndex].balance = Math.max(0, (customers[custIndex].balance || 0) - invoice.remainingAmount);
        this.setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    // عكس البنك
    if (invoice.paymentMethod === 'bank' && invoice.paidAmount > 0 && invoice.bankId) {
      const banks = this.getBanks();
      const bIndex = banks.findIndex(b => b.id === invoice.bankId);
      if (bIndex >= 0) {
        const delta = isReturn ? invoice.paidAmount : -invoice.paidAmount;
        banks[bIndex].balance = (banks[bIndex].balance || 0) + delta;
        this.setItem(STORAGE_KEYS.BANKS, banks);
      }
    }

    invoice.status = 'cancelled';
    invoices[invIndex] = invoice;

    this.setItem(STORAGE_KEYS.PRODUCTS, products);
    this.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    this.setItem(STORAGE_KEYS.INVOICES, invoices);

    // مزامنة فورية مباشرة مع Firestore
    firebaseSync.saveDoc('invoices', invoice.id, invoice);
    invoice.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) firebaseSync.saveDoc('products', p.id, p);
    });
    if (invoice.customerId) {
      const cust = this.getCustomers().find(c => c.id === invoice.customerId);
      if (cust) firebaseSync.saveDoc('customers', cust.id, cust);
    }
    if (invoice.bankId) {
      const bnk = this.getBanks().find(b => b.id === invoice.bankId);
      if (bnk) firebaseSync.saveDoc('banks', bnk.id, bnk);
    }

    return true;
  }

  // --- المشتريات ومردودات المشتريات (Purchases & Purchase Returns) ---
  getPurchases(): Purchase[] {
    return this.getItem<Purchase[]>(STORAGE_KEYS.PURCHASES, []);
  }

  createPurchase(purchase: Purchase): void {
    const products = this.getProducts();
    const movements = this.getStockMovements();
    const isReturn = purchase.type === 'purchase_return';
    const now = new Date().toISOString();

    // 1. زيادة المخزون في المشتريات، وإنقاصه في مرتجع المشتريات
    purchase.items.forEach(item => {
      const prodIndex = products.findIndex(p => p.id === item.productId);
      if (prodIndex >= 0) {
        const factorUnits = item.quantity * item.unitFactor;
        const delta = isReturn ? -factorUnits : factorUnits;
        products[prodIndex].stock = Math.max(0, products[prodIndex].stock + delta);

        // تحديث سعر التكلفة وسعر البيع وسلسلة الوحدات
        if (!isReturn && item.costPrice > 0) {
          products[prodIndex].lastCostPrice = item.costPrice;
          if (item.salePrice > 0) products[prodIndex].lastSalePrice = item.salePrice;

          // تحديث شجرة أسعار وحدات الصنف آلياً
          products[prodIndex].units = recalculateUnitHierarchyPrices(
            products[prodIndex].units,
            item.unitId,
            item.salePrice,
            item.costPrice,
            item.salePrice
          );
        }

        // تسجيل حركة مخزون
        movements.unshift({
          id: 'sm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          productId: item.productId,
          productName: item.productName,
          date: now,
          type: isReturn ? 'return' : 'purchase',
          quantity: delta,
          referenceId: purchase.purchaseNumber,
          notes: `${isReturn ? 'مرتجع مشتريات إلى' : 'شراء من'} ${purchase.partyName} (${item.quantity} ${item.unitName})`,
          balanceAfter: products[prodIndex].stock,
        });
      }
    });

    // 2. تحديث رصيد المورد أو العميل
    if (purchase.partyType === 'supplier' && purchase.partyId) {
      const suppliers = this.getSuppliers();
      const sIdx = suppliers.findIndex(s => s.id === purchase.partyId);
      if (sIdx >= 0) {
        if (isReturn) {
          // إرجاع للمورد يقلل مستحقاته
          suppliers[sIdx].balance = Math.max(0, (suppliers[sIdx].balance || 0) - purchase.totalAmount);
        } else if (purchase.remainingAmount > 0) {
          // شراء آجل يزيد المستحق للمورد
          suppliers[sIdx].balance = (suppliers[sIdx].balance || 0) + purchase.remainingAmount;
        }
        this.setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
      }
    } else if (purchase.partyType === 'customer' && purchase.partyId) {
      const customers = this.getCustomers();
      const cIdx = customers.findIndex(c => c.id === purchase.partyId);
      if (cIdx >= 0) {
        if (isReturn) {
          customers[cIdx].balance = (customers[cIdx].balance || 0) + purchase.totalAmount;
        } else if (purchase.remainingAmount > 0) {
          customers[cIdx].balance = Math.max(0, (customers[cIdx].balance || 0) - purchase.remainingAmount);
        }
        this.setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    // 3. تحديث رصيد البنك
    if (purchase.paymentMethod === 'bank' && purchase.paidAmount > 0 && purchase.bankId) {
      const banks = this.getBanks();
      const bIdx = banks.findIndex(b => b.id === purchase.bankId);
      if (bIdx >= 0) {
        const delta = isReturn ? purchase.paidAmount : -purchase.paidAmount;
        if (purchase.bankSubAccountId && banks[bIdx].subAccounts) {
          const sIdx = banks[bIdx].subAccounts!.findIndex(s => s.id === purchase.bankSubAccountId);
          if (sIdx >= 0) banks[bIdx].subAccounts![sIdx].balance += delta;
        } else {
          banks[bIdx].balance = (banks[bIdx].balance || 0) + delta;
        }
        this.setItem(STORAGE_KEYS.BANKS, banks);
      }
    }

    // 4. حفظ فاتورة الشراء
    const purchases = this.getPurchases();
    purchases.unshift(purchase);

    this.setItem(STORAGE_KEYS.PRODUCTS, products);
    this.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    this.setItem(STORAGE_KEYS.PURCHASES, purchases);

    // مزامنة فورية مباشرة مع Firestore
    firebaseSync.saveDoc('purchases', purchase.id, purchase);
    purchase.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) firebaseSync.saveDoc('products', p.id, p);
    });
    if (purchase.partyType === 'supplier' && purchase.partyId) {
      const s = this.getSuppliers().find(sup => sup.id === purchase.partyId);
      if (s) firebaseSync.saveDoc('suppliers', s.id, s);
    } else if (purchase.partyType === 'customer' && purchase.partyId) {
      const c = this.getCustomers().find(cust => cust.id === purchase.partyId);
      if (c) firebaseSync.saveDoc('customers', c.id, c);
    }
    if (purchase.bankId) {
      const bnk = this.getBanks().find(b => b.id === purchase.bankId);
      if (bnk) firebaseSync.saveDoc('banks', bnk.id, bnk);
    }
    movements.slice(0, purchase.items.length).forEach(m => {
      firebaseSync.saveDoc('stockMovements', m.id, m);
    });
  }

  deletePurchase(purchaseId: string): void {
    const list = this.getPurchases().filter(p => p.id !== purchaseId);
    this.setItem(STORAGE_KEYS.PURCHASES, list);
    firebaseSync.deleteDoc('purchases', purchaseId);
  }

  cancelPurchase(purchaseId: string): boolean {
    const purchases = this.getPurchases();
    const pIdx = purchases.findIndex(p => p.id === purchaseId);
    if (pIdx === -1) return false;

    const purchase = purchases[pIdx];
    if (purchase.status === 'cancelled') return false;

    const products = this.getProducts();
    const movements = this.getStockMovements();
    const isReturn = purchase.type === 'purchase_return';
    const now = new Date().toISOString();

    // عكس المخزون
    purchase.items.forEach(item => {
      const prodIndex = products.findIndex(p => p.id === item.productId);
      if (prodIndex >= 0) {
        const factorUnits = item.quantity * item.unitFactor;
        const delta = isReturn ? factorUnits : -factorUnits;
        products[prodIndex].stock = Math.max(0, products[prodIndex].stock + delta);

        movements.unshift({
          id: 'sm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          productId: item.productId,
          productName: item.productName,
          date: now,
          type: 'cancellation',
          quantity: delta,
          referenceId: purchase.purchaseNumber,
          notes: `إلغاء حركة الشراء ${purchase.purchaseNumber}`,
          balanceAfter: products[prodIndex].stock,
        });
      }
    });

    // عكس رصيد المورد
    if (purchase.partyType === 'supplier' && purchase.partyId && purchase.remainingAmount > 0) {
      const suppliers = this.getSuppliers();
      const sIdx = suppliers.findIndex(s => s.id === purchase.partyId);
      if (sIdx >= 0) {
        suppliers[sIdx].balance = Math.max(0, suppliers[sIdx].balance - purchase.remainingAmount);
        this.setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
      }
    }

    // عكس رصيد البنك
    if (purchase.paymentMethod === 'bank' && purchase.paidAmount > 0 && purchase.bankId) {
      const banks = this.getBanks();
      const bIdx = banks.findIndex(b => b.id === purchase.bankId);
      if (bIdx >= 0) {
        const delta = isReturn ? -purchase.paidAmount : purchase.paidAmount;
        banks[bIdx].balance = (banks[bIdx].balance || 0) + delta;
        this.setItem(STORAGE_KEYS.BANKS, banks);
      }
    }

    purchase.status = 'cancelled';
    purchases[pIdx] = purchase;

    this.setItem(STORAGE_KEYS.PRODUCTS, products);
    this.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    this.setItem(STORAGE_KEYS.PURCHASES, purchases);

    // مزامنة فورية مباشرة مع Firestore
    firebaseSync.saveDoc('purchases', purchase.id, purchase);
    purchase.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) firebaseSync.saveDoc('products', p.id, p);
    });
    if (purchase.partyType === 'supplier' && purchase.partyId) {
      const s = this.getSuppliers().find(sup => sup.id === purchase.partyId);
      if (s) firebaseSync.saveDoc('suppliers', s.id, s);
    }
    if (purchase.bankId) {
      const bnk = this.getBanks().find(b => b.id === purchase.bankId);
      if (bnk) firebaseSync.saveDoc('banks', bnk.id, bnk);
    }

    return true;
  }

  // أرقام تسلسلية
  getNextInvoiceNumber(type: 'sale' | 'sale_return' = 'sale'): string {
    const prefix = type === 'sale' ? 'INV' : 'RET';
    const invoices = this.getInvoices();
    const nums = invoices
      .filter(i => (i.type === type || (!i.type && type === 'sale')) && i.invoiceNumber.startsWith(prefix))
      .map(i => {
        const match = i.invoiceNumber.match(/\d+/);
        return match ? parseInt(match[0], 10) : 1000;
      });
    const max = Math.max(...nums, 1000);
    return `${prefix}-${max + 1}`;
  }

  getNextPurchaseNumber(type: 'purchase' | 'purchase_return' = 'purchase'): string {
    const prefix = type === 'purchase' ? 'PUR' : 'PRET';
    const purchases = this.getPurchases();
    const nums = purchases
      .filter(p => p.type === type && p.purchaseNumber.startsWith(prefix))
      .map(p => {
        const match = p.purchaseNumber.match(/\d+/);
        return match ? parseInt(match[0], 10) : 1000;
      });
    const max = Math.max(...nums, 1000);
    return `${prefix}-${max + 1}`;
  }

  // السندات المالية
  getVouchers(): Voucher[] {
    return this.getItem<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  }

  createVoucher(voucher: Voucher): void {
    const vouchers = this.getVouchers();
    vouchers.unshift(voucher);

    // تحديث رصيد الطرف
    if (voucher.type === 'receipt' && voucher.partyType === 'customer' && voucher.partyId) {
      const customers = this.getCustomers();
      const idx = customers.findIndex(c => c.id === voucher.partyId);
      if (idx >= 0) {
        customers[idx].balance = Math.max(0, (customers[idx].balance || 0) - voucher.amount);
        this.setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    } else if (voucher.type === 'payment' && voucher.partyType === 'supplier' && voucher.partyId) {
      const suppliers = this.getSuppliers();
      const idx = suppliers.findIndex(s => s.id === voucher.partyId);
      if (idx >= 0) {
        suppliers[idx].balance = Math.max(0, (suppliers[idx].balance || 0) - voucher.amount);
        this.setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
      }
    }

    // تحديث رصيد البنك
    if (voucher.paymentMethod === 'bank' && voucher.bankId) {
      const banks = this.getBanks();
      const bIdx = banks.findIndex(b => b.id === voucher.bankId);
      if (bIdx >= 0) {
        const delta = voucher.type === 'receipt' ? voucher.amount : -voucher.amount;
        banks[bIdx].balance = (banks[bIdx].balance || 0) + delta;
        this.setItem(STORAGE_KEYS.BANKS, banks);
      }
    }

    this.setItem(STORAGE_KEYS.VOUCHERS, vouchers);
    firebaseSync.saveDoc('vouchers', voucher.id, voucher);
    if (voucher.type === 'receipt' && voucher.partyType === 'customer' && voucher.partyId) {
      const cust = this.getCustomers().find(c => c.id === voucher.partyId);
      if (cust) firebaseSync.saveDoc('customers', cust.id, cust);
    } else if (voucher.type === 'payment' && voucher.partyType === 'supplier' && voucher.partyId) {
      const supp = this.getSuppliers().find(s => s.id === voucher.partyId);
      if (supp) firebaseSync.saveDoc('suppliers', supp.id, supp);
    }
    if (voucher.paymentMethod === 'bank' && voucher.bankId) {
      const bnk = this.getBanks().find(b => b.id === voucher.bankId);
      if (bnk) firebaseSync.saveDoc('banks', bnk.id, bnk);
    }
  }

  deleteVoucher(voucherId: string): void {
    const vouchers = this.getVouchers();
    const vIndex = vouchers.findIndex(v => v.id === voucherId);
    if (vIndex === -1) return;

    const voucher = vouchers[vIndex];

    if (voucher.type === 'receipt' && voucher.partyType === 'customer' && voucher.partyId) {
      const customers = this.getCustomers();
      const idx = customers.findIndex(c => c.id === voucher.partyId);
      if (idx >= 0) {
        customers[idx].balance = (customers[idx].balance || 0) + voucher.amount;
        this.setItem(STORAGE_KEYS.CUSTOMERS, customers);
        firebaseSync.saveDoc('customers', customers[idx].id, customers[idx]);
      }
    } else if (voucher.type === 'payment' && voucher.partyType === 'supplier' && voucher.partyId) {
      const suppliers = this.getSuppliers();
      const idx = suppliers.findIndex(s => s.id === voucher.partyId);
      if (idx >= 0) {
        suppliers[idx].balance = (suppliers[idx].balance || 0) + voucher.amount;
        this.setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
        firebaseSync.saveDoc('suppliers', suppliers[idx].id, suppliers[idx]);
      }
    }

    vouchers.splice(vIndex, 1);
    this.setItem(STORAGE_KEYS.VOUCHERS, vouchers);
    firebaseSync.deleteDoc('vouchers', voucherId);
  }

  getNextVoucherNumber(type: 'receipt' | 'payment' | 'journal'): string {
    const prefix = type === 'receipt' ? 'REC' : type === 'payment' ? 'PAY' : 'JRN';
    const vouchers = this.getVouchers();
    const nums = vouchers
      .filter(v => v.voucherNumber.startsWith(prefix))
      .map(v => {
        const match = v.voucherNumber.match(/\d+/);
        return match ? parseInt(match[0], 10) : 100;
      });
    const max = Math.max(...nums, 100);
    return `${prefix}-${max + 1}`;
  }

  // البحث عن بدائل دواء
  findAlternatives(product: Product): Product[] {
    if (!product.ingredientIds || product.ingredientIds.length === 0) return [];
    const allProducts = this.getProducts();
    return allProducts.filter(p => {
      if (p.id === product.id) return false;
      if (!p.ingredientIds || p.ingredientIds.length === 0) return false;
      return product.ingredientIds.some(ingId => p.ingredientIds.includes(ingId));
    });
  }

  // تصدير واستيراد النسخ الاحتياطية
  exportAllDataJSON(): string {
    const backup = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      settings: this.getSettings(),
      ingredients: this.getIngredients(),
      categories: this.getCategories(),
      manufacturers: this.getManufacturers(),
      products: this.getProducts(),
      banks: this.getBanks(),
      customers: this.getCustomers(),
      suppliers: this.getSuppliers(),
      invoices: this.getInvoices(),
      purchases: this.getPurchases(),
      vouchers: this.getVouchers(),
      stockMovements: this.getStockMovements(),
    };
    return JSON.stringify(backup, null, 2);
  }

  importAllDataJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') return false;

      if (data.settings) this.setItem(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.ingredients) this.setItem(STORAGE_KEYS.INGREDIENTS, data.ingredients);
      if (data.categories) this.setItem(STORAGE_KEYS.CATEGORIES, data.categories);
      if (data.manufacturers) this.setItem(STORAGE_KEYS.MANUFACTURERS, data.manufacturers);
      if (data.products) this.setItem(STORAGE_KEYS.PRODUCTS, data.products);
      if (data.banks) this.setItem(STORAGE_KEYS.BANKS, data.banks);
      if (data.customers) this.setItem(STORAGE_KEYS.CUSTOMERS, data.customers);
      if (data.suppliers) this.setItem(STORAGE_KEYS.SUPPLIERS, data.suppliers);
      if (data.invoices) this.setItem(STORAGE_KEYS.INVOICES, data.invoices);
      if (data.purchases) this.setItem(STORAGE_KEYS.PURCHASES, data.purchases);
      if (data.vouchers) this.setItem(STORAGE_KEYS.VOUCHERS, data.vouchers);
      if (data.stockMovements) this.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, data.stockMovements);

      return true;
    } catch (e) {
      console.error('خطأ في استيراد النسخة الاحتياطية:', e);
      return false;
    }
  }

  reactivateInvoice(invoiceId: string): boolean {
    const invoices = this.getInvoices();
    const invIndex = invoices.findIndex(i => i.id === invoiceId);
    if (invIndex === -1) return false;
    invoices[invIndex].status = 'active';
    this.setItem(STORAGE_KEYS.INVOICES, invoices);
    return true;
  }

  deleteInvoice(invoiceId: string): void {
    const list = this.getInvoices().filter(i => i.id !== invoiceId);
    this.setItem(STORAGE_KEYS.INVOICES, list);
    firebaseSync.deleteDoc('invoices', invoiceId);
  }

  saveVoucher(voucher: Voucher): void {
    this.createVoucher(voucher);
  }

  generate5000Items(): void {
    const prods = this.getProducts();
    const categories = this.getCategories();
    const manufacturers = this.getManufacturers();
    const ingredients = this.getIngredients();
    const baseNames = ['باراسيتامول', 'أموكسيسيلين', 'أزيثروميسين', 'أوميبرازول', 'لوراتادين', 'ديكلوفيناك', 'ميتفورمين', 'أتورفاستاتين', 'إيبوبروفين', 'سيتريزين'];
    const forms = ['أقراص', 'كبسولات', 'شراب', 'مرهم', 'حقن', 'قطرة'];
    const doses = ['100 ملغم', '250 ملغم', '500 ملغم', '1000 ملغم', '10 مل'];

    const newItems: Product[] = [];
    const count = 5000;

    for (let i = 1; i <= count; i++) {
      const bName = baseNames[i % baseNames.length];
      const form = forms[i % forms.length];
      const dose = doses[i % doses.length];
      const cat = categories[i % categories.length] || categories[0];
      const mfr = manufacturers[i % manufacturers.length] || manufacturers[0];
      const ing = ingredients[i % ingredients.length] || ingredients[0];

      const price = parseFloat(((i % 50) + 5 + (i * 0.05 % 10)).toFixed(2));
      const cost = parseFloat((price * 0.7).toFixed(2));

      newItems.push({
        id: `prod-bulk-${i}`,
        nameAr: `${bName} ${form} ${dose} (${i})`,
        nameEn: `Med ${i} ${bName}`,
        barcode: `625${String(i).padStart(9, '0')}`,
        type: 'medicine',
        categoryId: cat ? cat.id : 'cat-1',
        manufacturerId: mfr ? mfr.id : 'man-1',
        ingredientIds: ing ? [ing.id] : ['ing-1'],
        stock: 50 + (i % 100),
        units: [
          {
            id: `u-bulk-${i}-1`,
            name: 'علبة',
            factor: 20,
            salePrice: price,
            costPrice: cost,
          },
          {
            id: `u-bulk-${i}-2`,
            name: 'شريط',
            factor: 10,
            salePrice: parseFloat((price / 2).toFixed(2)),
            costPrice: parseFloat((cost / 2).toFixed(2)),
          },
          {
            id: `u-bulk-${i}-3`,
            name: 'حبة',
            factor: 1,
            salePrice: parseFloat((price / 20).toFixed(2)),
            costPrice: parseFloat((cost / 20).toFixed(2)),
          }
        ],
        createdAt: new Date().toISOString(),
      });
    }

    this.setItem(STORAGE_KEYS.PRODUCTS, [...prods, ...newItems]);
  }

  // --- دوال دمج البيانات السحابية مع المخزن المحلي ---
  mergeRemoteProducts(remote: Product[]): void {
    if (!remote) return;
    this.setItem(STORAGE_KEYS.PRODUCTS, remote);
  }

  mergeRemoteInvoices(remote: Invoice[]): void {
    if (!remote) return;
    const sorted = [...remote].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.setItem(STORAGE_KEYS.INVOICES, sorted);
  }

  mergeRemoteCustomers(remote: Customer[]): void {
    if (!remote) return;
    this.setItem(STORAGE_KEYS.CUSTOMERS, remote);
  }

  mergeRemoteSuppliers(remote: Supplier[]): void {
    if (!remote) return;
    this.setItem(STORAGE_KEYS.SUPPLIERS, remote);
  }

  mergeRemotePurchases(remote: Purchase[]): void {
    if (!remote) return;
    const sorted = [...remote].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.setItem(STORAGE_KEYS.PURCHASES, sorted);
  }

  mergeRemoteVouchers(remote: Voucher[]): void {
    if (!remote) return;
    const sorted = [...remote].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.setItem(STORAGE_KEYS.VOUCHERS, sorted);
  }

  mergeRemoteCategories(remote: Category[]): void {
    if (!remote) return;
    this.setItem(STORAGE_KEYS.CATEGORIES, remote);
  }

  mergeRemoteBanks(remote: Bank[]): void {
    if (!remote) return;
    this.setItem(STORAGE_KEYS.BANKS, remote);
  }

  mergeRemoteStockMovements(remote: StockMovement[]): void {
    if (!remote) return;
    const sorted = [...remote].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, sorted.slice(0, 1000));
  }

  mergeRemoteIngredients(remote: Ingredient[]): void {
    if (!remote) return;
    this.setItem(STORAGE_KEYS.INGREDIENTS, remote);
  }

  mergeRemoteManufacturers(remote: Manufacturer[]): void {
    if (!remote) return;
    this.setItem(STORAGE_KEYS.MANUFACTURERS, remote);
  }

  mergeRemoteSettings(remote: Settings): void {
    if (!remote) return;
    const current = this.getSettings();
    const merged: Settings = { ...current, ...remote };
    this.setItem(STORAGE_KEYS.SETTINGS, merged);
  }

  // تصدير ملف إكسل محلي (CSV) للأصناف والمخزون بدون إنترنت
  exportProductsToCSV(): void {
    const products = this.getProducts();
    const categories = this.getCategories();
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    
    let csvContent = '\uFEFF'; // UTF-8 BOM for Arabic support in Excel
    csvContent += 'اسم الصنف العربي,اسم الصنف الإنجليزي,الباركود,النوع,التصنيف,سعر البيع الأساسي,سعر الشراء (التكلفة),الرصيد بالمخزن,تاريخ الإضافة\n';
    
    products.forEach(p => {
      const baseUnit = p.units?.find(u => u.isBaseUnit) || p.units?.[0];
      const salePrice = baseUnit?.salePrice || p.lastSalePrice || 0;
      const costPrice = baseUnit?.costPrice || p.lastCostPrice || 0;
      const catName = p.categoryId ? (catMap.get(p.categoryId) || '') : '';
      
      const row = [
        `"${(p.nameAr || '').replace(/"/g, '""')}"`,
        `"${(p.nameEn || '').replace(/"/g, '""')}"`,
        `"${p.barcode || ''}"`,
        `"${p.type === 'medicine' ? 'دواء' : 'تجاري'}"`,
        `"${catName.replace(/"/g, '""')}"`,
        salePrice,
        costPrice,
        p.stock || 0,
        `"${p.createdAt || ''}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PharmaCare_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportBackupJSON(): string { return this.exportAllDataJSON(); }
  importBackupJSON(jsonString: string): boolean { return this.importAllDataJSON(jsonString); }

  resetToFactoryDefaults(): void {
    localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
    this.initializeDefaultData();
  }
}

export const pharmacyStorage = new PharmacyStorageService();
pharmacyStorage.initializeDefaultData();
