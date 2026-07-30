# Specifica di prodotto

Versione: 0.1  
Stato: pronta per prototipo UX  
Mercato iniziale: Italia  
Formato: basket 5×5 FIBA

## 1. Visione

Basketball Stats Coach trasforma il lavoro dello scorekeeper in una sequenza di
azioni semplici, affidabili e correggibili. Il prodotto non prova a sostituire
il referto ufficiale nella prima versione: produce statistiche tecniche per lo
staff e un'esperienza live facoltativa per gli invitati.

### Promessa

> Registra la partita senza smettere di guardarla.

### Principi

1. La velocità di inserimento viene prima della quantità di informazioni.
2. Nessuna azione deve andare persa per mancanza di connessione.
3. Ogni errore deve poter essere corretto.
4. Tutti i totali devono essere spiegabili partendo dagli eventi.
5. I dati di minori sono privati per impostazione predefinita.
6. Le statistiche avanzate devono essere accompagnate da una spiegazione.

## 2. Persone e ruoli

### Coach proprietario

- crea la società e le squadre;
- gestisce roster, stagioni e staff;
- vede tutte le statistiche;
- approva e chiude le partite;
- crea o revoca link di condivisione.

### Assistente

- prepara e registra le partite;
- corregge gli eventi;
- consulta ed esporta i report;
- non elimina la società o trasferisce la proprietà.

### Scorekeeper

- accede soltanto alle partite assegnate;
- registra e corregge eventi durante la partita;
- non vede dati amministrativi o altre squadre non assegnate.

### Giocatore

- non è un account obbligatorio nell'MVP;
- può apparire nel roster;
- può ricevere in futuro un invito per consultare il proprio profilo.

### Viewer

- apre un link revocabile in sola lettura;
- vede solo i dati scelti dal coach;
- non necessita di account nell'MVP.

## 3. Jobs to be done

1. Quando inizia la stagione, voglio inserire il roster una sola volta.
2. Prima della partita, voglio scegliere convocati e quintetto rapidamente.
3. Durante la partita, voglio registrare un'azione in uno o due tocchi.
4. Se sbaglio giocatore o tipo di azione, voglio correggere senza alterare il
   resto del tabellino.
5. Durante un timeout, voglio vedere pochi indicatori utili al coach.
6. A fine partita, voglio un box score pronto senza lavorare su Excel.
7. Dopo più partite, voglio confrontare rendimento e tendenze.
8. Se la palestra non ha rete, voglio continuare normalmente.

## 4. Ambito MVP

### Organizzazione

- registrazione e login;
- creazione di una società;
- creazione di una o più squadre;
- invito di assistenti e scorekeeper;
- ruoli e permessi.

### Squadra e stagione

- nome, logo e colori;
- stagione;
- roster;
- numero di maglia;
- nome visualizzato;
- ruolo cestistico facoltativo;
- mano dominante facoltativa;
- stato attivo/inattivo;
- importazione roster da CSV.

Per privacy, data di nascita completa, indirizzo, telefono, informazioni mediche
e documenti non appartengono all'MVP.

### Preparazione partita

- avversario;
- casa/trasferta/campo neutro;
- data e ora;
- competizione testuale;
- durata dei periodi;
- numero di periodi;
- overtime;
- convocati;
- quintetto iniziale;
- modalità Basic o Pro;
- scelta di tracciare solo la propria squadra o entrambe.

### Registrazione live

Eventi minimi:

- tiro libero segnato/sbagliato;
- tiro da 2 segnato/sbagliato;
- tiro da 3 segnato/sbagliato;
- posizione del tiro in modalità Pro;
- rimbalzo offensivo/difensivo;
- assist;
- recupero;
- palla persa;
- stoppata;
- fallo personale;
- fallo tecnico/antisportivo come classificazione facoltativa;
- sostituzione;
- timeout;
- inizio/fine periodo;
- correzione del punteggio;
- nota libera con timestamp.

### Output

- punteggio e parziali;
- play-by-play;
- box score;
- statistiche per periodo;
- shot chart;
- minuti e plus/minus;
- riepilogo quintetti;
- dashboard stagione;
- PDF;
- CSV;
- link live/finale in sola lettura.

## 5. Modalità di acquisizione

### Basic

Pensata per un solo volontario.

- punteggio;
- tiri segnati e sbagliati;
- rimbalzi;
- palle perse e recuperate;
- falli;
- sostituzioni;
- timeout.

Coordinate del tiro, assist, stoppate e dettaglio del possesso possono essere
aggiunti dopo la partita.

### Pro

Pensata per un assistente allenato.

- tutte le azioni Basic;
- coordinate di tiro;
- assist;
- stoppate;
- rimbalzo offensivo/difensivo;
- tipologia di palla persa;
- transizione/seconda opportunità facoltative;
- quintetti e possessi completi.

Il passaggio Basic/Pro non deve modificare il modello dati: cambia soltanto la
quantità di dettagli richiesta dall'interfaccia.

## 6. Flusso principale

### Prima della partita

1. Dashboard.
2. `Nuova partita`.
3. Selezione squadra e avversario.
4. Regole e dettagli.
5. Selezione convocati.
6. Scelta modalità Basic/Pro.
7. Selezione quintetto.
8. Download locale dei dati necessari.
9. `Inizia partita`.

### Durante la partita

1. Selezione squadra.
2. Selezione giocatore.
3. Selezione azione.
4. Eventuale selezione posizione/esito.
5. Conferma automatica o breve finestra contestuale.
6. Aggiornamento immediato di punteggio, play-by-play e statistiche.

Per i tiri in modalità Pro il flusso preferito è:

1. tocco sulla posizione del campo;
2. selezione del tiratore;
3. `Segnato` o `Sbagliato`;
4. eventuale assist, stoppata o rimbalzo mediante suggerimento contestuale.

### Fine periodo

- avviso se il cronometro raggiunge zero;
- riepilogo rapido;
- verifica del punteggio;
- possibilità di correggere;
- nuovo quintetto;
- avvio periodo successivo.

### Fine partita

1. Conferma punteggio.
2. Controlli di coerenza.
3. Elenco anomalie non bloccanti.
4. Firma interna dello scorekeeper.
5. Revisione del coach.
6. Chiusura.
7. Generazione report.

Una partita chiusa può essere riaperta solo da coach o assistente; la riapertura
resta nell'audit log.

## 7. Schermate

### Dashboard

- prossima partita;
- pulsante `Nuova partita`;
- ultime partite;
- andamento della squadra;
- problemi di sincronizzazione;
- accesso rapido a squadra, stagione e report.

### Live game — tablet landscape

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Q2  06:42    TIGERS  31  —  28  EAGLES    ● Offline/Salvato    ⋯          │
├───────────────┬─────────────────────────────────────┬───────────────────────┤
│ IN CAMPO      │                                     │ AZIONI               │
│ #4  Rossi     │            CAMPO                    │ [TL] [2PT] [3PT]     │
│ #7  Bianchi   │        tocca una zona               │ [REB] [AST] [STL]    │
│ #9  Serra     │                                     │ [TOV] [BLK] [FALLO]  │
│ #12 Piras     │                                     │ [CAMBIO] [TIMEOUT]   │
│ #15 Mereu     │                                     │                       │
│               │                                     │                       │
│ PANCHINA      │                                     │                       │
│ 5  8  10  14  │                                     │                       │
├───────────────┴─────────────────────────────────────┴───────────────────────┤
│ ↶ ANNULLA     Ultima: #7 tiro da 3 sbagliato, 06:47      PLAY-BY-PLAY ›    │
└─────────────────────────────────────────────────────────────────────────────┘
```

Vincoli:

- target tattili di almeno 48×48 px, preferibilmente maggiori;
- punteggio e periodo sempre visibili;
- undo sempre raggiungibile;
- nessun menu modale lungo durante l'azione;
- colore non usato come unico indicatore;
- feedback aptico sui dispositivi compatibili;
- conferma sonora disattivabile;
- cronometro utilizzabile ma non obbligatorio.

### Timeout view

Mostra soltanto:

- parziale del periodo;
- palle perse;
- rimbalzi offensivi concessi;
- percentuali 2PT/3PT/FT;
- falli di squadra;
- miglior/peggior plus-minus dei quintetti solo con campione sufficiente.

### Play-by-play

- ordinamento cronologico inverso durante il live;
- filtro per periodo, giocatore e tipo;
- modifica;
- annullamento logico;
- indicazione delle azioni corrette;
- ricerca delle anomalie.

### Report partita

- risultato;
- parziali;
- box score;
- Four Factors;
- shot chart squadra/giocatore;
- distribuzione dei tiri;
- quintetti;
- andamento del margine;
- note del coach;
- esportazioni.

### Profilo giocatore

- partite e minuti;
- medie e totali;
- percentuali;
- shot chart;
- trend ultime partite;
- confronto con la propria media stagionale;
- nessun ranking pubblico nell'MVP.

## 8. Regole UX

- massimo due tocchi per le azioni frequenti;
- richiesta di conferma solo per operazioni distruttive o ambigue;
- l'ultima azione è annullabile con un solo tocco;
- il sistema propone il giocatore usato più di recente, ma non seleziona azioni
  irreversibili automaticamente;
- se manca un dettaglio, salva comunque l'evento come incompleto;
- gli eventi incompleti sono evidenziati per la revisione;
- nessun errore di rete blocca il live;
- il logout non è disponibile accidentalmente dalla schermata live.

## 9. Requisiti offline e sincronizzazione

Prima dell'inizio:

- roster, partita, impostazioni e permessi vengono copiati localmente;
- viene verificato lo spazio disponibile;
- il sistema mostra `Pronto per l'offline`.

Durante:

- ogni evento viene scritto prima in IndexedDB;
- l'interfaccia si aggiorna dalla copia locale;
- la sincronizzazione è asincrona;
- ogni evento ha UUID, device ID e numero di sequenza;
- lo stato mostra salvato locale, in sincronizzazione, sincronizzato o conflitto.

In caso di due dispositivi:

- non si fondono silenziosamente due versioni incompatibili;
- gli eventi indipendenti possono convivere;
- modifiche allo stesso evento richiedono revisione;
- il punteggio visualizzato deriva dall'ordine autorevole degli eventi.

## 10. Privacy e visibilità

Stati di una squadra:

- privata;
- condivisa con membri;
- accessibile tramite link;
- pubblica, non disponibile nell'MVP.

Opzioni del link:

- punteggio soltanto;
- punteggio e play-by-play;
- box score completo;
- scadenza;
- PIN facoltativo;
- revoca immediata.

Per impostazione predefinita:

- nessun motore di ricerca indicizza il contenuto;
- le foto non compaiono nel link pubblico;
- per i minori si usa nome abbreviato configurabile;
- analytics e pubblicità comportamentale sono disattivati.

## 11. Requisiti non funzionali

- prima interazione utile sotto 2,5 secondi su rete 4G normale;
- risposta visiva a un evento sotto 100 ms usando lo stato locale;
- zero perdita di eventi dopo chiusura improvvisa dell'app;
- supporto ultime due versioni di Chrome, Safari, Edge e Firefox;
- layout primario da 1024×768 in su;
- modalità telefono utilizzabile, anche se meno efficiente;
- WCAG 2.2 AA per contrasto, tastiera e semantica;
- cifratura HTTPS;
- backup e ripristino verificati;
- error monitoring privo di nomi dei giocatori nei payload predefiniti.

## 12. Fuori ambito

- referto federale ufficiale;
- firma digitale con valore regolamentare;
- gestione arbitri;
- calendario completo di una lega;
- pagamenti e abbonamenti;
- chat;
- streaming video;
- riconoscimento automatico dal video;
- dati NBA, EuroLeague o betting;
- scouting marketplace;
- statistiche mediche e carichi di lavoro.

## 13. Metriche di successo

### Attivazione

- utente crea squadra e roster;
- completa una partita di prova entro il primo giorno.

### Utilizzo

- almeno il 60% delle squadre attivate registra una seconda partita;
- meno dell'1% degli eventi resta in conflitto;
- meno di 10 secondi medi per correggere un evento;
- almeno il 90% delle partite iniziate viene chiuso correttamente.

### Test UX

- almeno 90% delle azioni principali registrato in una partita simulata;
- meno di cinque richieste di aiuto nei primi dieci minuti;
- nessun evento perso spegnendo rete o bloccando il dispositivo;
- punteggio finale coerente con gli eventi nel 100% dei test automatici.

## 14. Domande da validare con i coach

1. Un solo scorekeeper registra entrambe le squadre o solo la propria?
2. Quanto è importante il cronometro esatto per ogni azione?
3. Quali cinque indicatori vogliono vedere durante il timeout?
4. Chi inserisce i minuti quando le sostituzioni non sono state registrate?
5. Preferiscono campo → giocatore → esito oppure giocatore → azione → campo?
6. Il report deve essere condiviso con giocatori, genitori o solo staff?
7. Quale formato CSV/PDF usano oggi?
8. Quante partite vengono riviste su video?

Queste domande affinano l'interfaccia, ma non bloccano il prototipo iniziale.
