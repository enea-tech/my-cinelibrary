import { icon } from '../icons.js';
import { esc, fmtRating, fmtAvg, fmtDate, plural } from '../util.js';
import * as S from '../store.js';
import { poster, barHeader, emptyState } from '../ui.js';

export function statsScreen() {
  const st = S.stats();
  const head = barHeader({ back: '#/altro', label: 'Indietro' });
  if (!st.seen) {
    return { html: head + '<div class="scroll"><header class="hdr" style="min-height:0;padding-top:2px"><h1 class="hdr-title">Statistiche</h1></header>' + emptyState({ ico: 'chart', title: 'Nessun dato per ora', text: 'Le statistiche nascono dai film che aggiungi: registi preferiti, voti, film per anno.', action: 'Aggiungi un film', go: '#/nuovo' }) + '</div>' };
  }
  const maxDir = Math.max(1, ...st.topDirs.map((d) => d.count));
  const dirs = '<div class="bars">' + st.topDirs.map((d) => '<div class="bar"><span class="nm">' + esc(d.name) + '</span><span class="tr"><span class="fl" style="width:' + (d.count / maxDir * 100).toFixed(1) + '%"></span></span><span class="n">' + d.count + '</span></div>').join('') + '</div>';

  const maxH = Math.max(1, ...st.hist);
  const hist = st.rated
    ? '<div class="cols">' + st.hist.map((n, i) => '<div class="col"><span class="cn">' + (n || '') + '</span><span class="cbw"><span class="cb gold' + (n ? '' : ' z') + '" style="height:' + (n ? Math.max(4, n / maxH * 100) : 0) + '%"></span></span><span class="cl">' + (i + 1) + '</span></div>').join('') + '</div>'
    : '<p class="none">Aggiungi un voto ai tuoi film per vedere come li giudichi.</p>';

  const maxY = Math.max(1, ...st.years.map((y) => y[1]));
  const years = st.years.length
    ? '<div class="cols-scroll"><div class="cols" style="min-width:' + Math.max(0, st.years.length * 44) + 'px">' + st.years.map(([y, n]) => '<div class="col"><span class="cn">' + n + '</span><span class="cbw"><span class="cb" style="height:' + Math.max(4, n / maxY * 100) + '%"></span></span><span class="cl">' + y + '</span></div>').join('') + '</div></div>'
    : '<p class="none">Indica la data di visione dei film per vedere l\'andamento negli anni.</p>';

  const maxD = Math.max(1, ...st.decades.map((d) => d[1]));
  const decades = st.decades.length
    ? '<div class="bars">' + st.decades.map(([d, n]) => '<div class="bar"><span class="nm">Anni ' + d + '</span><span class="tr"><span class="fl" style="width:' + (n / maxD * 100).toFixed(1) + '%"></span></span><span class="n">' + n + '</span></div>').join('') + '</div>'
    : '';

  const top = st.topRated.length
    ? '<div class="top-list">' + st.topRated.map((f) => '<div class="top-i" data-go="#/film/' + esc(f.id) + '">' + poster(f) + '<div class="txt"><div class="tt">' + esc(f.title) + '</div><div class="ts">' + esc(f.director) + '</div></div><span class="rate">' + icon('star', 14) + fmtRating(f.rating) + '</span></div>').join('') + '</div>'
    : '';

  const best = st.bestDirs[0];
  const facts = [
    [st.dirs, 'Registi nella biblioteca'],
    [st.commented, plural(st.commented, 'film con commento', 'film con commento').replace(/^\d+ /, '')],
    [st.inYear, 'Film visti quest\'anno'],
    [st.inMonth, 'Film visti questo mese'],
    [st.favs, 'Preferiti'],
    [st.want, 'Ancora da vedere'],
  ];
  const html = head + '<div class="scroll"><header class="hdr" style="min-height:0;padding-top:2px"><h1 class="hdr-title">Statistiche' + (st.first ? '<span class="hdr-sub">Dal ' + esc(fmtDate(st.first, true)) + '</span>' : '') + '</h1></header>' +
    '<div class="tiles"><div class="tile">' + icon('film', 22) + '<span class="tv">' + st.seen + '</span><span class="tk">Film Visti</span></div><div class="tile">' + icon('star', 22, 'i-fill') + '<span class="tv">' + fmtAvg(st.avg) + '</span><span class="tk">Voto Medio</span></div></div>' +
    '<div class="card"><h3>Registi più visti</h3>' + dirs + '</div>' +
    '<div class="card"><h3>Come li hai votati<small>' + (st.rated ? st.rated + ' con voto' : '') + '</small></h3>' + hist + '</div>' +
    '<div class="card"><h3>Film visti per anno</h3>' + years + '</div>' +
    (decades ? '<div class="card"><h3>Decenni di uscita</h3>' + decades + '</div>' : '') +
    (top ? '<div class="card"><h3>I film meglio votati</h3>' + top + '</div>' : '') +
    '<div class="card"><h3>In breve</h3><div class="facts">' + facts.map(([v, k]) => '<div class="fact"><div class="fv">' + v + '</div><div class="fk">' + esc(k) + '</div></div>').join('') +
    (best ? '<div class="fact" style="grid-column:1/-1"><div class="fv" style="font-size:19px">' + esc(best.name) + '</div><div class="fk">Regista con il voto medio più alto (' + fmtAvg(best.avg) + ' su ' + best.count + ' film)</div></div>' : '') + '</div></div>' +
    '<div class="pad-b"></div></div>';
  return { html };
}
