/**
 * PharmaCare Plus - Firebase Firestore Real-Time & Offline-First Service
 * Architecture:
 * - Pure Serverless Client-Side PWA (GitHub Pages ready)
 * - Single source of truth: Firestore database "(default)"
 * - Offline Persistence via persistentLocalCache & persistentMultipleTabManager
 * - Automatic Anonymous Authentication (Zero login friction)
 * - Multi-device synchronization without Google accounts using Workspace ID & Join Code
 * - Path schema: workspaces/{workspaceId}/{collectionName}/{docId}
 * - Soft deletes (deleted: true) for cross-device deletion propagation
 * - Conflict resolution: "Last Write Wins" with updatedAt serverTimestamp
 * - Atomic stock adjustments via increment()
 * - Device tracking with remote logout (revoked: true)
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
  deleteDoc as firestoreDeleteDoc,
  collection, 
  onSnapshot, 
  getDoc,
  getDocs,
  serverTimestamp,
  increment,
  waitForPendingWrites,
  Unsubscribe,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { firebaseConfig } from './firebaseConfig';
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
  StockMovement,
  LinkedDevice
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
const WORKSPACE_ID_KEY = 'pharmacare_workspace_id';
const LEGACY_PHARMACY_ID_KEY = 'pharmacare_pharmacy_id';
const JOIN_CODE_KEY = 'pharmacare_join_code';
const DEVICE_ID_KEY = 'pharmacare_device_id';
const DEVICE_NAME_KEY = 'pharmacare_device_name';
const LAST_SYNC_KEY = 'pharmacare_last_firestore_sync';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

class FirebaseSyncService {
  private statusListeners: Array<(status: SyncStatus, pendingCount: number, lastSyncTime?: string) => void> = [];
  private dataPulledListeners: Array<() => void> = [];
  private workspaceListeners: Array<(workspaceId: string | null) => void> = [];
  private errorListeners: Array<(message: string) => void> = [];
  private deviceRevokedListeners: Array<() => void> = [];
  
  private currentStatus: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced';
  private pendingCount = 0;
  private currentUser: User | null = null;
  private isAuthReady = false;
  private authInitPromise: Promise<User>;
  private deviceUnsubscribe: Unsubscribe | null = null;

  constructor() {
    // Generate or retrieve persistent unique Device ID
    this.initDeviceId();

    // Listen to network status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('PharmaCare: Network online, triggering synchronization...');
        this.updateStatus('syncing');
        this.syncNow().catch(() => {});
      });

      window.addEventListener('offline', () => {
        console.log('PharmaCare: Network offline, operating in offline cache mode.');
        this.updateStatus('offline');
      });
    }

    // Auto sign-in anonymously without any login screens
    this.authInitPromise = new Promise((resolve, reject) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          console.log('PharmaCare Anonymous Auth Success. UID:', user.uid);
          this.currentUser = user;
          this.isAuthReady = true;
          this.listenToDeviceStatus();
          resolve(user);
        } else {
          try {
            console.log('PharmaCare: Requesting Anonymous Sign-In...');
            const credential = await signInAnonymously(auth);
            console.log('PharmaCare: Signed in anonymously as UID:', credential.user.uid);
            this.currentUser = credential.user;
            this.isAuthReady = true;
            this.listenToDeviceStatus();
            resolve(credential.user);
          } catch (err: any) {
            console.error('PharmaCare Anonymous Auth Error:', err);
            this.notifyError(this.translateFirebaseError(err));
            reject(err);
          }
        }
      });
    });

    // Migrate legacy key if exists
    if (typeof localStorage !== 'undefined') {
      const legacyId = localStorage.getItem(LEGACY_PHARMACY_ID_KEY);
      if (legacyId && !localStorage.getItem(WORKSPACE_ID_KEY)) {
        localStorage.setItem(WORKSPACE_ID_KEY, legacyId);
      }
    }

    // Listen for device status
    this.listenToDeviceStatus();
  }

  // --- Device & Workspace Identification ---
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

  /**
   * Generate secure numeric code (digits only 0-9)
   */
  generateNumericCode(length = 6): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  getDeviceName(): string {
    try {
      let name = localStorage.getItem(DEVICE_NAME_KEY);
      if (!name) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        name = isMobile ? 'هاتف كاشير' : 'جهاز الحاسوب الرئيسي';
        localStorage.setItem(DEVICE_NAME_KEY, name);
      }
      return name;
    } catch {
      return 'جهاز كاشير';
    }
  }

  setDeviceName(name: string): void {
    try {
      localStorage.setItem(DEVICE_NAME_KEY, name);
      const wid = this.getWorkspaceId();
      if (wid) {
        this.registerDevice(wid, false).catch(() => {});
      }
    } catch (e) {
      console.warn(e);
    }
  }

  getDeviceType(): string {
    if (typeof navigator === 'undefined') return 'حاسوب';
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows';
    return 'متصفح ويب';
  }

  getWorkspaceId(): string | null {
    try {
      return localStorage.getItem(WORKSPACE_ID_KEY) || localStorage.getItem(LEGACY_PHARMACY_ID_KEY) || null;
    } catch {
      return null;
    }
  }

  // Alias for backward compatibility
  getPharmacyId(): string | null {
    return this.getWorkspaceId();
  }

  getJoinCode(): string | null {
    try {
      return localStorage.getItem(JOIN_CODE_KEY) || null;
    } catch {
      return null;
    }
  }

  isLinked(): boolean {
    return !!this.getWorkspaceId();
  }

  getWorkspaceInfo(): { 
    workspaceId: string | null; 
    pharmacyId: string | null;
    joinCode: string | null; 
    deviceId: string; 
    isLinked: boolean 
  } {
    const wid = this.getWorkspaceId();
    return {
      workspaceId: wid,
      pharmacyId: wid,
      joinCode: this.getJoinCode(),
      deviceId: this.getDeviceId(),
      isLinked: this.isLinked()
    };
  }

  // Alias for backward compatibility
  getPharmacyInfo() {
    return this.getWorkspaceInfo();
  }

  onPharmacyChange(cb: (workspaceId: string | null) => void) {
    this.workspaceListeners.push(cb);
    return () => {
      this.workspaceListeners = this.workspaceListeners.filter(l => l !== cb);
    };
  }

  private notifyWorkspaceChange(wid: string | null) {
    this.workspaceListeners.forEach(cb => {
      try { cb(wid); } catch (e) { console.warn(e); }
    });
  }

  onDeviceRevoked(cb: () => void) {
    this.deviceRevokedListeners.push(cb);
    return () => {
      this.deviceRevokedListeners = this.deviceRevokedListeners.filter(l => l !== cb);
    };
  }

  private notifyDeviceRevoked() {
    this.deviceRevokedListeners.forEach(cb => {
      try { cb(); } catch (e) { console.warn(e); }
    });
  }

  async ensureAuth(): Promise<User> {
    if (this.currentUser) return this.currentUser;
    if (auth.currentUser) {
      this.currentUser = auth.currentUser;
      return auth.currentUser;
    }
    try {
      return await this.authInitPromise;
    } catch {
      const cred = await signInAnonymously(auth);
      this.currentUser = cred.user;
      return cred.user;
    }
  }

  /**
   * Listen to current device member document in workspace to handle remote logout & expulsion
   */
  private listenToDeviceStatus() {
    if (this.deviceUnsubscribe) {
      this.deviceUnsubscribe();
      this.deviceUnsubscribe = null;
    }

    const wid = this.getWorkspaceId();
    const did = this.getDeviceId();
    if (!wid || !did) return;

    let hasInitiallyLoaded = false;

    try {
      const memberDocRef = doc(db, 'workspaces', wid, 'members', did);
      this.deviceUnsubscribe = onSnapshot(memberDocRef, (snap) => {
        if (!hasInitiallyLoaded) {
          hasInitiallyLoaded = true;
          // If member doc doesn't exist yet on initial registration, don't immediately expel
          if (!snap.exists()) {
            return;
          }
        }

        // Remote Expulsion: If member document was deleted OR marked revoked: true
        if (!snap.exists() || snap.data()?.revoked === true) {
          console.warn('PharmaCare: Membership document was deleted or revoked by owner. Expelling device...');
          this.disconnectPharmacy();
          this.notifyDeviceRevoked();
          return;
        }

        const data = snap.data();
        if (data?.role) {
          console.log(`PharmaCare: Current device role is [${data.role}]`);
        }
      }, (err) => {
        console.warn('Member listener warning:', err.message);
        // If permission-denied occurred because the rules denied access to non-members
        if (err.message.includes('permission-denied') || (err as any).code === 'permission-denied') {
          console.warn('PharmaCare: Permission denied for member, disconnecting...');
          this.disconnectPharmacy();
          this.notifyDeviceRevoked();
        }
      });
    } catch (e) {
      console.warn(e);
    }
  }

  /**
   * Register or update this device under workspaces/{wid}/members/{deviceId}
   * and dual-write to legacy devices/{deviceId}
   */
  async registerDevice(wid: string, isOwner = false, role?: MemberRole): Promise<void> {
    try {
      const user = await this.ensureAuth();
      const did = this.getDeviceId();
      const memberDocRef = doc(db, 'workspaces', wid, 'members', did);
      const legacyDevDocRef = doc(db, 'workspaces', wid, 'devices', did);
      
      const existingSnap = await getDoc(memberDocRef).catch(() => null);
      const existingData = existingSnap?.exists() ? existingSnap.data() : null;
      const isExistingOwner = existingData ? existingData.isOwner : isOwner;
      const determinedRole: MemberRole = isExistingOwner || isOwner 
        ? 'owner' 
        : (role || existingData?.role || 'cashier');

      const payload = {
        deviceId: did,
        deviceName: this.getDeviceName(),
        deviceType: this.getDeviceType(),
        role: determinedRole,
        joinedAt: existingData ? existingData.joinedAt : new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        isOwner: isExistingOwner || isOwner || false,
        revoked: false,
        uid: user.uid,
        updatedAt: serverTimestamp(),
      };

      // 1. Primary: Save in members collection
      await setDoc(memberDocRef, payload, { merge: true });

      // 2. Legacy: Dual-write to devices collection
      setDoc(legacyDevDocRef, payload, { merge: true }).catch(() => {});

      this.listenToDeviceStatus();
    } catch (err) {
      console.warn('Failed to register member device:', err);
    }
  }

  /**
   * Update heartbeat lastSeen timestamp on this device's member record
   */
  async updateHeartbeat(): Promise<void> {
    const wid = this.getWorkspaceId();
    const did = this.getDeviceId();
    if (!wid || !did) return;

    try {
      const memberDocRef = doc(db, 'workspaces', wid, 'members', did);
      await updateDoc(memberDocRef, {
        lastSeen: new Date().toISOString(),
        updatedAt: serverTimestamp()
      }).catch(() => {});
    } catch (e) {
      // Non-blocking
    }
  }

  /**
   * Generate a configurable numeric link code
   * expiresInMinutes: 5, 15, 60, 1440, or <= 0 for permanent
   */
  async generateTemporaryLinkCode(expiresInMinutes = 5): Promise<{ code: string; expiresAt: number; isPermanent: boolean }> {
    const wid = this.getWorkspaceId();
    if (!wid) throw new Error('لا توجد مساحة عمل مفعلة لتوليد رمز الربط');

    // 6-digit numeric code
    const code = this.generateNumericCode(6);
    const isPermanent = expiresInMinutes <= 0;
    const expiresAt = isPermanent 
      ? Date.now() + 10 * 365 * 24 * 3600 * 1000 
      : Date.now() + expiresInMinutes * 60 * 1000;

    const tokenDocRef = doc(db, 'workspaces', wid, 'linkTokens', code);
    await setDoc(tokenDocRef, {
      code,
      workspaceId: wid,
      expiresAt,
      isPermanent,
      used: false,
      createdAt: serverTimestamp(),
    });

    console.log(`PharmaCare: Generated numeric link token for workspace ${wid}: ${code} (Expires: ${isPermanent ? 'Permanent' : expiresInMinutes + 'm'})`);
    return { code, expiresAt, isPermanent };
  }

  /**
   * Create a new workspace on Firestore
   * Stores workspace root document and registers this device as Owner
   */
  async createWorkspace(nameAr?: string): Promise<{ workspaceId: string; joinCode: string }> {
    const user = await this.ensureAuth();
    const wid = 'pharma-' + Math.random().toString(36).substring(2, 8);
    
    // Generate secure 6-digit numeric persistent join code
    const joinCode = this.generateNumericCode(6);
    const deviceId = this.getDeviceId();

    try {
      console.log(`PharmaCare: Creating workspace ${wid} on Firestore (default)...`);

      // 1. Create workspace root document
      const workspaceDocRef = doc(db, 'workspaces', wid);
      await setDoc(workspaceDocRef, {
        joinCode,
        nameAr: nameAr || 'صيدليتي',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdDevice: deviceId,
        ownerDeviceId: deviceId,
      });

      // 2. Also write to legacy path pharmacies/{wid} to ensure cross-compatibility with any existing views
      const legacyRef = doc(db, 'pharmacies', wid);
      setDoc(legacyRef, {
        joinCode,
        nameAr: nameAr || 'صيدليتي',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      }, { merge: true }).catch(() => {});

      // 3. Save locally
      localStorage.setItem(WORKSPACE_ID_KEY, wid);
      localStorage.setItem(LEGACY_PHARMACY_ID_KEY, wid);
      localStorage.setItem(JOIN_CODE_KEY, joinCode);

      // 4. Register this device as OWNER in members collection
      await this.registerDevice(wid, true, 'owner');

      // 5. Migrate any existing local data into this newly created workspace
      await this.seedExistingLocalData(wid);

      this.notifyWorkspaceChange(wid);
      this.notifyDataPulled();
      console.log(`PharmaCare: Workspace ${wid} created successfully with numeric code: ${joinCode}`);
      return { workspaceId: wid, joinCode };
    } catch (err: any) {
      console.error('Error creating workspace:', err);
      const translated = this.translateFirebaseError(err);
      this.notifyError(`فشل إنشاء مساحة العمل: ${translated}`);
      throw new Error(translated);
    }
  }

  // Alias for backward compatibility
  async createPharmacy(nameAr?: string) {
    const res = await this.createWorkspace(nameAr);
    return { pharmacyId: res.workspaceId, joinCode: res.joinCode };
  }

  /**
   * Join an existing workspace organization using Workspace ID & Join Code or Temporary Token
   */
  async joinWorkspace(workspaceId: string, joinCodeOrToken: string): Promise<boolean> {
    const user = await this.ensureAuth();
    const wid = workspaceId.trim();
    const code = joinCodeOrToken.trim().toUpperCase();

    if (!wid || code.length < 4) {
      throw new Error('يرجى التأكد من إدخال معرّف مساحة العمل والرمز بشكل صحيح');
    }

    try {
      this.updateStatus('syncing');
      console.log(`PharmaCare: Joining workspace ${wid} with code/token [${code}]...`);

      let isValid = false;

      // 1. Check if token is a temporary link token
      const tokenDocRef = doc(db, 'workspaces', wid, 'linkTokens', code);
      const tokenSnap = await getDoc(tokenDocRef).catch(() => null);

      if (tokenSnap && tokenSnap.exists()) {
        const tokenData = tokenSnap.data();
        if (tokenData.used && !tokenData.isPermanent) {
          throw new Error('تم استخدام رمز الربط المؤقت هذا مسبقاً، يرجى طلب رمز جديد من المالك');
        }
        if (!tokenData.isPermanent && Date.now() > tokenData.expiresAt) {
          throw new Error('انتهت صلاحية رمز الربط، يرجى طلب توليد رمز جديد من المالك');
        }
        // Mark token as used if not permanent
        if (!tokenData.isPermanent) {
          await updateDoc(tokenDocRef, {
            used: true,
            usedBy: user.uid,
            usedAt: serverTimestamp(),
          }).catch(() => {});
        }
        isValid = true;
      } else {
        // 2. Validate against permanent joinCode in workspace doc
        const wsSnap = await getDoc(doc(db, 'workspaces', wid)).catch(() => null);
        if (wsSnap && wsSnap.exists()) {
          const wsData = wsSnap.data();
          if (wsData.joinCode && wsData.joinCode.toString().trim() === code) {
            isValid = true;
          }
        } else {
          // Check legacy pharmacies path
          const legSnap = await getDoc(doc(db, 'pharmacies', wid)).catch(() => null);
          if (legSnap && legSnap.exists() && legSnap.data().joinCode?.toString().trim() === code) {
            isValid = true;
          }
        }
      }

      if (!isValid) {
        throw new Error('رمز الربط أو الانضمام غير صحيح لمساحة العمل هذه');
      }

      // Save locally
      localStorage.setItem(WORKSPACE_ID_KEY, wid);
      localStorage.setItem(LEGACY_PHARMACY_ID_KEY, wid);
      localStorage.setItem(JOIN_CODE_KEY, code);

      // Register this new device as standard cashier member (joining member cannot assign their own role)
      await this.registerDevice(wid, false, 'cashier');

      this.notifyWorkspaceChange(wid);
      this.updateStatus('synced');
      this.notifyDataPulled();
      console.log(`PharmaCare: Device successfully joined workspace ${wid} as cashier`);
      return true;
    } catch (err: any) {
      console.error('Error joining workspace:', err);
      const translated = this.translateFirebaseError(err);
      this.notifyError(`فشل ربط الجهاز: ${translated}`);
      this.updateStatus('error');
      throw new Error(translated);
    }
  }

  // Alias for backward compatibility
  async joinPharmacy(pharmacyId: string, joinCode: string) {
    return this.joinWorkspace(pharmacyId, joinCode);
  }

  /**
   * Disconnect this device from the current workspace
   */
  disconnectPharmacy(): void {
    try {
      if (this.deviceUnsubscribe) {
        this.deviceUnsubscribe();
        this.deviceUnsubscribe = null;
      }
      localStorage.removeItem(WORKSPACE_ID_KEY);
      localStorage.removeItem(LEGACY_PHARMACY_ID_KEY);
      localStorage.removeItem(JOIN_CODE_KEY);
      this.notifyWorkspaceChange(null);
      this.notifyDataPulled();
    } catch (e) {
      console.warn(e);
    }
  }

  /**
   * Rotate the workspace joinCode automatically to prevent expelled devices from re-entering
   */
  async rotateJoinCode(wid?: string): Promise<string> {
    const targetWid = wid || this.getWorkspaceId();
    if (!targetWid) throw new Error('لا توجد مساحة عمل مفعلة لتدوير الرمز');

    const newCode = this.generateNumericCode(6);
    try {
      const wsRef = doc(db, 'workspaces', targetWid);
      await updateDoc(wsRef, {
        joinCode: newCode,
        updatedAt: serverTimestamp(),
      });

      // Update legacy path as well
      const legRef = doc(db, 'pharmacies', targetWid);
      updateDoc(legRef, {
        joinCode: newCode,
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      localStorage.setItem(JOIN_CODE_KEY, newCode);
      this.notifyWorkspaceChange(targetWid);
      console.log(`PharmaCare: Successfully rotated joinCode for ${targetWid} to: ${newCode}`);
      return newCode;
    } catch (err) {
      console.error('Failed to rotate join code:', err);
      throw err;
    }
  }

  /**
   * Realtime subscription to workspace members list (from collection members)
   */
  subscribeToMembers(callback: (members: LinkedDevice[]) => void): Unsubscribe {
    const wid = this.getWorkspaceId();
    if (!wid) {
      callback([]);
      return () => {};
    }

    const membersColRef = collection(db, 'workspaces', wid, 'members');
    return onSnapshot(membersColRef, (snap) => {
      if (snap.empty) {
        // Fallback to devices collection for existing data
        this.getLinkedDevices().then(callback).catch(() => callback([]));
        return;
      }
      const list: LinkedDevice[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          deviceId: d.id,
          deviceName: data.deviceName || 'جهاز كاشير',
          deviceType: data.deviceType || 'متصفح',
          role: data.role || (data.isOwner ? 'owner' : 'cashier'),
          joinedAt: data.joinedAt || new Date().toISOString(),
          lastSeen: data.lastSeen || new Date().toISOString(),
          isOwner: !!data.isOwner || data.role === 'owner',
          revoked: !!data.revoked,
          uid: data.uid,
        });
      });
      callback(list);
    }, (err) => {
      console.warn('Members subscription error:', err.message);
      // Fallback
      this.getLinkedDevices().then(callback).catch(() => callback([]));
    });
  }

  /**
   * Fetch all registered members / devices in current workspace
   */
  async getLinkedDevices(): Promise<LinkedDevice[]> {
    const wid = this.getWorkspaceId();
    if (!wid) return [];

    try {
      // Check members first
      const memColRef = collection(db, 'workspaces', wid, 'members');
      const snap = await getDocs(memColRef);
      if (!snap.empty) {
        const list: LinkedDevice[] = [];
        snap.forEach(d => {
          const data = d.data();
          list.push({
            deviceId: d.id,
            deviceName: data.deviceName || 'جهاز غير معروف',
            deviceType: data.deviceType || 'متصفح',
            role: data.role || (data.isOwner ? 'owner' : 'cashier'),
            joinedAt: data.joinedAt || new Date().toISOString(),
            lastSeen: data.lastSeen || new Date().toISOString(),
            isOwner: !!data.isOwner || data.role === 'owner',
            revoked: !!data.revoked,
            uid: data.uid,
          });
        });
        return list;
      }

      // Fallback to devices
      const devColRef = collection(db, 'workspaces', wid, 'devices');
      const devSnap = await getDocs(devColRef);
      const list: LinkedDevice[] = [];
      devSnap.forEach(d => {
        const data = d.data();
        list.push({
          deviceId: d.id,
          deviceName: data.deviceName || 'جهاز غير معروف',
          deviceType: data.deviceType || 'متصفح',
          role: data.isOwner ? 'owner' : 'cashier',
          joinedAt: data.joinedAt || new Date().toISOString(),
          lastSeen: data.lastSeen || new Date().toISOString(),
          isOwner: !!data.isOwner,
          revoked: !!data.revoked,
          uid: data.uid,
        });
      });
      return list;
    } catch (err) {
      console.warn('Failed to get linked devices:', err);
      return [];
    }
  }

  /**
   * Remotely revoke / logout a member device and immediately rotate the join code
   */
  async revokeDevice(targetDeviceId: string): Promise<{ success: boolean; newJoinCode: string }> {
    const wid = this.getWorkspaceId();
    if (!wid) throw new Error('لا توجد مساحة عمل مفعلة');

    try {
      // 1. Mark revoked in members
      const memDocRef = doc(db, 'workspaces', wid, 'members', targetDeviceId);
      await updateDoc(memDocRef, {
        revoked: true,
        revokedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      // 2. Mark revoked in legacy devices
      const devDocRef = doc(db, 'workspaces', wid, 'devices', targetDeviceId);
      await updateDoc(devDocRef, {
        revoked: true,
        revokedAt: serverTimestamp(),
      }).catch(() => {});

      // 3. Immediately rotate join code!
      const newJoinCode = await this.rotateJoinCode(wid);
      console.log(`PharmaCare: Remotely revoked device ${targetDeviceId} and rotated code to ${newJoinCode}`);
      return { success: true, newJoinCode };
    } catch (err) {
      console.error('Failed to revoke device:', err);
      throw err;
    }
  }

  /**
   * Delete a member document completely (cuts off access immediately) and rotate join code
   */
  async deleteDeviceRecord(targetDeviceId: string): Promise<{ success: boolean; newJoinCode: string }> {
    const wid = this.getWorkspaceId();
    if (!wid) throw new Error('لا توجد مساحة عمل مفعلة');

    try {
      // 1. Delete from members collection
      const memDocRef = doc(db, 'workspaces', wid, 'members', targetDeviceId);
      await firestoreDeleteDoc(memDocRef).catch(() => {});

      // 2. Delete from devices collection
      const devDocRef = doc(db, 'workspaces', wid, 'devices', targetDeviceId);
      await firestoreDeleteDoc(devDocRef).catch(() => {});

      // 3. Immediately rotate join code!
      const newJoinCode = await this.rotateJoinCode(wid);
      console.log(`PharmaCare: Deleted member ${targetDeviceId} and rotated code to ${newJoinCode}`);
      return { success: true, newJoinCode };
    } catch (err) {
      console.error('Failed to delete member device:', err);
      throw err;
    }
  }

  /**
   * Update role for a member device (Admin / Owner only)
   */
  async updateMemberRole(targetDeviceId: string, newRole: MemberRole): Promise<boolean> {
    const wid = this.getWorkspaceId();
    if (!wid) throw new Error('لا توجد مساحة عمل مفعلة');

    try {
      const memDocRef = doc(db, 'workspaces', wid, 'members', targetDeviceId);
      await updateDoc(memDocRef, {
        role: newRole,
        isOwner: newRole === 'owner',
        updatedAt: serverTimestamp(),
      });
      console.log(`PharmaCare: Updated role for ${targetDeviceId} to ${newRole}`);
      return true;
    } catch (err) {
      console.error('Failed to update member role:', err);
      throw err;
    }
  }

  // --- Document Operations (Scoped to current workspace with dual-write for compatibility) ---

  /**
   * Write or merge document into workspaces/{workspaceId}/{collectionName}/{id}
   * Adds updatedAt (serverTimestamp), deviceId, and deleted: false
   * Also dual-writes to pharmacies/{wid}/{collectionName}/{id} for full safety
   */
  async saveDoc(collectionName: string, id: string, data: any): Promise<void> {
    const wid = this.getWorkspaceId();
    if (!wid) {
      console.warn(`PharmaCare: saveDoc skipped for ${collectionName}/${id} because no workspace is linked`);
      return;
    }

    try {
      const sanitized = JSON.parse(JSON.stringify(data));
      delete sanitized.id;

      const payload = {
        ...sanitized,
        id,
        deleted: false,
        updatedAt: serverTimestamp(),
        deviceId: this.getDeviceId(),
      };

      // 1. Primary write to workspaces/{wid}/{col}/{id}
      const workspaceDocRef = doc(db, 'workspaces', wid, collectionName, id);
      setDoc(workspaceDocRef, payload, { merge: true }).catch((err: any) => {
        console.error(`Firestore write error (workspaces/${collectionName}/${id}):`, err);
        this.notifyError(`تعذر حفظ البيانات في السحابة (${collectionName}): ${this.translateFirebaseError(err)}`);
      });

      // 2. Dual-write to pharmacies/{wid}/{col}/{id} for full backward compatibility
      const legacyDocRef = doc(db, 'pharmacies', wid, collectionName, id);
      setDoc(legacyDocRef, payload, { merge: true }).catch(() => {});

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
    const wid = this.getWorkspaceId();
    if (!wid) return;

    try {
      const payload = {
        deleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deviceId: this.getDeviceId(),
      };

      const docRef = doc(db, 'workspaces', wid, collectionName, id);
      setDoc(docRef, payload, { merge: true }).catch((err: any) => {
        console.error(`Firestore soft delete error (${collectionName}/${id}):`, err);
        this.notifyError(`تعذر حذف العنصر من السحابة: ${this.translateFirebaseError(err)}`);
      });

      const legRef = doc(db, 'pharmacies', wid, collectionName, id);
      setDoc(legRef, payload, { merge: true }).catch(() => {});

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
    const wid = this.getWorkspaceId();
    if (!wid) return;

    try {
      const docRef = doc(db, 'workspaces', wid, 'products', productId);
      await updateDoc(docRef, {
        stock: increment(deltaQuantity),
        updatedAt: serverTimestamp(),
        deviceId: this.getDeviceId(),
      });

      const legRef = doc(db, 'pharmacies', wid, 'products', productId);
      updateDoc(legRef, {
        stock: increment(deltaQuantity),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    } catch (err: any) {
      console.warn(`Atomic stock update failed, fallback to saveDoc:`, err);
    }
  }

  // --- Real-Time Subscriptions ---

  /**
   * Subscribe to collection changes under current workspace
   * Automatically filters out soft-deleted documents
   */
  subscribeToCollection<T extends { id: string }>(
    collectionName: string,
    callback: (items: T[]) => void
  ): Unsubscribe {
    const wid = this.getWorkspaceId();
    if (!wid) {
      callback([]);
      return () => {};
    }

    const colRef = collection(db, 'workspaces', wid, collectionName);
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
        // Fallback to pharmacies collection if workspaces had permission issue
        if (error.code === 'permission-denied') {
          const fallbackCol = collection(db, 'pharmacies', wid, collectionName);
          return onSnapshot(fallbackCol, (snap) => {
            const active: T[] = [];
            snap.docs.forEach(d => {
              const data = d.data();
              if (!data.deleted) active.push({ id: d.id, ...data } as T);
            });
            callback(active);
          }, () => {});
        }
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

    const wid = this.getWorkspaceId();
    if (!wid) {
      return { success: false, message: 'يرجى ربط أو إنشاء مساحة عمل أولاً لتفعيل المزامنة' };
    }

    try {
      this.updateStatus('syncing');
      console.log('PharmaCare: Waiting for pending writes to commit to Firestore...');
      // Wait for all offline writes to commit to Firestore
      await waitForPendingWrites(db);

      // Validate live connection
      await getDocFromServer(doc(db, 'workspaces', wid)).catch(async () => {
        return await getDocFromServer(doc(db, 'pharmacies', wid));
      });

      const now = new Date().toISOString();
      this.setLastSyncTime(now);
      this.updateStatus('synced');
      this.notifyDataPulled();
      console.log('PharmaCare: syncNow completed successfully.');
      return { success: true, message: 'تمت المزامنة بنجاح: تم رفع كافة العمليات ومطابقة السحابة لحظياً 🟢' };
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

    const wid = this.getWorkspaceId();
    if (!wid) {
      return {
        success: false,
        message: 'لم يتم ربط هذا الجهاز بأي مساحة عمل بعد. يرجى إنشاء صيدلية أو ربطها بالرمز أولاً.',
        details: { code: 'no_workspace' }
      };
    }

    try {
      const user = await this.ensureAuth();
      const testDocRef = doc(db, 'workspaces', wid, 'settings', 'test_ping');
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
          workspaceId: wid,
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
    if (message.includes('joinCode') || message.includes('رمز')) {
      return 'رمز الانضمام غير صحيح أو انتهت صلاحيته.';
    }
    return message || 'خطأ غير معروف في خدمة المزامنة السحابية';
  }

  /**
   * Seed existing local data into newly created workspace to prevent any data loss
   */
  private async seedExistingLocalData(wid: string): Promise<void> {
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

      console.log(`PharmaCare: Seeding ${prods.length} products to workspace ${wid}...`);

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

      console.log('PharmaCare: Successfully seeded local data to new workspace:', wid);
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
  const wid = firebaseSync.getWorkspaceId();
  if (!wid) return () => {};
  return onSnapshot(
    doc(db, 'workspaces', wid, 'settings', 'current'),
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

export function subscribeToMembers(callback: (members: LinkedDevice[]) => void): Unsubscribe {
  return firebaseSync.subscribeToMembers(callback);
}

