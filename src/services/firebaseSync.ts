import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDocs, 
  collection, 
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Types for sync queue
export interface SyncQueueItem {
  id: string;
  collection: string;
  action: 'set' | 'delete';
  data?: any;
  timestamp: number;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

class FirebaseSyncService {
  private queueKey = 'pharmacare_sync_queue';
  private statusListeners: Array<(status: SyncStatus, pendingCount: number) => void> = [];
  private currentStatus: SyncStatus = 'synced';
  private isProcessing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
      window.addEventListener('offline', () => {
        this.updateStatus('offline');
      });
      // Initial queue check
      setTimeout(() => {
        this.testConnection();
        this.processQueue();
      }, 1000);
    }
  }

  // Subscribe to status changes
  onStatusChange(cb: (status: SyncStatus, pendingCount: number) => void) {
    this.statusListeners.push(cb);
    cb(this.currentStatus, this.getQueue().length);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== cb);
    };
  }

  private updateStatus(status: SyncStatus) {
    this.currentStatus = status;
    const count = this.getQueue().length;
    this.statusListeners.forEach(cb => cb(status, count));
  }

  // Validate connection per Firebase skill instructions
  async testConnection(): Promise<boolean> {
    try {
      if (!navigator.onLine) {
        this.updateStatus('offline');
        return false;
      }
      await getDocFromServer(doc(db, 'settings', 'ping'));
      this.updateStatus(this.getQueue().length > 0 ? 'syncing' : 'synced');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        this.updateStatus('offline');
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
      this.updateStatus(queue.length > 0 ? (navigator.onLine ? 'syncing' : 'offline') : 'synced');
    } catch (e) {
      console.warn('Failed to save sync queue:', e);
    }
  }

  // Queue item with deterministic ID to prevent duplicates
  enqueue(collectionName: string, id: string, data: any, action: 'set' | 'delete' = 'set') {
    const queue = this.getQueue();
    // Replace any existing item for this doc ID to avoid repeated operations
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

    // Try processing if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  // Process offline sync queue with automatic deduplication
  async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    const queue = this.getQueue();
    if (queue.length === 0) {
      this.updateStatus('synced');
      return;
    }

    this.isProcessing = true;
    this.updateStatus('syncing');

    try {
      // Process in batches of 20
      while (queue.length > 0) {
        const batchItems = queue.splice(0, 20);
        const batch = writeBatch(db);

        for (const item of batchItems) {
          const docRef = doc(db, item.collection, item.id);
          if (item.action === 'set' && item.data) {
            // Remove undefined or local functions
            const sanitized = JSON.parse(JSON.stringify(item.data));
            batch.set(docRef, sanitized, { merge: true });
          } else if (item.action === 'delete') {
            batch.delete(docRef);
          }
        }

        await batch.commit();
        this.saveQueue(queue);
      }

      this.updateStatus('synced');
    } catch (err) {
      console.warn('Error flushing sync queue to Firestore:', err);
      this.updateStatus('error');
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
      console.warn(`Failed to pull ${collectionName} from Firestore:`, err);
      return [];
    }
  }
}

export const firebaseSync = new FirebaseSyncService();
