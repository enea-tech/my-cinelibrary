// Funzioni di utilità condivise (testo, date, voti, ricerca)

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function uid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fallback */ }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export function debounce(fn, ms = 150) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

export const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/* ---------- Normalizzazione per confronti (senza accenti, maiuscole, punteggiatura) ---------- */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
    .toLowerCase()
    .replace(/[’'`´]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chiave del regista: "Tarantino, Quentin" e "quentin  TARANTINO" danno la stessa chiave. */
export function dirKey(name) {
  let s = String(name ?? '');
  const parts = s.split(',');
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) s = parts[1] + ' ' + parts[0];
  return norm(s);
}

const PARTICLES = new Set(['de', 'di', 'da', 'del', 'della', 'dei', 'van', 'von', 'der', 'den', 'le', 'la', 'du', 'dos', 'das', 'el', 'al', 'bin', 'ben', 'mac', 'st']);

/** Chiave di ordinamento per cognome: "Quentin Tarantino" -> "tarantino quentin" */
export function surnameKey(name) {
  const w = dirKey(name).split(' ').filter(Boolean);
  if (w.length <= 1) return w.join(' ');
  let i = w.length - 1;
  while (i > 1 && PARTICLES.has(w[i - 1])) i--;
  return w.slice(i).join(' ') + ' ' + w.slice(0, i).join(' ');
}

const ARTICLES = /^(il|lo|la|l|i|gli|le|un|uno|una|the|a|an|el|les|der|die|das)\s+/;
/** Titolo per ordinamento: "Il padrino" -> "padrino" */
export function sortTitle(t) {
  const n = norm(t);
  const m = n.match(ARTICLES);
  return m && n.length > m[0].length ? n.slice(m[0].length) : n;
}

export function initialOf(sortKey) {
  const c = (sortKey || '').charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

export function lev(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* ---------- Date (salvate come AAAA-MM-GG, ora locale) ---------- */
const pad = (n) => String(n).padStart(2, '0');
export function todayISO(d = new Date()) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d) ? null : d;
}
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export function fmtDate(s, long = false) {
  const d = parseISO(s);
  if (!d) return '';
  return d.getDate() + ' ' + (long ? MESI[d.getMonth()] : MESI_BREVI[d.getMonth()]) + ' ' + d.getFullYear();
}
export function fmtMonthYear(s) {
  const d = parseISO(s);
  if (!d) return 'Data non indicata';
  const m = MESI[d.getMonth()];
  return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + d.getFullYear();
}
export function timeAgo(ts) {
  if (!ts) return 'mai';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 30) return days + ' giorni fa';
  const mo = Math.floor(days / 30);
  return mo === 1 ? '1 mese fa' : mo + ' mesi fa';
}

/* ---------- Voti ---------- */
export function fmtRating(r) {
  if (r == null || r === '') return '';
  return String(Math.round(r * 2) / 2).replace('.', ',');
}
/** Media con un decimale: 8,7 (a differenza del voto, che va a mezzi punti). */
export function fmtAvg(x) {
  if (x == null || !isFinite(x)) return '–';
  const v = Math.round(x * 10) / 10;
  return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
}
export function parseRating(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.round(n * 2) / 2);
}

export function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

export function fmtBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
}

const fold1 = (ch) => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Evidenzia nel testo la parte che corrisponde alla ricerca (ignora accenti e maiuscole). */
export function highlight(text, q) {
  const t = String(text ?? '');
  const query = String(q ?? '').trim();
  if (!query) return esc(t);
  const arr = Array.from(t);
  let flat = '';
  const map = [];
  arr.forEach((ch, k) => { const f = fold1(ch); for (let j = 0; j < f.length; j++) { flat += f[j]; map.push(k); } });
  const q2 = Array.from(query).map(fold1).join('');
  const idx = q2 ? flat.indexOf(q2) : -1;
  if (idx < 0) return esc(t);
  const start = map[idx];
  const end = map[idx + q2.length - 1] + 1;
  return esc(arr.slice(0, start).join('')) + '<mark>' + esc(arr.slice(start, end).join('')) + '</mark>' + esc(arr.slice(end).join(''));
}
