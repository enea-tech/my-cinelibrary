// My CineLibrary — avvio dell'app
import * as S from './store.js';
import { route, start, go, back, replace, currentHash, scrollTop } from './router.js';
import { toast } from './ui.js';
import { icon } from './icons.js';
import { homeScreen } from './screens/home.js';
import { vistiScreen } from './screens/visti.js';
import { registaScreen } from './screens/regista.js';
import { filmScreen } from './screens/film.js';
import { formNewSeen, formNewWant, formEdit, formMove } from './screens/form.js';
import { daVedereScreen } from './screens/davedere.js';
import { cercaScreen } from './screens/cerca.js';
import { preferitiScreen } from './screens/preferiti.js';
import { statsScreen } from './screens/stats.js';
import { altroScreen, impostazioniScreen } from './screens/altro.js';

const TAB_ROOT = { home: '#/home', visti: '#/visti', 'da-vedere': '#/da-vedere', cerca: '#/cerca', altro: '#/altro' };

route('/home', { tab: 'home', build: homeScreen, live: true });
route('/visti', { tab: 'visti', build: vistiScreen });
route('/regista/:key', { tab: 'visti', build: registaScreen, live: true });
route('/film/:id', { tab: 'visti', build: filmScreen, live: true });
route('/da-vedere', { tab: 'da-vedere', build: daVedereScreen });
route('/cerca', { tab: 'cerca', build: cercaScreen });
route('/preferiti', { tab: 'altro', build: preferitiScreen, live: true });
route('/stat', { tab: 'altro', build: statsScreen, live: true });
route('/altro', { tab: 'altro', build: altroScreen, live: true });
route('/impostazioni', { tab: 'altro', build: impostazioniScreen, live: true });
route('/nuovo', { modal: true, tab: 'home', build: formNewSeen, parent: () => '#/home' });
route('/da-vedere/nuovo', { modal: true, tab: 'da-vedere', build: formNewWant, parent: () => '#/da-vedere' });
route('/modifica/:id', { modal: true, build: formEdit, parent: (p) => '#/film/' + p.id });
route('/sposta/:id', { modal: true, build: formMove, parent: (p) => '#/film/' + p.id });

const TABS = [['home', 'Home', 'home'], ['visti', 'Visti', 'film'], ['da-vedere', 'Da vedere', 'bookmark'], ['cerca', 'Cerca', 'search'], ['altro', 'Altro', 'more']];

function wireGlobalClicks() {
  document.getElementById('tabbar').innerHTML = TABS.map(([id, label, ic]) => '<button data-tab="' + id + '">' + icon(ic, 23) + '<span>' + label + '</span></button>').join('');
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); go(g.dataset.go); return; }
    const b = e.target.closest('[data-back]');
    if (b) { e.preventDefault(); back(b.dataset.back); }
  });
  document.getElementById('tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    const target = TAB_ROOT[t.dataset.tab];
    if (currentHash() === target) scrollTop(); else replace(target);
  });
}

function registerWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    if (!reg) return;
    const announce = () => toast('Aggiornamento pronto', { action: 'Applica', ms: 9000, onAction: () => { if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); } });
    if (reg.waiting && navigator.serviceWorker.controller) announce();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) announce(); });
    });
  }).catch((e) => console.warn('Service worker non attivo:', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || !hadController) return; reloaded = true; location.reload(); });
}

async function boot() {
  try { await S.init(); } catch (e) { console.error(e); }
  wireGlobalClicks();
  start();
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('out'); setTimeout(() => splash.remove(), 400); }
  registerWorker();
}

boot();
