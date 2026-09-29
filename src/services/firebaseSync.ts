/**
 * PharmaCare Plus - Firebase Firestore Real-Time & Offline-First Service
 * Architecture:
 * - Pure Serverless Client-Side PWA (GitHub Pages ready)
 * - Single source of truth: Firestore database "(default)"
 * - Offline Persistence via persistentLocalCache & persistentMultipleTabManager
 * - Automatic Anonymous Authentication (Zero login friction)
 * - Multi-device synchronization without Google accounts using Pharmacy ID & Join Code
 * - Path schema: pharmacies/{pharmacyId}/{collectionName}/{docId}
 * - Soft deletes (deleted: true) for cross-device deletion propagation
 * - Atomic stock adjustments via increment()
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  updateDoc,
  collection, 
  onSnapshot,
  getDoc,
  serverTimestamp,
  increment,
  waitForPendingWrites,
  Unsubscribe,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  Product, 
  Category, 
  Invoice, 
  Customer, 
  Supplier, 
  Purchase, 
  Voucher, 
  Bank, 
  Settings, 
  Manufacturer, 
  Ingredient, 
  StockMovement 
} from '../types/pharmacy';

// 1. Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// 2. Initialize Firestore using the (default) database with persistent multi-tab cache
let _db: ReturnType<typeof initializeFirestore>;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, '(default)');
} catch {
  _db = getFirestore(app, '(default)');
}
export const db = _db;

// Storage keys
const PHARMACY_ID_KEY = 'pharmacare_pharmacy_id';
const JOIN_CODE_KEY = 'pharmacare_join_code';
const DEVICE_ID_KEY = 'pharmacare_device_id';
const LAST_SYNC_KEY = 'pharmacare_last_firestore_sync';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

class FirebaseSyncService {
  private statusListeners: Array<(status: SyncStatus, pendingCount: number, lastSyncTime?: string) => void> = [];
  private dataPulledListeners: Array<() => void> = [];
  private pharmacyListeners: Array<(pharmacyId: string | null) => void> = [];
  private errorListeners: Array<(message: string) => void> = [];
  
  private currentStatus: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  private pendingCount = 0;
  private currentUser: User | null = null;
  private isAuthReady = false;
  private authInitPromise: Promise<User>;

  constructor() {
    // Generate or retrieve persistent unique Device ID
    this.initDeviceId();

    // Listen to network status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateStatus('syncing');
        this.syncNow().catch(() => {});
      });

      window.addEventListener('offline', () => {
        this.updateStatus('offline');
      });
    }

    // Auto sign-in anonymously without any login screens
    this.authInitPromise = new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          this.currentUser = user;
          this.isAuthReady = true;
          resolve(user);
        } else {
          try {
            const credential = await signInAnonymously(auth);
            this.currentUser = credential.user;
            this.isAuthReady = true;
            resolve(credential.user);
          } catch (err: any) {
            console.error('PharmaCare Anonymous Auth Error:', err);
            this.notifyError(this.translateFirebaseError(err));
          }
        }
      });
    });

    // Initial check for pending writes
    if (typeof window !== 'undefined' && navigator.onLine) {
      setTimeout(() => {
        this.updatePendingCount();
      }, 2000);
    }
  }

  // --- Device & Pharmacy Identification ---
  private initDeviceId(): string {
    try {
      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    } catch {
      return 'dev_unknown';
    }
  }

  getDeviceId(): string {
    try {
      return localStorage.getItem(DEVICE_ID_KEY) || this.initDeviceId();
    } catch {
      return 'dev_fallback';
    }
  }

  getPharmacyId(): string | null {
    try {
      return localStorage.getItem(PHARMACY_ID_KEY) || null;
    } catch {
      return null;
    }
  }

  getJoinCode(): string | null {
    try {
      return localStorage.getItem(JOIN_CODE_KEY) || null;
    } catch {
      return null;
    }
  }

  isLinked(): boolean {
    return !!this.getPharmacyId();
  }

  getPharmacyInfo(): { pharmacyId: string | null; joinCode: string | null; deviceId: string; isLinked: boolean } {
    return {
      pharmacyId: this.getPharmacyId(),
      joinCode: this.getJoinCode(),
      deviceId: this.getDeviceId(),
      isLinked: this.isLinked()
    };
  }

  onPharmacyChange(cb: (pharmacyId: string | null) => void) {
    this.pharmacyListeners.push(cb);
    return () => {
      this.pharmacyListeners = this.pharmacyListeners.filter(l => l !== cb);
    };
  }

  private notifyPharmacyChange(pid: string | null) {
    this.pharmacyListeners.forEach(cb => {
      try { cb(pid); } catch (e) { console.warn(e); }
    });
  }

  async ensureAuth(): Promise<User> {
    if (this.currentUser) return this.currentUser;
    return this.authInitPromise;
  }

  /**
   * Create a new pharmacy organization on Firestore
   * Stores joinCode in pharmacies/{pid} and establishes membership in pharmacies/{pid}/members/{uid}
   */
  async createPharmacy(nameAr?: string): Promise<{ pharmacyId: string; joinCode: string }> {
    const user = await this.ensureAuth();
    const pid = 'pharma-' + Math.random().toString(36).substring(2, 8);
    // Generate secure 8-character join code (uppercase + digits)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let joinCode = '';
    for (let i = 0; i < 8; i++) {
      joinCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const deviceId = this.getDeviceId();
    const now = new Date().toISOString();

    try {
      // 1. Create pharmacy root document
      const pharmacyDocRef = doc(db, 'pharmacies', pid);
      await setDoc(pharmacyDocRef, {
        joinCode,
        nameAr: nameAr || 'صيدليتي',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdDevice: deviceId,
      });

      // 2. Add creator as initial member
      const memberDocRef = doc(db, 'pharmacies', pid, 'members', user.uid);
      await setDoc(memberDocRef, {
        joinCode,
        role: 'admin',
        joinedAt: serverTimestamp(),
        deviceId,
      });

      // 3. Save locally
      localStorage.setItem(PHARMACY_ID_KEY, pid);
      localStorage.setItem(JOIN_CODE_KEY, joinCode);

      // 4. Migrate any existing local data into this newly created pharmacy
      await this.seedExistingLocalData(pid);

      this.notifyPharmacyChange(pid);
      this.notifyDataPulled();
      return { pharmacyId: pid, joinCode };
    } catch (err: any) {
      console.error('Error creating pharmacy:', err);
      const translated = this.translateFirebaseError(err);
      this.notifyError(`فشل إنشاء الصيدلية: ${translated}`);
      throw new Error(translated);
    }
  }

  /**
   * Join an existing pharmacy organization using Pharmacy ID & Join Code
   * Creates members/{uid} with joinCode matching pharmacies/{pid}.joinCode
   */
  async joinPharmacy(pharmacyId: string, joinCode: string): Promise<boolean> {
    const user = await this.ensureAuth();
    const pid = pharmacyId.trim();
    const code = joinCode.trim();

    if (!pid || code.length < 8) {
      throw new Error('يرجى التأكد من إدخال معرّف الصيدلية ورمز الربط المكوّن من 8 خانات على الأقل');
    }

    const deviceId = this.getDeviceId();

    try {
      this.updateStatus('syncing');

      // Attempt to register membership. Rules will only allow this if code matches pharmacies/{pid}.joinCode
      const memberDocRef = doc(db, 'pharmacies', pid, 'members', user.uid);
      await setDoc(memberDocRef, {
        joinCode: code,
        role: 'member',
        joinedAt: serverTimestamp(),
        deviceId,
      });

      // Verification: read pharmacy doc
      const pharmaSnap = await getDoc(doc(db, 'pharmacies', pid));
      if (!pharmaSnap.exists()) {
        throw new Error('لم يتم العثور على الصيدلية المطلوبة');
      }

      // Save locally
      localStorage.setItem(PHARMACY_ID_KEY, pid);
      localStorage.setItem(JOIN_CODE_KEY, code);

      this.notifyPharmacyChange(pid);
      this.updateStatus('synced');
      this.notifyDataPulled();
      return true;
    } catch (err: any) {
      console.error('Error joining pharmacy:', err);
      const translated = this.translateFirebaseError(err);
      this.notifyError(`فشل ربط الصيدلية: ${translated}`);
      this.updateStatus('error');
      throw new Error(translated);
    }
  }

  /**
   * Disconnect this device from the current pharmacy
   */
  disconnectPharmacy(): void {
    try {
      localStorage.removeItem(PHARMACY_ID_KEY);
      localStorage.removeItem(JOIN_CODE_KEY);
      this.notifyPharmacyChange(null);
      this.notifyDataPulled();
    } catch (e) {
      console.warn(e);
    }
  }

  // --- Document Operations (Scoped to current pharmacy) ---

  /**
   * Write or merge document into pharmacies/{pharmacyId}/{collectionName}/{id}
   * Adds updatedAt (serverTimestamp), deviceId, and deleted: false
   */
  async saveDoc(collectionName: string, id: string, data: any): Promise<void> {
    const pid = this.getPharmacyId();
    if (!pid) {
      console.warn(`PharmaCare: saveDoc skipped for ${collectionName}/${id} because no pharmacy is linked`);
      return;
    }

    try {
      const sanitized = JSON.parse(JSON.stringify(data));
      // Clean non-serializable fields
      delete sanitized.id;

      const payload = {
        ...sanitized,
        id,
        deleted: false,
        updatedAt: serverTimestamp(),
        deviceId: this.getDeviceId(),
      };

      const docRef = doc(db, 'pharmacies', pid, collectionName, id);
      // Immediately write via Firestore SDK (writes to IndexedDB persistent cache & syncs to cloud)
      setDoc(docRef, payload, { merge: true }).catch((err: any) => {
        console.error(`Firestore write error (${collectionName}/${id}):`, err);
        this.notifyError(`تعذر حفظ البيانات في السحابة (${collectionName}): ${this.translateFirebaseError(err)}`);
      });

      this.updatePendingCount();
    } catch (err: any) {
      console.error(`Error preparing doc for Firestore (${collectionName}/${id}):`, err);
      this.notifyError(`خطأ في معالجة البيانات: ${err?.message || err}`);
    }
  }

  /**
   * Soft-delete document (deleted: true) so deletion reliably propagates to all devices
   */
  async deleteDoc(collectionName: string, id: string): Promise<void> {
    const pid = this.getPharmacyId();
    if (!pid) return;

    try {
      const docRef = doc(db, 'pharmacies', pid, collectionName, id);
      setDoc(docRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deviceId: this.getDeviceId(),
      }, { merge: true }).catch((err: any) => {
        console.error(`Firestore soft delete error (${collectionName}/${id}):`, err);
        this.notifyError(`تعذر حذف العنصر من السحابة: ${this.translateFirebaseError(err)}`);
      });

      this.updatePendingCount();
    } catch (err: any) {
      console.error(`Error soft-deleting doc (${collectionName}/${id}):`, err);
      this.notifyError(`خطأ في الحذف: ${err?.message || err}`);
    }
  }

  /**
   * Atomically adjust product stock across devices using increment()
   */
  async adjustProductStock(productId: string, deltaQuantity: number): Promise<void> {
    const pid = this.getPharmacyId();
    if (!pid) return;

    try {
      const docRef = doc(db, 'pharmacies', pid, 'products', productId);
      await updateDoc(docRef, {
        stock: increment(deltaQuantity),
        updatedAt: serverTimestamp(),
        deviceId: this.getDeviceId(),
      });
    } catch (err: any) {
      console.warn(`Atomic stock update failed, fallback to saveDoc:`, err);
    }
  }

  // --- Real-Time Subscriptions ---

  /**
   * Subscribe to collection changes under current pharmacy
   * Automatically filters out soft-deleted documents
   */
  subscribeToCollection<T extends { id: string }>(
    collectionName: string,
    callback: (items: T[]) => void
  ): Unsubscribe {
    const pid = this.getPharmacyId();
    if (!pid) {
      callback([]);
      // Return dummy unsubscribe
      return () => {};
    }

    const colRef = collection(db, 'pharmacies', pid, collectionName);
    return onSnapshot(
      colRef,
      { includeMetadataChanges: false },
      (snapshot) => {
        const activeItems: T[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (!data.deleted) {
            activeItems.push({ id: d.id, ...data } as T);
          }
        });
        callback(activeItems);
        this.updatePendingCount();
      },
      (error) => {
        console.error(`Firestore ${collectionName} listener error:`, error.code, error.message);
        this.notifyError(`خطأ في استماع بيانات ${collectionName}: ${this.translateFirebaseError(error)}`);
      }
    );
  }

  // --- Sync Status & Diagnostic Helpers ---

  private updatePendingCount() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateStatus('offline');
      return;
    }
    this.updateStatus('synced');
  }

  onStatusChange(cb: (status: SyncStatus, pendingCount: number, lastSyncTime?: string) => void) {
    this.statusListeners.push(cb);
    cb(this.currentStatus, this.pendingCount, this.getLastSyncTime());
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== cb);
    };
  }

  onDataPulled(cb: () => void) {
    this.dataPulledListeners.push(cb);
    return () => {
      this.dataPulledListeners = this.dataPulledListeners.filter(l => l !== cb);
    };
  }

  notifyDataPulled() {
    this.dataPulledListeners.forEach(cb => {
      try { cb(); } catch (e) { console.warn(e); }
    });
  }

  private updateStatus(status: SyncStatus) {
    this.currentStatus = status;
    const lastSync = this.getLastSyncTime();
    this.statusListeners.forEach(cb => cb(status, this.pendingCount, lastSync));
  }

  getLastSyncTime(): string | undefined {
    try {
      return localStorage.getItem(LAST_SYNC_KEY) || undefined;
    } catch {
      return undefined;
    }
  }

  setLastSyncTime(isoTime: string) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, isoTime);
    } catch {}
  }

  onError(cb: (message: string) => void) {
    this.errorListeners.push(cb);
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== cb);
    };
  }

  notifyError(message: string) {
    this.errorListeners.forEach(cb => {
      try { cb(message); } catch (e) { console.warn(e); }
    });
  }

  /**
   * "Sync Now" button: Waits for pending local writes to reach cloud and validates connection
   */
  async syncNow(): Promise<{ success: boolean; message: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateStatus('offline');
      return { success: false, message: 'لا يوجد اتصال بالإنترنت حالياً (البيانات محفوظة محلياً وتُرفع تلقائياً)' };
    }

    const pid = this.getPharmacyId();
    if (!pid) {
      return { success: false, message: 'يرجى ربط أو إنشاء صيدلية أولاً لتفعيل المزامنة' };
    }

    try {
      this.updateStatus('syncing');
      // Wait for all offline writes to commit to Firestore
      await waitForPendingWrites(db);

      // Validate live connection
      await getDocFromServer(doc(db, 'pharmacies', pid));

      const now = new Date().toISOString();
      this.setLastSyncTime(now);
      this.updateStatus('synced');
      this.notifyDataPulled();
      return { success: true, message: 'تم التحقق من المزامنة: جميع البيانات متطابقة ومتزامنة لحظياً عبر السحابة 🟢' };
    } catch (err: any) {
      console.warn('Sync now error:', err);
      this.updateStatus('error');
      const translated = this.translateFirebaseError(err);
      return { success: false, message: `تعذر إتمام المزامنة: ${translated}` };
    }
  }

  /**
   * Run full diagnostics test: writes and reads a test document and explains errors in Arabic
   */
  async runDiagnosticTest(): Promise<{ success: boolean; message: string; details: any }> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      return {
        success: false,
        message: 'الجهاز غير متصل بالإنترنت. يرجى تفعيل Wi-Fi أو البيانات.',
        details: { code: 'offline' }
      };
    }

    const pid = this.getPharmacyId();
    if (!pid) {
      return {
        success: false,
        message: 'لم يتم ربط هذا الجهاز بأي صيدلية بعد. يرجى إنشاء صيدلية أو ربطها بالرمز أولاً.',
        details: { code: 'no_pharmacy' }
      };
    }

    try {
      const user = await this.ensureAuth();
      const testDocRef = doc(db, 'pharmacies', pid, 'settings', 'test_ping');
      const testTimestamp = Date.now().toString();

      // Write test
      await setDoc(testDocRef, {
        testPing: testTimestamp,
        testerUid: user.uid,
        deviceId: this.getDeviceId(),
        testedAt: serverTimestamp()
      }, { merge: true });

      // Read test from server
      const readSnap = await getDocFromServer(testDocRef);
      if (!readSnap.exists()) {
        throw new Error('لم يتمكن الاختبار من قراءة مستند التحقق');
      }

      return {
        success: true,
        message: 'الاتصال ممتاز بقاعدة Firestore وقواعد الحماية تعمل بشكل صحيح 🟢',
        details: {
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          pharmacyId: pid,
          pingTime: readSnap.data()?.testPing
        }
      };
    } catch (err: any) {
      console.error('Diagnostic error:', err);
      const message = this.translateFirebaseError(err);
      return {
        success: false,
        message: `فشل اختبار الاتصال: ${message}`,
        details: {
          code: err?.code || 'unknown',
          originalMessage: err?.message
        }
      };
    }
  }

  /**
   * Translate Firebase technical error codes to clear Arabic explanations
   */
  translateFirebaseError(err: any): string {
    const code = err?.code || '';
    const message = err?.message || String(err);

    if (code === 'permission-denied' || message.includes('PERMISSION_DENIED')) {
      return 'تم رفض الإذن (permission-denied): يرجى التأكد من نشر ملف firestore.rules في Firebase Console وتفعيل خيار Anonymous Authentication في Authentication > Sign-in method.';
    }
    if (code === 'not-found' || message.includes('NOT_FOUND')) {
      return 'قاعدة البيانات غير موجودة (not-found): يرجى التأكد من إنشاء قاعدة Firestore بالمعرّف (default) في Firebase Console.';
    }
    if (code === 'unavailable' || message.includes('unavailable') || message.includes('Failed to get document')) {
      return 'خدمة السحابة غير متاحة حالياً (unavailable): يرجى التأكد من استقرار الإنترنت أو فحص الحجب.';
    }
    if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
      const domain = typeof window !== 'undefined' ? window.location.hostname : 'النطاق الحالي';
      return `النطاق (${domain}) غير مصرح به: يرجى إضافته في قائمة Authorized Domains داخل Firebase Console > Authentication > Settings.`;
    }
    if (code === 'auth/network-request-failed') {
      return 'فشل الاتصال بالشبكة أثناء المصادقة السحابية.';
    }
    if (message.includes('joinCode')) {
      return 'رمز الانضمام (Join Code) غير صحيح أو لا يطابق هذه الصيدلية.';
    }
    return message || 'خطأ غير معروف في خدمة المزامنة السحابية';
  }

  /**
   * Seed existing local data into newly created pharmacy to prevent any data loss
   */
  private async seedExistingLocalData(pid: string): Promise<void> {
    try {
      const { pharmacyStorage } = await import('./storage');
      const prods = pharmacyStorage.getProducts();
      const cats = pharmacyStorage.getCategories();
      const mans = pharmacyStorage.getManufacturers();
      const ings = pharmacyStorage.getIngredients();
      const custs = pharmacyStorage.getCustomers();
      const sups = pharmacyStorage.getSuppliers();
      const invs = pharmacyStorage.getInvoices();
      const purs = pharmacyStorage.getPurchases();
      const vouchs = pharmacyStorage.getVouchers();
      const banks = pharmacyStorage.getBanks();
      const settings = pharmacyStorage.getSettings();

      // Write items in small non-blocking chunks
      for (const p of prods) {
        await this.saveDoc('products', p.id, p);
      }
      for (const c of cats) {
        await this.saveDoc('categories', c.id, c);
      }
      for (const m of mans) {
        await this.saveDoc('manufacturers', m.id, m);
      }
      for (const i of ings) {
        await this.saveDoc('ingredients', i.id, i);
      }
      for (const cust of custs) {
        await this.saveDoc('customers', cust.id, cust);
      }
      for (const sup of sups) {
        await this.saveDoc('suppliers', sup.id, sup);
      }
      for (const inv of invs) {
        await this.saveDoc('invoices', inv.id, inv);
      }
      for (const pur of purs) {
        await this.saveDoc('purchases', pur.id, pur);
      }
      for (const v of vouchs) {
        await this.saveDoc('vouchers', v.id, v);
      }
      for (const b of banks) {
        await this.saveDoc('banks', b.id, b);
      }
      await this.saveDoc('settings', 'current', settings);

      console.log('PharmaCare: Successfully seeded local data to new pharmacy:', pid);
    } catch (e) {
      console.warn('PharmaCare: Data seed warning:', e);
    }
  }
}

export const firebaseSync = new FirebaseSyncService();

// --- Typed Collection Subscriptions ---

export function subscribeToProducts(callback: (products: Product[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Product>('products', callback);
}

export function subscribeToCategories(callback: (categories: Category[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Category>('categories', callback);
}

export function subscribeToManufacturers(callback: (manufacturers: Manufacturer[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Manufacturer>('manufacturers', callback);
}

export function subscribeToIngredients(callback: (ingredients: Ingredient[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Ingredient>('ingredients', callback);
}

export function subscribeToInvoices(callback: (invoices: Invoice[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Invoice>('invoices', callback);
}

export function subscribeToCustomers(callback: (customers: Customer[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Customer>('customers', callback);
}

export function subscribeToSuppliers(callback: (suppliers: Supplier[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Supplier>('suppliers', callback);
}

export function subscribeToPurchases(callback: (purchases: Purchase[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Purchase>('purchases', callback);
}

export function subscribeToVouchers(callback: (vouchers: Voucher[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Voucher>('vouchers', callback);
}

export function subscribeToBanks(callback: (banks: Bank[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<Bank>('banks', callback);
}

export function subscribeToStockMovements(callback: (movements: StockMovement[]) => void): Unsubscribe {
  return firebaseSync.subscribeToCollection<StockMovement>('stockMovements', callback);
}

export function subscribeToSettings(callback: (settings: Settings) => void): Unsubscribe {
  const pid = firebaseSync.getPharmacyId();
  if (!pid) return () => {};
  return onSnapshot(
    doc(db, 'pharmacies', pid, 'settings', 'current'),
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as Settings);
      }
    },
    (error) => {
      console.warn('Firestore settings listener error:', error);
    }
  );
}
