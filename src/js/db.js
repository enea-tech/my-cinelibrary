// Archivio locale permanente (IndexedDB). Tutto avviene sul telefono, nessun server.
//
//  films  -> una scheda per film (testi, voto, date, miniatura)
//  covers -> copertina grande, letta solo quando serve
//  meta   -> impostazioni e contatori

const DB_NAME = 'my-cinelibrary';
const DB_VERSION = 1;

let dbp = null;
export let available = true;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) { reject(new Error('IndexedDB non disponibile')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('films')) db.createObjectStore('films', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbp = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('Impossibile aprire l\'archivio'));
    req.onblocked = () => reject(new Error('Archivio bloccato da un\'altra scheda'));
  });
  return dbp;
}

function wrap(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

/** Esegue più operazioni in un'unica transazione: o riescono tutte o nessuna. */
async function transact(names, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, 'readwrite');
    const stores = {};
    names.forEach((n) => { stores[n] = t.objectStore(n); });
    try { fn(stores); } catch (e) { try { t.abort(); } catch (_) { /* già chiusa */ } reject(e); return; }
    t.oncomplete = () => resolve(true);
    t.onerror = () => reject(t.error || new Error('Scrittura non riuscita'));
    t.onabort = () => reject(t.error || new Error('Scrittura annullata'));
  });
}

export async function loadAll() {
  try {
    const db = await open();
    const t = db.transaction(['films', 'meta'], 'readonly');
    const [films, metaRows] = await Promise.all([wrap(t.objectStore('films').getAll()), wrap(t.objectStore('meta').getAll())]);
    const meta = {};
    metaRows.forEach((r) => { meta[r.key] = r.value; });
    available = true;
    return { films, meta };
  } catch (e) {
    available = false;
    console.warn('Archivio locale non disponibile:', e);
    return { films: [], meta: {} };
  }
}

/** Salva (o aggiorna) una scheda. cover: stringa = nuova copertina, null = rimuovi, undefined = invariata. */
export async function saveFilm(film, cover, metaPatch) {
  if (!available) return false;
  const names = ['films', 'covers', 'meta'];
  await transact(names, (s) => {
    s.films.put(film);
    if (typeof cover === 'string') s.covers.put({ id: film.id, data: cover });
    else if (cover === null) s.covers.delete(film.id);
    if (metaPatch) Object.entries(metaPatch).forEach(([key, value]) => s.meta.put({ key, value }));
  });
  return true;
}

export async function saveFilms(films, metaPatch) {
  if (!available) return false;
  await transact(['films', 'meta'], (s) => {
    films.forEach((f) => s.films.put(f));
    if (metaPatch) Object.entries(metaPatch).forEach(([key, value]) => s.meta.put({ key, value }));
  });
  return true;
}

export async function removeFilm(id, metaPatch) {
  if (!available) return false;
  await transact(['films', 'covers', 'meta'], (s) => {
    s.films.delete(id);
    s.covers.delete(id);
    if (metaPatch) Object.entries(metaPatch).forEach(([key, value]) => s.meta.put({ key, value }));
  });
  return true;
}

export async function saveMeta(patch) {
  if (!available) return false;
  await transact(['meta'], (s) => { Object.entries(patch).forEach(([key, value]) => s.meta.put({ key, value })); });
  return true;
}

/** Importazione in blocco (ripristino da copia). */
export async function bulkImport(films, covers, metaPatch, replace) {
  if (!available) return false;
  await transact(['films', 'covers', 'meta'], (s) => {
    if (replace) { s.films.clear(); s.covers.clear(); }
    films.forEach((f) => s.films.put(f));
    Object.entries(covers || {}).forEach(([id, data]) => s.covers.put({ id, data }));
    if (metaPatch) Object.entries(metaPatch).forEach(([key, value]) => s.meta.put({ key, value }));
  });
  return true;
}

export async function clearAll() {
  if (!available) return false;
  await transact(['films', 'covers', 'meta'], (s) => { s.films.clear(); s.covers.clear(); s.meta.clear(); });
  return true;
}

export async function getCover(id) {
  if (!available) return null;
  try {
    const db = await open();
    const row = await wrap(db.transaction('covers').objectStore('covers').get(id));
    return row ? row.data : null;
  } catch (e) { return null; }
}

export async function getAllCovers() {
  if (!available) return {};
  const db = await open();
  const rows = await wrap(db.transaction('covers').objectStore('covers').getAll());
  const out = {};
  rows.forEach((r) => { out[r.id] = r.data; });
  return out;
}

/* ---------- Protezione dei dati ---------- */
export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) { /* non supportato */ }
  return false;
}

export async function storageInfo() {
  const info = { usage: null, quota: null, persisted: false };
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      info.usage = e.usage ?? null;
      info.quota = e.quota ?? null;
    }
    if (navigator.storage && navigator.storage.persisted) info.persisted = await navigator.storage.persisted();
  } catch (e) { /* ignora */ }
  return info;
}

/** Legge le copertine a gruppi (per non riempire la memoria con librerie grandi). */
export async function eachCoverBatch(size, cb) {
  if (!available) return;
  const db = await open();
  let lastKey = null;
  for (;;) {
    const range = lastKey == null ? undefined : IDBKeyRange.lowerBound(lastKey, true);
    const rows = await wrap(db.transaction('covers').objectStore('covers').getAll(range, size));
    if (!rows.length) break;
    cb(rows);
    lastKey = rows[rows.length - 1].id;
    if (rows.length < size) break;
  }
}
