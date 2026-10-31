/* IndexedDB anahtar-değer önbelleği (kota dostu açılış) */

const DB_NAME = 'sevkiyat_db_v2';
const STORE = 'kv';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export function idbSet<T>(k: string, v: T): Promise<void> {
  return idbOpen().then(
    (db) =>
      new Promise<void>((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(v, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      })
  );
}

export function idbGet<T>(k: string): Promise<T | undefined> {
  return idbOpen().then(
    (db) =>
      new Promise<T | undefined>((res, rej) => {
        const tx = db.transaction(STORE, 'readonly');
        const rq = tx.objectStore(STORE).get(k);
        rq.onsuccess = () => res(rq.result as T | undefined);
        rq.onerror = () => rej(rq.error);
      })
  );
}

export function cacheSave(rows: unknown, targets: unknown): Promise<void> {
  return Promise.all([idbSet('rows', rows), idbSet('targets', targets)])
    .then(() => undefined)
    .catch(() => undefined);
}
