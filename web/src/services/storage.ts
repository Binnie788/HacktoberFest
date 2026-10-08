import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CapturedPhoto } from '../types/camera';

interface LuminaDB extends DBSchema {
  photos: {
    key: string;
    value: Omit<CapturedPhoto, 'dataUrl'>;
    indexes: { 'by-date': number };
  };
}

const DB_NAME = 'lumina_photos_v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LuminaDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LuminaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id' });
          store.createIndex('by-date', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return true;
    } catch (e) {
      console.warn('[Storage] Persistent storage request failed:', e);
    }
  }
  return false;
}

export async function savePhoto(
  photoData: Omit<CapturedPhoto, 'dataUrl'>
): Promise<CapturedPhoto> {
  const db = await getDB();
  await db.put('photos', photoData);
  const dataUrl = URL.createObjectURL(photoData.blob);
  return {
    ...photoData,
    dataUrl,
  };
}

export async function getAllPhotos(): Promise<CapturedPhoto[]> {
  const db = await getDB();
  const rawList = await db.getAllFromIndex('photos', 'by-date');
  // Sort descending by timestamp
  rawList.reverse();

  return rawList.map((item) => ({
    ...item,
    dataUrl: URL.createObjectURL(item.blob),
  }));
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('photos', id);
}
