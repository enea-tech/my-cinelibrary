// Pagina di un regista: la sua collezione con date di visione e commenti
import { icon } from '../icons.js';
import { esc, fmtDate, fmtRating, fmtAvg, plural } from '../util.js';
import * as S from '../store.js';
import { poster, barHeader, actionSheet, promptDlg, toast } from '../ui.js';
import { go, replace, refresh } from '../router.js';
import { pref, setPref } from '../prefs.js';

const SORTS = [
  { value: 'date', label: 'Data di visione (più recenti)', short: 'Più recenti' },
  { value: 'date-asc', label: 'Data di visione (meno recenti)', short: 'Meno recenti' },
  { value: 'title', label: 'Titolo (A–Z)', short: 'Titolo' },
  { value: 'rating', label: 'Voto più alto', short: 'Voto' },
];

function monogram(name) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  return (w[0].charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
}

export function filmRowTall(f) {
  return '<div class="frow tall" data-id="' + esc(f.id) + '" role="button" tabindex="0">' + poster(f) +
    '<div class="txt"><div class="ttl">' + esc(f.title) + (f.year ? ' <span class="y">(' + f.year + ')</span>' : '') + '</div>' +
    '<div class="meta"><span>' + icon('calendar', 14) + (f.seenOn ? fmtDate(f.seenOn) : 'Data non indicata') + '</span>' +
    (f.rating ? '<span class="rate">' + icon('star', 13) + fmtRating(f.rating) + '</span>' : '') + '</div>' +
    (f.comment ? '<div class="cmt">' + esc(f.comment) + '</div>' : '') + '</div>' +
    (f.fav ? '<span class="hrt" style="margin-top:6px">' + icon('heart', 16, 'i-fill') + '</span>' : '') + icon('right', 20, 'chev') + '</div>';
}

export function registaScreen(p) {
  const d = S.getDirector(p.key);
  if (!d || !d.count) return { redirect: '#/visti' };
  const sort = pref('dSort', 'date');
  const films = S.sortFilms(d.films, sort);
  const first = d.films.filter((f) => f.seenOn).map((f) => f.seenOn).sort()[0];
  const html =
    barHeader({ back: '#/visti', label: 'Film Visti', right: '<button class="ibtn" data-act="add" aria-label="Aggiungi un film di ' + esc(d.name) + '">' + icon('plus', 24) + '</button><button class="ibtn" data-act="more" aria-label="Altre azioni">' + icon('more', 24) + '</button>' }) +
    '<div class="scroll">' +
    '<div class="dr-head"><div class="avatar">' + esc(monogram(d.name)) + '</div><div><h1 class="dr-name">' + esc(d.name) + '</h1>' +
    '<div class="dr-sub">' + (first ? 'Primo film visto nel ' + first.slice(0, 4) : 'Collezione personale') + '</div></div></div>' +
    '<div class="dr-stats"><div class="dr-stat"><div class="v">' + d.count + '</div><div class="k">' + (d.count === 1 ? 'Film visto' : 'Film visti') + '</div></div>' +
    '<div class="dr-stat"><div class="v">' + fmtAvg(d.avg) + '</div><div class="k">Voto medio</div></div>' +
    '<div class="dr-stat"><div class="v">' + (d.last ? d.last.slice(0, 4) : '–') + '</div><div class="k">Ultima visione</div></div></div>' +
    '<div class="perf"></div>' +
    '<div class="sort-line"><span>' + plural(d.count, 'film', 'film') + ' nella collezione</span><button data-act="sort">' + icon('sort', 16) + SORTS.find((s) => s.value === sort).short + '</button></div>' +
    '<div class="flist">' + films.map(filmRowTall).join('') + '</div>' +
    '<div class="d-actions" style="padding:22px 16px 0"><button class="btn ghost" data-act="add">' + icon('plus', 20) + 'Aggiungi un film di ' + esc(d.name.split(' ').slice(-1)[0]) + '</button></div>' +
    '<div class="pad-b"></div></div>';
  return {
    html,
    mount(el) {
      const onClick = async (e) => {
        const row = e.target.closest('.frow[data-id]');
        if (row) { go('#/film/' + row.dataset.id); return; }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        const act = a.dataset.act;
        if (act === 'add') go('#/nuovo?dir=' + encodeURIComponent(d.name));
        else if (act === 'sort') {
          const v = await actionSheet({ title: 'Ordina i film di ' + d.name, options: SORTS.map((s) => ({ label: s.label, value: s.value, checked: s.value === sort })) });
          if (v) { setPref('dSort', v); refresh(); }
        } else if (act === 'more') {
          const v = await actionSheet({ title: d.name, options: [{ label: 'Rinomina regista', icon: 'edit', value: 'rename' }, { label: 'Aggiungi un suo film', icon: 'plus', value: 'add' }] });
          if (v === 'add') go('#/nuovo?dir=' + encodeURIComponent(d.name));
          if (v === 'rename') {
            const name = await promptDlg({ title: 'Rinomina regista', text: 'Il nuovo nome vale per tutti i suoi film. Se esiste già un regista con quel nome, le due collezioni si uniscono.', value: d.name, ok: 'Rinomina' });
            if (!name) return;
            try {
              const r = await S.renameDirector(d.key, name);
              toast(r.merged ? 'Collezioni unite in «' + r.name + '»' : 'Regista rinominato');
              replace('#/regista/' + encodeURIComponent(r.key));
            } catch (err) { toast(err.message || 'Impossibile rinominare', { error: true }); }
          }
        }
      };
      el.addEventListener('click', onClick);
      return () => el.removeEventListener('click', onClick);
    },
  };
}
