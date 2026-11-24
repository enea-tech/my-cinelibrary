// Preferenze leggere dell'interfaccia (ordinamenti, ultima vista). Non contengono dati dei film.
const KEY = 'cinelib.prefs.v1';
let cache = null;
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { cache = {}; }
  return cache;
}
export const pref = (k, d) => (k in load() ? load()[k] : d);
export function setPref(k, v) {
  load()[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* spazio esaurito o non disponibile */ }
}
export function draft(kind, value) {
  const k = 'cinelib.draft.' + kind;
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
    if (value === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(value));
  } catch (e) { /* ignora */ }
  return null;
}
