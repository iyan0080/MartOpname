import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { InventoryItem, MartUser, ScanAuditLog } from '../types/inventory.ts';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Must specify firestoreDatabaseId for custom provisioned Firestore instance
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup connection test
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    // Document might not exist which is fine for connection test
    return true;
  }
}

// Fetch all items from Firestore
export async function fetchItemsFromFirestore(): Promise<InventoryItem[]> {
  const path = 'items';
  try {
    const snapshot = await getDocs(collection(db, path));
    const items: InventoryItem[] = [];
    snapshot.forEach((docSnap) => {
      items.push(docSnap.data() as InventoryItem);
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Fetch all logs from Firestore
export async function fetchLogsFromFirestore(): Promise<ScanAuditLog[]> {
  const path = 'logs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    const logs: ScanAuditLog[] = [];
    snapshot.forEach((docSnap) => {
      logs.push(docSnap.data() as ScanAuditLog);
    });
    return logs;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Save or update an item in Firestore
export async function saveItemToFirestore(item: InventoryItem): Promise<void> {
  const path = `items/${item.id}`;
  try {
    await setDoc(doc(db, 'items', item.id), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete item from Firestore
export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  const path = `items/${itemId}`;
  try {
    await deleteDoc(doc(db, 'items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Save a scan audit log to Firestore
export async function saveLogToFirestore(logItem: ScanAuditLog): Promise<void> {
  const path = `logs/${logItem.id}`;
  try {
    await setDoc(doc(db, 'logs', logItem.id), logItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Batch save items to Firestore (e.g. initial seed or XLSX import)
export async function batchSaveItemsToFirestore(items: InventoryItem[]): Promise<void> {
  const path = 'items';
  try {
    // Firestore batch limit is 500 writes
    const CHUNK_SIZE = 400;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        const itemRef = doc(db, 'items', item.id);
        batch.set(itemRef, item);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Subscribe to real-time item changes in Firestore
export function subscribeToFirestoreItems(
  onUpdate: (items: InventoryItem[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'items';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as InventoryItem);
      });
      onUpdate(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        if (onError && err instanceof Error) {
          onError(err);
        }
      }
    }
  );
}

// Subscribe to real-time logs in Firestore
export function subscribeToFirestoreLogs(
  onUpdate: (logs: ScanAuditLog[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'logs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: ScanAuditLog[] = [];
      snapshot.forEach((docSnap) => {
        logs.push(docSnap.data() as ScanAuditLog);
      });
      onUpdate(logs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        if (onError && err instanceof Error) {
          onError(err);
        }
      }
    }
  );
}
