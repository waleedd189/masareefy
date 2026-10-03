export const OFFLINE_DB_NAME = "masareefy-offline";
const OFFLINE_DB_VERSION = 1;
const OUTBOX = "outbox";
const SNAPSHOTS = "snapshots";

export type OfflineOperation = {
  id: string;
  kind: "card" | "transaction" | "message";
  createdAt: string;
  payload: Record<string, unknown>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OUTBOX)) database.createObjectStore(OUTBOX, { keyPath: "id" });
      if (!database.objectStoreNames.contains(SNAPSHOTS)) database.createObjectStore(SNAPSHOTS, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOperation(operation: OfflineOperation): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX, "readwrite");
    transaction.objectStore(OUTBOX).put(operation);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function listOperations(): Promise<OfflineOperation[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(OUTBOX, "readonly").objectStore(OUTBOX).getAll();
    request.onsuccess = () => resolve(request.result as OfflineOperation[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOperations(ids: string[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OUTBOX, "readwrite");
    const store = transaction.objectStore(OUTBOX);
    ids.forEach((id) => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveSnapshot<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOTS, "readwrite");
    transaction.objectStore(SNAPSHOTS).put({ key, value, savedAt: new Date().toISOString() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getSnapshot<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(SNAPSHOTS, "readonly").objectStore(SNAPSHOTS).get(key);
    request.onsuccess = () => resolve((request.result?.value as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}
