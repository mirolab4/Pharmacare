import { pgTable, text, serial, integer, doublePrecision, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (Firebase Auth linkage)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Pharmacy Settings
export const settingsTable = pgTable('pharmacy_settings', {
  id: text('id').primaryKey(), // 'default'
  pharmacyName: text('pharmacy_name').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  taxNumber: text('tax_number'),
  currency: text('currency').notNull().default('₪'),
  defaultTaxRate: doublePrecision('default_tax_rate').default(0),
  manualTotalBehavior: text('manual_total_behavior').default('price'),
  hideCostAndProfit: boolean('hide_cost_and_profit').default(false),
  soundEnabled: boolean('sound_enabled').default(true),
  darkMode: boolean('dark_mode').default(false),
  receiptFooter: text('receipt_footer').default('شكراً لزيارتكم ونتمنى لكم دوام الصحة والعافية'),
  thermalPaperWidth: text('thermal_paper_width').default('58mm'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Categories
export const categoriesTable = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Manufacturers
export const manufacturersTable = pgTable('manufacturers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Active Ingredients
export const ingredientsTable = pgTable('ingredients', {
  id: text('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Products & Hierarchy of Units
export const productsTable = pgTable('products', {
  id: text('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  barcode: text('barcode').notNull(),
  type: text('type').notNull(), // 'medicine' | 'commercial' | 'both'
  categoryId: text('category_id').notNull(),
  manufacturerId: text('manufacturer_id').notNull(),
  ingredientIds: jsonb('ingredient_ids').$type<string[]>().default([]),
  stock: doublePrecision('stock').notNull().default(0), // stock in base unit (usually the smallest unit e.g. حبة)
  minStock: doublePrecision('min_stock').default(5),
  units: jsonb('units').$type<Array<{
    id: string;
    name: string;
    parentUnitId?: string; // links e.g. "حبة" to "شريط", or "شريط" to "علبة"
    containsQty?: number; // e.g. العلبة تحتوي 3 أشرطة (containsQty=3)
    factor: number; // factor relative to base unit (e.g. حبة=1, شريط=10, علبة=30)
    salePrice: number;
    costPrice: number;
    wholesalePrice?: number;
    specialPrice?: number;
    isCustomPrice?: boolean; // if user manually set custom price
    isBaseUnit?: boolean;
  }>>().notNull(),
  lastCostPrice: doublePrecision('last_cost_price'),
  lastSalePrice: doublePrecision('last_sale_price'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Customers
export const customersTable = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  debt: doublePrecision('debt').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Suppliers
export const suppliersTable = pgTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  company: text('company'),
  balance: doublePrecision('balance').notNull().default(0), // credit owed to supplier
  createdAt: timestamp('created_at').defaultNow(),
});

// Banks and Electronic Wallets
export const banksTable = pgTable('banks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  accountNumber: text('account_number').notNull(),
  balance: doublePrecision('balance').notNull().default(0),
  type: text('type').notNull(), // 'bank' | 'wallet'
  createdAt: timestamp('created_at').defaultNow(),
});

// Bank Sub-Accounts
export const bankSubAccountsTable = pgTable('bank_sub_accounts', {
  id: text('id').primaryKey(),
  bankId: text('bank_id').references(() => banksTable.id).notNull(),
  name: text('name').notNull(), // e.g. 'فرع جنين - جاري', 'محفظة التوفير'
  accountNumber: text('account_number').notNull(),
  balance: doublePrecision('balance').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Invoices (Sales & Sales Returns)
export const invoicesTable = pgTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull(),
  date: text('date').notNull(),
  type: text('type').notNull().default('sale'), // 'sale' | 'sale_return'
  customerId: text('customer_id'),
  customerName: text('customer_name').notNull(),
  items: jsonb('items').$type<Array<{
    productId: string;
    productName: string;
    barcode: string;
    unitId: string;
    unitName: string;
    quantity: number;
    unitFactor: number;
    price: number;
    cost: number;
    discount: number;
    total: number;
    profit: number;
  }>>().notNull(),
  subtotal: doublePrecision('subtotal').notNull(),
  discount: doublePrecision('discount').notNull().default(0),
  tax: doublePrecision('tax').notNull().default(0),
  totalAmount: doublePrecision('total_amount').notNull(),
  totalCost: doublePrecision('total_cost').notNull().default(0),
  totalProfit: doublePrecision('total_profit').notNull().default(0),
  paidAmount: doublePrecision('paid_amount').notNull().default(0),
  remainingAmount: doublePrecision('remaining_amount').notNull().default(0),
  paymentMethod: text('payment_method').notNull(), // 'cash' | 'card' | 'bank' | 'credit'
  bankId: text('bank_id'),
  bankSubAccountId: text('bank_sub_account_id'),
  notes: text('notes'),
  status: text('status').notNull().default('active'), // 'active' | 'cancelled'
  createdAt: timestamp('created_at').defaultNow(),
});

// Purchases & Purchase Returns
export const purchasesTable = pgTable('purchases', {
  id: text('id').primaryKey(),
  purchaseNumber: text('purchase_number').notNull(),
  date: text('date').notNull(),
  type: text('type').notNull().default('purchase'), // 'purchase' | 'purchase_return'
  partyType: text('party_type').notNull().default('supplier'), // 'supplier' | 'customer'
  partyId: text('party_id'),
  partyName: text('party_name').notNull(),
  items: jsonb('items').$type<Array<{
    productId: string;
    productName: string;
    barcode: string;
    unitId: string;
    unitName: string;
    quantity: number;
    unitFactor: number;
    costPrice: number;
    salePrice: number;
    total: number;
  }>>().notNull(),
  subtotal: doublePrecision('subtotal').notNull(),
  discount: doublePrecision('discount').notNull().default(0),
  totalAmount: doublePrecision('total_amount').notNull(),
  paidAmount: doublePrecision('paid_amount').notNull().default(0),
  remainingAmount: doublePrecision('remaining_amount').notNull().default(0),
  paymentMethod: text('payment_method').notNull(), // 'cash' | 'bank' | 'credit'
  bankId: text('bank_id'),
  bankSubAccountId: text('bank_sub_account_id'),
  notes: text('notes'),
  status: text('status').notNull().default('active'), // 'active' | 'cancelled'
  createdAt: timestamp('created_at').defaultNow(),
});

// Financial Vouchers (سند قبض، سند صرف، سند تسوية)
export const vouchersTable = pgTable('vouchers', {
  id: text('id').primaryKey(),
  voucherNumber: text('voucher_number').notNull(),
  date: text('date').notNull(),
  type: text('type').notNull(), // 'receipt' | 'payment' | 'journal'
  partyType: text('party_type').notNull(), // 'customer' | 'supplier' | 'general'
  partyId: text('party_id'),
  partyName: text('party_name').notNull(),
  amount: doublePrecision('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'cash' | 'bank'
  bankId: text('bank_id'),
  bankSubAccountId: text('bank_sub_account_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const banksRelations = relations(banksTable, ({ many }) => ({
  subAccounts: many(bankSubAccountsTable),
}));

export const bankSubAccountsRelations = relations(bankSubAccountsTable, ({ one }) => ({
  bank: one(banksTable, {
    fields: [bankSubAccountsTable.bankId],
    references: [banksTable.id],
  }),
}));
