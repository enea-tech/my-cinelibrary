// Compila l'app: src/ -> app.js, style.css, sw.js (nella stessa cartella di index.html)
//   npm install && npm run build
import { build, transform } from 'esbuild';
import fs from 'node:fs';
import crypto from 'node:crypto';

await build({
  entryPoints: ['src/js/main.js'],
  bundle: true, format: 'iife', target: ['safari15'], minify: true, legalComments: 'none',
  outfile: 'app.js', logLevel: 'warning',
});

const css = ['base', 'components', 'screens'].map((n) => fs.readFileSync(`src/css/${n}.css`, 'utf8')).join('\n');
const out = await transform(css, { loader: 'css', minify: true, target: 'safari15' });
fs.writeFileSync('style.css', out.code);

const list = (d) => fs.readdirSync(d).filter((f) => !f.startsWith('.')).sort().map((f) => `${d}/${f}`);
const files = ['./', 'index.html', 'app.js', 'style.css', 'manifest.webmanifest', ...list('fonts'), ...list('icons')];
const hash = crypto.createHash('sha256');
files.filter((f) => f !== './').forEach((f) => hash.update(f).update(fs.readFileSync(f)));
const version = hash.digest('hex').slice(0, 10);
const sw = fs.readFileSync('src/sw.template.js', 'utf8').split('__VERSION__').join(version).split('__FILES__').join(JSON.stringify(files));
if (/__[A-Z]+__/.test(sw)) throw new Error('sw.js: segnaposto non sostituiti');
fs.writeFileSync('sw.js', sw);

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
console.log(`ok  app.js ${kb('app.js')}  style.css ${kb('style.css')}  sw.js (versione ${version}, ${files.length} file in cache)`);
