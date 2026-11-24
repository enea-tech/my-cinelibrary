import { icon } from '../icons.js';
import { esc, timeAgo } from '../util.js';
import { counts, index, needsBackup, state } from '../store.js';
import { dbAvailable } from '../store.js';
import { poster } from '../ui.js';
import { pref, setPref } from '../prefs.js';

/** Sala buia: fascio del proiettore, bobina e file di poltroncine. Disegnata in SVG, nessuna immagine esterna. */
function seats(y, w, h, gap, op, off) {
  let out = '';
  const pitch = w + gap;
  for (let x = -pitch + off; x < 420; x += pitch) {
    out += '<g opacity="' + op + '">' +
      '<rect x="' + (x + w * 0.12) + '" y="' + y + '" width="' + w * 0.76 + '" height="' + h * 0.74 + '" rx="' + w * 0.3 + '" fill="url(#seat)"/>' +
      '<rect x="' + x + '" y="' + (y + h * 0.36) + '" width="' + w * 0.17 + '" height="' + h * 0.52 + '" rx="' + w * 0.08 + '" fill="#5a0e14"/>' +
      '<rect x="' + (x + w * 0.83) + '" y="' + (y + h * 0.36) + '" width="' + w * 0.17 + '" height="' + h * 0.52 + '" rx="' + w * 0.08 + '" fill="#5a0e14"/>' +
      '<rect x="' + (x + w * 0.12) + '" y="' + (y + h * 0.64) + '" width="' + w * 0.76 + '" height="' + h * 0.34 + '" rx="' + w * 0.13 + '" fill="#7d141b"/>' +
      '<path d="M' + (x + w * 0.2) + ' ' + (y + h * 0.1) + 'Q' + (x + w * 0.5) + ' ' + (y - h * 0.02) + ' ' + (x + w * 0.8) + ' ' + (y + h * 0.1) + '" stroke="#c4323a" stroke-opacity=".35" stroke-width="1.2" fill="none"/></g>';
  }
  return out;
}

function hero() {
  const holes = [0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; return '<circle cx="' + (Math.cos(a) * 29).toFixed(1) + '" cy="' + (Math.sin(a) * 29).toFixed(1) + '" r="10.5" fill="#0a0808"/>'; }).join('');
  const spokes = [0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5; return '<line x1="0" y1="0" x2="' + (Math.cos(a) * 44).toFixed(1) + '" y2="' + (Math.sin(a) * 44).toFixed(1) + '" stroke="#2a2224" stroke-width="2.4"/>'; }).join('');
  return '<svg viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">' +
    '<defs>' +
    '<radialGradient id="glow" cx="80%" cy="22%" r="80%"><stop offset="0" stop-color="#4d1519"/><stop offset=".42" stop-color="#1d0d0f"/><stop offset="1" stop-color="#0a0808"/></radialGradient>' +
    '<linearGradient id="beam" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffe9c8" stop-opacity=".62"/><stop offset=".55" stop-color="#ffd7a0" stop-opacity=".12"/><stop offset="1" stop-color="#ffd7a0" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a21d25"/><stop offset="1" stop-color="#520d12"/></linearGradient>' +
    '<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b5052"/><stop offset="1" stop-color="#1d1819"/></linearGradient>' +
    '<radialGradient id="lens"><stop offset="0" stop-color="#fff7e4"/><stop offset=".45" stop-color="#ffdca6" stop-opacity=".9"/><stop offset="1" stop-color="#ffdca6" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0808" stop-opacity="0"/><stop offset="1" stop-color="#0a0808"/></linearGradient>' +
    '</defs>' +
    '<rect width="390" height="300" fill="url(#glow)"/>' +
    '<polygon points="282,94 -20,118 -20,268 282,106" fill="url(#beam)"/>' +
    '<g fill="#ffe9c8"><circle cx="190" cy="132" r="1.2" opacity=".5"/><circle cx="130" cy="168" r="1" opacity=".4"/><circle cx="226" cy="118" r="1.5" opacity=".55"/><circle cx="84" cy="206" r="1.1" opacity=".3"/><circle cx="160" cy="190" r="0.9" opacity=".35"/><circle cx="246" cy="146" r="1" opacity=".4"/></g>' +
    '<g transform="translate(330 38)"><g class="reel"><circle r="47" fill="url(#metal)" stroke="#6a5e60" stroke-width="2"/><circle r="40" fill="none" stroke="#2a2224" stroke-width="1.5"/>' + spokes + holes + '<circle r="8" fill="#241d1f" stroke="#6a5e60" stroke-width="1.5"/></g></g>' +
    '<rect x="284" y="82" width="82" height="36" rx="7" fill="url(#metal)"/><rect x="284" y="82" width="82" height="3" rx="1.5" fill="#8a7d7f" opacity=".5"/>' +
    '<rect x="262" y="90" width="26" height="20" rx="3" fill="#2b2325"/><rect x="254" y="93" width="12" height="14" rx="2" fill="#1a1415"/>' +
    '<circle cx="254" cy="100" r="17" fill="url(#lens)"/>' +
    seats(224, 34, 34, 11, 0.5, 6) + seats(242, 46, 42, 12, 0.78, 28) + seats(268, 62, 56, 15, 1, -4) +
    '<rect y="250" width="390" height="50" fill="url(#fade)"/></svg>';
}

export function homeScreen() {
  const c = counts();
  const recent = index().seen.slice(0, 10);
  let banners = '';
  if (!dbAvailable()) {
    banners += '<div class="banner err">' + icon('alert', 22) + '<div><b>Archivio non disponibile.</b> I film non verranno salvati. Apri l\'app da Safari fuori dalla navigazione privata.</div></div>';
  } else if (needsBackup()) {
    banners += '<button class="banner" data-go="#/impostazioni">' + icon('shield', 22) + '<div><b>Salva una copia dei tuoi dati.</b> ' + (state.meta.lastBackupAt ? 'Ultima copia: ' + timeAgo(state.meta.lastBackupAt) + '.' : 'Non ne hai ancora una.') + ' Tocca per farlo.</div></button>';
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches;
  if (ios && !pref('hideInstall', false)) {
    banners += '<div class="banner">' + icon('phone', 22) + '<div>Per usarla come un\'app: tocca <b>Condividi</b> e poi <b>Aggiungi alla schermata Home</b>.</div><button class="mini-act" data-act="hide-install" aria-label="Nascondi">' + icon('x', 18) + '</button></div>';
  }
  const strip = recent.length
    ? '<div class="sec-t"><span>Ultimi film visti</span><button data-go="#/visti">Vedi tutti</button></div><div class="strip">' +
      recent.map((f) => '<button class="pcell" data-go="#/film/' + esc(f.id) + '">' + poster(f) + '<div class="pt">' + esc(f.title) + '</div></button>').join('') + '</div>'
    : '<p class="note" style="padding:6px 28px 0;text-align:center">Comincia da un film che hai visto di recente: ogni regista avrà la sua collezione.</p>';
  const html =
    '<div class="scroll">' +
    '<div class="hero">' + hero() + '<div class="wordmark"><span class="wm-my">My</span><span class="wm-cl"><b>Cine</b>Library</span><div class="wm-sub">La mia biblioteca cinematografica</div></div></div>' +
    banners +
    '<div class="hstats">' +
    '<button class="htile" data-go="#/visti">' + icon('film', 22) + '<span class="hk">Film Visti</span><span class="hv">' + c.seen + '</span></button>' +
    '<button class="htile" data-go="#/da-vedere">' + icon('star', 22, 'i-fill') + '<span class="hk">Da Vedere</span><span class="hv">' + c.want + '</span></button>' +
    '</div>' +
    '<div class="home-cta"><button class="btn red" data-go="#/nuovo">' + icon('plus', 22) + 'Aggiungi Film</button></div>' +
    '<div class="menu">' +
    '<button class="mrow" data-go="#/visti">' + icon('film', 24) + 'Film Visti' + icon('right', 20, 'chev') + '</button>' +
    '<button class="mrow" data-go="#/da-vedere">' + icon('bookmark', 24) + 'Film da Vedere' + icon('right', 20, 'chev') + '</button>' +
    '<button class="mrow" data-go="#/preferiti">' + icon('heart', 24) + 'Preferiti' + icon('right', 20, 'chev') + '</button>' +
    '<button class="mrow" data-go="#/stat">' + icon('chart', 24) + 'Statistiche' + icon('right', 20, 'chev') + '</button>' +
    '<button class="mrow" data-go="#/impostazioni">' + icon('settings', 24) + 'Impostazioni' + icon('right', 20, 'chev') + '</button>' +
    '</div>' + strip + '<div class="pad-b"></div></div>';
  return {
    html,
    mount(el) {
      const h = (e) => {
        if (e.target.closest('[data-act="hide-install"]')) { setPref('hideInstall', true); const b = e.target.closest('.banner'); if (b) b.remove(); }
      };
      el.addEventListener('click', h);
      return () => el.removeEventListener('click', h);
    },
  };
}
