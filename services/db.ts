
const DB_NAME = 'SkillAssessmentDB';
const DB_VERSION = 1;
const STORE_NAME = 'trainingMaterials';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(true);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', request.error);
      reject(false);
    };

    request.onsuccess = (event) => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const addMaterial = (material: { id: string; data: string }): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
        return reject('DB is not initialized.');
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(material);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error('Error adding material to DB:', request.error);
      reject(request.error);
    };
  });
};

export const getMaterialData = (id: string): Promise<string | undefined> => {
  return new Promise((resolve, reject) => {
    if (!db) {
        return reject('DB is not initialized.');
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result?.data);
    };
    request.onerror = () => {
      console.error('Error getting material from DB:', request.error);
      reject(request.error);
    };
  });
};

export const deleteMaterial = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
        return reject('DB is not initialized.');
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.error('Error deleting material from DB:', request.error);
      reject(request.error);
    };
  });
};

export const getAllMaterials = (): Promise<{id: string, data: string}[]> => {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB is not initialized.');
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            console.error('Error getting all materials from DB:', request.error);
            reject(request.error);
        };
    });
};

export const clearAllMaterials = (): Promise<void> => {
     return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB is not initialized.');
        }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          console.error('Error clearing materials from DB:', request.error);
          reject(request.error);
        };
  });
}
