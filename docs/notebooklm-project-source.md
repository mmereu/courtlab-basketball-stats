# CourtLab — dossier del progetto

## Scopo del documento

Questa è la fonte principale del notebook di progetto CourtLab. Descrive il
prodotto, i destinatari, i flussi, le statistiche, la sicurezza, il collaudo e
il funzionamento operativo. Non contiene statistiche reali, credenziali,
password o dati personali di giocatori.

## Identità del prodotto

CourtLab è una PWA italiana, offline-first, per allenatori e staff di
pallacanestro giovanile e dilettantistica. Consente di preparare più squadre e
roster della stessa società, registrare una partita dal vivo, correggere gli
eventi, analizzare i dati ed esportare report PDF ed Excel.

Società di riferimento del progetto: Basket Novara.

Dispositivi supportati:

- tablet, dispositivo primario durante la partita;
- computer desktop, per preparazione, revisione e report;
- telefono, per consultazione e registrazione compatta;
- installazione come PWA, con funzionamento anche senza rete.

## Struttura dell’applicazione

### Area società e squadre

Una società può avere più categorie, per esempio Under 14, Under 15 e Under
17. Ogni categoria ha stagione, colore, logo e roster indipendenti. La
dashboard mostra partite, vittorie, giocatori attivi, prossimo impegno e
archivio stagionale.

### Preparazione della partita

Il coach seleziona squadra, avversario, roster e quintetto iniziale. Può
scegliere se tracciare in dettaglio anche gli eventi avversari. Una partita
rimane in bozza, live o terminata.

### Foglio Coach

È l’interfaccia rapida per l’inserimento live. Il soggetto selezionato può
essere un giocatore oppure la squadra. Le azioni principali sono:

- tiro da due segnato o sbagliato;
- tiro da tre segnato o sbagliato;
- tiro libero segnato o sbagliato;
- rimbalzo offensivo e difensivo;
- assist;
- palla recuperata e persa;
- stoppata fatta e subita;
- fallo commesso e subito;
- punti in contropiede fatti e subiti;
- sostituzioni e correzioni.

Dopo tiri, errori e falli l’app può proporre flussi guidati facoltativi, per
esempio l’autore dell’assist o del rimbalzo.

### Periodi e parziali

Le statistiche sono attribuite al periodo in cui viene registrato l’evento.
Il coach può passare liberamente tra Q1, Q2, Q3, Q4 ed eventuali supplementari
per correggere o aggiungere azioni. La barra live mostra contemporaneamente il
parziale squadra-avversario di tutti i quarti e mette in evidenza quello
selezionato. Il report aggrega primo tempo, secondo tempo, quattro quarti e
totale gara.

### Tracking campo e shot chart

Il tiro può essere registrato selezionando una posizione sul campo. Il punto
viene rappresentato con una maglia che riporta il numero del giocatore. Lo shot
chart può essere filtrato per giocatore, periodo, esito e zona.

### Revisione

Ogni evento mantiene periodo, cronometro, giocatore, tipo ed eventuale
posizione. Il coach può modificare o eliminare un evento per correggere errori
scoperti anche al termine dello scouting. Le statistiche vengono ricalcolate
dagli eventi.

## Statistiche

Il box score completo contiene:

- PT: punti;
- MIN: minuti;
- +/-: differenziale mentre il giocatore è in campo;
- 2P, 2P%;
- 3P, 3P%;
- TL, TL%;
- RT: rimbalzi totali;
- RD: rimbalzi difensivi;
- RO: rimbalzi offensivi;
- PP: palle perse;
- PR: palle recuperate;
- AS: assist;
- STF: stoppate fatte;
- STS: stoppate subite;
- FS: falli subiti;
- FC: falli commessi;
- CPF: punti in contropiede fatti;
- CPS: punti in contropiede subiti;
- VAL: valutazione.

La valutazione usa:

`VAL = PT + RT + AS + PR + STF + FS - tiri sbagliati - liberi sbagliati - PP - FC - STS`

L’indicatore EFF non viene mostrato. I calcoli di minuti e plus/minus possono
restare disponibili internamente, ma la sezione dedicata ai quintetti non è
attualmente mostrata nel report.

## Report ed esportazioni

Il report live include:

- punteggio e box score completo;
- andamento del punteggio;
- shot chart filtrabile;
- analisi video locale;
- indicatori di transizione;
- statistiche e parziali per quarto.

PDF ed Excel includono logo, statistiche individuali e di squadra, aggregati
per periodo e VAL. Nel foglio Excel le intestazioni statistiche usano lo
sfondo giallo.

## Analisi video locale

Il filmato viene scelto dal computer o dal telefono e resta sul dispositivo:
non viene caricato sul server CourtLab. È possibile:

- impostare l’inizio di ogni periodo;
- collegare un evento al secondo esatto del filmato;
- usare spostamenti di meno o più uno e cinque secondi;
- cambiare velocità;
- filtrare per giocatore, periodo e azione;
- scrivere note;
- riprodurre una playlist virtuale delle azioni sincronizzate.

Metadati, collegamenti e note possono essere salvati; dopo una ricarica il
browser richiede di selezionare nuovamente lo stesso file video.

## Conservazione locale e sincronizzazione protetta

Squadre, roster e partite vengono conservati localmente in IndexedDB.
L’accesso cloud non carica e non scarica automaticamente alcun archivio.

Operazioni disponibili:

- **Crea nuova versione cloud**: carica esplicitamente lo stato locale dopo
  conferma;
- **Scarica la copia cloud**: sostituisce esplicitamente lo stato locale dopo
  conferma;
- **Cronologia e ripristino**: mostra revisioni immutabili e permette di
  recuperarne una.

Il server usa versionamento ottimistico: se un altro dispositivo ha creato una
versione più recente, un upload basato su una versione vecchia viene bloccato.
La procedura operativa è caricare dal dispositivo che ha effettuato la modifica
e poi scaricare sugli altri dispositivi. Le modifiche parallele non vengono
ancora unite automaticamente.

Il VPS esegue backup SQLite giornalieri. I servizi applicativi sono gestiti da
systemd e ripartono automaticamente dopo un riavvio.

## Sicurezza e privacy

- traffico pubblico tramite HTTPS;
- token cloud e sessioni protette;
- password memorizzate come hash, non in chiaro;
- risposte API private escluse dalla cache PWA;
- video mai inviati al server;
- backup prima delle operazioni infrastrutturali importanti;
- dati di minori limitati allo stretto necessario;
- consigliato usare numero e iniziali nei materiali condivisi esternamente.

## Architettura tecnica

- frontend React e TypeScript;
- build Vite;
- PWA con service worker e funzionamento offline;
- IndexedDB per archivio locale;
- API cloud Python con SQLite;
- Caddy come reverse proxy HTTPS;
- VPS con servizi systemd;
- dominio pubblico `basketcoach.duckdns.org`;
- PDF tramite jsPDF;
- Excel tramite ExcelJS;
- test unitari Vitest;
- collaudi browser Playwright su desktop e mobile.

## Regole di qualità

Prima di pubblicare una modifica:

1. eseguire test unitari;
2. compilare la build di produzione;
3. collaudare workspace e flussi live;
4. verificare layout desktop e mobile;
5. creare un backup quando cambia il database;
6. pubblicare frontend o API;
7. controllare salute API e servizi;
8. ripetere il collaudo sul dominio pubblico.

## Materiali che NotebookLM può generare

Da questa fonte NotebookLM può produrre:

- manuale d’istruzioni completo;
- guida rapida per la partita;
- manuale per gestione società e roster;
- guida alle abbreviazioni statistiche;
- guida alla correzione degli eventi;
- manuale dell’analisi video;
- procedura di sincronizzazione sicura;
- FAQ e risoluzione problemi;
- manuale tecnico e di deploy;
- checklist pre-partita e post-partita;
- note di rilascio e materiale formativo.

## Limiti e sviluppi futuri

- unione automatica delle modifiche parallele tra dispositivi;
- gestione più evoluta di permessi e organizzazioni;
- esportazione strutturata verso strumenti di analisi;
- automazione documentale tramite NotebookLM;
- ulteriori strumenti per analisi video e scouting;
- accessibilità e rifinitura continua del layout mobile.
