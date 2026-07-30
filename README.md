# CourtLab — Basketball Stats Coach

Web app PWA, tablet-first e offline-first, per registrare e
analizzare le statistiche di squadre di pallacanestro 5 contro 5 secondo le
convenzioni FIBA.

Demo pubblica: [basketcoach.duckdns.org](https://basketcoach.duckdns.org)

## Obiettivo

Permettere a un allenatore, assistente o volontario di:

1. preparare roster e partita;
2. registrare rapidamente gli eventi mentre guarda il campo;
3. correggere gli errori senza perdere la storia delle modifiche;
4. ottenere box score, shot chart e indicatori avanzati;
5. condividere un report controllando chi può vedere i dati.

## Documentazione

- [Specifica di prodotto](docs/product-spec.md)
- [Modello dati e motore statistico](docs/data-and-stats.md)
- [Backlog MVP](docs/mvp-backlog.md)

## Decisioni già prese

- target iniziale: coach e staff di squadre italiane giovanili/dilettantistiche;
- formato iniziale: pallacanestro 5 contro 5, regole FIBA;
- dispositivo primario: tablet in orizzontale;
- piattaforma: PWA utilizzabile anche su telefono e desktop;
- acquisizione: manuale, con modalità Basic e Pro;
- dati: event sourcing, audit delle correzioni e ricalcolo delle statistiche;
- rete: la partita deve poter essere registrata interamente offline;
- lingue iniziali: italiano, struttura predisposta per l'inglese;
- fuori dall'MVP: AI video, feed NBA/EuroLeague, tornei e pagamenti.

## Gate prima dello sviluppo

Il prototipo della schermata live deve essere provato da almeno tre persone su
una partita registrata o simulata. L'MVP può passare allo sviluppo completo solo
se un utente riesce a registrare le azioni principali senza perdere
frequentemente l'azione successiva.

## Funzioni attuali

CourtLab è implementata in React e TypeScript con:

- gestione di più società, categorie, roster e stagioni;
- setup partita e quintetto;
- modalità Basic e Pro;
- tracker live ottimizzato per tablet;
- tiro posizionato sul campo e shot chart;
- statistiche individuali e di squadra, aggregazioni per quarto e VAL;
- eventi individuali, falli, contropiede, timeout e sostituzioni;
- cronometro, navigazione tra periodi e parziali di tutti i quarti;
- revisione degli eventi e correzione delle statistiche;
- analisi video locale con sincronizzazione degli eventi;
- report PDF ed Excel con logo;
- archivio locale IndexedDB e PWA offline;
- sincronizzazione cloud esplicita, versionata e ripristinabile.

### Avvio

```bash
npm install
npm run dev
```

Aprire l'indirizzo mostrato da Vite, normalmente
`http://127.0.0.1:5173`.

### Verifica

```bash
npm test
npm run build
npm run qa
```

I collaudi browser richiedono una preview locale:

```bash
npm run preview -- --host 127.0.0.1
node scripts/qa-workspace.mjs
npm run qa:video
```

Le immagini del collaudo vengono salvate in `artifacts/` e non vengono
versionate.
