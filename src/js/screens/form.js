// Modulo di inserimento: nuovo film visto, nuovo film da vedere, modifica, sposta tra i visti
import { icon } from '../icons.js';
import { esc, clean, dirKey, fmtDate, fmtRating, todayISO, parseISO, debounce, highlight } from '../util.js';
import * as S from '../store.js';
import { poster, toast, confirmDlg } from '../ui.js';
import { back } from '../router.js';
import { draft } from '../prefs.js';
import { processCover, pickFile } from '../files.js';

const TITLES = { 'new-seen': 'Aggiungi Film', 'new-want': 'Da vedere', edit: 'Modifica film', move: 'Segna come visto' };

function build(mode, p) {
  const film = p.id ? S.getFilm(p.id) : null;
  if ((mode === 'edit' || mode === 'move') && !film) return { redirect: '#/visti' };
  const seenLike = mode === 'new-seen' || mode === 'move' || (mode === 'edit' && film.status === 'seen');
  const wantLike = !seenLike;
  const draftKind = mode === 'new-seen' ? 'seen' : mode === 'new-want' ? 'want' : null;
  const showCover = mode !== 'move';
  const dirOptional = wantLike;
  const saveLabel = mode === 'new-seen' ? 'Salva Film' : mode === 'new-want' ? 'Aggiungi ai da vedere' : mode === 'move' ? 'Segna come visto' : 'Salva modifiche';
  const parent = mode === 'new-want' ? '#/da-vedere' : film ? '#/film/' + film.id : '#/home';

  const html =
    '<div class="modal-bar"><button class="link dim" data-act="cancel">Annulla</button><div class="mt">' + TITLES[mode] + '</div><button class="link" data-act="save">Salva</button></div>' +
    '<div class="scroll"><form class="form" novalidate autocomplete="off">' +
    (mode === 'move' ? '<div class="cover-has">' + poster(film) + '<div class="cc"><b style="font-family:var(--serif);font-size:22px;line-height:1.1">' + esc(film.title) + '</b><span class="none">Quando l\'hai visto? Aggiungi regista, voto e commento.</span></div></div>' : '') +
    (showCover ? '<div data-cover></div>' : '') +
    (mode !== 'move' ? '<div class="fld"><div class="fld-ico">' + icon('film', 22) + '</div><div class="fld-body"><input data-title type="text" placeholder="Titolo del film" enterkeyhint="next" autocapitalize="words" autocorrect="off" spellcheck="false" maxlength="160" aria-label="Titolo del film"><div data-dup></div></div></div>' : '') +
    '<div class="fld"><div class="fld-ico">' + icon('user', 22) + '</div><div class="fld-body"><input data-dir type="text" placeholder="' + (dirOptional ? 'Nome del regista (opzionale)' : 'Nome del regista') + '" enterkeyhint="done" autocapitalize="words" autocorrect="off" spellcheck="false" maxlength="120" aria-label="Nome del regista"><div data-dirui></div></div></div>' +
    (seenLike
      ? '<div><div class="row2"><div class="fld"><div class="fld-ico">' + icon('calendar', 22) + '</div><div class="fld-body"><input data-date type="date" aria-label="Data di visione" max="' + todayISO() + '"></div></div>' +
        '<div class="fld"><div class="fld-body"><input data-year type="text" inputmode="numeric" maxlength="4" placeholder="Anno" aria-label="Anno di uscita (opzionale)"></div></div></div>' +
        '<div class="chips" style="padding:10px 0 0 58px"><button type="button" class="chip" data-d="today">Oggi</button><button type="button" class="chip" data-d="yest">Ieri</button><button type="button" class="chip" data-d="none">Non ricordo</button></div></div>' +
        '<div class="fld"><div class="fld-ico">' + icon('star', 22) + '</div><div class="fld-body"><div class="lbl">Voto (opzionale)</div><div class="rate-chips">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => '<button type="button" data-n="' + n + '" aria-pressed="false">' + n + '</button>').join('') + '</div>' +
        '<div class="rate-sub"><span data-rlabel>Nessun voto</span><button type="button" class="half" data-half aria-pressed="false">+ ½ punto</button></div></div></div>'
      : '<div class="fld"><div class="fld-ico">' + icon('calendar', 22) + '</div><div class="fld-body"><input data-year type="text" inputmode="numeric" maxlength="4" placeholder="Anno di uscita (opzionale)" aria-label="Anno di uscita"></div></div>') +
    '<div class="fld"><div class="fld-ico">' + icon('note', 22) + '</div><div class="fld-body"><textarea data-note rows="4" placeholder="' + (seenLike ? 'Commento o recensione (opzionale)' : 'Annotazioni (opzionale)') + '" autocapitalize="sentences" aria-label="' + (seenLike ? 'Commento' : 'Annotazioni') + '"></textarea></div></div>' +
    '<div class="form-actions"><button type="button" class="btn red" data-act="save">' + (mode === 'move' ? icon('check', 22) : '') + saveLabel + '</button>' +
    (mode === 'new-seen' ? '<button type="button" class="btn ghost" data-act="save-more">Salva e aggiungi un altro</button>' : '') + '</div>' +
    '</form><div class="pad-b"></div></div>';

  return {
    html,
    mount(el) {
      const $ = (s) => el.querySelector(s);
      const title = $('[data-title]'), dir = $('[data-dir]'), date = $('[data-date]'), year = $('[data-year]'), note = $('[data-note]');
      const dirui = $('[data-dirui]'), dup = $('[data-dup]'), coverBox = $('[data-cover]'), scroll = $('.scroll');
      let rating = null, closing = false;
      let cover = { kind: film && film.hasCover ? 'keep' : 'none', thumb: film ? film.thumb : null, full: null };

      /* ----- valori iniziali ----- */
      const fill = (v) => {
        if (title) title.value = v.title || '';
        dir.value = v.director || '';
        if (date) date.value = v.seenOn || '';
        year.value = v.year || '';
        note.value = v.comment || v.notes || '';
        rating = v.rating || null;
      };
      let initial;
      if (film) {
        initial = { title: film.title, director: film.director, seenOn: mode === 'move' ? todayISO() : film.seenOn, year: film.year, rating: mode === 'move' ? null : film.rating, comment: film.status === 'seen' ? film.comment : '', notes: film.status === 'want' && mode !== 'move' ? film.notes : '' };
      } else {
        initial = { title: '', director: p.q && p.q.dir ? p.q.dir : '', seenOn: seenLike ? todayISO() : '', year: '', rating: null, comment: '', notes: '' };
        const dr = draftKind ? draft(draftKind) : null;
        if (dr && (dr.title || dr.comment || dr.notes) && !(p.q && p.q.dir)) {
          initial = { ...initial, ...dr, seenOn: dr.seenOn !== undefined ? dr.seenOn : initial.seenOn };
          setTimeout(() => toast('Bozza ripristinata', { action: 'Scarta', onAction: () => { fill({ seenOn: seenLike ? todayISO() : '' }); paintRating(); updateDirUI(); updateDup(); draft(draftKind, null); } }), 450);
        }
      }
      fill(initial);
      const snapshot = () => JSON.stringify([title ? title.value : '', dir.value, date ? date.value : '', year.value, rating, note.value, cover.kind, cover.thumb && cover.thumb.length]);
      const startState = snapshot();

      /* ----- copertina ----- */
      function paintCover() {
        if (!coverBox) return;
        if (cover.kind === 'none') {
          coverBox.innerHTML = '<button type="button" class="cover-pick" data-act="cover">' + icon('camera', 30) + '<span>Aggiungi copertina<small>(opzionale)</small></span></button>';
        } else {
          const fake = { title: (title && title.value) || 'Film', director: dir.value, thumb: cover.thumb };
          coverBox.innerHTML = '<div class="cover-has">' + poster(fake) + '<div class="cc"><button type="button" class="btn sm" data-act="cover">Cambia foto</button><button type="button" class="link dim" data-act="cover-del" style="padding-left:0">Rimuovi</button></div></div>';
        }
      }
      paintCover();

      /* ----- voto ----- */
      const chips = Array.from(el.querySelectorAll('.rate-chips button')), half = $('[data-half]'), rlabel = $('[data-rlabel]');
      function paintRating() {
        chips.forEach((b) => b.setAttribute('aria-pressed', rating != null && Math.floor(rating) === +b.dataset.n ? 'true' : 'false'));
        if (half) { half.setAttribute('aria-pressed', rating != null && rating % 1 !== 0 ? 'true' : 'false'); half.disabled = rating == null || rating >= 10; half.style.opacity = half.disabled ? .4 : 1; }
        if (rlabel) rlabel.textContent = rating ? 'Voto: ' + fmtRating(rating) + ' su 10' : 'Nessun voto';
      }
      paintRating();

      /* ----- regista: suggerimenti e controllo duplicati ----- */
      function recentDirs() { return S.index().dirList.slice().sort((a, b) => b.lastSeq - a.lastSeq).slice(0, 5); }
      function updateDirUI() {
        const v = dir.value, k = dirKey(v), focused = document.activeElement === dir;
        let h = '';
        if (focused) {
          const list = v.trim() ? S.suggestDirectors(v, 5).filter((d) => d.key !== k) : recentDirs();
          if (list.length) h += '<div class="sugg">' + list.map((d) => '<button type="button" data-pick="' + esc(d.name) + '"><span>' + highlight(d.name, v) + '</span><small>' + (d.count || d.wants) + ' film</small></button>').join('') + '</div>';
        }
        if (v.trim()) {
          const ex = S.getDirector(k);
          if (ex) h += '<div class="hint ok">' + icon('check', 17) + '<span>Va nella collezione «' + esc(ex.name) + '»' + (ex.count ? ' (' + ex.count + (ex.count === 1 ? ' film)' : ' film)') : '') + '</span></div>';
          else {
            const near = S.nearestDirector(v);
            h += near ? '<button type="button" class="hint warn" data-pick="' + esc(near.name) + '">' + icon('alert', 17) + '<span>Intendevi «' + esc(near.name) + '»? Tocca per usarlo</span></button>'
              : '<div class="hint new">' + icon('plus', 17) + '<span>Nuovo regista: verrà creata una nuova collezione</span></div>';
          }
        }
        dirui.innerHTML = h;
      }
      function updateDup() {
        if (!dup || !title) return;
        const f = S.findDuplicate(title.value, dir.value, film && film.id);
        dup.innerHTML = f && seenLike ? '<div class="hint warn">' + icon('alert', 17) + '<span>Già in biblioteca' + (f.seenOn ? ': visto il ' + fmtDate(f.seenOn) : '') + '. Puoi aggiungerlo comunque.</span></div>' : '';
      }
      updateDirUI(); updateDup();

      const saveDraft = debounce(() => {
        if (!draftKind) return;
        draft(draftKind, { title: title.value, director: dir.value, seenOn: date ? date.value : '', year: year.value, rating, comment: seenLike ? note.value : '', notes: seenLike ? '' : note.value });
      }, 350);
      const autosize = () => { note.style.height = 'auto'; note.style.height = Math.max(124, note.scrollHeight + 2) + 'px'; };
      autosize();

      const onInput = (e) => {
        if (e.target === dir) { updateDirUI(); updateDup(); }
        if (e.target === title) { updateDup(); title.classList.remove('bad'); }
        if (e.target === note) autosize();
        if (e.target === dir) dir.classList.remove('bad');
        saveDraft();
      };
      el.addEventListener('input', onInput);
      dir.addEventListener('focus', updateDirUI);
      dir.addEventListener('blur', () => setTimeout(updateDirUI, 220));
      if (title) title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dir.focus(); } });
      dir.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dir.blur(); } });
      $('form').addEventListener('submit', (e) => e.preventDefault());

      /* ----- salvataggio ----- */
      async function save(more) {
        const t = clean(title ? title.value : film.title);
        const dname = clean(dir.value);
        const y = clean(year.value);
        if (!t) { toast('Scrivi il titolo del film', { error: true, top: true }); if (title) { title.classList.add('bad'); title.focus(); } return; }
        if (!dname && !dirOptional) { toast('Scrivi il nome del regista', { error: true, top: true }); dir.classList.add('bad'); dir.focus(); return; }
        if (y && !(/^\d{4}$/.test(y) && +y >= 1888 && +y <= 2100)) { toast('Anno non valido: scrivi quattro cifre, ad esempio 1994', { error: true, top: true }); year.focus(); return; }
        const dv = date ? date.value : '';
        if (dv && (!parseISO(dv) || dv > todayISO())) { toast('La data di visione non può essere nel futuro', { error: true, top: true }); return; }
        const text = note.value.trim();
        const group = dname ? S.getDirector(dirKey(dname)) : null;
        const btns = el.querySelectorAll('[data-act="save"],[data-act="save-more"]');
        btns.forEach((b) => { b.disabled = true; });
        try {
          let msg;
          if (mode === 'new-seen') {
            const f = await S.addFilm({ status: 'seen', title: t, director: dname, year: y, seenOn: dv || null, rating, comment: text, thumb: cover.kind === 'new' ? cover.thumb : null }, cover.kind === 'new' ? cover.full : null);
            msg = group && group.count ? 'Aggiunto a «' + f.director + '»' : 'Nuova collezione: «' + f.director + '»';
          } else if (mode === 'new-want') {
            await S.addFilm({ status: 'want', title: t, director: dname, year: y, notes: text, thumb: cover.kind === 'new' ? cover.thumb : null }, cover.kind === 'new' ? cover.full : null);
            msg = 'Aggiunto ai film da vedere';
          } else if (mode === 'move') {
            await S.moveToSeen(film.id, { director: dname, seenOn: dv || null, rating, comment: text, year: y || film.year });
            msg = 'Spostato tra i film visti';
          } else {
            const ch = { title: t, director: dname, year: y, ...(seenLike ? { seenOn: dv || null, rating, comment: text } : { notes: text }) };
            let cv;
            if (cover.kind === 'new') { cv = cover.full; ch.thumb = cover.thumb; } else if (cover.kind === 'none' && film.hasCover) cv = null;
            await S.updateFilm(film.id, ch, cv);
            msg = 'Modifiche salvate';
          }
          if (draftKind) draft(draftKind, null);
          if (more) {
            toast(msg + '. Aggiungi il prossimo', { top: true });
            fill({ director: dname, seenOn: todayISO() });
            cover = { kind: 'none', thumb: null, full: null };
            paintCover(); paintRating(); updateDirUI(); updateDup(); autosize();
            scroll.scrollTop = 0;
            title.focus();
          } else {
            closing = true;
            back(parent);
            toast(msg);
          }
        } catch (err) {
          console.error(err);
          toast(/quota/i.test(String(err && err.name)) ? 'Spazio esaurito sul telefono: libera memoria e riprova' : 'Non riesco a salvare. Riprova.', { error: true, top: true });
        } finally { btns.forEach((b) => { b.disabled = false; }); }
      }

      async function cancel() {
        if (!closing && (mode === 'edit' || mode === 'move') && snapshot() !== startState) {
          const ok = await confirmDlg({ title: 'Uscire senza salvare?', text: 'Le modifiche a questa scheda andranno perse.', ok: 'Esci', cancel: 'Continua a modificare', danger: true });
          if (!ok) return;
        }
        closing = true;
        back(parent);
      }

      const onClick = async (e) => {
        const pick = e.target.closest('[data-pick]');
        if (pick) { dir.value = pick.dataset.pick; dir.classList.remove('bad'); updateDirUI(); updateDup(); saveDraft(); if (document.activeElement === dir) dir.blur(); return; }
        const n = e.target.closest('.rate-chips [data-n]');
        if (n) { const v = +n.dataset.n; rating = rating != null && Math.floor(rating) === v ? null : v; paintRating(); saveDraft(); return; }
        if (e.target.closest('[data-half]')) { if (rating != null && rating < 10) { rating = rating % 1 ? Math.floor(rating) : rating + 0.5; paintRating(); saveDraft(); } return; }
        const dch = e.target.closest('[data-d]');
        if (dch && date) {
          const d = new Date();
          if (dch.dataset.d === 'yest') d.setDate(d.getDate() - 1);
          date.value = dch.dataset.d === 'none' ? '' : todayISO(d);
          saveDraft();
          return;
        }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        switch (a.dataset.act) {
          case 'cancel': cancel(); break;
          case 'save': save(false); break;
          case 'save-more': save(true); break;
          case 'cover-del': cover = { kind: 'none', thumb: null, full: null }; paintCover(); break;
          case 'cover': {
            const file = await pickFile('image/*');
            if (!file) break;
            try {
              const c = await processCover(file);
              cover = { kind: 'new', thumb: c.thumb, full: c.full };
              paintCover();
            } catch (err) { toast('Non riesco a leggere questa immagine', { error: true, top: true }); }
            break;
          }
          default: break;
        }
      };
      el.addEventListener('click', onClick);
      if (mode === 'new-seen' || mode === 'new-want') setTimeout(() => { try { title.focus(); } catch (err) { /* ignora */ } }, 380);
      return () => { el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); saveDraft.cancel(); };
    },
  };
}

export const formNewSeen = (p) => build('new-seen', p);
export const formNewWant = (p) => build('new-want', p);
export const formEdit = (p) => build('edit', p);
export const formMove = (p) => build('move', p);
