# THE LAB — CRM / Studio Management

Gestionale interno di THE LAB: CRM clienti, pipeline trattative, preventivi,
listino bundle e modulo Stabile (affitto bottom-up).

## Architettura in due pezzi

| Pezzo | File | Dove gira |
|---|---|---|
| Frontend | `index.html` | hosting statico, servito alla radice |
| Backend | non versionato qui | Google Apps Script, pubblicato come Web App |
| Database | — | Google Sheets |

Il frontend e' una SPA in un unico file: HTML, CSS e JavaScript nello stesso
documento, senza build step e senza framework. Si apre, si modifica, si
ricarica. Le uniche dipendenze esterne sono Chart.js e Google Identity
Services, entrambe da CDN.

La documentazione tecnica completa (`ARCHITETTURA.md`) non e' versionata
qui: descrive l'architettura di sicurezza nel dettaglio e resta fuori dal
repo pubblico.

## Come si aggiorna

**Frontend** — si modifica `index.html` e si fa push: l'hosting ridistribuisce
da solo.

**Backend** — il sorgente `the-lab-backend-v8 (1).gs` **non sta in questo repo**: contiene l'ID del
foglio Google, e un repo pubblico servito da Pages lo renderebbe scaricabile.
Vive su disco e nell'editor Apps Script. Si modifica, si incolla nell'editor e
si pubblica **come nuova versione dentro il deployment esistente**, mai come
nuovo deployment. Un deployment nuovo genera un URL nuovo e stacca il frontend,
che punta a `SCRIPT_URL` in cima a `index.html`.

Dopo ogni modifica allo schema dei fogli va lanciato `setupSheets` dall'editor.

## Test

```
npm test
```

Nessuna dipendenza da installare: usa `node:test`, incluso in Node. `package.json`
esiste solo per dare un nome al comando.

I test coprono la logica contabile delle provvigioni, che e' la parte dove un
errore costerebbe caro e resterebbe invisibile a occhio. Due livelli:

- **Funzioni pure** (`tests/provvigioni.test.js`, `tests/trattative.test.js`) —
  `tests/extract.js` carica il blocco delimitato da `// <<<TESTABLE:PROVVIGIONI`
  dentro `index.html` e lo esegue sotto Node. E' il modo per testare davvero
  senza rompere il vincolo "un solo file, nessun build step". Le funzioni dentro
  quel blocco non devono leggere `_s`, il DOM o altre globali: ricevono tutto per
  parametro, ed e' proprio questo che le rende caricabili.
- **Integrazione** (`tests/integrazione.test.js`) — valuta l'intero blocco
  `<script>` principale in una sandbox con stub minimi di `document`/`window`,
  poi inietta uno stato e chiama le **vere** `buildMovimenti()` e
  `getRevenueAllocationsForProject()`. Verifica su 80 combinazioni di
  acconto/saldo/corrisposto che la somma delle allocazioni di ogni movimento sia
  esattamente pari al movimento e che nessuna quota vada sotto zero.

Se aggiungi una funzione dentro il blocco testabile, aggiungila anche all'elenco
`exported` in `tests/extract.js`, altrimenti i test non la vedono.

## Versionamento

Le modifiche sono taggate inline nei commenti con la versione che le ha
introdotte, ad esempio `[v8.3-32]`. `BACKEND_VERSION` nel `.gs` e
`REQUIRED_BACKEND_VERSION` in `index.html` devono restare allineate: il
frontend rifiuta di partire se il backend e' piu' vecchio del previsto.

## Nota sulle credenziali

`index.html` contiene in chiaro il token condiviso, il client ID Google e
l'elenco delle email abilitate. E' una scelta architetturale nota: il file
viene comunque servito al browser, quindi quei valori sono leggibili da
chiunque apra il sorgente della pagina. La difesa reale e' la whitelist di
email lato backend, non la segretezza del token.
