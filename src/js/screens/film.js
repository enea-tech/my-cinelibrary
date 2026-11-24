// Scheda di un film (visto o da vedere)
import { icon } from '../icons.js';
import { esc, fmtDate, fmtRating } from '../util.js';
import * as S from '../store.js';
import { poster, barHeader, actionSheet, confirmDlg, toast } from '../ui.js';
import { go, back } from '../router.js';

export function filmScreen(p) {
  const f = S.getFilm(p.id);
  if (!f) return { redirect: '#/visti' };
  const want = f.status === 'want';
  const d = f.dkey ? S.getDirector(f.dkey) : null;
  const backTo = want ? '#/da-vedere' : '#/visti';

  const dirLink = f.director
    ? (d && d.count ? '<button class="d-dir" data-act="dir">' + esc(f.director) + icon('right', 18) + '</button>' : '<div class="d-dir" style="color:var(--ink-2)">' + esc(f.director) + '</div>')
    : '<div class="d-dir" style="color:var(--ink-3)">Regista da definire</div>';

  const meta = want
    ? '<div class="mi">' + icon('bookmark', 24) + '<div><div class="k">Stato</div><div class="v">Da vedere</div></div></div>' +
      '<div class="mi">' + icon('calendar', 24) + '<div><div class="k">Aggiunto il</div><div class="v">' + fmtDate(new Date(f.addedAt).toISOString().slice(0, 10), true) + '</div></div></div>'
    : '<div class="mi">' + icon('calendar', 24) + '<div><div class="k">Visto il</div><div class="v">' + (f.seenOn ? fmtDate(f.seenOn, true) : 'Data non indicata') + '</div></div></div>' +
      '<div class="mi">' + icon('star', 24, 'gold') + '<div><div class="k">Voto</div><div class="v">' + (f.rating ? fmtRating(f.rating) + '/10' : 'Nessun voto') + '</div></div></div>';

  let body = '';
  if (want) {
    body += '<div class="d-sec"><h2>Annotazioni</h2>' + (f.notes ? '<p class="plain">' + esc(f.notes) + '</p>' : '<p class="none">Nessuna annotazione. Usa «Modifica» per aggiungerne una.</p>') + '</div>';
  } else {
    body += '<div class="d-sec"><h2>Il mio commento</h2>' + (f.comment ? '<p class="quote">“' + esc(f.comment) + '”</p>' : '<p class="none">Nessun commento. Usa «Modifica» per scriverne uno.</p>') + '</div>';
    if (f.notes) body += '<div class="d-sec"><h2>Appunti prima della visione</h2><p class="plain">' + esc(f.notes) + '</p></div>';
  }

  const added = new Date(f.addedAt);
  const cat = '<div class="catcard"><div class="cn">Scheda n. ' + f.seq + '</div><div class="cd">Registrata il ' + fmtDate(added.getFullYear() + '-' + String(added.getMonth() + 1).padStart(2, '0') + '-' + String(added.getDate()).padStart(2, '0'), true) +
    (!want && d && d.count > 1 ? '<br>Collezione «' + esc(d.name) + '»: ' + d.count + ' film' : '') + '</div></div>';

  const html =
    barHeader({ back: backTo, right: '<button class="ibtn' + (f.fav ? ' on' : '') + '" data-act="fav" aria-label="' + (want ? 'Metti in cima' : 'Preferito') + '" aria-pressed="' + f.fav + '">' + icon(want ? 'star' : 'heart', 24, f.fav ? 'i-fill' : '') + '</button><button class="ibtn" data-act="more" aria-label="Altre azioni">' + icon('more', 24) + '</button>' }) +
    '<div class="scroll"><div class="detail">' +
    '<div class="d-top" data-top>' + poster(f) + '<div class="d-info"><h1 class="d-title">' + esc(f.title) + '</h1>' + dirLink + (f.year ? '<div class="d-year">' + f.year + '</div>' : '') + '<div class="d-meta">' + meta + '</div></div></div>' +
    body + cat +
    '<div class="d-actions">' + (want ? '<button class="btn red" data-act="seen">' + icon('check', 22) + 'Segna come visto</button>' : '') +
    '<div class="btn-row"><button class="btn ghost" data-act="edit">' + icon('edit', 20) + 'Modifica</button><button class="btn danger" data-act="del">' + icon('trash', 20) + 'Elimina</button></div></div>' +
    '</div><div class="pad-b"></div></div>';

  return {
    html,
    mount(el) {
      if (f.hasCover) {
        S.loadCover(f.id).then((src) => {
          const box = el.querySelector('[data-top] .poster');
          if (src && box && box.isConnected) box.outerHTML = '<div class="poster"><img src="' + src + '" alt="Copertina di ' + esc(f.title) + '" decoding="async"></div>';
        });
      }
      const onClick = async (e) => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        const act = a.dataset.act;
        try {
          if (act === 'dir') go('#/regista/' + encodeURIComponent(f.dkey));
          else if (act === 'fav') { await S.setFav(f.id, !f.fav); toast(want ? (f.fav ? 'Tolto dalla cima' : 'Messo in cima ai da vedere') : (f.fav ? 'Tolto dai preferiti' : 'Aggiunto ai preferiti')); }
          else if (act === 'edit') go('#/modifica/' + f.id);
          else if (act === 'seen') go('#/sposta/' + f.id);
          else if (act === 'more') {
            const opts = want
              ? [{ label: 'Segna come visto', icon: 'check', value: 'seen' }, { label: 'Modifica', icon: 'edit', value: 'edit' }, { sep: true }, { label: 'Elimina', icon: 'trash', danger: true, value: 'del' }]
              : [{ label: 'Modifica', icon: 'edit', value: 'edit' }, { label: 'Rimetti tra i film da vedere', icon: 'undo', value: 'unsee' }, { sep: true }, { label: 'Elimina', icon: 'trash', danger: true, value: 'del' }];
            const v = await actionSheet({ title: f.title, options: opts });
            if (v === 'seen') go('#/sposta/' + f.id);
            else if (v === 'edit') go('#/modifica/' + f.id);
            else if (v === 'unsee') {
              if (await confirmDlg({ title: 'Rimettere tra i film da vedere?', text: 'La data di visione e il voto vengono rimossi. Il commento diventa un\'annotazione.', ok: 'Sposta' })) {
                await S.moveToWant(f.id); toast('Spostato tra i film da vedere'); back('#/da-vedere');
              }
            } else if (v === 'del') await remove();
          } else if (act === 'del') await remove();
        } catch (err) { toast(err.message || 'Operazione non riuscita', { error: true }); }
      };
      async function remove() {
        const ok = await confirmDlg({ title: 'Eliminare «' + f.title + '»?', text: 'La scheda con voto e commento verrà rimossa dalla biblioteca.', ok: 'Elimina', danger: true });
        if (!ok) return;
        const cover = f.hasCover ? await S.loadCover(f.id) : null;
        const snapshot = { ...f };
        back(backTo);
        await S.deleteFilm(f.id);
        toast('Film eliminato', { action: 'Annulla', ms: 6000, onAction: async () => { try { await S.restoreFilm(snapshot, cover); toast('Film ripristinato'); } catch (e) { toast('Impossibile ripristinare', { error: true }); } } });
      }
      el.addEventListener('click', onClick);
      return () => el.removeEventListener('click', onClick);
    },
  };
}
