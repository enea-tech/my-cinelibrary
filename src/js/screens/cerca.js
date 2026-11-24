// Ricerca globale: film (visti e da vedere), registi e parole dei commenti
import { icon } from '../icons.js';
import { esc, norm, fmtDate, fmtRating, debounce, highlight } from '../util.js';
import * as S from '../store.js';
import { poster, VList, emptyState, snippet } from '../ui.js';
import { go } from '../router.js';

let savedQuery = '', savedKind = 'all';

export function cercaScreen(_p, ctx) {
  if (!ctx || ctx.dir !== 'pop') { savedQuery = ''; savedKind = 'all'; }
  const html =
    '<div class="scroll">' +
    '<header class="hdr"><h1 class="hdr-title">Cerca</h1></header>' +
    '<div class="tools" data-tools><div class="tools-row"><label class="search">' + icon('search', 19) + '<input data-q type="search" placeholder="Film, regista o parola di un commento" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Cerca"><button class="clr" data-qc hidden aria-label="Cancella ricerca">' + icon('x', 15) + '</button></label></div>' +
    '<div class="tools-row"><div class="chips" style="flex:1"><button class="chip" data-kind="all">Tutti</button><button class="chip" data-kind="film">Film</button><button class="chip" data-kind="dir">Registi</button></div></div></div>' +
    '<div class="vlist" data-host></div><div data-msg></div></div>';

  return {
    html,
    mount(el) {
      const $ = (s) => el.querySelector(s);
      const sc = $('.scroll'), host = $('[data-host]'), q = $('[data-q]'), qc = $('[data-qc]'), msg = $('[data-msg]');
      let kind = savedKind, query = savedQuery, items = [];
      q.value = query; qc.hidden = !query;

      const vl = new VList(sc, host, {
        render: (i, it) => {
          if (it.kind === 'h') return '<div class="lh">' + esc(it.label) + '</div>';
          if (it.kind === 'd') {
            const d = it.d, ps = d.films.slice(0, 3);
            return '<div class="drow"><div class="stack">' + ps.map((f, k) => poster(f, '', 'left:' + k * 13 + 'px;z-index:' + (3 - k))).join('') + '</div>' +
              '<div class="txt"><div class="name">' + highlight(d.name, query) + '</div><div class="sub"><b>' + d.count + ' film</b>' + d.films.slice(0, 4).map((f) => esc(f.title)).join(', ') + '</div></div>' + icon('right', 20, 'chev') + '</div>';
          }
          const f = it.f;
          const hit = norm(f.title).includes(norm(query)) || norm(f.director).includes(norm(query));
          const second = !hit && (f.comment || f.notes) ? highlight(snippet(f.comment || f.notes, query), query) : highlight(f.director || 'Regista da definire', query);
          const want = f.status === 'want';
          return '<div class="frow">' + poster(f) + '<div class="txt"><div class="ttl">' + highlight(f.title, query) + '</div><div class="sub">' + second + '</div><div class="meta">' +
            (want ? '<span class="tag gold">Da vedere</span>' : '<span>' + (f.seenOn ? fmtDate(f.seenOn) : 'Data non indicata') + '</span>' + (f.rating ? '<span class="rate">' + icon('star', 13) + fmtRating(f.rating) + '</span>' : '')) +
            '</div></div>' + icon('right', 20, 'chev') + '</div>';
        },
        onClick: (i) => {
          const it = items[i];
          if (it.kind === 'd') go('#/regista/' + encodeURIComponent(it.d.key));
          else if (it.kind === 'f') go('#/film/' + it.f.id);
        },
      });

      function compute() {
        el.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.kind === kind ? 'true' : 'false'));
        items = [];
        if (!query.trim()) {
          vl.setItems([]);
          msg.innerHTML = emptyState({ ico: 'search', title: 'Cerca nella biblioteca', text: 'Scrivi il titolo di un film, il nome di un regista o una parola che hai usato nei tuoi commenti.' });
          return;
        }
        const dirs = kind !== 'film' ? S.searchDirectors(query) : [];
        let films = [];
        if (kind !== 'dir') {
          const nq = norm(query);
          films = S.searchFilms(query, Array.from(S.state.films.values()));
          films.sort((a, b) => (norm(b.title).startsWith(nq) - norm(a.title).startsWith(nq)) || (norm(b.title).includes(nq) - norm(a.title).includes(nq)) || (a.status === b.status ? b.seq - a.seq : a.status === 'seen' ? -1 : 1));
        }
        if (dirs.length) { items.push({ kind: 'h', h: 34, label: 'Registi (' + dirs.length + ')' }); S.sortDirectors(dirs, 'name').forEach((d) => items.push({ kind: 'd', h: 82, d })); }
        if (films.length) { items.push({ kind: 'h', h: 34, label: 'Film (' + films.length + ')' }); films.forEach((f) => items.push({ kind: 'f', h: 90, f })); }
        vl.setItems(items);
        msg.innerHTML = items.length ? '' : emptyState({ ico: 'search', title: 'Nessun risultato', text: 'Non trovo nulla per «' + query.trim() + '». Prova con meno lettere o senza accenti.' });
      }

      const onInput = debounce(() => { query = q.value; savedQuery = query; qc.hidden = !query; compute(); sc.scrollTop = 0; }, 90);
      q.addEventListener('input', onInput);
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') q.blur(); });
      qc.addEventListener('click', () => { q.value = ''; query = ''; savedQuery = ''; qc.hidden = true; compute(); q.focus(); });
      el.querySelector('.chips').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (b) { kind = b.dataset.kind; savedKind = kind; compute(); } });
      const unsub = S.subscribe(() => compute());
      compute();
      if (!query) setTimeout(() => { try { q.focus(); } catch (e) { /* ignora */ } }, 60);
      return () => { unsub(); vl.destroy(); onInput.cancel(); };
    },
  };
}
