// Navigazione: ogni schermata è un indirizzo (#/film/123). Il tasto Indietro di iPhone e dell'app funziona sempre.
import * as store from './store.js';
import { closeOverlays } from './ui.js';

const defs = [];
let base = null;   // schermata di fondo
let modal = null;  // schermata a tutto schermo (modulo)
let cur = 0;       // posizione nella cronologia
const scrollMem = new Map();
const EASE = 'cubic-bezier(.22,.8,.24,1)';

/** pattern: '/film/:id'. def: { tab, modal, parent(params), live, build(params) -> {html, mount(el), redirect} } */
export function route(pattern, def) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/?]+)'; }) + '$');
  defs.push({ re, keys, def });
}

function match(hash) {
  const h = String(hash || '').replace(/^#/, '') || '/home';
  const [path, qs] = h.split('?');
  for (const d of defs) {
    const m = d.re.exec(path);
    if (!m) continue;
    const params = {};
    d.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch (e) { params[k] = m[i + 1]; } });
    params.q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { def: d.def, params, hash: '#' + h };
  }
  return null;
}

/* ---------- Navigazione ---------- */
export function go(hash) { history.pushState({ i: ++cur }, '', hash); render(); }
export function replace(hash) { history.replaceState({ i: cur }, '', hash); render(); }
export function back(fallback = '#/home') {
  if (cur > 0) history.back();
  else replace(fallback);
}
export const currentHash = () => (base ? base.hash : '#/home');

export function start() {
  window.addEventListener('popstate', () => render());
  const st = history.state;
  cur = st && typeof st.i === 'number' ? st.i : 0;
  history.replaceState({ i: cur }, '', location.hash && location.hash !== '#' ? location.hash : '#/home');
  render(true);
}

/* ---------- Costruzione delle schermate ---------- */
function mountScreen(m, layer, isModal, dir) {
  const s = m.def.build(m.params, { dir });
  if (!s) return null;
  if (s.redirect) return { redirect: s.redirect };
  const el = document.createElement('section');
  el.className = 'screen' + (isModal ? ' modal' : '');
  el.dataset.hash = m.hash;
  el.innerHTML = s.html;
  layer.appendChild(el);
  const inst = { el, hash: m.hash, def: m.def, params: m.params, cleanup: null, unsub: null };
  try { inst.cleanup = s.mount ? s.mount(el) : null; } catch (e) { console.error(e); }
  if (m.def.live) {
    let queued = false;
    inst.unsub = store.subscribe(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; rebuild(inst); });
    });
  }
  return inst;
}

/** Aggiorna la schermata dopo una modifica dei dati, mantenendo la posizione di scorrimento. */
function rebuild(inst) {
  if (!inst.el.isConnected) return;
  const s = inst.def.build(inst.params, { dir: 'pop' });
  if (!s) return;
  if (s.redirect) { if (inst === base) replace(s.redirect); return; }
  const sc = inst.el.querySelector('.scroll');
  const top = sc ? sc.scrollTop : 0;
  try { if (inst.cleanup) inst.cleanup(); } catch (e) { console.error(e); }
  inst.el.innerHTML = s.html;
  try { inst.cleanup = s.mount ? s.mount(inst.el) : null; } catch (e) { console.error(e); }
  const nsc = inst.el.querySelector('.scroll');
  if (nsc) nsc.scrollTop = top;
}

function destroy(inst) {
  if (!inst) return;
  try { if (inst.cleanup) inst.cleanup(); } catch (e) { console.error(e); }
  if (inst.unsub) inst.unsub();
  inst.el.remove();
}

function setTab(tab) {
  document.querySelectorAll('#tabbar button').forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function slide(el, from, to, ms, ease = EASE) {
  return el.animate([{ transform: from }, { transform: to }], { duration: ms, easing: ease, fill: 'both' });
}

function showBase(m, dir) {
  if (base && base.hash === m.hash) return true;
  const prev = base;
  if (prev) { const sc = prev.el.querySelector('.scroll'); if (sc) scrollMem.set(prev.hash, sc.scrollTop); }
  const inst = mountScreen(m, document.getElementById('view'), false, dir);
  if (!inst) return false;
  if (inst.redirect) { replace(inst.redirect); return true; }
  base = inst;
  setTab(m.def.tab);
  if (dir === 'pop' && scrollMem.has(m.hash)) {
    const sc = inst.el.querySelector('.scroll');
    if (sc) sc.scrollTop = scrollMem.get(m.hash);
  }
  if (!prev) return true;
  if (dir === 'push') {
    inst.el.style.zIndex = 2;
    slide(inst.el, 'translateX(100%)', 'translateX(0)', 340).onfinish = () => { destroy(prev); inst.el.style.zIndex = ''; };
    prev.el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24%)', opacity: .6 }], { duration: 340, easing: EASE, fill: 'both' });
  } else if (dir === 'pop') {
    prev.el.style.zIndex = 2;
    inst.el.animate([{ transform: 'translateX(-24%)', opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: EASE });
    slide(prev.el, 'translateX(0)', 'translateX(100%)', 320).onfinish = () => destroy(prev);
  } else {
    destroy(prev);
    inst.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
  }
  return true;
}

function openModal(m) {
  if (modal && modal.hash === m.hash) return;
  if (modal) { destroy(modal); modal = null; }
  const inst = mountScreen(m, document.getElementById('modal-layer'), true, 'push');
  if (!inst) return;
  if (inst.redirect) { replace(inst.redirect); return; }
  modal = inst;
  inst.el.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 380, easing: EASE });
}

function closeModal() {
  if (!modal) return;
  const inst = modal;
  modal = null;
  try { if (inst.cleanup) inst.cleanup(); } catch (e) { console.error(e); }
  if (inst.unsub) inst.unsub();
  if (document.activeElement && inst.el.contains(document.activeElement)) document.activeElement.blur();
  const a = inst.el.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 280, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards' });
  a.onfinish = () => inst.el.remove();
}

function render(initial) {
  const hash = location.hash || '#/home';
  let m = match(hash);
  if (!m) { history.replaceState({ i: cur }, '', '#/home'); m = match('#/home'); }
  const st = history.state;
  let idx = st && typeof st.i === 'number' ? st.i : null;
  if (idx == null) { idx = cur + 1; history.replaceState({ i: idx }, '', hash); }
  const dir = initial ? 'replace' : idx > cur ? 'push' : idx < cur ? 'pop' : 'replace';
  cur = idx;
  closeOverlays();
  if (m.def.modal) {
    if (!base) { const pm = match(m.def.parent ? m.def.parent(m.params) : '#/home'); showBase(pm, 'replace'); }
    openModal(m);
  } else {
    closeModal();
    showBase(m, dir);
  }
}

/** Ricostruisce la schermata attuale (ad esempio dopo un cambio di ordinamento). */
export function refresh() { if (base) rebuild(base); }

/** Torna in cima alla schermata attuale (tocco sulla scheda già attiva). */
export function scrollTop() {
  const sc = base && base.el.querySelector('.scroll');
  if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
}
