// Film da vedere: lista semplice, con priorità e passaggio rapido ai film visti
import { icon } from '../icons.js';
import { esc, debounce, highlight } from '../util.js';
import * as S from '../store.js';
import { poster, VList, actionSheet, emptyState, toast } from '../ui.js';
import { go } from '../router.js';
import { pref, setPref } from '../prefs.js';

let savedQuery = '';

export function daVedereScreen(_p, ctx) {
  if (!ctx || ctx.dir !== 'pop') savedQuery = '';
  const html =
    '<div class="scroll">' +
    '<header class="hdr"><h1 class="hdr-title">Film da Vedere<span class="hdr-sub" data-sub></span></h1><button class="ibtn red" data-go="#/da-vedere/nuovo" aria-label="Aggiungi un film da vedere">' + icon('plus', 24) + '</button></header>' +
    '<div class="tools" data-tools><div class="tools-row"><label class="search">' + icon('search', 19) + '<input data-q type="search" placeholder="Cerca nei film da vedere…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="Cerca nei film da vedere"><button class="clr" data-qc hidden aria-label="Cancella ricerca">' + icon('x', 15) + '</button></label><button class="ibtn" data-sort aria-label="Ordina">' + icon('sort', 22) + '</button></div></div>' +
    '<div class="vlist" data-host></div><div data-msg></div></div>';

  return {
    html,
    mount(el) {
      const $ = (s) => el.querySelector(s);
      const sc = $('.scroll'), host = $('[data-host]'), q = $('[data-q]'), qc = $('[data-qc]'), msg = $('[data-msg]'), sub = $('[data-sub]'), tools = $('[data-tools]');
      let sort = pref('wSort', 'added'), query = savedQuery, items = [];
      q.value = query; qc.hidden = !query;

      const rowH = (f) => (f.notes && f.notes.trim() ? 102 : 88);
      const vl = new VList(sc, host, {
        render: (i, it) => {
          if (it.kind === 'h') return '<div class="lh">' + esc(it.label) + '</div>';
          const f = it.f;
          return '<div class="frow">' + poster(f) + '<div class="txt"><div class="ttl">' + highlight(f.title, query) + (f.year ? ' <span style="font-weight:400;color:var(--ink-3);font-size:14px">(' + f.year + ')</span>' : '') + '</div>' +
            '<div class="sub">' + (f.director ? highlight(f.director, query) : '<span style="color:var(--ink-3)">Regista da definire</span>') + '</div>' +
            (f.notes ? '<div class="nt">' + esc(f.notes.replace(/\s+/g, ' ')) + '</div>' : '') + '</div>' +
            '<button class="mini-act' + (f.fav ? ' on' : '') + '" data-act="pin" aria-label="' + (f.fav ? 'Togli dalla cima' : 'Metti in cima') + '">' + icon('star', 22, f.fav ? 'i-fill' : '') + '</button>' +
            '<button class="mini-act ok" data-act="seen" aria-label="Segna come visto">' + icon('check', 24) + '</button></div>';
        },
        onClick: async (i, e) => {
          const it = items[i];
          if (!it || it.kind !== 'f') return;
          const a = e.target.closest('[data-act]');
          if (!a) { go('#/film/' + it.f.id); return; }
          if (a.dataset.act === 'seen') go('#/sposta/' + it.f.id);
          else if (a.dataset.act === 'pin') {
            try { await S.setFav(it.f.id, !it.f.fav); toast(it.f.fav ? 'Tolto dalla cima' : 'Messo in cima'); } catch (err) { toast('Operazione non riuscita', { error: true }); }
          }
        },
      });

      function compute() {
        const all = S.index().want;
        sub.textContent = all.length ? all.length + (all.length === 1 ? ' film in attesa' : ' film in attesa') : 'Nessun film in lista';
        let list = query.trim() ? S.searchFilms(query, all) : all;
        list = S.sortFilms(list, sort);
        const pinned = list.filter((f) => f.fav), rest = list.filter((f) => !f.fav);
        items = [];
        if (pinned.length && rest.length) items.push({ kind: 'h', h: 34, label: 'In cima' });
        pinned.forEach((f) => items.push({ kind: 'f', h: rowH(f), f }));
        if (pinned.length && rest.length) items.push({ kind: 'h', h: 34, label: 'Gli altri' });
        rest.forEach((f) => items.push({ kind: 'f', h: rowH(f), f }));
        vl.setItems(items);
        if (!all.length) msg.innerHTML = emptyState({ ico: 'bookmark', title: 'Nessun film in attesa', text: 'Scrivi qui i film che vuoi vedere. Quando li guardi, un tocco li sposta tra i film visti.', action: 'Aggiungi un film', go: '#/da-vedere/nuovo' });
        else msg.innerHTML = items.length ? '' : emptyState({ ico: 'search', title: 'Nessun risultato', text: 'Nessun film da vedere corrisponde a «' + query.trim() + '».' });
      }

      const onInput = debounce(() => { query = q.value; savedQuery = query; qc.hidden = !query; compute(); }, 90);
      q.addEventListener('input', onInput);
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') q.blur(); });
      qc.addEventListener('click', () => { q.value = ''; query = ''; savedQuery = ''; qc.hidden = true; compute(); q.focus(); });
      $('[data-sort]').addEventListener('click', async () => {
        const opts = [{ label: 'Aggiunti di recente', value: 'added' }, { label: 'Aggiunti da più tempo', value: 'added-asc' }, { label: 'Titolo (A–Z)', value: 'title' }, { label: 'Regista (A–Z)', value: 'director' }];
        opts.forEach((o) => { o.checked = o.value === sort; });
        const v = await actionSheet({ title: 'Ordina i film da vedere', options: opts });
        if (!v) return;
        sort = v; setPref('wSort', v); compute(); sc.scrollTop = 0;
      });
      const unsub = S.subscribe(() => compute());
      compute();
      return () => { unsub(); vl.destroy(); onInput.cancel(); void tools; };
    },
  };
}
