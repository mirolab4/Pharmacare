import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/db/index.ts';
import { 
  productsTable, 
  categoriesTable, 
  manufacturersTable, 
  ingredientsTable, 
  banksTable, 
  bankSubAccountsTable, 
  customersTable, 
  suppliersTable, 
  invoicesTable, 
  purchasesTable, 
  vouchersTable, 
  settingsTable 
} from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initial sample data seed function
async function seedDatabaseIfEmpty() {
  try {
    const existingCats = await db.select().from(categoriesTable);
    if (existingCats.length > 0) return; // Already seeded

    console.log('Seeding initial pharmacy database in Cloud SQL...');

    // Categories
    const sampleCats = [
      { id: 'cat-1', name: 'مسكنات وخافضات حرارة', description: 'أدوية الصداع والحرارة والألم' },
      { id: 'cat-2', name: 'مضادات حيوية', description: 'أدوية مكافحة العدوى البكتيرية' },
      { id: 'cat-3', name: 'حساسية وجهاز تنفسي', description: 'أدوية الرشح والسعال والحساسية' },
      { id: 'cat-4', name: 'جهاز هضمي ومعدة', description: 'علاجات الحموضة والقولون' },
      { id: 'cat-5', name: 'فيتامينات ومكملات غذائية', description: 'مقويات وحديد وكالسيوم' },
      { id: 'cat-6', name: 'عناية بالبشرة ومستحضرات', description: 'كريمات وغسولات وواقيات شمس' },
      { id: 'cat-7', name: 'مستلزمات وأجهزة طبية', description: 'أجهزة قياس السكر والضغط والضمادات' },
    ];
    await db.insert(categoriesTable).values(sampleCats);

    // Manufacturers
    const sampleMans = [
      { id: 'man-1', name: 'دار الشفاء للأدوية', country: 'فلسطين' },
      { id: 'man-2', name: 'شركة بيرزيت للأدوية', country: 'فلسطين' },
      { id: 'man-3', name: 'شركة بيت جالا لصناعة الأدوية', country: 'فلسطين' },
      { id: 'man-4', name: 'القدس للمستحضرات الطبية', country: 'فلسطين' },
      { id: 'man-5', name: 'GSK - جلاكسو سميث كلاين', country: 'بريطانيا' },
      { id: 'man-6', name: 'Hikma - أدوية الحكمة', country: 'الأردن' },
      { id: 'man-7', name: 'Novartis - نوفارتس', country: 'سويسرا' },
      { id: 'man-8', name: 'Pfizer - فايزر', country: 'الولايات المتحدة' },
    ];
    await db.insert(manufacturersTable).values(sampleMans);

    // Active Ingredients
    const sampleIngs = [
      { id: 'ing-1', nameAr: 'باراسيتامول', nameEn: 'Paracetamol', description: 'مسكن للآلام وخافض للحرارة' },
      { id: 'ing-2', nameAr: 'إيبوبروفين', nameEn: 'Ibuprofen', description: 'مضاد التهاب غير ستيرويدي ومسكن' },
      { id: 'ing-3', nameAr: 'أموكسيسيلين', nameEn: 'Amoxicillin', description: 'مضاد حيوي واسع الطيف (بنسلين)' },
      { id: 'ing-4', nameAr: 'حمض الكلافولانيك', nameEn: 'Clavulanic Acid', description: 'مثبط لإنزيم البيتا لاكتاماز' },
      { id: 'ing-5', nameAr: 'سيتريزين', nameEn: 'Cetirizine', description: 'مضاد للحساسية والهيستامين' },
      { id: 'ing-6', nameAr: 'أوميبرازول', nameEn: 'Omeprazole', description: 'مثبط لمضخة البروتون لحموضة المعدة' },
    ];
    await db.insert(ingredientsTable).values(sampleIngs);

    // Banks & Sub-Accounts
    const sampleBanks = [
      { id: 'bank-1', name: 'بنك فلسطين', accountNumber: '1234567-001', balance: 14500.0, type: 'bank' },
      { id: 'bank-2', name: 'محفظة PalPay', accountNumber: '0599123456', balance: 3200.0, type: 'wallet' },
      { id: 'bank-3', name: 'محفظة جوال باي (Jawwal Pay)', accountNumber: '0599654321', balance: 1850.0, type: 'wallet' },
      { id: 'bank-4', name: 'حساب PayPal العالمي', accountNumber: 'pharmacy@paypal.com', balance: 950.0, type: 'wallet' },
    ];
    await db.insert(banksTable).values(sampleBanks);

    const sampleSubAccounts = [
      { id: 'sub-1', bankId: 'bank-1', name: 'فرع رام الله - الحساب الجاري', accountNumber: '1234567-001-A', balance: 10000.0 },
      { id: 'sub-2', bankId: 'bank-1', name: 'فرع رام الله - حساب الشيكات', accountNumber: '1234567-001-B', balance: 4500.0 },
      { id: 'sub-3', bankId: 'bank-2', name: 'نقطة بيع الكاشير الرئيسية', accountNumber: '0599123456-POS', balance: 3200.0 },
    ];
    await db.insert(bankSubAccountsTable).values(sampleSubAccounts);

    // Customers
    const sampleCusts = [
      { id: 'cust-1', name: 'أحمد محمود القواسمي', phone: '059-8112233', address: 'رام الله - الماصيون', debt: 150.0 },
      { id: 'cust-2', name: 'د. سارة خليل عواد', phone: '056-9445566', address: 'البيرة - شارع القدس', debt: 0.0 },
      { id: 'cust-3', name: 'خالد عبد الرحيم', phone: '059-7788990', address: 'بيتونيا', debt: 320.0 },
    ];
    await db.insert(customersTable).values(sampleCusts);

    // Suppliers
    const sampleSupps = [
      { id: 'supp-1', name: 'شركة مستودع أدوية الجنوب', phone: '02-2256789', address: 'الخليل', company: 'مستودع الجنوب', balance: 4500.0 },
      { id: 'supp-2', name: 'الشركة العربية للتوريدات الطبية', phone: '02-2965432', address: 'رام الله', company: 'العربية للتوريدات', balance: 1200.0 },
      { id: 'supp-3', name: 'مستودع الأمل لمستحضرات التجميل', phone: '09-2345678', address: 'نابلس', company: 'مستودع الأمل', balance: 0.0 },
    ];
    await db.insert(suppliersTable).values(sampleSupps);

    // Products with Smart Unit Hierarchy (علبة تحتوي أشرطة والشريط يحتوي حبات)
    const sampleProducts = [
      {
        id: 'prod-1',
        nameAr: 'أكامول 500 ملغم أقراص',
        nameEn: 'Acamol 500mg Tablets',
        barcode: '729000000101',
        type: 'medicine',
        categoryId: 'cat-1',
        manufacturerId: 'man-1',
        ingredientIds: ['ing-1'],
        stock: 300, // 300 pills = 10 boxes (30 pills each)
        units: [
          { id: 'u-1', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-2', salePrice: 0.5, costPrice: 0.2, isBaseUnit: true },
          { id: 'u-2', name: 'شريط', factor: 10, containsQty: 10, parentUnitId: 'u-3', salePrice: 4.5, costPrice: 1.8 },
          { id: 'u-3', name: 'علبة (30 حبة)', factor: 30, containsQty: 3, salePrice: 12.0, costPrice: 5.4 },
        ],
        lastCostPrice: 5.4,
        lastSalePrice: 12.0,
      },
      {
        id: 'prod-2',
        nameAr: 'بنادول أزرق 500 ملغم',
        nameEn: 'Panadol Blue 500mg',
        barcode: '5000347060124',
        type: 'medicine',
        categoryId: 'cat-1',
        manufacturerId: 'man-5',
        ingredientIds: ['ing-1'], // Same active ingredient: Paracetamol
        stock: 480, // 20 boxes * 24 pills
        units: [
          { id: 'u-4', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-5', salePrice: 0.6, costPrice: 0.3, isBaseUnit: true },
          { id: 'u-5', name: 'شريط', factor: 12, containsQty: 12, parentUnitId: 'u-6', salePrice: 7.0, costPrice: 3.5 },
          { id: 'u-6', name: 'علبة (24 حبة)', factor: 24, containsQty: 2, salePrice: 13.5, costPrice: 7.0 },
        ],
        lastCostPrice: 7.0,
        lastSalePrice: 13.5,
      },
      {
        id: 'prod-3',
        nameAr: 'أوغمنتين 1 غرام أقراص',
        nameEn: 'Augmentin 1g Tablets',
        barcode: '5000347012345',
        type: 'medicine',
        categoryId: 'cat-2',
        manufacturerId: 'man-5',
        ingredientIds: ['ing-3', 'ing-4'],
        stock: 140, // 10 boxes * 14 pills
        units: [
          { id: 'u-7', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-8', salePrice: 3.0, costPrice: 1.8, isBaseUnit: true },
          { id: 'u-8', name: 'شريط (7 حبات)', factor: 7, containsQty: 7, parentUnitId: 'u-9', salePrice: 20.0, costPrice: 12.0 },
          { id: 'u-9', name: 'علبة (14 حبة)', factor: 14, containsQty: 2, salePrice: 38.0, costPrice: 24.0 },
        ],
        lastCostPrice: 24.0,
        lastSalePrice: 38.0,
      },
      {
        id: 'prod-4',
        nameAr: 'كلافوكس 1 غرام أقراص',
        nameEn: 'Klavox 1g Tablets',
        barcode: '6251234567890',
        type: 'medicine',
        categoryId: 'cat-2',
        manufacturerId: 'man-6',
        ingredientIds: ['ing-3', 'ing-4'], // Same active ingredient: Alternative to Augmentin
        stock: 210,
        units: [
          { id: 'u-10', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-11', salePrice: 2.5, costPrice: 1.5, isBaseUnit: true },
          { id: 'u-11', name: 'شريط (7 حبات)', factor: 7, containsQty: 7, parentUnitId: 'u-12', salePrice: 16.5, costPrice: 10.0 },
          { id: 'u-12', name: 'علبة (14 حبة)', factor: 14, containsQty: 2, salePrice: 32.0, costPrice: 20.0 },
        ],
        lastCostPrice: 20.0,
        lastSalePrice: 32.0,
      },
      {
        id: 'prod-5',
        nameAr: 'أدفيل 200 ملغم كبسولات جيلاتينية',
        nameEn: 'Advil 200mg Liquid Gels',
        barcode: '305730160205',
        type: 'medicine',
        categoryId: 'cat-1',
        manufacturerId: 'man-8',
        ingredientIds: ['ing-2'],
        stock: 160,
        units: [
          { id: 'u-13', name: 'حبة', factor: 1, containsQty: 1, parentUnitId: 'u-14', salePrice: 1.2, costPrice: 0.7, isBaseUnit: true },
          { id: 'u-14', name: 'شريط (10 حبات)', factor: 10, containsQty: 10, parentUnitId: 'u-15', salePrice: 11.0, costPrice: 6.5 },
          { id: 'u-15', name: 'علبة (20 حبة)', factor: 20, containsQty: 2, salePrice: 21.0, costPrice: 13.0 },
        ],
        lastCostPrice: 13.0,
        lastSalePrice: 21.0,
      },
    ];
    await db.insert(productsTable).values(sampleProducts);

    // Pharmacy Settings
    await db.insert(settingsTable).values({
      id: 'default',
      pharmacyName: 'صيدلية الأمل المركزية',
      phone: '059-9123456 / 02-2987654',
      address: 'فلسطين - رام الله - شارع الإرسال، مجمع القدس الطبي',
      taxNumber: '900456789',
      currency: '₪',
      defaultTaxRate: 0,
      manualTotalBehavior: 'price',
      hideCostAndProfit: false,
      soundEnabled: true,
      darkMode: false,
      receiptFooter: 'طهور إن شاء الله.. شكراً لثقتكم بنا',
      thermalPaperWidth: '58mm',
    });

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding initial data:', err);
  }
}

// Ensure database is seeded on start
seedDatabaseIfEmpty();

// --- API Endpoints ---

// 1. GET /api/sync: Synchronize all data from PostgreSQL
app.get('/api/sync', async (_req: Request, res: Response) => {
  try {
    const [
      products, 
      categories, 
      manufacturers, 
      ingredients, 
      banks, 
      subAccounts, 
      customers, 
      suppliers, 
      invoices, 
      purchases, 
      vouchers, 
      settingsRows
    ] = await Promise.all([
      db.select().from(productsTable),
      db.select().from(categoriesTable),
      db.select().from(manufacturersTable),
      db.select().from(ingredientsTable),
      db.select().from(banksTable),
      db.select().from(bankSubAccountsTable),
      db.select().from(customersTable),
      db.select().from(suppliersTable),
      db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt)),
      db.select().from(purchasesTable).orderBy(desc(purchasesTable.createdAt)),
      db.select().from(vouchersTable).orderBy(desc(vouchersTable.createdAt)),
      db.select().from(settingsTable).where(eq(settingsTable.id, 'default')),
    ]);

    // Attach subAccounts to their parent bank and compute totalBalance
    const banksWithSubs = banks.map(b => {
      const subs = subAccounts.filter(s => s.bankId === b.id);
      const subsSum = subs.reduce((sum, s) => sum + s.balance, 0);
      return {
        ...b,
        accountName: b.name,
        ibanOrEmail: b.accountNumber,
        subAccounts: subs,
        totalBalance: b.balance + subsSum,
      };
    });

    res.json({
      success: true,
      products,
      categories,
      manufacturers,
      ingredients,
      banks: banksWithSubs,
      customers: customers.map(c => ({ ...c, balance: c.debt })),
      suppliers: suppliers.map(s => ({ ...s, balance: s.balance })),
      invoices,
      purchases,
      vouchers,
      settings: settingsRows[0] || null,
    });
  } catch (error: any) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Failed to sync with SQL database', details: error.message });
  }
});

// 2. Products API
app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const prod = req.body;
    if (!prod.id || !prod.nameAr) {
      return res.status(400).json({ error: 'Product id and nameAr are required' });
    }

    const existing = await db.select().from(productsTable).where(eq(productsTable.id, prod.id));
    if (existing.length > 0) {
      await db.update(productsTable)
        .set({
          nameAr: prod.nameAr,
          nameEn: prod.nameEn || '',
          barcode: prod.barcode || '',
          type: prod.type || 'medicine',
          categoryId: prod.categoryId,
          manufacturerId: prod.manufacturerId,
          ingredientIds: prod.ingredientIds || [],
          stock: prod.stock ?? 0,
          minStock: prod.minStock ?? 5,
          units: prod.units,
          lastCostPrice: prod.lastCostPrice,
          lastSalePrice: prod.lastSalePrice,
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, prod.id));
    } else {
      await db.insert(productsTable).values({
        id: prod.id,
        nameAr: prod.nameAr,
        nameEn: prod.nameEn || '',
        barcode: prod.barcode || '',
        type: prod.type || 'medicine',
        categoryId: prod.categoryId,
        manufacturerId: prod.manufacturerId,
        ingredientIds: prod.ingredientIds || [],
        stock: prod.stock ?? 0,
        minStock: prod.minStock ?? 5,
        units: prod.units,
        lastCostPrice: prod.lastCostPrice,
        lastSalePrice: prod.lastSalePrice,
      });
    }

    res.json({ success: true, product: prod });
  } catch (error: any) {
    console.error('Failed to save product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(productsTable).where(eq(productsTable.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Invoices API (Sales & Sales Returns)
app.post('/api/invoices', async (req: Request, res: Response) => {
  try {
    const invoice = req.body;
    const isReturn = invoice.type === 'sale_return';

    // 1. Insert Invoice
    await db.insert(invoicesTable).values({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date || new Date().toISOString(),
      type: invoice.type || 'sale',
      customerId: invoice.customerId || null,
      customerName: invoice.customerName || 'زبون عام / نقدي',
      items: invoice.items,
      subtotal: invoice.subtotal,
      discount: invoice.discountAmount || invoice.discount || 0,
      tax: invoice.taxAmount || invoice.tax || 0,
      totalAmount: invoice.totalAmount,
      totalCost: invoice.totalCost || 0,
      totalProfit: invoice.totalProfit || 0,
      paidAmount: invoice.paidAmount || 0,
      remainingAmount: invoice.remainingAmount || 0,
      paymentMethod: invoice.paymentMethod,
      bankId: invoice.bankId || null,
      bankSubAccountId: invoice.bankSubAccountId || null,
      notes: invoice.notes || null,
      status: invoice.status || 'active',
    });

    // 2. Update Product Stocks
    for (const item of invoice.items) {
      const prods = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (prods.length > 0) {
        const prod = prods[0];
        const qtyInBaseUnit = (item.quantity || 1) * (item.unitFactor || 1);
        const newStock = isReturn ? (prod.stock + qtyInBaseUnit) : (prod.stock - qtyInBaseUnit);

        await db.update(productsTable)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(productsTable.id, item.productId));
      }
    }

    // 3. Update Customer Debt if applicable
    if (invoice.customerId) {
      const custs = await db.select().from(customersTable).where(eq(customersTable.id, invoice.customerId));
      if (custs.length > 0) {
        const cust = custs[0];
        if (isReturn) {
          // A return reduces customer debt
          const newDebt = Math.max(0, cust.debt - invoice.totalAmount);
          await db.update(customersTable).set({ debt: newDebt }).where(eq(customersTable.id, invoice.customerId));
        } else if (invoice.remainingAmount > 0) {
          // Sale with remaining balance increases debt
          const newDebt = cust.debt + invoice.remainingAmount;
          await db.update(customersTable).set({ debt: newDebt }).where(eq(customersTable.id, invoice.customerId));
        }
      }
    }

    // 4. Update Bank / SubAccount Balance if paid via bank
    if (invoice.paymentMethod === 'bank' && invoice.paidAmount > 0) {
      if (invoice.bankSubAccountId) {
        const subs = await db.select().from(bankSubAccountsTable).where(eq(bankSubAccountsTable.id, invoice.bankSubAccountId));
        if (subs.length > 0) {
          const newBal = isReturn ? (subs[0].balance - invoice.paidAmount) : (subs[0].balance + invoice.paidAmount);
          await db.update(bankSubAccountsTable).set({ balance: newBal }).where(eq(bankSubAccountsTable.id, invoice.bankSubAccountId));
        }
      } else if (invoice.bankId) {
        const bks = await db.select().from(banksTable).where(eq(banksTable.id, invoice.bankId));
        if (bks.length > 0) {
          const newBal = isReturn ? (bks[0].balance - invoice.paidAmount) : (bks[0].balance + invoice.paidAmount);
          await db.update(banksTable).set({ balance: newBal }).where(eq(banksTable.id, invoice.bankId));
        }
      }
    }

    res.json({ success: true, invoice });
  } catch (error: any) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel Invoice
app.post('/api/invoices/:id/cancel', async (req: Request, res: Response) => {
  try {
    const invs = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params.id));
    if (invs.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invs[0];
    if (inv.status === 'cancelled') return res.json({ success: true, message: 'Already cancelled' });

    const isReturn = inv.type === 'sale_return';

    // Reverse stocks
    for (const item of (inv.items as any[])) {
      const prods = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (prods.length > 0) {
        const prod = prods[0];
        const qtyInBaseUnit = (item.quantity || 1) * (item.unitFactor || 1);
        // If it was a sale, cancelling restores stock. If it was return, cancelling deducts stock.
        const restoredStock = isReturn ? (prod.stock - qtyInBaseUnit) : (prod.stock + qtyInBaseUnit);
        await db.update(productsTable).set({ stock: restoredStock }).where(eq(productsTable.id, item.productId));
      }
    }

    // Reverse customer debt
    if (inv.customerId && inv.remainingAmount > 0) {
      const custs = await db.select().from(customersTable).where(eq(customersTable.id, inv.customerId));
      if (custs.length > 0) {
        const newDebt = Math.max(0, custs[0].debt - inv.remainingAmount);
        await db.update(customersTable).set({ debt: newDebt }).where(eq(customersTable.id, inv.customerId));
      }
    }

    // Reverse bank
    if (inv.paymentMethod === 'bank' && inv.paidAmount > 0 && inv.bankId) {
      const bks = await db.select().from(banksTable).where(eq(banksTable.id, inv.bankId));
      if (bks.length > 0) {
        const newBal = isReturn ? (bks[0].balance + inv.paidAmount) : (bks[0].balance - inv.paidAmount);
        await db.update(banksTable).set({ balance: newBal }).where(eq(banksTable.id, inv.bankId));
      }
    }

    await db.update(invoicesTable).set({ status: 'cancelled' }).where(eq(invoicesTable.id, inv.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Purchases API (Purchases & Purchase Returns)
app.post('/api/purchases', async (req: Request, res: Response) => {
  try {
    const purchase = req.body;
    const isReturn = purchase.type === 'purchase_return';

    // 1. Insert Purchase Record
    await db.insert(purchasesTable).values({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      date: purchase.date || new Date().toISOString(),
      type: purchase.type || 'purchase',
      partyType: purchase.partyType || 'supplier',
      partyId: purchase.partyId || null,
      partyName: purchase.partyName || 'مورد عام',
      items: purchase.items,
      subtotal: purchase.subtotal,
      discount: purchase.discount || 0,
      totalAmount: purchase.totalAmount,
      paidAmount: purchase.paidAmount || 0,
      remainingAmount: purchase.remainingAmount || 0,
      paymentMethod: purchase.paymentMethod,
      bankId: purchase.bankId || null,
      bankSubAccountId: purchase.bankSubAccountId || null,
      notes: purchase.notes || null,
      status: purchase.status || 'active',
    });

    // 2. Update Product Stocks and Unit Prices
    for (const item of purchase.items) {
      const prods = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (prods.length > 0) {
        const prod = prods[0];
        const qtyInBaseUnit = (item.quantity || 1) * (item.unitFactor || 1);
        // Purchase increases stock, Return decreases stock
        const newStock = isReturn ? Math.max(0, prod.stock - qtyInBaseUnit) : (prod.stock + qtyInBaseUnit);

        // Update last cost and units cost price
        let updatedUnits = prod.units as any[];
        if (!isReturn && item.costPrice > 0) {
          updatedUnits = updatedUnits.map(u => {
            if (u.id === item.unitId) {
              return { ...u, costPrice: item.costPrice, salePrice: item.salePrice || u.salePrice };
            }
            return u;
          });
        }

        await db.update(productsTable)
          .set({ 
            stock: newStock, 
            units: updatedUnits,
            lastCostPrice: item.costPrice || prod.lastCostPrice,
            lastSalePrice: item.salePrice || prod.lastSalePrice,
            updatedAt: new Date() 
          })
          .where(eq(productsTable.id, item.productId));
      }
    }

    // 3. Update Supplier Balance (Credit) or Customer
    if (purchase.partyType === 'supplier' && purchase.partyId) {
      const supps = await db.select().from(suppliersTable).where(eq(suppliersTable.id, purchase.partyId));
      if (supps.length > 0) {
        const supp = supps[0];
        if (isReturn) {
          // Returning to supplier reduces what we owe them
          const newBal = Math.max(0, supp.balance - purchase.totalAmount);
          await db.update(suppliersTable).set({ balance: newBal }).where(eq(suppliersTable.id, purchase.partyId));
        } else if (purchase.remainingAmount > 0) {
          // Buying on credit increases our debt to supplier
          const newBal = supp.balance + purchase.remainingAmount;
          await db.update(suppliersTable).set({ balance: newBal }).where(eq(suppliersTable.id, purchase.partyId));
        }
      }
    }

    // 4. Update Bank Balance if paid via bank
    if (purchase.paymentMethod === 'bank' && purchase.paidAmount > 0) {
      if (purchase.bankSubAccountId) {
        const subs = await db.select().from(bankSubAccountsTable).where(eq(bankSubAccountsTable.id, purchase.bankSubAccountId));
        if (subs.length > 0) {
          // Purchase deducts from bank, Return refunds into bank
          const newBal = isReturn ? (subs[0].balance + purchase.paidAmount) : (subs[0].balance - purchase.paidAmount);
          await db.update(bankSubAccountsTable).set({ balance: newBal }).where(eq(bankSubAccountsTable.id, purchase.bankSubAccountId));
        }
      } else if (purchase.bankId) {
        const bks = await db.select().from(banksTable).where(eq(banksTable.id, purchase.bankId));
        if (bks.length > 0) {
          const newBal = isReturn ? (bks[0].balance + purchase.paidAmount) : (bks[0].balance - purchase.paidAmount);
          await db.update(banksTable).set({ balance: newBal }).where(eq(banksTable.id, purchase.bankId));
        }
      }
    }

    res.json({ success: true, purchase });
  } catch (error: any) {
    console.error('Purchase creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel Purchase
app.post('/api/purchases/:id/cancel', async (req: Request, res: Response) => {
  try {
    const purs = await db.select().from(purchasesTable).where(eq(purchasesTable.id, req.params.id));
    if (purs.length === 0) return res.status(404).json({ error: 'Purchase not found' });
    const pur = purs[0];
    if (pur.status === 'cancelled') return res.json({ success: true });

    const isReturn = pur.type === 'purchase_return';

    // Reverse stocks
    for (const item of (pur.items as any[])) {
      const prods = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (prods.length > 0) {
        const prod = prods[0];
        const qtyInBaseUnit = (item.quantity || 1) * (item.unitFactor || 1);
        const restoredStock = isReturn ? (prod.stock + qtyInBaseUnit) : Math.max(0, prod.stock - qtyInBaseUnit);
        await db.update(productsTable).set({ stock: restoredStock }).where(eq(productsTable.id, item.productId));
      }
    }

    // Reverse supplier balance
    if (pur.partyId && pur.remainingAmount > 0) {
      const supps = await db.select().from(suppliersTable).where(eq(suppliersTable.id, pur.partyId));
      if (supps.length > 0) {
        const newBal = Math.max(0, supps[0].balance - pur.remainingAmount);
        await db.update(suppliersTable).set({ balance: newBal }).where(eq(suppliersTable.id, pur.partyId));
      }
    }

    // Reverse bank
    if (pur.paymentMethod === 'bank' && pur.paidAmount > 0 && pur.bankId) {
      const bks = await db.select().from(banksTable).where(eq(banksTable.id, pur.bankId));
      if (bks.length > 0) {
        const newBal = isReturn ? (bks[0].balance - pur.paidAmount) : (bks[0].balance + pur.paidAmount);
        await db.update(banksTable).set({ balance: newBal }).where(eq(banksTable.id, pur.bankId));
      }
    }

    await db.update(purchasesTable).set({ status: 'cancelled' }).where(eq(purchasesTable.id, pur.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Banks & Bank Sub-Accounts API
app.post('/api/banks', async (req: Request, res: Response) => {
  try {
    const bank = req.body;
    const existing = await db.select().from(banksTable).where(eq(banksTable.id, bank.id));
    if (existing.length > 0) {
      await db.update(banksTable).set({
        name: bank.name,
        accountNumber: bank.accountNumber,
        balance: bank.balance ?? 0,
        type: bank.type || 'bank',
      }).where(eq(banksTable.id, bank.id));
    } else {
      await db.insert(banksTable).values({
        id: bank.id,
        name: bank.name,
        accountNumber: bank.accountNumber,
        balance: bank.balance ?? 0,
        type: bank.type || 'bank',
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/banks/sub-accounts', async (req: Request, res: Response) => {
  try {
    const sub = req.body;
    const existing = await db.select().from(bankSubAccountsTable).where(eq(bankSubAccountsTable.id, sub.id));
    if (existing.length > 0) {
      await db.update(bankSubAccountsTable).set({
        name: sub.name,
        accountNumber: sub.accountNumber,
        balance: sub.balance ?? 0,
      }).where(eq(bankSubAccountsTable.id, sub.id));
    } else {
      await db.insert(bankSubAccountsTable).values({
        id: sub.id,
        bankId: sub.bankId,
        name: sub.name,
        accountNumber: sub.accountNumber,
        balance: sub.balance ?? 0,
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/banks/sub-accounts/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(bankSubAccountsTable).where(eq(bankSubAccountsTable.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Customers & Suppliers API
app.post('/api/customers', async (req: Request, res: Response) => {
  try {
    const cust = req.body;
    const existing = await db.select().from(customersTable).where(eq(customersTable.id, cust.id));
    if (existing.length > 0) {
      await db.update(customersTable).set({
        name: cust.name,
        phone: cust.phone,
        address: cust.address,
        debt: cust.balance ?? cust.debt ?? 0,
      }).where(eq(customersTable.id, cust.id));
    } else {
      await db.insert(customersTable).values({
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        address: cust.address,
        debt: cust.balance ?? cust.debt ?? 0,
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/suppliers', async (req: Request, res: Response) => {
  try {
    const supp = req.body;
    const existing = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supp.id));
    if (existing.length > 0) {
      await db.update(suppliersTable).set({
        name: supp.name,
        phone: supp.phone,
        address: supp.address,
        company: supp.company,
        balance: supp.balance ?? 0,
      }).where(eq(suppliersTable.id, supp.id));
    } else {
      await db.insert(suppliersTable).values({
        id: supp.id,
        name: supp.name,
        phone: supp.phone,
        address: supp.address,
        company: supp.company,
        balance: supp.balance ?? 0,
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Vouchers API
app.post('/api/vouchers', async (req: Request, res: Response) => {
  try {
    const v = req.body;
    await db.insert(vouchersTable).values({
      id: v.id,
      voucherNumber: v.voucherNumber,
      date: v.date || new Date().toISOString(),
      type: v.type,
      partyType: v.partyType,
      partyId: v.partyId || null,
      partyName: v.partyName,
      amount: v.amount,
      paymentMethod: v.paymentMethod,
      bankId: v.bankId || null,
      bankSubAccountId: v.bankSubAccountId || null,
      notes: v.statement || v.notes || null,
    });

    // Update balances
    if (v.partyType === 'customer' && v.partyId) {
      const custs = await db.select().from(customersTable).where(eq(customersTable.id, v.partyId));
      if (custs.length > 0) {
        // Receipt from customer reduces their debt, Payment increases it
        const newDebt = v.type === 'receipt' ? Math.max(0, custs[0].debt - v.amount) : (custs[0].debt + v.amount);
        await db.update(customersTable).set({ debt: newDebt }).where(eq(customersTable.id, v.partyId));
      }
    } else if (v.partyType === 'supplier' && v.partyId) {
      const supps = await db.select().from(suppliersTable).where(eq(suppliersTable.id, v.partyId));
      if (supps.length > 0) {
        // Payment to supplier reduces balance owed to them
        const newBal = v.type === 'payment' ? Math.max(0, supps[0].balance - v.amount) : (supps[0].balance + v.amount);
        await db.update(suppliersTable).set({ balance: newBal }).where(eq(suppliersTable.id, v.partyId));
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Categories, Manufacturers, Ingredients
app.post('/api/categories', async (req: Request, res: Response) => {
  try {
    const c = req.body;
    await db.insert(categoriesTable).values(c);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/manufacturers', async (req: Request, res: Response) => {
  try {
    const m = req.body;
    await db.insert(manufacturersTable).values(m);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ingredients', async (req: Request, res: Response) => {
  try {
    const ing = req.body;
    await db.insert(ingredientsTable).values(ing);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Settings API
app.post('/api/settings', async (req: Request, res: Response) => {
  try {
    const s = req.body;
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.id, 'default'));
    if (existing.length > 0) {
      await db.update(settingsTable).set({
        pharmacyName: s.pharmacyName,
        phone: s.phone,
        address: s.address,
        taxNumber: s.taxNumber,
        currency: s.currency,
        defaultTaxRate: s.defaultTaxRate,
        manualTotalBehavior: s.manualTotalBehavior || s.editMode,
        hideCostAndProfit: s.hideCostAndProfit,
        soundEnabled: s.enableScannerSound ?? s.soundEnabled,
        darkMode: s.darkMode,
        receiptFooter: s.receiptFooterMessage ?? s.receiptFooter,
        thermalPaperWidth: s.thermalPaperWidth,
        updatedAt: new Date(),
      }).where(eq(settingsTable.id, 'default'));
    } else {
      await db.insert(settingsTable).values({
        id: 'default',
        pharmacyName: s.pharmacyName,
        phone: s.phone,
        address: s.address,
        taxNumber: s.taxNumber,
        currency: s.currency || '₪',
        defaultTaxRate: s.defaultTaxRate || 0,
        manualTotalBehavior: s.manualTotalBehavior || s.editMode || 'price',
        hideCostAndProfit: s.hideCostAndProfit || false,
        soundEnabled: s.soundEnabled ?? true,
        darkMode: s.darkMode || false,
        receiptFooter: s.receiptFooterMessage ?? s.receiptFooter ?? 'شكراً لزيارتكم',
        thermalPaperWidth: s.thermalPaperWidth || '58mm',
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Development / Production Frontend Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Pharmacare Plus server is running on port ${PORT}`);
  });
}

startServer();
