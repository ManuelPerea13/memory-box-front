// Persistencia de las imágenes del editor entre navegaciones (p. ej. al tocar
// "Cambiar datos del cliente") usando IndexedDB. A diferencia de sessionStorage
// (~5MB y solo strings), IndexedDB guarda los Blobs nativamente y con cuota mucho
// mayor, así no se pierden las fotos ya cargadas.

const DB_NAME = "memorybox-editor";
const STORE = "images";
const VERSION = 1;

export interface StoredCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StoredEditorImage {
  id: string;
  name: string;
  blob: Blob;
  crop: StoredCrop | null;
  cropPosition?: { x: number; y: number };
  zoom?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveEditorImages(
  orderId: string,
  items: StoredEditorImage[],
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(items, orderId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* si IndexedDB no está disponible, no rompemos el flujo */
  }
}

export async function loadEditorImages(
  orderId: string,
): Promise<StoredEditorImage[] | null> {
  try {
    const db = await openDB();
    const result = await new Promise<StoredEditorImage[] | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(orderId);
        req.onsuccess = () =>
          resolve((req.result as StoredEditorImage[]) ?? null);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function clearEditorImages(orderId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(orderId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* ignore */
  }
}
