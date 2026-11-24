// Film visti: collezioni per regista (vista principale) oppure elenco di tutti i film
import { icon } from '../icons.js';
import { esc, norm, fmtDate, fmtMonthYear, fmtRating, initialOf, surnameKey, sortTitle, debounce, highlight } from '../util.js';
import * as S from '../store.js';
import { poster, VList, alphaRail, actionSheet, emptyState, snippet } from '../ui.js';
import { go } from '../router.js';
import { pref, setPref } from '../prefs.js';

let savedQuery = '';

export function vistiScreen(_p, ctx) {
  if (!ctx || ctx.dir !== 'pop') savedQuery = '';
  const html =
    '<div class="scroll">' +
    '<header class="hdr"><h1 class="hdr-title">Film Visti<span class="hdr-sub" data-sub></span></h1><button class="ibtn red" data-go="#/nuovo" aria-label="Aggiungi film">' + icon('plus', 24) + '</button></header>' +
    '<div class="tools" data-tools>' +
    '<div class="tools-row"><label class="search">' + icon('search', 19) + '<input data-q type="search" placeholder="Cerca film o regista…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Cerca film o regista"><button class="clr" data-qc hidden aria-label="Cancella ricerca">' + icon('x', 15) + '</button></label><button class="ibtn" data-sort aria-label="Ordina">' + icon('sort', 22) + '</button></div>' +
    '<div class="tools-row"><div class="seg"><button data-mode="dir">Registi</button><button data-mode="film">Film</button></div></div>' +
    '</div><div class="vlist" data-host></div><div data-msg></div></div>' +
    '<div class="rail" data-rail hidden></div><div class="rail-pop" data-pop></div>';

  return {
    html,
    mount(el) {
      const $ = (s) => el.querySelector(s);
      const sc = $('.scroll'), host = $('[data-host]'), q = $('[data-q]'), qc = $('[data-qc]'), msg = $('[data-msg]'), sub = $('[data-sub]');
      const rail = $('[data-rail]'), pop = $('[data-pop]'), tools = $('[data-tools]');
      let mode = pref('vMode', 'dir'), sortDir = pref('vSortDir', 'name'), sortFilm = pref('vSortFilm', 'date');
      let query = savedQuery, items = [], endRail = () => {};
      q.value = query; qc.hidden = !query;

      const vl = new VList(sc, host, {
        render: (i, it) => (it.kind === 'h' ? '<div class="lh">' + esc(it.label) + '</div>' : it.kind === 'd' ? dirRow(it) : filmRow(it)),
        onClick: (i) => {
          const it = items[i];
          if (it.kind === 'd') go('#/regista/' + encodeURIComponent(it.d.key));
          else if (it.kind === 'f') go('#/film/' + it.f.id);
        },
      });

      function dirRow(it) {
        const d = it.d, ps = d.films.slice(0, 3), n = ps.length;
        const stack = '<div class="stack">' + ps.map((f, k) => poster(f, '', 'left:' + k * 13 + 'px;z-index:' + (3 - k))).join('') + '</div>';
        const titles = (it.m || d.films).slice(0, 4).map((f) => highlight(f.title, query)).join(', ');
        return '<div class="drow">' + stack + '<div class="txt"><div class="name">' + highlight(d.name, query) + '</div><div class="sub"><b>' + d.count + ' film</b>' + titles + '</div></div>' + icon('right', 20, 'chev') + '</div>';
      }

      function filmRow(it) {
        const f = it.f;
        const hitTitle = norm(f.title).includes(norm(query)) || norm(f.director).includes(norm(query));
        const second = query && !hitTitle && f.comment ? highlight(snippet(f.comment, query), query) : highlight(f.director, query);
        return '<div class="frow">' + poster(f) + '<div class="txt"><div class="ttl">' + highlight(f.title, query) + '</div><div class="sub">' + second + '</div>' +
          '<div class="meta"><span>' + (f.seenOn ? fmtDate(f.seenOn) : 'Data non indicata') + '</span>' + (f.rating ? '<span class="rate">' + icon('star', 13) + fmtRating(f.rating) + '</span>' : '') + '</div></div>' +
          (f.fav ? '<span class="hrt">' + icon('heart', 16, 'i-fill') + '</span>' : '') + icon('right', 20, 'chev') + '</div>';
      }

      function dirItems() {
        let list = S.index().dirList, matched = null;
        if (query.trim()) {
          const byKey = new Map();
          S.searchFilms(query, S.index().seen).forEach((f) => { if (!byKey.has(f.dkey)) byKey.set(f.dkey, []); byKey.get(f.dkey).push(f); });
          const nameHits = new Set(S.searchDirectors(query).map((d) => d.key));
          list = list.filter((d) => nameHits.has(d.key) || byKey.has(d.key));
          matched = byKey;
        }
        list = S.sortDirectors(list, sortDir);
        const out = [];
        let last = null;
        list.forEach((d) => {
          if (sortDir === 'name') { const L = initialOf(d.sortKey); if (L !== last) { out.push({ kind: 'h', h: 34, label: L }); last = L; } }
          const m = matched && matched.get(d.key);
          out.push({ kind: 'd', h: 82, d, m: m && !nameHitsOnly(d, m) ? m : null });
        });
        return out;
      }
      const nameHitsOnly = (d) => norm(d.name).includes(norm(query));

      function filmItems() {
        let list = S.index().seen;
        if (query.trim()) list = S.searchFilms(query, list);
        list = S.sortFilms(list, sortFilm);
        const head = (f) => {
          switch (sortFilm) {
            case 'title': return initialOf(sortTitle(f.title));
            case 'director': return initialOf(surnameKey(f.director));
            case 'date': case 'date-asc': return fmtMonthYear(f.seenOn);
            case 'rating': return f.rating ? '★ ' + fmtRating(Math.floor(f.rating)) : 'Senza voto';
            default: return null;
          }
        };
        const out = [];
        let last = null;
        list.forEach((f) => {
          const L = head(f);
          if (L !== last) { out.push({ kind: 'h', h: 34, label: L }); last = L; }
          out.push({ kind: 'f', h: 90, f });
        });
        return out;
      }

      function compute() {
        const idx = S.index();
        const total = idx.seen.length;
        sub.textContent = total ? total + ' film, ' + idx.dirList.length + ' registi' : 'Ancora nessun film';
        el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
        endRail();
        if (!total) {
          items = []; vl.setItems([]); rail.hidden = true;
          msg.innerHTML = emptyState({ ico: 'film', title: 'La biblioteca è vuota', text: 'Aggiungi il primo film che hai visto: i film dello stesso regista finiranno nella stessa collezione.', action: 'Aggiungi un film', go: '#/nuovo' });
          return;
        }
        items = mode === 'dir' ? dirItems() : filmItems();
        vl.setItems(items);
        const alphaSort = mode === 'dir' ? sortDir === 'name' : sortFilm === 'title' || sortFilm === 'director';
        const letters = alphaSort && items.length > 28 ? items.filter((it) => it.kind === 'h').map((it) => it.label) : [];
        host.classList.toggle('has-rail', letters.length > 0);
        endRail = alphaRail(rail, pop, letters, (L) => {
          const i = items.findIndex((it) => it.kind === 'h' && it.label === L);
          if (i >= 0) vl.scrollToIndex(i, tools.offsetHeight - 6);
        });
        msg.innerHTML = items.length ? '' : emptyState({ ico: 'search', title: 'Nessun risultato', text: 'Nessun film o regista corrisponde a «' + query.trim() + '».' });
      }

      const onInput = debounce(() => {
        query = q.value; savedQuery = query; qc.hidden = !query;
        compute();
        const max = vl.baseTop - tools.offsetHeight;
        if (sc.scrollTop > max) sc.scrollTop = Math.max(0, max);
      }, 90);
      q.addEventListener('input', onInput);
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') q.blur(); });
      qc.addEventListener('click', () => { q.value = ''; query = ''; savedQuery = ''; qc.hidden = true; compute(); q.focus(); });

      el.querySelector('.seg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]');
        if (!b || b.dataset.mode === mode) return;
        mode = b.dataset.mode; setPref('vMode', mode); compute(); sc.scrollTop = Math.min(sc.scrollTop, Math.max(0, vl.baseTop - tools.offsetHeight));
      });

      $('[data-sort]').addEventListener('click', async () => {
        const opts = mode === 'dir'
          ? [{ label: 'Nome del regista (A–Z)', value: 'name' }, { label: 'Più film visti', value: 'count' }, { label: 'Visto più di recente', value: 'recent' }, { label: 'Voto medio più alto', value: 'rating' }]
          : [{ label: 'Data di visione (più recenti)', value: 'date' }, { label: 'Data di visione (meno recenti)', value: 'date-asc' }, { label: 'Titolo (A–Z)', value: 'title' }, { label: 'Regista (A–Z)', value: 'director' }, { label: 'Voto più alto', value: 'rating' }];
        const cur = mode === 'dir' ? sortDir : sortFilm;
        opts.forEach((o) => { o.checked = o.value === cur; });
        const v = await actionSheet({ title: mode === 'dir' ? 'Ordina i registi' : 'Ordina i film', options: opts });
        if (!v) return;
        if (mode === 'dir') { sortDir = v; setPref('vSortDir', v); } else { sortFilm = v; setPref('vSortFilm', v); }
        compute(); sc.scrollTop = 0;
      });

      const unsub = S.subscribe(() => compute());
      compute();
      return () => { unsub(); vl.destroy(); endRail(); onInput.cancel(); };
    },
  };
}
