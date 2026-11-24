# My CineLibrary

La tua biblioteca cinematografica personale, pensata per l'iPhone.
Si installa come una vera app, funziona anche **senza internet** e tiene tutti i dati **sul telefono**: nessun account, nessun server, nessun limite pratico al numero di film (provata con 3.000 film e 1.000 registi, sempre fluida).

---

## Cosa c'è in questa cartella

| Serve per usare l'app | Serve solo per modificarla |
|---|---|
| `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `fonts/`, `icons/` | `src/`, `build.mjs`, `tools/`, `package.json` |

L'app è già compilata: non devi installare nulla per usarla.

---

## 1. Metterla online (una volta sola)

Un'app installabile ha bisogno di un indirizzo `https://`. Il modo più semplice è **GitHub Pages**, gratuito:

1. Su github.com crea un nuovo repository **pubblico**, per esempio `my-cinelibrary`.
   Non contiene dati personali: i tuoi film restano solo sul tuo iPhone.
2. Carica **tutto il contenuto di questa cartella** (comprese `fonts`, `icons`, `src` e `tools`; il file nascosto `.nojekyll` è facoltativo).
3. Vai in **Settings → Pages**, scegli *Deploy from a branch*, branch `main`, cartella `/ (root)`, poi **Save**.
4. Dopo circa un minuto l'app è raggiungibile a
   `https://IL-TUO-UTENTE.github.io/my-cinelibrary/`

Va bene anche qualsiasi altro hosting di file statici con HTTPS (Cloudflare Pages, Netlify, ecc.): basta pubblicare la cartella così com'è.

## 2. Installarla sull'iPhone

1. Apri l'indirizzo in **Safari**.
2. Tocca **Condividi** (il quadrato con la freccia) → **Aggiungi alla schermata Home** → **Aggiungi**.
3. Apri l'app dalla nuova icona: parte a schermo intero.
   Dopo il primo avvio con internet funziona anche in modalità aereo.

> **Usa sempre l'icona sulla Home**, non la pagina aperta in Safari: è il modo più sicuro per conservare i dati. Nelle schede normali di Safari, iOS può svuotare l'archivio dei siti che non apri da molto tempo.

---

## 3. Come si usa

- **Home**: totali, pulsante rosso *Aggiungi Film*, accesso rapido alle sezioni e agli ultimi film inseriti.
- **Film Visti**: due viste, **Registi** e **Film**. Ricerca, ordinamento (titolo, regista, data) e indice A–Z a destra per scorrere biblioteche grandi.
  Toccando un regista vedi la sua collezione con data di visione, voto e commento.
- **Aggiungere un film visto**: titolo, regista, data (anche *Oggi*, *Ieri*, *Non ricordo*), voto facoltativo da 1 a 10 (anche mezzi punti), commento e copertina facoltativi.
  Se il regista esiste già finisce nella sua raccolta, se è nuovo viene creato da solo.
  «tarantino», «Quentin Tarantino» e «Tarantino, Quentin» sono lo stesso regista; se sbagli una lettera l'app propone «Intendevi …?».
  Dalla pagina del regista (menu ⋯) puoi rinominarlo: se il nuovo nome esiste già, le due raccolte si uniscono.
- **Film da Vedere**: aggiungi titolo, regista e annotazioni («consigliato da Marco…»). La stella mette un film in cima alla lista.
  La spunta verde lo sposta tra i **Visti** chiedendo data, regista e commento.
- **Cerca**: film, registi e anche le parole scritte nei tuoi commenti.
- **Altro**: Preferiti, Statistiche (registi più visti, voti, film per anno e decennio) e Impostazioni.
- Modificare o eliminare un film: dalla sua scheda. Se elimini per errore compare **Annulla** per qualche secondo.
- Se esci da un modulo a metà, la bozza viene ricordata.

---

## 4. I tuoi dati (importante)

I film sono salvati nell'archivio interno dell'app, solo su questo iPhone. Restano anche dopo aver chiuso l'app o riavviato il telefono.
Si perdono invece se **cancelli i dati di Safari**, **rimuovi l'app dalla Home**, **cambi iPhone** o **cambi l'indirizzo del sito**.

Per questo, ogni tanto fai una copia:

- **Altro → Impostazioni → Salva una copia dei dati** crea un file `.json` (con le copertine, se vuoi). Scegli **Salva su File**, meglio in iCloud Drive.
  Dopo un po' di film la Home te lo ricorda.
- **Ripristina da una copia**: *Unisci* aggiunge i film mancanti e tiene quelli che hai; *Sostituisci tutto* riparte dalla copia.
- **Esporta per Excel (CSV)**: tabella con film, registi, date, voti e commenti.

**Nuovo iPhone, o nuovo indirizzo:** salva una copia sul vecchio, installa l'app sul nuovo e usa *Ripristina da una copia*.

---

## 5. Aggiornare l'app

Sostituisci i file nel repository con quelli nuovi. Alla successiva apertura con internet compare **«Aggiornamento pronto»**: tocca *Applica*.
I film non vengono mai toccati dagli aggiornamenti.
In **Impostazioni → Cerca aggiornamenti** puoi forzare il controllo.

---

## 6. Per chi vuole modificare il codice

```
npm install                  # una volta sola (serve solo esbuild)
npm run build                # rigenera app.js, style.css e sw.js da src/
node tools/serve.mjs 8080    # prova in locale: http://localhost:8080
```

- `src/js/store.js`: dati, raggruppamento per regista, ricerca, statistiche, copie di sicurezza.
- `src/js/db.js`: archivio IndexedDB (database `my-cinelibrary`).
- `src/js/screens/`: una schermata per file. `src/css/`: stili.
- `src/sw.template.js`: service worker (la versione della cache cambia da sola a ogni build).
- `tools/make-icons.mjs` rigenera le icone dell'interfaccia da Lucide (`npm i -D lucide-static` prima di usarlo). Le icone dell'app in `icons/` sono normali PNG sostituibili.

Tecnologia: HTML, CSS e JavaScript puri, IndexedDB, service worker. Nessuna dipendenza a runtime, nessun tracciamento, nessuna chiamata di rete oltre al caricamento dei file dell'app.

## Limiti da conoscere

- Pensata per **un solo utente e un solo dispositivo**: non c'è sincronizzazione tra telefoni. Per spostare i dati si usano le copie.
- Le copertine sono facoltative: se non ne metti, l'app disegna una locandina tipografica con titolo e regista.
- I dati sono legati all'indirizzo del sito: se lo cambi, ripristina da una copia.
