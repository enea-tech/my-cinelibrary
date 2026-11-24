// «Altro» (menu) e «Impostazioni» (copie di sicurezza, esportazione, installazione)
import { icon } from '../icons.js';
import { fmtBytes, timeAgo, todayISO } from '../util.js';
import * as S from '../store.js';
import * as db from '../db.js';
import { barHeader, dialog, confirmDlg, toast } from '../ui.js';
import { pickFile, saveFile } from '../files.js';
import { pref, setPref } from '../prefs.js';
import { replace } from '../router.js';
import { VERSION } from '../version.js';

export function altroScreen() {
  const c = S.counts();
  const favs = S.index().seen.filter((f) => f.fav).length;
  return {
    html: '<div class="scroll"><header class="hdr"><h1 class="hdr-title">Altro</h1></header><div class="menu">' +
      '<button class="mrow" data-go="#/preferiti">' + icon('heart', 24) + 'Preferiti<span class="val">' + favs + '</span>' + icon('right', 20, 'chev') + '</button>' +
      '<button class="mrow" data-go="#/stat">' + icon('chart', 24) + 'Statistiche' + icon('right', 20, 'chev') + '</button>' +
      '<button class="mrow" data-go="#/impostazioni">' + icon('settings', 24) + 'Impostazioni e copie dei dati' + icon('right', 20, 'chev') + '</button>' +
      '</div><p class="note" style="padding:18px 24px 0">La biblioteca contiene ' + c.seen + (c.seen === 1 ? ' film visto' : ' film visti') + ' e ' + c.want + ' da vedere. Tutto è salvato solo su questo iPhone: fai ogni tanto una copia dei dati.</p><div class="pad-b"></div></div>',
  };
}

export function impostazioniScreen() {
  const c = S.counts(), m = S.state.meta;
  const covers = pref('exportCovers', true);
  const row = (k, v, id) => '<div class="srow"><div class="sk">' + k + '</div><div class="sv"' + (id ? ' data-' + id : '') + '>' + v + '</div></div>';
  const btn = (act, ico, label, sub, cls = '') => '<button class="srow ' + cls + '" data-act="' + act + '">' + icon(ico, 22) + '<div class="sk">' + label + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + icon('right', 18, 'chev') + '</button>';
  const html = barHeader({ back: '#/altro', label: 'Indietro' }) +
    '<div class="scroll"><header class="hdr" style="min-height:0;padding-top:2px"><h1 class="hdr-title">Impostazioni</h1></header>' +
    '<div class="grp"><div class="grp-t">La mia biblioteca</div><div class="grp-b">' +
    row('Film visti', c.seen) + row('Film da vedere', c.want) + row('Registi', c.dirs) +
    row('Spazio occupato', '…', 'usage') + row('Archiviazione protetta', '…', 'persist') + row('Ultima copia dei dati', S.state.meta.lastBackupAt ? timeAgo(m.lastBackupAt) : 'mai') +
    '</div></div>' +
    '<div class="grp"><div class="grp-t">Copia di sicurezza</div><div class="grp-b">' +
    '<div class="srow"><div class="sk">Includi le copertine<small>Il file è più grande ma completo</small></div><button class="sw" data-act="covers" role="switch" aria-checked="' + covers + '" aria-label="Includi le copertine"></button></div>' +
    btn('export', 'download', 'Salva una copia dei dati', 'File .json: tienilo su File o iCloud Drive') +
    btn('import', 'upload', 'Ripristina da una copia', 'Unisci o sostituisci la biblioteca') +
    btn('csv', 'table', 'Esporta per Excel (CSV)', 'Tabella con film, registi, voti e commenti') +
    '</div><p class="note">I dati vivono solo su questo iPhone. Se cancelli i dati di Safari o rimuovi l\'app, la biblioteca si perde: una copia salvata ti protegge.</p></div>' +
    '<div class="grp"><div class="grp-t">Usarla come un\'app</div><div class="grp-b"><ol class="steps">' +
    '<li>Apri questa pagina in <b>Safari</b> sull\'iPhone.</li><li>Tocca il tasto <b>Condividi</b> (il quadrato con la freccia).</li><li>Scegli <b>Aggiungi alla schermata Home</b>.</li><li>Apri l\'icona: parte a tutto schermo e funziona anche <b>senza internet</b>.</li></ol></div></div>' +
    '<div class="grp"><div class="grp-t">Informazioni</div><div class="grp-b">' +
    row('Versione', VERSION) + row('Funziona offline', '…', 'offline') + btn('update', 'refresh', 'Cerca aggiornamenti', '') + '</div></div>' +
    '<div class="grp"><div class="grp-t">Zona delicata</div><div class="grp-b">' + btn('wipe', 'trash', 'Elimina tutta la biblioteca', 'Rimuove ogni film. Non si può annullare.', 'danger') + '</div></div>' +
    '<div class="pad-b"></div></div>';

  return {
    html,
    mount(el) {
      const set = (k, v) => { const n = el.querySelector('[data-' + k + ']'); if (n) n.textContent = v; };
      db.storageInfo().then((i) => {
        set('usage', i.usage != null ? fmtBytes(i.usage) : 'non disponibile');
        set('persist', i.persisted ? 'Sì' : 'Non ancora');
      });
      set('offline', 'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'Sì' : 'Dopo il primo avvio');

      async function exportJSON() {
        toast('Preparo la copia…', { ms: 1400 });
        const blob = await S.exportJSON({ covers: pref('exportCovers', true) });
        const name = 'my-cinelibrary-' + todayISO() + '.json';
        const r = await dialog({ title: 'Copia pronta', text: S.state.films.size + ' film, ' + fmtBytes(blob.size) + '. Su iPhone scegli «Salva su File», meglio se in iCloud Drive.', buttons: [{ label: 'Annulla', value: false, kind: 'ghost' }, { label: 'Salva…', value: true, kind: 'red', primary: true }] });
        if (!r || !r.value) return;
        const res = await saveFile(blob, name);
        if (res === 'cancelled') return;
        await S.markBackedUp();
        toast(res === 'shared' ? 'Copia salvata' : 'Copia scaricata');
      }

      async function importJSON() {
        const file = await pickFile('.json,application/json,text/plain');
        if (!file) return;
        let text;
        try { text = await file.text(); } catch (e) { toast('Non riesco a leggere il file', { error: true }); return; }
        const r = await dialog({
          title: 'Ripristina dalla copia', text: 'Come vuoi usare questa copia? «Unisci» aggiunge i film mancanti e tiene quelli che hai già. «Sostituisci» cancella la biblioteca attuale.',
          buttons: [{ label: 'Annulla', value: null, kind: 'ghost' }, { label: 'Unisci', value: 'merge', kind: 'red', primary: true }, { label: 'Sostituisci tutto', value: 'replace', kind: 'danger' }],
        });
        if (!r || !r.value) return;
        if (r.value === 'replace' && !(await confirmDlg({ title: 'Sostituire la biblioteca?', text: 'I film attuali verranno eliminati e rimpiazzati da quelli della copia.', ok: 'Sostituisci', danger: true }))) return;
        try {
          const res = await S.importBackup(text, r.value);
          toast(res.added + ' film aggiunti' + (res.updated ? ', ' + res.updated + ' aggiornati' : '') + '. Totale: ' + res.total);
        } catch (e) { toast(e.message || 'Ripristino non riuscito', { error: true }); }
      }

      async function wipe() {
        const r = await dialog({ title: 'Eliminare tutto?', text: 'Verranno rimossi tutti i film, i commenti e le copertine. Per confermare scrivi ELIMINA.', input: { placeholder: 'ELIMINA', cap: 'characters' }, buttons: [{ label: 'Annulla', value: false, kind: 'ghost' }, { label: 'Elimina tutto', value: true, kind: 'red', needs: 'ELIMINA', primary: true }] });
        if (!r || !r.value) return;
        await S.wipeAll();
        toast('Biblioteca svuotata');
        replace('#/home');
      }

      const onClick = async (e) => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        try {
          switch (a.dataset.act) {
            case 'covers': { const v = a.getAttribute('aria-checked') !== 'true'; a.setAttribute('aria-checked', v); setPref('exportCovers', v); break; }
            case 'export': await exportJSON(); break;
            case 'import': await importJSON(); break;
            case 'csv': {
              const res = await saveFile(S.exportCSV(), 'my-cinelibrary-' + todayISO() + '.csv');
              if (res !== 'cancelled') toast(res === 'shared' ? 'Tabella salvata' : 'Tabella scaricata');
              break;
            }
            case 'wipe': await wipe(); break;
            case 'update': {
              toast('Controllo aggiornamenti…', { ms: 1500 });
              const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
              if (reg) { await reg.update(); setTimeout(() => toast(reg.waiting || reg.installing ? 'Aggiornamento pronto: riapri l\'app' : 'Hai già l\'ultima versione'), 1200); } else toast('Hai già l\'ultima versione');
              break;
            }
            default: break;
          }
        } catch (err) { console.error(err); toast('Operazione non riuscita', { error: true }); }
      };
      el.addEventListener('click', onClick);
      return () => el.removeEventListener('click', onClick);
    },
  };
}
