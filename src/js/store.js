// Stato dell'app: tutti i film vivono in memoria (veloce anche con migliaia di schede)
// e ogni modifica viene scritta subito nell'archivio permanente (IndexedDB).
import * as db from './db.js';
import { uid, clean, dirKey, norm, surnameKey, sortTitle, parseISO, parseRating, lev } from './util.js';

export const state = { ready: false, films: new Map(), meta: { nextSeq: 1, lastBackupAt: 0, changesSinceBackup: 0 } };
export const dbAvailable = () => db.available;

const subs = new Set();
let _idx = null;
const hay = new WeakMap();

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit() { _idx = null; subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

/* ---------- Scheda film: campi validi e puliti ---------- */
export function sanitizeFilm(r) {
  const title = clean(r.title);
  const director = clean(r.director);
  const year = parseInt(r.year, 10);
  const rating = parseRating(r.rating);
  const thumb = typeof r.thumb === 'string' && r.thumb.startsWith('data:image/') ? r.thumb : null;
  return {
    id: String(r.id || uid()),
    status: r.status === 'want' ? 'want' : 'seen',
    title,
    director,
    dkey: dirKey(director),
    year: year >= 1888 && year <= 2100 ? year : null,
    seenOn: parseISO(r.seenOn) ? r.seenOn : null,
    rating,
    comment: String(r.comment ?? '').trim(),
    notes: String(r.notes ?? '').trim(),
    fav: !!r.fav,
    thumb,
    hasCover: !!r.hasCover,
    seq: Number.isFinite(+r.seq) ? +r.seq : 0,
    addedAt: +r.addedAt || Date.now(),
    updatedAt: +r.updatedAt || Date.now(),
  };
}

/* ---------- Avvio ---------- */
export async function init() {
  const { films, meta } = await db.loadAll();
  films.forEach((f) => state.films.set(f.id, f));
  state.meta = { nextSeq: 1, lastBackupAt: 0, changesSinceBackup: 0, ...meta };
  let max = 0;
  films.forEach((f) => { if (f.seq > max) max = f.seq; });
  if (state.meta.nextSeq <= max) state.meta.nextSeq = max + 1;
  state.ready = true;
  emit();
  if (films.length) db.requestPersist();
}

/* ---------- Indici (ricalcolati solo dopo una modifica) ---------- */
function cmpSeen(a, b) {
  if (a.seenOn && b.seenOn) return a.seenOn < b.seenOn ? 1 : a.seenOn > b.seenOn ? -1 : b.seq - a.seq;
  if (a.seenOn) return -1;
  if (b.seenOn) return 1;
  return b.seq - a.seq;
}

export function index() {
  if (_idx) return _idx;
  const seen = [], want = [], dirs = new Map();
  for (const f of state.films.values()) {
    (f.status === 'want' ? want : seen).push(f);
    if (!f.dkey) continue;
    let d = dirs.get(f.dkey);
    if (!d) { d = { key: f.dkey, name: f.director, _seq: Infinity, films: [], wants: 0, count: 0, last: '', lastSeq: 0, sum: 0, rated: 0 }; dirs.set(f.dkey, d); }
    if (f.seq < d._seq) { d._seq = f.seq; d.name = f.director; }
    if (f.status === 'want') { d.wants++; continue; }
    d.films.push(f);
    d.count++;
    if (f.seenOn && f.seenOn > d.last) d.last = f.seenOn;
    if (f.seq > d.lastSeq) d.lastSeq = f.seq;
    if (f.rating) { d.sum += f.rating; d.rated++; }
  }
  seen.sort(cmpSeen);
  want.sort((a, b) => (b.fav - a.fav) || (b.seq - a.seq));
  const dirList = [];
  dirs.forEach((d) => {
    d.sortKey = surnameKey(d.name);
    d.avg = d.rated ? d.sum / d.rated : null;
    d.films.sort(cmpSeen);
    if (d.count) dirList.push(d);
  });
  _idx = { seen, want, dirs, dirList };
  return _idx;
}

export const getFilm = (id) => state.films.get(id) || null;
export const getDirector = (key) => index().dirs.get(key) || null;
export const counts = () => { const i = index(); return { seen: i.seen.length, want: i.want.length, dirs: i.dirList.length }; };

/* ---------- Registi: suggerimenti, duplicati, nomi coerenti ---------- */
export function suggestDirectors(q, limit = 6) {
  const nq = norm(q);
  if (!nq) return [];
  const out = [];
  index().dirs.forEach((d) => {
    const k = d.key;
    let score = -1;
    if (k === nq) score = 0;
    else if (k.startsWith(nq)) score = 1;
    else if (k.split(' ').some((w) => w.startsWith(nq))) score = 2;
    else if (k.includes(nq)) score = 3;
    if (score >= 0) out.push({ d, score });
  });
  out.sort((a, b) => a.score - b.score || (b.d.count + b.d.wants) - (a.d.count + a.d.wants) || a.d.name.localeCompare(b.d.name, 'it'));
  return out.slice(0, limit).map((x) => x.d);
}

/** Regista già presente con nome quasi uguale (errore di battitura). */
export function nearestDirector(name) {
  const key = dirKey(name);
  if (key.length < 5) return null;
  const dirs = index().dirs;
  if (dirs.has(key)) return null;
  let best = null, bestD = 3;
  dirs.forEach((d) => {
    const dist = lev(key, d.key, 2);
    if (dist < bestD) { bestD = dist; best = d; }
  });
  return best;
}

export function findDuplicate(title, directorName, excludeId) {
  const t = norm(title), k = dirKey(directorName);
  if (!t) return null;
  for (const f of state.films.values()) {
    if (f.id !== excludeId && f.status === 'seen' && norm(f.title) === t && (!k || f.dkey === k)) return f;
  }
  return null;
}

/** Nome da usare per un regista: se il gruppo esiste già, si usa la grafia del gruppo. */
function canonical(typed, excludeIds = []) {
  const name = clean(typed), key = dirKey(name);
  let best = null;
  for (const f of state.films.values()) {
    if (f.dkey === key && !excludeIds.includes(f.id) && (!best || f.seq < best.seq)) best = f;
  }
  return { director: best ? best.director : name, dkey: key };
}

/* ---------- Scritture ---------- */
function metaAfter(extra = {}) {
  return { nextSeq: state.meta.nextSeq, changesSinceBackup: state.meta.changesSinceBackup + 1, ...extra };
}

export async function addFilm(input, cover) {
  const { director, dkey } = canonical(input.director);
  const film = sanitizeFilm({ ...input, id: uid(), director, seq: state.meta.nextSeq, addedAt: Date.now(), updatedAt: Date.now(), hasCover: !!cover });
  if (!cover) film.thumb = null;
  const patch = metaAfter({ nextSeq: state.meta.nextSeq + 1 });
  film.dkey = dkey;
  await db.saveFilm(film, cover || undefined, patch);
  state.films.set(film.id, film);
  Object.assign(state.meta, patch);
  emit();
  return film;
}

/** cover: undefined = invariata, stringa = nuova, null = rimossa */
export async function updateFilm(id, changes, cover) {
  const old = state.films.get(id);
  if (!old) throw new Error('Film non trovato');
  const merged = { ...old, ...changes, id, seq: old.seq, addedAt: old.addedAt, updatedAt: Date.now() };
  if ('director' in changes) { const c = canonical(merged.director, [id]); merged.director = c.director; }
  if (cover === null) { merged.hasCover = false; merged.thumb = null; }
  else if (typeof cover === 'string') merged.hasCover = true;
  const film = sanitizeFilm(merged);
  const patch = metaAfter();
  await db.saveFilm(film, cover, patch);
  state.films.set(id, film);
  Object.assign(state.meta, patch);
  emit();
  return film;
}

export async function deleteFilm(id) {
  if (!state.films.has(id)) return;
  const patch = metaAfter();
  await db.removeFilm(id, patch);
  state.films.delete(id);
  Object.assign(state.meta, patch);
  emit();
}

export const setFav = (id, v) => updateFilm(id, { fav: !!v });

/** Annulla un'eliminazione: rimette la scheda (e la copertina) com'era. */
export async function restoreFilm(film, cover) {
  const patch = metaAfter();
  await db.saveFilm(film, cover || undefined, patch);
  state.films.set(film.id, film);
  Object.assign(state.meta, patch);
  emit();
}

export function moveToSeen(id, data, cover) {
  return updateFilm(id, { ...data, status: 'seen', fav: false }, cover);
}

export function moveToWant(id) {
  const f = state.films.get(id);
  const notes = [f.notes, f.comment].filter(Boolean).join('\n\n');
  return updateFilm(id, { status: 'want', seenOn: null, rating: null, comment: '', notes, fav: false });
}

/** Rinomina un regista in tutte le sue schede. Se il nuovo nome esiste già i due gruppi si uniscono. */
export async function renameDirector(oldKey, newName) {
  const name = clean(newName);
  if (!name) throw new Error('Scrivi il nome del regista');
  const mine = Array.from(state.films.values()).filter((f) => f.dkey === oldKey);
  const ids = mine.map((f) => f.id);
  const target = canonical(name, ids);
  const sameKey = dirKey(name) === oldKey;
  const finalName = sameKey ? name : target.director;
  const changed = mine.map((f) => ({ ...f, director: finalName, dkey: dirKey(finalName), updatedAt: Date.now() }));
  // schede dell'eventuale gruppo di destinazione: stessa grafia
  const merged = !sameKey ? Array.from(state.films.values()).filter((f) => f.dkey === dirKey(finalName) && f.director !== finalName).map((f) => ({ ...f, director: finalName, updatedAt: Date.now() })) : [];
  const all = [...changed, ...merged];
  const patch = metaAfter();
  await db.saveFilms(all, patch);
  all.forEach((f) => state.films.set(f.id, f));
  Object.assign(state.meta, patch);
  emit();
  return { key: dirKey(finalName), name: finalName, merged: !sameKey && target.director !== name ? true : (merged.length > 0) };
}

/* ---------- Ricerca ---------- */
function haystack(f) {
  let h = hay.get(f);
  if (!h) { h = norm(f.title + ' ' + f.director + ' ' + (f.year || '') + ' ' + f.comment + ' ' + f.notes); hay.set(f, h); }
  return h;
}

export function searchFilms(q, list) {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) return list;
  const out = [];
  for (const f of list) {
    const h = haystack(f);
    if (toks.every((t) => h.includes(t))) out.push(f);
  }
  return out;
}

export function searchDirectors(q) {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) return index().dirList;
  return index().dirList.filter((d) => toks.every((t) => d.key.includes(t)));
}

/** Ordina i film per titolo / regista / data / voto. */
export function sortFilms(list, by) {
  const l = list.slice();
  const t = (f) => sortTitle(f.title);
  switch (by) {
    case 'title': l.sort((a, b) => t(a).localeCompare(t(b), 'it') || b.seq - a.seq); break;
    case 'director': l.sort((a, b) => surnameKey(a.director).localeCompare(surnameKey(b.director), 'it') || t(a).localeCompare(t(b), 'it')); break;
    case 'date-asc': l.sort((a, b) => -cmpSeen(a, b) || a.seq - b.seq); break;
    case 'rating': l.sort((a, b) => (b.rating || 0) - (a.rating || 0) || cmpSeen(a, b)); break;
    case 'added': l.sort((a, b) => b.seq - a.seq); break;
    case 'added-asc': l.sort((a, b) => a.seq - b.seq); break;
    default: l.sort(cmpSeen);
  }
  return l;
}

export function sortDirectors(list, by) {
  const l = list.slice();
  switch (by) {
    case 'count': l.sort((a, b) => b.count - a.count || a.sortKey.localeCompare(b.sortKey, 'it')); break;
    case 'recent': l.sort((a, b) => (b.last || '').localeCompare(a.last || '') || b.lastSeq - a.lastSeq); break;
    case 'rating': l.sort((a, b) => (b.avg || 0) - (a.avg || 0) || b.count - a.count); break;
    default: l.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'it'));
  }
  return l;
}

/* ---------- Statistiche ---------- */
export function stats() {
  const { seen, want, dirList } = index();
  const rated = seen.filter((f) => f.rating);
  const avg = rated.length ? rated.reduce((a, f) => a + f.rating, 0) / rated.length : null;
  const byYear = new Map(), hist = Array(10).fill(0), decades = new Map();
  const now = new Date(), thisYear = String(now.getFullYear()), thisMonth = thisYear + '-' + String(now.getMonth() + 1).padStart(2, '0');
  let inYear = 0, inMonth = 0, first = '';
  for (const f of seen) {
    if (f.seenOn) {
      const y = f.seenOn.slice(0, 4);
      byYear.set(y, (byYear.get(y) || 0) + 1);
      if (y === thisYear) inYear++;
      if (f.seenOn.startsWith(thisMonth)) inMonth++;
      if (!first || f.seenOn < first) first = f.seenOn;
    }
    if (f.rating) hist[Math.min(10, Math.max(1, Math.round(f.rating))) - 1]++;
    if (f.year) { const d = Math.floor(f.year / 10) * 10; decades.set(d, (decades.get(d) || 0) + 1); }
  }
  const topDirs = dirList.slice().sort((a, b) => b.count - a.count || (b.avg || 0) - (a.avg || 0) || a.sortKey.localeCompare(b.sortKey)).slice(0, 8);
  const topRated = rated.slice().sort((a, b) => b.rating - a.rating || cmpSeen(a, b)).slice(0, 5);
  const bestDirs = dirList.filter((d) => d.count >= 3 && d.avg).sort((a, b) => b.avg - a.avg).slice(0, 3);
  return {
    seen: seen.length, want: want.length, dirs: dirList.length, avg, rated: rated.length,
    commented: seen.filter((f) => f.comment).length, favs: seen.filter((f) => f.fav).length,
    inYear, inMonth, first,
    years: Array.from(byYear.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1),
    hist, decades: Array.from(decades.entries()).sort((a, b) => a[0] - b[0]),
    topDirs, topRated, bestDirs,
  };
}

/* ---------- Copie di sicurezza ---------- */
export const needsBackup = () => {
  const n = state.films.size, m = state.meta;
  if (n < 8) return false;
  if (!m.lastBackupAt) return true;
  return m.changesSinceBackup >= 15 && Date.now() - m.lastBackupAt > 7 * 86400000;
};

export async function markBackedUp() {
  const patch = { lastBackupAt: Date.now(), changesSinceBackup: 0 };
  await db.saveMeta(patch);
  Object.assign(state.meta, patch);
  emit();
}

export async function exportJSON({ covers = true } = {}) {
  const films = Array.from(state.films.values()).sort((a, b) => a.seq - b.seq);
  const parts = [];
  const head = { app: 'my-cinelibrary', version: 1, exportedAt: new Date().toISOString(), nextSeq: state.meta.nextSeq, count: films.length };
  parts.push(JSON.stringify(head).slice(0, -1) + ',"films":[');
  for (let i = 0; i < films.length; i += 200) {
    const chunk = films.slice(i, i + 200).map((f) => JSON.stringify(f)).join(',');
    parts.push(new Blob([(i ? ',' : '') + chunk]));
  }
  parts.push('],"covers":{');
  if (covers) {
    let first = true;
    await db.eachCoverBatch(40, (rows) => {
      const s = rows.map((r) => JSON.stringify(r.id) + ':' + JSON.stringify(r.data)).join(',');
      parts.push(new Blob([(first ? '' : ',') + s]));
      first = false;
    });
  }
  parts.push('}}');
  return new Blob(parts, { type: 'application/json' });
}

const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
export function exportCSV() {
  const rows = [['Stato', 'Titolo', 'Regista', 'Anno', 'Data visione', 'Voto', 'Preferito', 'Commento', 'Annotazioni']];
  const list = Array.from(state.films.values()).sort((a, b) => (a.status === b.status ? surnameKey(a.director).localeCompare(surnameKey(b.director), 'it') || sortTitle(a.title).localeCompare(sortTitle(b.title), 'it') : a.status === 'seen' ? -1 : 1));
  list.forEach((f) => rows.push([f.status === 'seen' ? 'Visto' : 'Da vedere', f.title, f.director, f.year || '', f.seenOn || '', f.rating ? String(f.rating).replace('.', ',') : '', f.fav ? 'Sì' : '', f.comment, f.notes]));
  return new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

/** Legge una copia di sicurezza. mode: 'merge' (aggiunge) oppure 'replace' (sostituisce tutto). */
export async function importBackup(text, mode = 'merge') {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Il file non è una copia valida di My CineLibrary.'); }
  if (!data || data.app !== 'my-cinelibrary' || !Array.isArray(data.films)) throw new Error('Il file non è una copia valida di My CineLibrary.');
  const replace = mode === 'replace';
  const incoming = [];
  for (const r of data.films) {
    const f = sanitizeFilm(r || {});
    if (f.title) incoming.push(f);
  }
  const covers = data.covers && typeof data.covers === 'object' ? data.covers : {};
  const base = replace ? new Map() : new Map(state.films);
  let added = 0, updated = 0;
  let seq = replace ? 0 : state.meta.nextSeq - 1;
  const maxIncoming = incoming.reduce((a, f) => Math.max(a, f.seq), 0);
  incoming.sort((a, b) => a.seq - b.seq);
  const touched = [];
  for (const f of incoming) {
    const cur = base.get(f.id);
    if (cur) {
      if (f.updatedAt > cur.updatedAt) { base.set(f.id, f); touched.push(f); updated++; }
    } else {
      if (!replace) f.seq = ++seq;
      base.set(f.id, f); touched.push(f); added++;
    }
  }
  // stessa grafia per lo stesso regista
  const firstName = new Map();
  Array.from(base.values()).sort((a, b) => a.seq - b.seq).forEach((f) => { if (f.dkey && !firstName.has(f.dkey)) firstName.set(f.dkey, f.director); });
  base.forEach((f) => {
    const n = firstName.get(f.dkey);
    if (n && n !== f.director) { const g = { ...f, director: n }; base.set(f.id, g); const i = touched.findIndex((t) => t.id === f.id); if (i >= 0) touched[i] = g; else touched.push(g); }
  });
  let nextSeq = Math.max(replace ? 0 : state.meta.nextSeq - 1, seq, replace ? maxIncoming : 0, ...Array.from(base.values()).map((f) => f.seq)) + 1;
  const usedCovers = {};
  touched.forEach((f) => { if (f.hasCover && typeof covers[f.id] === 'string') usedCovers[f.id] = covers[f.id]; else if (f.hasCover && !covers[f.id]) f.hasCover = false; });
  const patch = { nextSeq, changesSinceBackup: replace ? 0 : state.meta.changesSinceBackup + added + updated };
  await db.bulkImport(touched, usedCovers, patch, replace);
  state.films = replace ? new Map() : state.films;
  base.forEach((f, id) => state.films.set(id, f));
  Object.assign(state.meta, patch);
  emit();
  return { added, updated, total: state.films.size };
}

export async function wipeAll() {
  await db.clearAll();
  state.films.clear();
  state.meta = { nextSeq: 1, lastBackupAt: 0, changesSinceBackup: 0 };
  emit();
}

export const loadCover = (id) => db.getCover(id);
