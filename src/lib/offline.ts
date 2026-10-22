/**
 * Offline study kits.
 *
 * A generated sheet is already a small JSON payload, so "download" means
 * writing that payload into IndexedDB on this device. Nothing is uploaded and
 * no account data leaves the browser; deleting a kit deletes it here.
 *
 * IndexedDB is used instead of localStorage because a deck of flashcards or a
 * slide deck can easily exceed the ~5 MB string quota, and because the values
 * are structured JSON rather than strings.
 */

const DB_NAME = "manthan-offline";
const STORE = "kits";
const VERSION = 1;

export type OfflineKind =
  | "summary"
  | "flashcards"
  | "quiz"
  | "mindmap"
  | "slides";

export type OfflineKit = {
  /** `${materialId}:${lang}` — one slot per language. */
  id: string;
  materialId: string;
  notebookId: string;
  notebookName: string;
  kind: OfflineKind;
  title: string;
  payload: unknown;
  lang: "en" | "hi";
  savedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("savedAt", "savedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function changed() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("manthan:offline-kits"));
}

export function offlineKitId(materialId: string, lang: "en" | "hi") {
  return `${materialId}:${lang}`;
}

export async function saveKit(kit: OfflineKit): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(kit);
    tx.oncomplete = () => {
      changed();
      resolve(true);
    };
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

export async function listKits(): Promise<OfflineKit[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => {
      const rows = (request.result as OfflineKit[]) ?? [];
      resolve(rows.sort((a, b) => b.savedAt - a.savedAt));
    };
    request.onerror = () => resolve([]);
  });
}

export async function isKitSaved(id: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getKey(id);
    request.onsuccess = () => resolve(Boolean(request.result));
    request.onerror = () => resolve(false);
  });
}

export async function removeKit(id: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      changed();
      resolve(true);
    };
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}
