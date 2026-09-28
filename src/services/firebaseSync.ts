/**
 * Firebase Firestore Real-Time & Offline-First Bidirectional Sync Service
 * Guarantees zero-interruption pharmacy operations when offline, with automatic
 * replay and bidirectional synchronization whenever internet is restored.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs, 
  collection, 
  onSnapshot,
  getDocFromServer,
  writeBatch,
  enableIndexedDbPersistence,
  Unsubscribe
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, Category, Invoice, Customer, Supplier, Purchase, Voucher, Bank, Settings } from '../types/pharmacy';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Enable Firestore client-side offline persistence if supported in browser
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore multi-tab persistence limitation');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence not supported in this environment');
      }
    });
  } catch (e) {
    // Ignore if already enabled
  }
}

// Types for sync queue
export interface SyncQueueItem {
  id: string;
  collection: string;
  action: 'set' | 'delete';
  data?: any;
  timestamp: number;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Info: ', JSON.stringify(errInfo));
}

class FirebaseSyncService {
  private queueKey = 'pharmacare_sync_queue';
  private lastSyncKey = 'pharmacare_last_firestore_sync';
  private statusListeners: Array<(status: SyncStatus, pendingCount: number, lastSyncTime?: string) => void> = [];
  private dataPulledListeners: Array<() => void> = [];
  private currentStatus: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  private isProcessing = false;
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen to browser network changes
      window.addEventListener('online', async () => {
        console.log('PharmaCare: Network restored, initiating auto-sync with Firebase Firestore...');
        this.updateStatus('syncing');
        const res = await this.fullTwoWaySync();
        if (res.pulled > 0) {
          this.notifyDataPulled();
        }
      });

      window.addEventListener('offline', () => {
        console.log('PharmaCare: Operating in full Offline-First mode (Zero interruption)...');
        this.updateStatus('offline');
      });

      // Periodic check every 30 seconds: push pending local changes and pull remote data
      this.autoSyncInterval = setInterval(async () => {
        if (typeof navigator !== 'undefined' && navigator.onLine && !this.isProcessing) {
          if (this.getQueue().length > 0) {
            await this.processQueue();
          }
          // Periodic silent pull
          const res = await this.fullTwoWaySync();
          if (res.pulled > 0) {
            this.notifyDataPulled();
          }
        }
      }, 30000);

      // Initial validation and silent background sync on start
      setTimeout(() => {
        this.testConnection().then(async (online) => {
          if (online) {
            const res = await this.fullTwoWaySync();
            if (res.pulled > 0) {
              this.notifyDataPulled();
            }
          }
        });
      }, 1500);
    }
  }

  // Subscribe to status changes
  onStatusChange(cb: (status: SyncStatus, pendingCount: number, lastSyncTime?: string) => void) {
    this.statusListeners.push(cb);
    cb(this.currentStatus, this.getQueue().length, this.getLastSyncTime());
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== cb);
    };
  }

  // Subscribe to remote data pull events to refresh local React state immediately
  onDataPulled(cb: () => void) {
    this.dataPulledListeners.push(cb);
    return () => {
      this.dataPulledListeners = this.dataPulledListeners.filter(l => l !== cb);
    };
  }

  notifyDataPulled() {
    this.dataPulledListeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.warn('Error in onDataPulled listener:', e);
      }
    });
  }

  private updateStatus(status: SyncStatus) {
    this.currentStatus = status;
    const count = this.getQueue().length;
    const lastSync = this.getLastSyncTime();
    this.statusListeners.forEach(cb => cb(status, count, lastSync));
  }

  getLastSyncTime(): string | undefined {
    try {
      return localStorage.getItem(this.lastSyncKey) || undefined;
    } catch {
      return undefined;
    }
  }

  setLastSyncTime(isoTime: string) {
    try {
      localStorage.setItem(this.lastSyncKey, isoTime);
    } catch {}
  }

  // Validate connection per Firebase skill instructions
  async testConnection(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.updateStatus('offline');
        return false;
      }
      await getDocFromServer(doc(db, 'settings', 'ping'));
      this.updateStatus(this.getQueue().length > 0 ? 'syncing' : 'synced');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        this.updateStatus('offline');
      } else {
        // Can still be online even if ping doc doesn't exist
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          this.updateStatus(this.getQueue().length > 0 ? 'syncing' : 'synced');
          return true;
        }
      }
      return false;
    }
  }

  // Local storage queue
  getQueue(): SyncQueueItem[] {
    try {
      const data = localStorage.getItem(this.queueKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: SyncQueueItem[]) {
    try {
      localStorage.setItem(this.queueKey, JSON.stringify(queue));
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.updateStatus(queue.length > 0 ? (isOnline ? 'syncing' : 'offline') : 'synced');
    } catch (e) {
      console.warn('Failed to save sync queue:', e);
    }
  }

  // Queue item with deterministic ID to prevent duplicates
  enqueue(collectionName: string, id: string, data: any, action: 'set' | 'delete' = 'set') {
    const queue = this.getQueue();
    // Replace any existing item for this doc ID to avoid redundant operations
    const existingIndex = queue.findIndex(q => q.collection === collectionName && q.id === id);
    const item: SyncQueueItem = {
      id,
      collection: collectionName,
      action,
      data,
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = item;
    } else {
      queue.push(item);
    }

    this.saveQueue(queue);

    // If online, immediately process in background without blocking caller
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue();
    }
  }

  // Process offline sync queue with automatic deduplication & batching
  async processQueue(): Promise<boolean> {
    if (this.isProcessing) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateStatus('offline');
      return false;
    }

    const queue = this.getQueue();
    if (queue.length === 0) {
      this.updateStatus('synced');
      return true;
    }

    this.isProcessing = true;
    this.updateStatus('syncing');

    try {
      // Process in batches of 25 to respect Firestore transaction limits
      while (queue.length > 0) {
        const batchItems = queue.splice(0, 25);
        const batch = writeBatch(db);

        for (const item of batchItems) {
          const docRef = doc(db, item.collection, item.id);
          if (item.action === 'set' && item.data) {
            // Remove undefined or prototype values
            const sanitized = JSON.parse(JSON.stringify(item.data));
            batch.set(docRef, sanitized, { merge: true });
          } else if (item.action === 'delete') {
            batch.delete(docRef);
          }
        }

        await batch.commit();
        this.saveQueue(queue);
      }

      const now = new Date().toISOString();
      this.setLastSyncTime(now);
      this.updateStatus('synced');
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batch_queue');
      this.updateStatus('error');
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  // Pull collection from Cloud Firestore
  async pullCollection<T>(collectionName: string): Promise<T[]> {
    try {
      const colRef = collection(db, collectionName);
      const snapshot = await getDocs(colRef);
      const items: T[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as T);
      });
      return items;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, collectionName);
      return [];
    }
  }

  // Perform full two-way synchronization:
  // 1. Flush local queue (offline changes) to Firestore
  // 2. Push all local records to ensure Cloud has complete inventory
  // 3. Pull remote changes from Firestore to local storage
  async fullTwoWaySync(): Promise<{ success: boolean; pushed: number; pulled: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateStatus('offline');
      return { success: false, pushed: 0, pulled: 0 };
    }

    this.updateStatus('syncing');
    let pushed = 0;
    let pulled = 0;
    
    try {
      const { pharmacyStorage } = await import('./storage');

      // Step 1: Push offline queued changes first
      await this.processQueue();

      // Step 2: Push local records to Firestore so both devices share the exact database
      const prods = pharmacyStorage.getProducts();
      if (prods.length > 0) {
        for (let i = 0; i < prods.length; i += 25) {
          const chunk = prods.slice(i, i + 25);
          const batch = writeBatch(db);
          chunk.forEach(p => batch.set(doc(db, 'products', p.id), JSON.parse(JSON.stringify(p)), { merge: true }));
          await batch.commit();
          pushed += chunk.length;
        }
      }

      const cats = pharmacyStorage.getCategories();
      if (cats.length > 0) {
        const catBatch = writeBatch(db);
        cats.forEach(c => catBatch.set(doc(db, 'categories', c.id), JSON.parse(JSON.stringify(c)), { merge: true }));
        await catBatch.commit();
        pushed += cats.length;
      }

      const custs = pharmacyStorage.getCustomers();
      if (custs.length > 0) {
        const custBatch = writeBatch(db);
        custs.forEach(c => custBatch.set(doc(db, 'customers', c.id), JSON.parse(JSON.stringify(c)), { merge: true }));
        await custBatch.commit();
        pushed += custs.length;
      }

      const sups = pharmacyStorage.getSuppliers();
      if (sups.length > 0) {
        const supBatch = writeBatch(db);
        sups.forEach(s => supBatch.set(doc(db, 'suppliers', s.id), JSON.parse(JSON.stringify(s)), { merge: true }));
        await supBatch.commit();
        pushed += sups.length;
      }

      const invs = pharmacyStorage.getInvoices();
      if (invs.length > 0) {
        for (let i = 0; i < invs.length; i += 25) {
          const chunk = invs.slice(i, i + 25);
          const batch = writeBatch(db);
          chunk.forEach(inv => batch.set(doc(db, 'invoices', inv.id), JSON.parse(JSON.stringify(inv)), { merge: true }));
          await batch.commit();
          pushed += chunk.length;
        }
      }

      // Step 3: Pull products
      const cloudProducts = await this.pullCollection<any>('products');
      if (cloudProducts.length > 0) {
        pharmacyStorage.mergeRemoteProducts(cloudProducts);
        pulled += cloudProducts.length;
      }

      // Pull categories
      const cloudCategories = await this.pullCollection<any>('categories');
      if (cloudCategories.length > 0) {
        pharmacyStorage.mergeRemoteCategories(cloudCategories);
        pulled += cloudCategories.length;
      }

      // Pull invoices
      const cloudInvoices = await this.pullCollection<any>('invoices');
      if (cloudInvoices.length > 0) {
        pharmacyStorage.mergeRemoteInvoices(cloudInvoices);
        pulled += cloudInvoices.length;
      }

      // Pull customers
      const cloudCustomers = await this.pullCollection<any>('customers');
      if (cloudCustomers.length > 0) {
        pharmacyStorage.mergeRemoteCustomers(cloudCustomers);
        pulled += cloudCustomers.length;
      }

      // Pull suppliers
      const cloudSuppliers = await this.pullCollection<any>('suppliers');
      if (cloudSuppliers.length > 0) {
        pharmacyStorage.mergeRemoteSuppliers(cloudSuppliers);
        pulled += cloudSuppliers.length;
      }

      // Pull purchases
      const cloudPurchases = await this.pullCollection<any>('purchases');
      if (cloudPurchases.length > 0) {
        pharmacyStorage.mergeRemotePurchases(cloudPurchases);
        pulled += cloudPurchases.length;
      }

      // Pull vouchers
      const cloudVouchers = await this.pullCollection<any>('vouchers');
      if (cloudVouchers.length > 0) {
        pharmacyStorage.mergeRemoteVouchers(cloudVouchers);
        pulled += cloudVouchers.length;
      }

      const now = new Date().toISOString();
      this.setLastSyncTime(now);
      this.updateStatus('synced');
      this.notifyDataPulled();
      return { success: true, pushed, pulled };
    } catch (e) {
      console.warn('Two-way sync pull error:', e);
      this.updateStatus('error');
      return { success: false, pushed, pulled };
    }
  }

  /**
   * Save a complete snapshot backup directly to Firestore /backups collection
   * Runs silently in the background without triggering any browser downloads.
   */
  async saveCloudSnapshotBackup(isAutomatic: boolean = false): Promise<{ success: boolean; id?: string }> {
    try {
      const { pharmacyStorage } = await import('./storage');
      const backupJson = pharmacyStorage.exportAllDataJSON();
      const backupId = `backup_${Date.now()}`;
      const docRef = doc(db, 'backups', backupId);
      await setDoc(docRef, {
        id: backupId,
        timestamp: new Date().toISOString(),
        type: isAutomatic ? 'auto' : 'manual',
        data: backupJson,
        size: `${(backupJson.length / 1024).toFixed(1)} KB`,
      });
      return { success: true, id: backupId };
    } catch (err) {
      console.warn('Cloud snapshot backup to Firestore failed silently:', err);
      return { success: false };
    }
  }
}

export const firebaseSync = new FirebaseSyncService();

/**
 * Direct CRUD operations using Firestore SDK directly with automatic offline queue fallback
 */
export async function saveDocToFirestore(collectionName: string, id: string, data: any): Promise<void> {
  try {
    const sanitized = JSON.parse(JSON.stringify(data));
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (error) {
    console.warn(`Firestore direct write failed for ${collectionName}/${id}:`, error);
    firebaseSync.enqueue(collectionName, id, data, 'set');
  }
}

export async function deleteDocFromFirestore(collectionName: string, id: string): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn(`Firestore direct delete failed for ${collectionName}/${id}:`, error);
    firebaseSync.enqueue(collectionName, id, null, 'delete');
  }
}

/**
 * Real-Time onSnapshot subscriptions across devices
 */
export function subscribeToProducts(callback: (products: Product[]) => void): Unsubscribe {
  let isInitial = true;
  return onSnapshot(collection(db, 'products'), async (snapshot) => {
    if (!snapshot.empty) {
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      callback(products);
    } else if (isInitial) {
      isInitial = false;
      // Seed Firestore if collection is empty
      try {
        const { pharmacyStorage } = await import('./storage');
        const local = pharmacyStorage.getProducts();
        if (local && local.length > 0) {
          const batch = writeBatch(db);
          local.forEach(p => batch.set(doc(db, 'products', p.id), JSON.parse(JSON.stringify(p)), { merge: true }));
          await batch.commit();
        }
      } catch (e) {
        console.warn('Initial products seed skipped:', e);
      }
    }
  }, (error) => {
    console.error('Firestore products real-time sync error:', error);
  });
}

export function subscribeToCategories(callback: (categories: Category[]) => void): Unsubscribe {
  let isInitial = true;
  return onSnapshot(collection(db, 'categories'), async (snapshot) => {
    if (!snapshot.empty) {
      const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      callback(categories);
    } else if (isInitial) {
      isInitial = false;
      try {
        const { pharmacyStorage } = await import('./storage');
        const local = pharmacyStorage.getCategories();
        if (local && local.length > 0) {
          const batch = writeBatch(db);
          local.forEach(c => batch.set(doc(db, 'categories', c.id), JSON.parse(JSON.stringify(c)), { merge: true }));
          await batch.commit();
        }
      } catch (e) {
        console.warn('Initial categories seed skipped:', e);
      }
    }
  }, (error) => {
    console.error('Firestore categories real-time sync error:', error);
  });
}

export function subscribeToInvoices(callback: (invoices: Invoice[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'invoices'), (snapshot) => {
    if (!snapshot.empty) {
      const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
      callback(invoices);
    }
  }, (error) => {
    console.error('Firestore invoices real-time sync error:', error);
  });
}

export function subscribeToCustomers(callback: (customers: Customer[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'customers'), (snapshot) => {
    if (!snapshot.empty) {
      const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      callback(customers);
    }
  }, (error) => {
    console.error('Firestore customers real-time sync error:', error);
  });
}

export function subscribeToSuppliers(callback: (suppliers: Supplier[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'suppliers'), (snapshot) => {
    if (!snapshot.empty) {
      const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      callback(suppliers);
    }
  }, (error) => {
    console.error('Firestore suppliers real-time sync error:', error);
  });
}

export function subscribeToPurchases(callback: (purchases: Purchase[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'purchases'), (snapshot) => {
    if (!snapshot.empty) {
      const purchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
      callback(purchases);
    }
  }, (error) => {
    console.error('Firestore purchases real-time sync error:', error);
  });
}

export function subscribeToVouchers(callback: (vouchers: Voucher[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'vouchers'), (snapshot) => {
    if (!snapshot.empty) {
      const vouchers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher));
      callback(vouchers);
    }
  }, (error) => {
    console.error('Firestore vouchers real-time sync error:', error);
  });
}

export function subscribeToBanks(callback: (banks: Bank[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'banks'), (snapshot) => {
    if (!snapshot.empty) {
      const banks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
      callback(banks);
    }
  }, (error) => {
    console.error('Firestore banks real-time sync error:', error);
  });
}

