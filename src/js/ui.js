// Elementi grafici condivisi: locandine, avvisi, pannelli, finestre di dialogo, lista a scorrimento virtuale
import { icon } from './icons.js';
import { esc, norm, clean } from './util.js';

/* ---------- Locandine ---------- */
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
const ART = new Set(['il', 'lo', 'la', 'l', 'i', 'gli', 'le', 'un', 'uno', 'una', 'the', 'a', 'an', 'el']);

function initials(title) {
  const w = norm(title).split(' ').filter(Boolean);
  const sig = w.length > 1 && ART.has(w[0]) ? w.slice(1) : w;
  const a = (sig[0] || '?').charAt(0), b = sig[1] ? sig[1].charAt(0) : '';
  return (a + b).toUpperCase();
}

/** Locandina: copertina vera se presente, altrimenti una locandina tipografica con colore stabile per titolo. */
const PART = new Set(['de', 'di', 'da', 'del', 'della', 'dei', 'van', 'von', 'der', 'den', 'le', 'la', 'du', 'dos', 'das', 'el', 'al', 'bin', 'ben', 'mac', 'st']);
function credit(name) {
  const w = clean(name).split(' ').filter(Boolean);
  if (!w.length) return '';
  let i = w.length - 1;
  while (i > 0 && PART.has(w[i - 1].toLowerCase())) i--;
  return w.slice(i).join(' ');
}

export function poster(f, cls = '', style = '') {
  const st = style ? ' style="' + style + '"' : '';
  if (f.thumb) return '<div class="poster ' + cls + '"' + st + '><img src="' + f.thumb + '" alt="" decoding="async"></div>';
  const c = hash(norm(f.title)) % 8;
  const len = f.title.length;
  const sz = len > 30 ? 'xs' : len > 15 ? 's' : '';
  return '<div class="poster ph c' + c + ' ' + cls + '"' + st + '><div class="ph-in"><i class="ph-r"></i><span class="ph-t ' + sz + '">' + esc(f.title) + '</span><i class="ph-r"></i><span class="ph-d">' + esc(credit(f.director)) + '</span></div><span class="ph-i">' + esc(initials(f.title)) + '</span></div>';
}

/* ---------- Intestazione con tasto Indietro ---------- */
export function barHeader({ back, label = 'Indietro', right = '' }) {
  return '<header class="hdr nav"><button class="back" data-back="' + esc(back || '#/home') + '" aria-label="' + esc(label) + '">' + icon('left', 26) + '<span>' + esc(label) + '</span></button><div class="mid"></div>' + right + '</header>';
}

export function emptyState({ ico = 'film', title, text, action, go }) {
  return '<div class="empty"><div class="em-ico">' + icon(ico, 28) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
    (action ? '<button class="btn red" data-go="' + esc(go) + '">' + esc(action) + '</button>' : '') + '</div>';
}

/* ---------- Strato per pannelli e avvisi ---------- */
const overlay = () => document.getElementById('overlay');
export function closeOverlays() { const o = overlay(); if (o) o.querySelectorAll('.ov').forEach((n) => n.remove()); }

function mountLayer(html) {
  const w = document.createElement('div');
  w.className = 'ov';
  w.style.cssText = 'position:absolute;inset:0';
  w.innerHTML = html;
  overlay().appendChild(w);
  return w;
}

/* ---------- Avviso temporaneo ---------- */
let toastNode = null, toastTimer = 0;
export function toast(msg, opt = {}) {
  clearTimeout(toastTimer);
  if (toastNode) { toastNode.remove(); toastNode = null; }
  const el = document.createElement('div');
  el.className = 'toast' + (opt.error ? ' err' : '') + (opt.top ? ' top' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = '<span>' + esc(msg) + '</span>' + (opt.action ? '<button class="ta">' + esc(opt.action) + '</button>' : '');
  overlay().appendChild(el);
  toastNode = el;
  const hide = () => { el.classList.remove('on'); setTimeout(() => { el.remove(); if (toastNode === el) toastNode = null; }, 320); };
  if (opt.action) el.querySelector('.ta').addEventListener('click', () => { hide(); if (opt.onAction) opt.onAction(); });
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  toastTimer = setTimeout(hide, opt.ms || (opt.error ? 4200 : 2600));
}

/* ---------- Pannello di scelta dal basso ---------- */
export function actionSheet({ title, options }) {
  return new Promise((resolve) => {
    const items = options.map((o, i) => o.sep ? '<div class="opt-sep"></div>'
      : '<button class="opt' + (o.danger ? ' danger' : '') + '" data-i="' + i + '"' + (o.checked != null ? ' role="menuitemradio" aria-checked="' + !!o.checked + '"' : '') + '>' +
        (o.icon ? icon(o.icon, 22) : '') + '<span class="grow">' + esc(o.label) + '</span>' + (o.checked ? icon('check', 20) : '') + '</button>').join('');
    const w = mountLayer('<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true">' + (title ? '<h4>' + esc(title) + '</h4>' : '') + items + '<button class="opt cancel" data-i="-1">Annulla</button></div>');
    const scrim = w.querySelector('.scrim'), sheet = w.querySelector('.sheet');
    let done = false;
    const close = (val) => {
      if (done) return; done = true;
      scrim.classList.remove('on'); sheet.classList.remove('on');
      setTimeout(() => w.remove(), 340);
      resolve(val);
    };
    scrim.addEventListener('click', () => close(null));
    sheet.addEventListener('click', (e) => {
      const b = e.target.closest('.opt[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      close(i < 0 ? null : options[i].value);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('on'); sheet.classList.add('on'); }));
  });
}

/* ---------- Finestre di dialogo ---------- */
export function dialog({ title, text, input, buttons }) {
  return new Promise((resolve) => {
    const inp = input ? '<input id="dlg-in" type="' + (input.type || 'text') + '" value="' + esc(input.value || '') + '" placeholder="' + esc(input.placeholder || '') + '" autocomplete="off" autocapitalize="' + (input.cap || 'words') + '" autocorrect="off" spellcheck="false" enterkeyhint="done">' : '';
    const w = mountLayer('<div class="scrim"></div><div class="dlg-wrap"><div class="dlg" role="alertdialog" aria-modal="true"><h3>' + esc(title) + '</h3>' + (text ? '<p>' + esc(text) + '</p>' : '') + inp +
      '<div class="btn-row">' + buttons.map((b, i) => '<button class="btn ' + (b.kind || '') + '" data-i="' + i + '"' + (b.needs ? ' disabled' : '') + '>' + esc(b.label) + '</button>').join('') + '</div></div></div>');
    const scrim = w.querySelector('.scrim'), dlg = w.querySelector('.dlg'), field = w.querySelector('#dlg-in');
    let done = false;
    const close = (val) => {
      if (done) return; done = true;
      scrim.classList.remove('on'); dlg.classList.remove('on');
      setTimeout(() => w.remove(), 260);
      resolve(val);
    };
    const check = () => buttons.forEach((b, i) => { if (b.needs) w.querySelector('[data-i="' + i + '"]').disabled = (field.value || '').trim().toUpperCase() !== b.needs; });
    if (field) field.addEventListener('input', check);
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      close({ value: buttons[+b.dataset.i].value, text: field ? field.value : '' });
    });
    if (field) field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const primary = buttons.findIndex((b) => b.primary); if (primary >= 0 && !w.querySelector('[data-i="' + primary + '"]').disabled) close({ value: buttons[primary].value, text: field.value }); } });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrim.classList.add('on'); dlg.classList.add('on');
      if (field) { field.focus(); field.select(); }
    }));
  });
}

export async function confirmDlg({ title, text, ok = 'Conferma', cancel = 'Annulla', danger = false }) {
  const r = await dialog({ title, text, buttons: [{ label: cancel, value: false, kind: 'ghost' }, { label: ok, value: true, kind: danger ? 'red' : 'red', primary: true }] });
  return !!(r && r.value);
}

export async function promptDlg({ title, text, value = '', placeholder = '', ok = 'Salva' }) {
  const r = await dialog({ title, text, input: { value, placeholder }, buttons: [{ label: 'Annulla', value: false, kind: 'ghost' }, { label: ok, value: true, kind: 'red', primary: true }] });
  return r && r.value ? r.text : null;
}

/* ---------- Lista a scorrimento virtuale (righe di altezza nota) ---------- */
export class VList {
  constructor(scroller, host, { render, onClick }) {
    this.sc = scroller; this.host = host; this.render = render;
    this.items = []; this.offs = [0]; this.nodes = new Map(); this.raf = 0; this.baseTop = 0;
    this.onScroll = () => { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); }); };
    this.onResize = () => { this.baseTop = this.host.offsetTop; this.onScroll(); };
    scroller.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);
    if (onClick) host.addEventListener('click', (e) => { const n = e.target.closest('.vrow'); if (n && host.contains(n)) onClick(+n.dataset.i, e, n); });
  }

  setItems(items) {
    this.items = items;
    const offs = new Array(items.length + 1);
    let y = 0;
    for (let i = 0; i < items.length; i++) { offs[i] = y; y += items[i].h; }
    offs[items.length] = y;
    this.offs = offs;
    this.host.style.height = y + 'px';
    this.nodes.forEach((n) => n.remove());
    this.nodes.clear();
    this.baseTop = this.host.offsetTop;
    this.update();
  }

  find(y) {
    const o = this.offs;
    let lo = 0, hi = this.items.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (o[mid] <= y) lo = mid; else hi = mid - 1; }
    return lo;
  }

  update() {
    const n = this.items.length;
    if (!n) return;
    const top = this.sc.scrollTop - this.baseTop;
    const vh = this.sc.clientHeight || 700;
    const a = this.find(Math.max(0, top - 360)), b = this.find(Math.max(0, Math.min(this.offs[n] - 1, top + vh + 360)));
    for (const [i, node] of this.nodes) if (i < a || i > b) { node.remove(); this.nodes.delete(i); }
    const add = [];
    for (let i = a; i <= b; i++) if (!this.nodes.has(i)) add.push(i);
    if (!add.length) return;
    const t = document.createElement('template');
    t.innerHTML = add.map((i) => '<div class="vrow" data-i="' + i + '" style="top:' + this.offs[i] + 'px;height:' + this.items[i].h + 'px">' + this.render(i, this.items[i]) + '</div>').join('');
    const kids = Array.from(t.content.children);
    kids.forEach((k) => this.nodes.set(+k.dataset.i, k));
    this.host.appendChild(t.content);
  }

  scrollToIndex(i, stickyH = 0) { this.sc.scrollTop = this.baseTop + this.offs[Math.max(0, Math.min(i, this.items.length - 1))] - stickyH; }
  destroy() { this.sc.removeEventListener('scroll', this.onScroll); window.removeEventListener('resize', this.onResize); cancelAnimationFrame(this.raf); }
}

/* ---------- Scorrimento rapido A–Z ---------- */
export function alphaRail(railEl, popEl, letters, onPick) {
  if (!letters.length) { railEl.hidden = true; return () => {}; }
  railEl.hidden = false;
  railEl.innerHTML = letters.map((l) => '<span data-l="' + esc(l) + '">' + esc(l) + '</span>').join('');
  let last = null;
  const pick = (y) => {
    const r = railEl.getBoundingClientRect();
    const idx = Math.max(0, Math.min(letters.length - 1, Math.floor(((y - r.top) / r.height) * letters.length)));
    const l = letters[idx];
    if (l !== last) { last = l; popEl.textContent = l; popEl.classList.add('on'); onPick(l); }
  };
  const start = (e) => { e.preventDefault(); last = null; pick(e.touches ? e.touches[0].clientY : e.clientY); };
  const move = (e) => { e.preventDefault(); pick(e.touches ? e.touches[0].clientY : e.clientY); };
  const end = () => { popEl.classList.remove('on'); last = null; };
  railEl.addEventListener('touchstart', start, { passive: false });
  railEl.addEventListener('touchmove', move, { passive: false });
  railEl.addEventListener('touchend', end);
  railEl.addEventListener('touchcancel', end);
  railEl.addEventListener('click', (e) => { const s = e.target.closest('[data-l]'); if (s) onPick(s.dataset.l); });
  return end;
}

export function snippet(text, q, len = 64) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const i = q ? norm(t).indexOf(norm(q)) : -1;
  if (i < 0 || t.length <= len) return t.length > len ? t.slice(0, len) + '…' : t;
  const s = Math.max(0, i - 18);
  return (s ? '…' : '') + t.slice(s, s + len) + '…';
}
