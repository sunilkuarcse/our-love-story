const DATABASE_NAME = "our-love-story-gallery";
const DATABASE_VERSION = 1;
const PHYSICAL_STORE = "photos";
const LOGICAL_STORES = new Set(["photos", "timelineEvents", "loveLetters", "settings"]);

let databasePromise;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PHYSICAL_STORE)) database.createObjectStore(PHYSICAL_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error("Could not open local storage."));
      request.onblocked = () => reject(new Error("Local storage is busy in another tab. Close that tab and try again."));
    });
  }
  return databasePromise;
}

function storeRequest(storeName, mode, operation) {
  if (!LOGICAL_STORES.has(storeName)) return Promise.reject(new Error(`Unknown local storage collection: ${storeName}`));
  return getDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(PHYSICAL_STORE, mode);
    const request = operation(transaction.objectStore(PHYSICAL_STORE));
    let result;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error || new Error("Local storage request failed."));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error("Local storage transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Local storage transaction was cancelled."));
  }));
}

function physicalId(storeName, id) {
  return storeName === "photos" ? id : `${storeName}::${id}`;
}

export const getAllRecords = async (storeName) => {
  const records = await storeRequest(storeName, "readonly", (store) => store.getAll());
  return records
    .filter((record) => storeName === "photos" ? !record._bucket : record._bucket === storeName)
    .map((record) => {
      if (!record._bucket) return record;
      const { _bucket, _recordId, ...publicRecord } = record;
      return { ...publicRecord, id: _recordId };
    });
};

export const putRecord = (storeName, record) => {
  const storedRecord = storeName === "photos"
    ? record
    : { ...record, id: physicalId(storeName, record.id), _bucket: storeName, _recordId: record.id };
  return storeRequest(storeName, "readwrite", (store) => store.put(storedRecord));
};

export const deleteRecord = (storeName, id) => storeRequest(storeName, "readwrite", (store) => store.delete(physicalId(storeName, id)));

export const clearRecords = async (storeName) => {
  const records = await getAllRecords(storeName);
  if (!records.length) return undefined;
  return storeRequest(storeName, "readwrite", (store) => {
    let lastRequest;
    records.forEach((record) => {
      lastRequest = store.delete(physicalId(storeName, record.id));
    });
    return lastRequest;
  });
};

export const getSetting = async (key) => {
  const record = await storeRequest("settings", "readonly", (store) => store.get(physicalId("settings", key)));
  return record?.value;
};

export const setSetting = (key, value) => putRecord("settings", { id: key, key, value });