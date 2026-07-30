# QA inventory — Release A

## User-visible claims

- setup partita con modifica nomi e selezione modalità;
- quintetto iniziale limitato a cinque giocatori;
- live tracker tablet-first con campo, roster e azioni visibili;
- tiro Pro con posizione, esito e aggiornamento del punteggio;
- eventi semplici, tiro libero, cambio, play-by-play e undo;
- controllo manuale del punteggio avversario;
- cronometro e passaggio periodo;
- box score derivato dagli eventi;
- persistenza locale dopo reload;
- adattamento al viewport tablet minimo 1024×768.

## Functional checks

1. Aprire setup e verificare quintetto 5/5.
2. Cambiare Basic/Pro e tornare a Pro.
3. Avviare la partita.
4. Selezionare un giocatore, registrare 2PT segnato e verificare 2 punti.
5. Registrare assist e tiro libero segnato.
6. Incrementare punteggio avversario.
7. Annullare l'ultimo evento e verificare il ricalcolo.
8. Aprire report e verificare box score.
9. Ricaricare e verificare persistenza dello stato.
10. Tornare al live e provare una sostituzione.

## Visual checks

- setup a 1366×900;
- live vuoto a 1366×900;
- live post-interazione e shot chart;
- report denso;
- live a 1024×768;
- mobile 390×844 come controllo secondario.

## Exploratory checks

- tentare di iniziare con meno di cinque titolari;
- avviare un tiro senza giocatore selezionato;
- annullare quando non esistono eventi;
- verificare reload mentre la partita è in corso.

## Expected evidence

- screenshot in `artifacts/`;
- assert funzionali nello script Playwright;
- bounding box delle regioni essenziali entro il viewport tablet;
- assenza di overflow orizzontale nel setup e nel live tablet.
