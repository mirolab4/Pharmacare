/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { POSView } from './components/POSView';
import { ProductsView } from './components/ProductsView';
import { BanksWalletsView } from './components/BanksWalletsView';
import { CustomersSuppliersView } from './components/CustomersSuppliersView';
import { InvoicesView } from './components/InvoicesView';
import { VouchersView } from './components/VouchersView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { PurchasesView } from './components/PurchasesView';
import { SalesReturnsView } from './components/SalesReturnsView';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ContinuousScannerWidget } from './components/ContinuousScannerWidget';
import { ThermalReceipt } from './components/ThermalReceipt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DeviceLinkModal } from './components/DeviceLinkModal';
import { PharmacySetupModal } from './components/PharmacySetupModal';
import { QuickStockAuditModal } from './components/QuickStockAuditModal';
import { CustomerDisplayView } from './components/CustomerDisplayView';

import { pharmacyStorage } from './services/storage';
import { 
  firebaseSync, 
  subscribeToProducts, 
  subscribeToCategories, 
  subscribeToManufacturers,
  subscribeToIngredients,
  subscribeToInvoices, 
  subscribeToPurchases,
  subscribeToCustomers, 
  subscribeToSuppliers,
  subscribeToVouchers,
  subscribeToBanks,
  subscribeToStockMovements,
  subscribeToSettings
} from './services/firebaseSync';
import { checkAndRunScheduledBackup, uploadBackupToDrive } from './services/googleDrive';
import { 
  MainTab, 
  Product, 
  Category, 
  Manufacturer, 
  Ingredient, 
  Bank, 
  Customer, 
  Supplier, 
  Invoice, 
  Purchase,
  Voucher, 
  Settings 
} from './types/pharmacy';
import { playBeep, playSuccess, playError } from './utils/audio';
import { useHardwareBarcodeScanner } from './utils/useHardwareBarcodeScanner';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const VALID_TABS: MainTab[] = [
  'pos', 'sales_returns', 'purchases', 'purchase_returns', 
  'products', 'banks', 'customers', 'suppliers', 
  'invoices', 'vouchers', 'analytics', 'settings'
];

function getUrlParams(): { wid?: string; code?: string; slug?: string } {
  if (typeof window === 'undefined') return {};

  const extract = (search: string) => {
    const params = new URLSearchParams(search);
    const wid = params.get('w') || params.get('wid') || params.get('workspaceId') || params.get('pid') || params.get('pharmacyId') || undefined;
    const code = params.get('code') || params.get('token') || params.get('joinCode') || params.get('k') || undefined;
    const slug = params.get('slug') || params.get('name') || undefined;
    return { wid, code, slug };
  };

  let res = extract(window.location.search);
  if ((!res.wid || !res.code) && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1];
    if (hashQuery) {
      const hashRes = extract(hashQuery);
      res = {
        wid: res.wid || hashRes.wid,
        code: res.code || hashRes.code,
        slug: res.slug || hashRes.slug,
      };
    }
  }
  return res;
}

function getTabFromHash(): MainTab {
  if (typeof window !== 'undefined' && window.location.hash) {
    const raw = window.location.hash.replace(/^#\/?/, '').trim() as MainTab;
    if (VALID_TABS.includes(raw)) {
      return raw;
    }
  }
  return 'pos';
}

export default function App() {
  // Navigation with Hash URL support
  const [activeTab, setActiveTab] = useState<MainTab>(() => getTabFromHash());

  const handleSelectTab = (tab: MainTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${tab}`;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const tab = getTabFromHash();
      setActiveTab(tab);
    };
    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash) {
      window.location.hash = '#/pos';
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Application Data State
  const [settings, setSettings] = useState<Settings>(() => pharmacyStorage.getSettings());
  const [products, setProducts] = useState<Product[]>(() => pharmacyStorage.getProducts());
  const [categories, setCategories] = useState<Category[]>(() => pharmacyStorage.getCategories());
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>(() => pharmacyStorage.getManufacturers());
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => pharmacyStorage.getIngredients());
  const [banks, setBanks] = useState<Bank[]>(() => pharmacyStorage.getBanks());
  const [customers, setCustomers] = useState<Customer[]>(() => pharmacyStorage.getCustomers());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => pharmacyStorage.getSuppliers());
  const [invoices, setInvoices] = useState<Invoice[]>(() => pharmacyStorage.getInvoices());
  const [vouchers, setVouchers] = useState<Voucher[]>(() => pharmacyStorage.getVouchers());

  // Refresh all state from storage
  const refreshAllState = useCallback(() => {
    setSettings(pharmacyStorage.getSettings());
    setProducts(pharmacyStorage.getProducts());
    setCategories(pharmacyStorage.getCategories());
    setManufacturers(pharmacyStorage.getManufacturers());
    setIngredients(pharmacyStorage.getIngredients());
    setBanks(pharmacyStorage.getBanks());
    setCustomers(pharmacyStorage.getCustomers());
    setSuppliers(pharmacyStorage.getSuppliers());
    setInvoices(pharmacyStorage.getInvoices());
    setVouchers(pharmacyStorage.getVouchers());
  }, []);

  // Scanner & Modal States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isContinuousScannerOn, setIsContinuousScannerOn] = useState(false);
  const [isDeviceLinkOpen, setIsDeviceLinkOpen] = useState(false);
  const [isStockAuditOpen, setIsStockAuditOpen] = useState(false);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scannedBarcodeTarget, setScannedBarcodeTarget] = useState<((code: string) => void) | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);

  // URL Params & Multi-Device Pharmacy Setup Modal
  const [urlParams] = useState(() => getUrlParams());
  const [isAutoJoining, setIsAutoJoining] = useState<boolean>(false);
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null);
  const [revokedNotice, setRevokedNotice] = useState<boolean>(false);

  const [isPharmacySetupOpen, setIsPharmacySetupOpen] = useState<boolean>(() => {
    return !firebaseSync.isLinked() && !urlParams.wid;
  });

  // Automatic Join when scanning QR Code URL
  useEffect(() => {
    const { wid, code } = urlParams;
    if (wid && code) {
      const currentWid = firebaseSync.getWorkspaceId();
      if (currentWid === wid) {
        setIsPharmacySetupOpen(false);
        const cleanUrl = window.location.origin + window.location.pathname + '#/pos';
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }

      setIsAutoJoining(true);
      setAutoJoinError(null);
      console.log(`PharmaCare: Auto-joining workspace ${wid} via URL barcode parameters...`);

      firebaseSync.joinWorkspace(wid, code)
        .then(() => {
          playSuccess();
          setIsAutoJoining(false);
          setIsPharmacySetupOpen(false);
          refreshAllState();
          const cleanUrl = window.location.origin + window.location.pathname + '#/pos';
          window.history.replaceState({}, document.title, cleanUrl);
        })
        .catch((err: any) => {
          console.error('Auto join failed:', err);
          playError();
          setIsAutoJoining(false);
          setAutoJoinError(err.message || 'فشل الانضمام التلقائي عبر الباركود');
          setIsPharmacySetupOpen(true);
        });
    }
  }, [urlParams, refreshAllState]);

  // Listen to remote expulsion / membership revocation
  useEffect(() => {
    const unsubRevoked = firebaseSync.onDeviceRevoked(() => {
      playError();
      setRevokedNotice(true);
      setIsPharmacySetupOpen(true);
      refreshAllState();
    });
    return () => unsubRevoked();
  }, [refreshAllState]);

  // Heartbeat interval (updates lastSeen every 2 minutes when online)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        firebaseSync.updateHeartbeat().catch(() => {});
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCustomerDisplay = () => {
    if (typeof window !== 'undefined') {
      const displayUrl = `${window.location.origin}${window.location.pathname}#/customer-display`;
      const win = window.open(displayUrl, 'pharmacare_customer_display', 'width=1024,height=768');
      if (!win) {
        setIsCustomerDisplayOpen(true);
      }
    } else {
      setIsCustomerDisplayOpen(true);
    }
  };

  // Sync Dark Mode with document
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Listen to Firestore real-time sync updates across devices, remote data pull, and periodic silent cloud backup
  useEffect(() => {
    // 1. Real-Time onSnapshot subscriptions across devices
    const unsubProducts = subscribeToProducts((cloudProds) => {
      pharmacyStorage.mergeRemoteProducts(cloudProds);
      setProducts(pharmacyStorage.getProducts());
    });

    const unsubCategories = subscribeToCategories((cloudCats) => {
      pharmacyStorage.mergeRemoteCategories(cloudCats);
      setCategories(pharmacyStorage.getCategories());
    });

    const unsubManufacturers = subscribeToManufacturers((cloudMans) => {
      pharmacyStorage.mergeRemoteManufacturers(cloudMans);
      setManufacturers(pharmacyStorage.getManufacturers());
    });

    const unsubIngredients = subscribeToIngredients((cloudIngs) => {
      pharmacyStorage.mergeRemoteIngredients(cloudIngs);
      setIngredients(pharmacyStorage.getIngredients());
    });

    const unsubInvoices = subscribeToInvoices((cloudInvs) => {
      pharmacyStorage.mergeRemoteInvoices(cloudInvs);
      setInvoices(pharmacyStorage.getInvoices());
    });

    const unsubPurchases = subscribeToPurchases((cloudPurs) => {
      pharmacyStorage.mergeRemotePurchases(cloudPurs);
    });

    const unsubCustomers = subscribeToCustomers((cloudCusts) => {
      pharmacyStorage.mergeRemoteCustomers(cloudCusts);
      setCustomers(pharmacyStorage.getCustomers());
    });

    const unsubSuppliers = subscribeToSuppliers((cloudSups) => {
      pharmacyStorage.mergeRemoteSuppliers(cloudSups);
      setSuppliers(pharmacyStorage.getSuppliers());
    });

    const unsubVouchers = subscribeToVouchers((cloudVouchs) => {
      pharmacyStorage.mergeRemoteVouchers(cloudVouchs);
      setVouchers(pharmacyStorage.getVouchers());
    });

    const unsubBanks = subscribeToBanks((cloudBanks) => {
      pharmacyStorage.mergeRemoteBanks(cloudBanks);
      setBanks(pharmacyStorage.getBanks());
    });

    const unsubMovements = subscribeToStockMovements((cloudMovs) => {
      pharmacyStorage.mergeRemoteStockMovements(cloudMovs);
    });

    const unsubSettings = subscribeToSettings((cloudSettings) => {
      pharmacyStorage.mergeRemoteSettings(cloudSettings);
      setSettings(pharmacyStorage.getSettings());
    });

    const unsubscribePulled = firebaseSync.onDataPulled(() => {
      refreshAllState();
    });

    const unsubscribeSync = firebaseSync.onStatusChange((status) => {
      if (status === 'synced') {
        refreshAllState();
      }
    });

    const unsubscribePharma = firebaseSync.onPharmacyChange((pid) => {
      setIsPharmacySetupOpen(!pid);
      refreshAllState();
    });

    // Check automated daily silent cloud snapshot backup on load
    checkAndRunScheduledBackup().catch((e) => console.log('Scheduled backup auto check:', e));

    const handleOnline = () => {
      checkAndRunScheduledBackup().catch(() => {});
      firebaseSync.syncNow().catch(() => {});
    };
    window.addEventListener('online', handleOnline);

    // Schedule background backup every 6 hours while app remains active
    const interval = setInterval(() => {
      checkAndRunScheduledBackup().catch(() => {});
    }, 6 * 60 * 60 * 1000);

    return () => {
      unsubProducts();
      unsubCategories();
      unsubManufacturers();
      unsubIngredients();
      unsubInvoices();
      unsubPurchases();
      unsubCustomers();
      unsubSuppliers();
      unsubVouchers();
      unsubBanks();
      unsubMovements();
      unsubSettings();
      unsubscribePulled();
      unsubscribeSync();
      unsubscribePharma();
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshAllState]);

  // Settings update
  const handleUpdateSettings = (newSettings: Settings) => {
    pharmacyStorage.saveSettings(newSettings);
    setSettings(newSettings);
  };

  // Toggle Magic Eye
  const handleToggleMagicEye = () => {
    const updated: Settings = {
      ...settings,
      hideCostAndProfit: !settings.hideCostAndProfit,
    };
    handleUpdateSettings(updated);
  };

  // Toggle Sound
  const handleToggleSound = () => {
    const isEnabled = settings.soundEnabled ?? settings.enableScannerSound;
    const updated: Settings = {
      ...settings,
      soundEnabled: !isEnabled,
      enableScannerSound: !isEnabled,
    };
    handleUpdateSettings(updated);
  };

  const isSoundOn = settings.soundEnabled ?? settings.enableScannerSound ?? true;

  // 1. POS Actions
  const handleSaveInvoice = (invoice: Invoice, printAfterSave?: boolean) => {
    pharmacyStorage.createInvoice(invoice);
    refreshAllState();
    if (isSoundOn) playSuccess();
    if (printAfterSave) {
      setPrintingInvoice(invoice);
    }
  };

  const handleSavePurchase = (purchase: Purchase) => {
    pharmacyStorage.createPurchase(purchase);
    refreshAllState();
    if (isSoundOn) playSuccess();
  };

  const handleSaveSalesReturnInvoice = (invoice: Invoice) => {
    pharmacyStorage.createInvoice(invoice);
    refreshAllState();
    if (isSoundOn) playSuccess();
    setPrintingInvoice(invoice);
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    setPrintingInvoice(invoice);
  };

  // 2. Product Actions
  const handleSaveProduct = (prod: Product) => {
    pharmacyStorage.saveProduct(prod);
    setProducts(pharmacyStorage.getProducts());
    if (isSoundOn) playSuccess();
  };

  const handleDeleteProduct = (id: string) => {
    pharmacyStorage.deleteProduct(id);
    setProducts(pharmacyStorage.getProducts());
  };

  const handleSaveCategory = (cat: Category) => {
    pharmacyStorage.saveCategory(cat);
    setCategories(pharmacyStorage.getCategories());
  };

  const handleDeleteCategory = (id: string) => {
    pharmacyStorage.deleteCategory(id);
    setCategories(pharmacyStorage.getCategories());
  };

  const handleSaveManufacturer = (mfr: Manufacturer) => {
    pharmacyStorage.saveManufacturer(mfr);
    setManufacturers(pharmacyStorage.getManufacturers());
  };

  const handleDeleteManufacturer = (id: string) => {
    pharmacyStorage.deleteManufacturer(id);
    setManufacturers(pharmacyStorage.getManufacturers());
  };

  const handleSaveIngredient = (ing: Ingredient) => {
    pharmacyStorage.saveIngredient(ing);
    setIngredients(pharmacyStorage.getIngredients());
  };

  const handleDeleteIngredient = (id: string) => {
    pharmacyStorage.deleteIngredient(id);
    setIngredients(pharmacyStorage.getIngredients());
  };

  // 3. Bank Actions
  const handleSaveBank = (bank: Bank) => {
    pharmacyStorage.saveBank(bank);
    setBanks(pharmacyStorage.getBanks());
    if (isSoundOn) playSuccess();
  };

  const handleDeleteBank = (id: string) => {
    pharmacyStorage.deleteBank(id);
    setBanks(pharmacyStorage.getBanks());
  };

  // 4. Customer & Supplier Actions
  const handleSaveCustomer = (cust: Customer) => {
    pharmacyStorage.saveCustomer(cust);
    setCustomers(pharmacyStorage.getCustomers());
    if (isSoundOn) playSuccess();
  };

  const handleDeleteCustomer = (id: string) => {
    pharmacyStorage.deleteCustomer(id);
    setCustomers(pharmacyStorage.getCustomers());
  };

  const handleSaveSupplier = (sup: Supplier) => {
    pharmacyStorage.saveSupplier(sup);
    setSuppliers(pharmacyStorage.getSuppliers());
    if (isSoundOn) playSuccess();
  };

  const handleDeleteSupplier = (id: string) => {
    pharmacyStorage.deleteSupplier(id);
    setSuppliers(pharmacyStorage.getSuppliers());
  };

  // 5. Invoices Management
  const handleCancelInvoice = (id: string) => {
    pharmacyStorage.cancelInvoice(id);
    refreshAllState();
    if (isSoundOn) playError();
  };

  const handleReactivateInvoice = (id: string) => {
    pharmacyStorage.reactivateInvoice(id);
    refreshAllState();
    if (isSoundOn) playSuccess();
  };

  const handleDeleteInvoice = (id: string) => {
    pharmacyStorage.deleteInvoice(id);
    setInvoices(pharmacyStorage.getInvoices());
  };

  // 6. Vouchers Management
  const handleSaveVoucher = (voucher: Voucher) => {
    pharmacyStorage.saveVoucher(voucher);
    refreshAllState();
    if (isSoundOn) playSuccess();
  };

  const handleDeleteVoucher = (id: string) => {
    pharmacyStorage.deleteVoucher(id);
    refreshAllState();
  };

  // 7. Backup & Export / Import / Reset / 5000 Items
  // Quick cloud backup to Google Drive Web App
  const handleQuickCloudBackup = async () => {
    try {
      const res = await uploadBackupToDrive(false);
      if (isSoundOn) playSuccess();
      alert(`تم حفظ النسخة بنجاح في Google Drive: ${res.fileName}`);
    } catch (e: any) {
      alert('تنبيه: ' + (e?.message || 'يرجى ضبط رابط Web App ورمز الأمان في الإعدادات'));
    }
  };

  const handleExportBackup = () => {
    const jsonStr = pharmacyStorage.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pharmacare-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (isSoundOn) playSuccess();
  };

  const handleImportBackup = (jsonString: string): boolean => {
    const success = pharmacyStorage.importBackupJSON(jsonString);
    if (success) {
      refreshAllState();
      if (isSoundOn) playSuccess();
    }
    return success;
  };

  const handleResetDatabase = () => {
    pharmacyStorage.resetToFactoryDefaults();
    refreshAllState();
    if (isSoundOn) playSuccess();
  };

  const handleGenerate5000Items = () => {
    pharmacyStorage.generate5000Items();
    refreshAllState();
    if (isSoundOn) playSuccess();
    alert('تم توليد 5,000 صنف بنجاح! التطبيق جاهز للبحث فائق السرعة.');
  };

  // Scanner Open Helper
  const openScanner = (onScanCallback?: (code: string) => void) => {
    if (onScanCallback) {
      setScannedBarcodeTarget(() => onScanCallback);
    } else {
      setScannedBarcodeTarget(null);
    }
    setIsScannerOpen(true);
  };

  const handleBarcodeScanned = (code: string) => {
    if (isSoundOn) playBeep();
    if (scannedBarcodeTarget) {
      scannedBarcodeTarget(code);
    } else {
      setScannedBarcode(code);
    }
    setIsScannerOpen(false);
  };

  // Hardware Barcode Scanner Listener (USB / Bluetooth barcode gun)
  useHardwareBarcodeScanner({
    onScan: (barcode) => {
      if (isSoundOn) playBeep();
      if (scannedBarcodeTarget) {
        scannedBarcodeTarget(barcode);
      } else {
        setScannedBarcode(barcode);
      }
    },
    enabled: true,
  });

  // Dual Customer-Facing Screen Route or Modal
  const isCustomerDisplayRoute = typeof window !== 'undefined' && window.location.hash.includes('customer-display');
  if (isCustomerDisplayRoute || isCustomerDisplayOpen) {
    return (
      <CustomerDisplayView
        settings={settings}
        onClose={() => {
          setIsCustomerDisplayOpen(false);
          if (typeof window !== 'undefined' && window.location.hash.includes('customer-display')) {
            window.location.hash = '#/pos';
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 font-sans pb-16 lg:pb-0" dir="rtl">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        settings={settings}
        onToggleHideProfit={handleToggleMagicEye}
        onToggleSound={handleToggleSound}
        onOpenScanner={() => openScanner()}
        onQuickBackup={handleQuickCloudBackup}
        isContinuousScannerOn={isContinuousScannerOn}
        onToggleContinuousScanner={() => setIsContinuousScannerOn((prev) => !prev)}
        onOpenDeviceLink={() => setIsDeviceLinkOpen(true)}
        onOpenStockAudit={() => setIsStockAuditOpen(true)}
        onOpenCustomerDisplay={handleOpenCustomerDisplay}
        cartCount={0}
      />

      {/* Main View Area */}
      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-4">
        {activeTab === 'pos' && (
          <POSView
            products={products}
            categories={categories}
            manufacturers={manufacturers}
            ingredients={ingredients}
            customers={customers}
            banks={banks}
            settings={settings}
            onSaveInvoice={handleSaveInvoice}
            onOpenScanner={() => openScanner()}
            scannedBarcode={scannedBarcode}
            onClearScannedBarcode={() => setScannedBarcode(null)}
            findAlternatives={(p) => pharmacyStorage.findAlternatives(p)}
            isContinuousScannerOn={isContinuousScannerOn}
            onToggleContinuousScanner={() => setIsContinuousScannerOn((prev) => !prev)}
            onOpenCustomerDisplay={handleOpenCustomerDisplay}
          />
        )}

        {activeTab === 'sales_returns' && (
          <SalesReturnsView
            products={products}
            customers={customers}
            banks={banks}
            invoices={invoices}
            settings={settings}
            onSaveReturnInvoice={handleSaveSalesReturnInvoice}
          />
        )}

        {activeTab === 'purchases' && (
          <PurchasesView
            defaultType="purchase"
            products={products}
            suppliers={suppliers}
            customers={customers}
            banks={banks}
            purchases={pharmacyStorage.getPurchases()}
            settings={settings}
            onSavePurchase={handleSavePurchase}
            onCancelPurchase={(id) => { pharmacyStorage.cancelPurchase(id); refreshAllState(); }}
          />
        )}

        {activeTab === 'purchase_returns' && (
          <PurchasesView
            defaultType="purchase_return"
            products={products}
            suppliers={suppliers}
            customers={customers}
            banks={banks}
            purchases={pharmacyStorage.getPurchases()}
            settings={settings}
            onSavePurchase={handleSavePurchase}
            onCancelPurchase={(id) => { pharmacyStorage.cancelPurchase(id); refreshAllState(); }}
          />
        )}

        {activeTab === 'products' && (
          <ProductsView
            products={products}
            categories={categories}
            manufacturers={manufacturers}
            ingredients={ingredients}
            settings={settings}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onSaveIngredient={handleSaveIngredient}
            onDeleteIngredient={handleDeleteIngredient}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onSaveManufacturer={handleSaveManufacturer}
            onDeleteManufacturer={handleDeleteManufacturer}
            onOpenScanner={(cb) => openScanner(cb)}
            scannedBarcode={scannedBarcode}
            onClearScannedBarcode={() => setScannedBarcode(null)}
          />
        )}

        {activeTab === 'banks' && (
          <BanksWalletsView
            banks={banks}
            onSaveBank={handleSaveBank}
            onDeleteBank={handleDeleteBank}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersSuppliersView
            customers={customers}
            suppliers={suppliers}
            invoices={invoices}
            vouchers={vouchers}
            settings={settings}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onSaveSupplier={handleSaveSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onQuickVoucher={handleSaveVoucher}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            settings={settings}
            onPrintInvoice={handlePrintInvoice}
            onCancelInvoice={handleCancelInvoice}
            onReactivateInvoice={handleReactivateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        )}

        {activeTab === 'vouchers' && (
          <VouchersView
            vouchers={vouchers}
            customers={customers}
            suppliers={suppliers}
            banks={banks}
            settings={settings}
            onSaveVoucher={handleSaveVoucher}
            onDeleteVoucher={handleDeleteVoucher}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            invoices={invoices}
            products={products}
            categories={categories}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onResetDatabase={handleResetDatabase}
            onGenerate5000Items={handleGenerate5000Items}
            totalProductsCount={products.length}
            onRefreshData={refreshAllState}
          />
        )}
      </main>

      {/* Global Barcode Scanner Camera Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Global Thermal Receipt Preview & Printing Modal */}
      {printingInvoice && (
        <ThermalReceipt
          invoice={printingInvoice}
          settings={settings}
          onClose={() => setPrintingInvoice(null)}
        />
      )}

      {/* Global Continuous Background Barcode Scanner Widget */}
      <ContinuousScannerWidget
        isActive={isContinuousScannerOn}
        onToggleActive={setIsContinuousScannerOn}
        onBarcodeDetected={(code) => {
          if (scannedBarcodeTarget) {
            scannedBarcodeTarget(code);
          } else {
            setScannedBarcode(code);
          }
        }}
        soundEnabled={isSoundOn}
      />

      {/* Multi-Device QR Code Link Modal */}
      <DeviceLinkModal
        isOpen={isDeviceLinkOpen}
        onClose={() => setIsDeviceLinkOpen(false)}
        products={products}
      />

      {/* First-Launch / Multi-Device Pharmacy Setup Modal */}
      <PharmacySetupModal
        isOpen={isPharmacySetupOpen && !isAutoJoining}
        onSuccess={() => {
          setIsPharmacySetupOpen(false);
          refreshAllState();
        }}
        initialPharmacyId={urlParams.wid || ''}
        initialJoinCode={urlParams.code || ''}
      />

      {/* Auto-Joining Splash Overlay on Barcode Scan */}
      {isAutoJoining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4" dir="rtl">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-sky-50 dark:bg-sky-950/60 rounded-2xl flex items-center justify-center mx-auto text-sky-600">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
              جارٍ ربط هذا الجهاز بالصيدلية تلقائياً...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تم اكتشاف باركود الربط. يتم الآن تهيئة الاتصال ومزامنة الأصناف ومخزون الأدوية.
            </p>
            {autoJoinError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold">
                {autoJoinError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expulsion / Remote Logout Notice Modal */}
      {revokedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4" dir="rtl">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-rose-200 dark:border-rose-900/60 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
              تم إنهاء صلاحية هذا الجهاز عن بُعد 🚫
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              قام مالك أو مسؤول الصيدلية بحذف أو طرد هذا الجهاز من قائمة الأجهزة المصرح لها (Members).
              تم مسح بيانات الدخول السحابية لحماية الصيدلية والعودة لشاشة البداية.
            </p>
            <button
              type="button"
              onClick={() => setRevokedNotice(false)}
              className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all"
            >
              فهمت، الانتقال لشاشة البداية
            </button>
          </div>
        </div>
      )}

      {/* Quick Mobile Camera Stock Audit Modal */}
      <QuickStockAuditModal
        isOpen={isStockAuditOpen}
        onClose={() => setIsStockAuditOpen(false)}
        products={products}
        onCompleteAudit={refreshAllState}
      />

      {/* Connectivity & Offline Notification Banner */}
      <OfflineIndicator />
    </div>
  );
}
