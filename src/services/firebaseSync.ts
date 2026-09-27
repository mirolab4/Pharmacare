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
  getDocs, 
  collection, 
  getDocFromServer,
  writeBatch,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

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
  private currentStatus: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  private isProcessing = false;
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen to browser network changes
      window.addEventListener('online', () => {
        console.log('PharmaCare: Network restored, initiating auto-sync with Firebase Firestore...');
        this.updateStatus('syncing');
        this.fullTwoWaySync();
      });

      window.addEventListener('offline', () => {
        console.log('PharmaCare: Operating in full Offline-First mode (Zero interruption)...');
        this.updateStatus('offline');
      });

      // Periodic queue check every 30 seconds if online
      this.autoSyncInterval = setInterval(() => {
        if (navigator.onLine && !this.isProcessing && this.getQueue().length > 0) {
          this.processQueue();
        }
      }, 30000);

      // Initial validation
      setTimeout(() => {
        this.testConnection().then((online) => {
          if (online) {
            this.fullTwoWaySync();
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
  // 2. Pull remote changes from Firestore to local storage
  async fullTwoWaySync(): Promise<{ success: boolean; pushed: number; pulled: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateStatus('offline');
      return { success: false, pushed: 0, pulled: 0 };
    }

    this.updateStatus('syncing');
    const initialQueueCount = this.getQueue().length;
    
    // Step 1: Push offline changes first
    await this.processQueue();
    const remainingCount = this.getQueue().length;
    const pushed = initialQueueCount - remainingCount;

    // Step 2: Import dynamic storage to pull and merge without circular imports
    let pulled = 0;
    try {
      const { pharmacyStorage } = await import('./storage');
      
      // Pull products
      const cloudProducts = await this.pullCollection<any>('products');
      if (cloudProducts.length > 0) {
        pharmacyStorage.mergeRemoteProducts(cloudProducts);
        pulled += cloudProducts.length;
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
      return { success: true, pushed, pulled };
    } catch (e) {
      console.warn('Two-way sync pull error:', e);
      this.updateStatus('error');
      return { success: false, pushed, pulled };
    }
  }
}

export const firebaseSync = new FirebaseSyncService();
