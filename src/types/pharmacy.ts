/**
 * أنماط بيانات نظام إدارة ونقاط بيع الصيدلية (فارماكير بلس)
 */

export interface Settings {
  pharmacyName: string;
  phone: string;
  address: string;
  taxNumber: string;
  currency: string;
  defaultTaxRate: number; // e.g. 16% or 0%
  editMode: 'price' | 'quantity'; // سلوك تعديل الإجمالي اليدوي
  manualTotalBehavior?: 'price' | 'quantity';
  hideCostAndProfit: boolean; // زر 👁️ السحري للخصوصية أمام الزبائن
  enableScannerSound: boolean;
  soundEnabled?: boolean;
  darkMode?: boolean;
  receiptFooterMessage: string;
  receiptFooter?: string;
  thermalPaperWidth?: '58mm' | '80mm';
  googleDriveBackupEnabled?: boolean;
  lastCloudSync?: string;
  customerDisplayEnabled?: boolean;
  themeColor?: 'sky' | 'emerald' | 'indigo' | 'purple' | 'amber' | 'rose' | 'slate';
  printTemplate?: PrintTemplateSettings;
}

export interface PrintTemplateSettings {
  pharmacyName: string;
  subTitle?: string;
  phone: string;
  address: string;
  taxNumber: string;
  logoUrl?: string;
  receiptWidth: '80mm' | '58mm' | 'A4' | 'A5';
  fontSize: 'small' | 'medium' | 'large';
  showBarcode: boolean;
  showQRCode: boolean;
  showTaxDetails: boolean;
  showCashierName: boolean;
  showReturnPolicy: boolean;
  returnPolicyText: string;
  footerMessage: string;
  accentColor: string;
}

export interface Ingredient {
  id: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'medicine' | 'commercial' | 'both';
  description?: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  country: string;
}

export type PriceTier = 'retail' | 'wholesale' | 'special';

export interface ProductUnit {
  id: string;
  name: string; // مثل: حبة، شريط، علبة، أنبوب، زجاجة
  parentUnitId?: string; // ربط الوحدة بوحدة أعلى (مثلاً: الشريط يتبع العلبة، والحبة تتبع الشريط)
  containsQty?: number; // كم تحتوي هذه الوحدة من الوحدة الفرعية (مثلاً: العلبة تحتوي 3 أشرطة)
  factor: number; // معامل التحويل إلى الوحدة الأساسية (الحبة = 1، الشريط = 10، العلبة = 30)
  salePrice: number; // سعر البيع للجمهور (قطاعي)
  costPrice: number; // سعر التكلفة
  wholesalePrice?: number; // سعر الجملة / الصيدليات الأخرى
  specialPrice?: number; // سعر خاص / نقابي / تأمين
  isCustomPrice?: boolean; // هل تم تحديد سعر بيع مخصص يدوياً لهذه الوحدة أم محسوب تلقائياً
  isBaseUnit?: boolean; // هل هذه هي أصغر وحدة أساسية
  barcode?: string; // باركود مخصص لهذه الوحدة (شريط، علبة، كرتونة)
}

export interface Product {
  id: string;
  nameAr: string;
  nameEn: string;
  barcode: string;
  type: 'medicine' | 'commercial';
  categoryId: string;
  ingredientIds: string[]; // مصفوفة معرفات المواد الفعالة
  manufacturerId: string;
  stock: number; // المخزون بالوحدة الأساسية (مثلاً بالحبوب)
  minStock?: number; // حد إعادة الطلب والتنبيه بالنواقص (افتراضي 5)
  notes?: string;
  units: ProductUnit[]; // الوحدات المتاحة
  lastCostPrice?: number;
  lastSalePrice?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface BankSubAccount {
  id: string;
  bankId: string;
  name: string; // مثل: فرع جنين - جاري، حساب شيكات، محفظة توفير
  accountNumber: string;
  balance: number;
  notes?: string;
  createdAt?: string;
}

export interface Bank {
  id: string;
  type: 'bank' | 'wallet'; // بنك أو محفظة إلكترونية
  name: string; // مثل بنك فلسطين، PalPay، PayPal
  accountName: string;
  accountNumber: string;
  ibanOrEmail: string;
  balance: number; // رصيد الحساب الرئيسي
  subAccounts?: BankSubAccount[]; // الحسابات الفرعية
  totalBalance?: number; // إجمالي الرصيد (الرئيسي + الفرعية)
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  balance: number; // الرصيد الحالي (الموجب يعني عليه مديونية)
  creditLimit?: number; // الحد الائتماني الأقصى المسموح به للدين
  maxDebtDays?: number; // فترة السماح بالأيام
  nationalId?: string; // رقم الهوية الوطنية
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  company?: string;
  balance: number; // الرصيد الحالي (المستحق له)
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  unitIndex: number;
  unitName: string;
  unitFactor: number;
  quantity: number;
  salePrice: number;
  costPrice: number;
  total: number;
  profit: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string; // ISO string
  type: 'sale' | 'sale_return'; // بيع أو مرتجع مبيعات
  customerId?: string;
  customerName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  priceTier?: PriceTier;
  paymentMethod: 'cash' | 'card' | 'bank' | 'credit';
  bankId?: string;
  bankSubAccountId?: string;
  bankName?: string;
  paidAmount: number;
  remainingAmount: number;
  status: 'active' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  unitId: string;
  unitName: string;
  unitFactor: number;
  quantity: number;
  costPrice: number; // تكلفة شراء الوحدة المختارة
  salePrice: number; // سعر بيع الوحدة المقترح
  total: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  date: string;
  type: 'purchase' | 'purchase_return'; // شراء أو مردود مشتريات
  partyType: 'supplier' | 'customer'; // إمكانية التبديل بين المورد أو الزبون
  partyId?: string;
  partyName: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'cash' | 'bank' | 'credit';
  bankId?: string;
  bankSubAccountId?: string;
  notes?: string;
  status: 'active' | 'cancelled';
  createdAt: string;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  type: 'receipt' | 'payment' | 'journal'; // سند قبض، سند صرف، سند قيد
  date: string;
  partyType: 'customer' | 'supplier' | 'general';
  partyId?: string;
  partyName?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank';
  bankId?: string;
  bankSubAccountId?: string;
  bankName?: string;
  statement: string; // البيان / سبب الدفع أو الاستلام
  debitAccount?: string; // للحساب المدين في سند القيد
  creditAccount?: string; // للحساب الدائن في سند القيد
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  date: string;
  type: 'sale' | 'return' | 'purchase' | 'cancellation' | 'adjustment';
  quantity: number; // بالوحدة الأساسية (سالب للنقصان وموجب للزيادة)
  referenceId: string; // رقم الفاتورة أو السند
  notes: string;
  balanceAfter: number;
}

export type MainTab = 
  | 'pos' 
  | 'sales_returns'
  | 'purchases'
  | 'purchase_returns'
  | 'products' 
  | 'banks' 
  | 'customers' 
  | 'suppliers' 
  | 'invoices' 
  | 'vouchers' 
  | 'inventory_opening'
  | 'print_designer'
  | 'analytics' 
  | 'settings';
