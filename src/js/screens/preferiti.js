import { icon } from '../icons.js';
import { esc, fmtRating } from '../util.js';
import * as S from '../store.js';
import { poster, barHeader, emptyState } from '../ui.js';

export function preferitiScreen() {
  const favs = S.index().seen.filter((f) => f.fav).sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.seq - a.seq);
  const grid = favs.length
    ? '<div class="pgrid">' + favs.map((f) => '<button class="pcell" data-go="#/film/' + esc(f.id) + '">' + poster(f) + '<div class="pt">' + esc(f.title) + '</div><div class="ps">' + esc(f.director) + (f.rating ? ' · ' + fmtRating(f.rating) : '') + '</div></button>').join('') + '</div>'
    : emptyState({ ico: 'heart', title: 'Ancora nessun preferito', text: 'Apri la scheda di un film e tocca il cuore: i tuoi film del cuore compariranno qui.', action: 'Vai ai film visti', go: '#/visti' });
  return {
    html: barHeader({ back: '#/altro', label: 'Indietro' }) +
      '<div class="scroll"><header class="hdr" style="min-height:0;padding-top:2px"><h1 class="hdr-title">Preferiti<span class="hdr-sub">' + (favs.length ? favs.length + (favs.length === 1 ? ' film del cuore' : ' film del cuore') : 'I film del cuore') + '</span></h1></header>' +
      grid + '<div class="pad-b"></div></div>',
  };
}
