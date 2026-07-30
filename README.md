# CourtLab — Basketball Stats Coach

[Italiano](README.md) · [English](README.en.md)

CourtLab è una web app PWA, pensata prima di tutto per tablet e utilizzabile
anche offline, con cui coach e staff possono rilevare, correggere e analizzare
le statistiche di una partita di pallacanestro 5 contro 5.

**Demo pubblica:** [basketcoach.duckdns.org](https://basketcoach.duckdns.org)

> La demo contiene dati di prova. Prima di usare CourtLab in una partita
> ufficiale è consigliato simulare una gara completa sul dispositivo che verrà
> utilizzato a bordo campo.

## A chi serve

CourtLab nasce per società italiane giovanili e dilettantistiche che vogliono
sostituire carta e penna senza complicare il lavoro dello scout. Una singola
società può gestire più squadre e categorie, per esempio Under 14, Under 15 e
Under 17, ciascuna con roster, stagioni e partite proprie.

## Come funziona

Il flusso normale è composto da cinque passaggi:

1. **Società e squadre** — crea la società, aggiungi una o più categorie e
   seleziona la stagione.
2. **Roster** — inserisci giocatori, numero di maglia e informazioni necessarie
   alla distinta.
3. **Partita** — indica avversario, data e giocatori convocati, quindi scegli il
   quintetto iniziale.
4. **Rilevazione live** — seleziona un giocatore e registra tiri, rimbalzi,
   palle perse o recuperate, assist, stoppate, falli e contropiedi. I tiri
   possono essere posizionati direttamente sul campo.
5. **Controllo ed esportazione** — torna su qualsiasi periodo, correggi gli
   eventi e genera il box score o i report PDF ed Excel.

Le statistiche non sono numeri isolati: vengono ricalcolate dagli eventi
registrati. Una correzione aggiorna quindi i totali del giocatore, della squadra
e del periodo interessato.

## Statistiche rilevate

| Sigla | Significato |
|---|---|
| PT | Punti |
| 2R / 2T / 2% | Tiri da 2 realizzati, tentati e percentuale |
| 3R / 3T / 3% | Tiri da 3 realizzati, tentati e percentuale |
| TLR / TLT / TL% | Tiri liberi realizzati, tentati e percentuale |
| RT / RD / RO | Rimbalzi totali, difensivi e offensivi |
| PP / PR | Palle perse e recuperate |
| AS | Assist |
| STF / STS | Stoppate fatte e subite |
| FS / FC | Falli subiti e commessi |
| CPF / CPS | Punti in contropiede fatti e subiti |
| VAL | Valutazione complessiva |

La valutazione è calcolata con la formula:

```text
VAL = PT + RT + AS + PR + STF + FS
      - (tiri dal campo sbagliati) - (liberi sbagliati)
      - PP - STS - FC
```

Il box score mostra tutte le colonne sia per i singoli giocatori sia per il
totale squadra. Il PDF e il file Excel includono il logo della società; il file
Excel usa intestazioni evidenziate per facilitare la lettura e il lavoro
successivo.

## Periodi, parziali e correzioni

Ogni evento appartiene al quarto o al supplementare in cui è stato registrato.
Durante la partita si può avanzare o tornare a un periodo precedente senza
perdere gli eventi. La barra dei parziali mostra contemporaneamente il
risultato di ogni singolo quarto.

Nei report le statistiche sono disponibili come:

- primo tempo, aggregando Q1 e Q2;
- secondo tempo, aggregando Q3 e Q4;
- partita completa, aggregando tutti i quarti e gli eventuali supplementari.

La cronologia delle giocate permette di correggere un errore anche a scouting
terminato; i risultati vengono ricalcolati automaticamente.

## Campo e shot chart

Quando si registra un tiro, il punto scelto sul campo viene associato al
giocatore, al periodo, al valore del tiro e al suo esito. Sulla mappa il
giocatore è riconoscibile anche dal numero di maglia.

Lo shot chart può essere filtrato per giocatore, periodo, zona ed esito, così da
individuare rapidamente aree efficaci e aree da migliorare.

## Minuti, quintetti e andamento della gara

Le sostituzioni determinano chi è in campo e consentono di ricostruire minuti,
quintetti e plus/minus. Il Game Flow collega il punteggio ai momenti della
partita e ai giocatori presenti, rendendo visibili parziali e cambi di inerzia.

Questi dati dipendono dalla precisione con cui vengono registrati quintetto
iniziale, sostituzioni e punteggio avversario.

## Analisi video locale

È possibile selezionare un video presente sul computer e collegare le giocate
alla posizione temporale corrispondente. Si possono creare riferimenti,
annotazioni e sequenze per rivedere rapidamente tiri, errori o situazioni
tattiche.

Il file video **rimane sul dispositivo** e non viene caricato sul server. Per
motivi di sicurezza del browser, dopo una chiusura o un aggiornamento della
pagina può essere necessario selezionare nuovamente il file originale.

## Salvataggio e sincronizzazione

CourtLab è offline-first: i dati di lavoro vengono salvati localmente nel
browser tramite IndexedDB. La connessione non è quindi necessaria durante la
partita.

La sincronizzazione cloud è intenzionalmente esplicita:

1. sul dispositivo che contiene le modifiche più recenti usa **Crea nuova
   versione cloud**;
2. sugli altri dispositivi usa **Scarica copia cloud**;
3. se la versione cloud è cambiata nel frattempo, CourtLab blocca la
   sovrascrittura e segnala il conflitto;
4. le revisioni precedenti possono essere consultate e ripristinate.

Non è necessario scaricare la copia cloud dopo ogni modifica sullo stesso
dispositivo. Serve invece prima di continuare il lavoro da un altro telefono,
tablet o computer. Finché non sarà disponibile una fusione automatica, evitare
di modificare contemporaneamente la stessa partita da due dispositivi.

La sincronizzazione non sostituisce una corretta politica di backup. Il server
di produzione conserva backup periodici del database, ma per gare importanti è
prudente verificare anche l'esportazione finale.

## Installazione locale

Requisiti:

- Node.js 20 o successivo;
- npm;
- Python 3 per il servizio di sincronizzazione.

Avvio dell'interfaccia:

```bash
npm install
npm run dev
```

Aprire l'indirizzo mostrato da Vite, normalmente
`http://127.0.0.1:5173`.

I dettagli del servizio cloud e della configurazione di produzione sono nella
[documentazione del server](server/README.md).

## Verifica

```bash
npm test -- --run
npm run build
npm run qa
```

I collaudi browser richiedono una preview locale:

```bash
npm run preview -- --host 127.0.0.1
node scripts/qa-workspace.mjs
npm run qa:video
```

Screenshot e risultati dei collaudi vengono salvati in `artifacts/` e non sono
versionati.

## Struttura e documentazione

- [`src`](src) — interfaccia React, motore statistico e archivio locale;
- [`server`](server) — API Python, SQLite, revisioni e sincronizzazione;
- [`scripts`](scripts) — strumenti di collaudo e manutenzione;
- [Specifica di prodotto](docs/product-spec.md);
- [Modello dati e motore statistico](docs/data-and-stats.md);
- [Backlog MVP](docs/mvp-backlog.md);
- [Dossier del progetto per NotebookLM](docs/notebooklm-project-source.md).

## Tecnologia

L'interfaccia usa React, TypeScript e Vite ed è distribuita come PWA. I dati
locali risiedono in IndexedDB; la sincronizzazione usa un servizio Python con
SQLite. In produzione l'app può essere gestita come servizio di sistema e
pubblicata dietro un reverse proxy HTTPS.

## Privacy e sicurezza

- Non inserire password, chiavi SSH o altri segreti nel repository.
- I video selezionati per l'analisi non vengono caricati nel cloud.
- Prima di pubblicare dati di atleti minorenni verificare consensi, ruoli di
  accesso e normativa applicabile.
- Il repository pubblico contiene codice e documentazione, non il database di
  produzione né i profili reali.

## Stato del progetto

CourtLab è in sviluppo attivo. È già utilizzabile per simulazioni e collaudi,
ma ogni rilascio destinato a una partita ufficiale deve essere provato
preventivamente sul dispositivo reale, prestando particolare attenzione a
offline, ripristino, esportazioni e sincronizzazione tra dispositivi.
