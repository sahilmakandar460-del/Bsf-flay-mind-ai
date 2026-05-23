import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getMessaging, onMessage } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: any[];
  tenantId: string | null;
}

class MockAuth {
  private listeners: ((user: User | null) => void)[] = [];
  
  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for local profile updates or dynamic modifications to notify subscribers
      window.addEventListener('storage', () => this.notify());
      window.addEventListener('flymind_profile_update', () => this.notify());
      window.addEventListener('flymind_language_update', () => this.notify());
    }
  }

  get currentUser(): User {
    let name = "Sahil Makandar";
    let email = "sahilmakandar460@gmail.com";
    let photoURL: string | null = null;

    try {
      if (typeof window !== 'undefined') {
        const localUser = localStorage.getItem('flymind_farmer_profile');
        if (localUser) {
          const parsed = JSON.parse(localUser);
          if (parsed.fullName) name = parsed.fullName;
          if (parsed.contactEmail) email = parsed.contactEmail;
          if (parsed.customAvatarBase64) photoURL = parsed.customAvatarBase64;
        }
      }
    } catch (e) {
      console.warn("Error reading local profile in MockAuth", e);
    }

    return {
      uid: "guest-operator-101",
      email: email,
      displayName: name,
      photoURL: photoURL,
      emailVerified: true,
      isAnonymous: true,
      providerData: [],
      tenantId: null,
    };
  }

  notify() {
    const user = this.currentUser;
    this.listeners.forEach(l => {
      try { l(user); } catch (e) {}
    });
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    const trigger = () => {
      callback(this.currentUser);
    };
    
    trigger();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('flymind_profile_update', trigger);
      window.addEventListener('flymind_language_update', trigger);
      window.addEventListener('storage', trigger);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('flymind_profile_update', trigger);
        window.removeEventListener('flymind_language_update', trigger);
        window.removeEventListener('storage', trigger);
      }
    };
  }
}

export const auth = new MockAuth();

// Expose standard mock Firebase auth operators directly
export function onAuthStateChanged(authInstance: any, callback: (user: User | null) => void) {
  return auth.onAuthStateChanged(callback);
}

export async function signOut(authInstance: any) {
  try {
    // Perform standard local identity reset
    localStorage.removeItem('flymind_farmer_profile');
    window.dispatchEvent(new Event('flymind_profile_update'));
  } catch (e) {
    console.warn("Failed to reset local profile on logout", e);
  }
}

export async function deleteUser(userInstance: any) {
  try {
    localStorage.removeItem('flymind_farmer_profile');
    localStorage.removeItem('flymind_scanned_stage');
    localStorage.removeItem('flymind_alerts_history');
    localStorage.removeItem('flymind_dismissed_alerts');
    localStorage.removeItem('flymind_acknowledged_alerts');
    window.dispatchEvent(new Event('flymind_profile_update'));
  } catch (e) {
    console.warn("Failed to clean up client state on deleteAccount", e);
  }
}

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);

export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
export async function testConnection() {
  // Silent success
}
