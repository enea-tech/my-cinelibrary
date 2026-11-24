// Genera src/js/icons.js a partire dalle icone Lucide (https://lucide.dev, licenza ISC).
// Uso:  node tools/make-icons.mjs [cartella-icone-lucide]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'node_modules/lucide-static/icons';

// nome usato nell'app -> nome del file Lucide (con alternative per versioni diverse)
const WANT = {
  home: ['house', 'home'],
  film: ['clapperboard', 'film'],
  reel: ['film'],
  bookmark: ['bookmark'],
  search: ['search'],
  more: ['ellipsis', 'more-horizontal'],
  plus: ['plus'],
  right: ['chevron-right'],
  left: ['chevron-left'],
  down: ['chevron-down'],
  up: ['chevron-up'],
  star: ['star'],
  heart: ['heart'],
  calendar: ['calendar-days', 'calendar'],
  user: ['user'],
  note: ['message-square-text', 'message-square'],
  camera: ['camera'],
  x: ['x'],
  check: ['check'],
  trash: ['trash-2', 'trash'],
  edit: ['pencil', 'edit-2'],
  sort: ['arrow-up-down'],
  sliders: ['sliders-horizontal'],
  chart: ['chart-column', 'bar-chart-3', 'bar-chart'],
  settings: ['settings'],
  download: ['download'],
  upload: ['upload'],
  share: ['share'],
  table: ['file-spreadsheet', 'sheet'],
  shield: ['shield-check'],
  info: ['info'],
  users: ['users'],
  list: ['list'],
  grid: ['layout-grid'],
  alert: ['triangle-alert', 'alert-triangle'],
  phone: ['smartphone'],
  refresh: ['refresh-cw'],
  eye: ['eye'],
  undo: ['undo-2', 'rotate-ccw'],
  clock: ['clock'],
  popcorn: ['popcorn', 'film'],
  database: ['database'],
  wifi: ['wifi'],
  image: ['image'],
  sparkles: ['sparkles'],
};

const out = {};
const missing = [];
for (const [name, cands] of Object.entries(WANT)) {
  let svg = null;
  for (const c of cands) {
    const f = path.join(dir, c + '.svg');
    if (fs.existsSync(f)) { svg = fs.readFileSync(f, 'utf8'); break; }
  }
  if (!svg) { missing.push(name); continue; }
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\s*\n\s*/g, '').trim();
  out[name] = inner;
}

const js = `// FILE GENERATO da tools/make-icons.mjs — icone Lucide (ISC License)
const P = ${JSON.stringify(out, null, 1)};

export function icon(name, size = 22, cls = '') {
  const inner = P[name] || P.film;
  return '<svg class="i ' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
}
`;
fs.mkdirSync('src/js', { recursive: true });
fs.writeFileSync('src/js/icons.js', js);
console.log('icone:', Object.keys(out).length, missing.length ? 'MANCANTI: ' + missing.join(', ') : 'ok');
