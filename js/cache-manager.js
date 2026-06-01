const DB_NAME = "censoDB";
const STORE_NAME = "timestamps";
const TIMESTAMP_KEY = "last_update_";

let db = null;

export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveTimestamp(cacheKey, date = new Date()) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const key = TIMESTAMP_KEY + cacheKey;
    const request = store.put(date.getTime(), key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getTimestamp(cacheKey) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const key = TIMESTAMP_KEY + cacheKey;
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const timestamp = request.result;
      resolve(timestamp ? new Date(timestamp) : null);
    };
  });
}

export function formatTimestamp(date) {
  if (!date) return "No sincronizado";

  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export async function getFormattedTimestamp(cacheKey) {
  const timestamp = await getTimestamp(cacheKey);
  return formatTimestamp(timestamp);
}

export async function clearAllTimestamps() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
