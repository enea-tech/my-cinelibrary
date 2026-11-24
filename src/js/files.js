// Copertine (ridimensionamento) e file (salvataggio / lettura di copie)

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')); };
    img.src = url;
  });
}

/** Ritaglia la foto in formato locandina (2:3) e crea copertina + miniatura leggere (circa 25 KB + 5 KB). */
export async function processCover(file) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { src = await loadImg(file); }
  const w = src.width, h = src.height;
  const make = (tw, th, q) => {
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    const x = c.getContext('2d');
    const target = tw / th, ratio = w / h;
    let sw = w, sh = h, sx = 0, sy = 0;
    if (ratio > target) { sw = h * target; sx = (w - sw) / 2; } else { sh = w / target; sy = (h - sh) / 2; }
    x.fillStyle = '#111'; x.fillRect(0, 0, tw, th);
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, sx, sy, sw, sh, 0, 0, tw, th);
    return c.toDataURL('image/jpeg', q);
  };
  const out = { full: make(300, 450, 0.82), thumb: make(96, 144, 0.74) };
  if (src.close) src.close();
  return out;
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(i);
    const done = (f) => { i.remove(); resolve(f); };
    i.addEventListener('change', () => done(i.files && i.files[0] ? i.files[0] : null));
    i.addEventListener('cancel', () => done(null));
    i.click();
  });
}

/** Su iPhone apre il pannello «Condividi» (Salva su File, iCloud Drive, AirDrop). Altrove scarica il file. */
export async function saveFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}
