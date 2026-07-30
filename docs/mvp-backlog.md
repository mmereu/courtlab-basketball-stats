# Backlog MVP

Priorità:

- P0: necessaria per una partita completa;
- P1: necessaria per un MVP distribuibile;
- P2: utile dopo la validazione iniziale.

## Epic 0 — Prototipo e validazione

### P0.1 Prototipo tablet live

Come scorekeeper voglio provare la schermata senza creare un account.

Criteri:

- roster fittizio già disponibile;
- selezione quintetto;
- inserimento tiri, rimbalzi, palle perse, falli e cambi;
- punteggio e play-by-play aggiornati;
- undo;
- funziona a 1024×768 e 1366×768;
- testabile con mouse e touch.

### P0.2 Test su partita simulata

Criteri:

- almeno tre partecipanti;
- stessa sequenza video o script di azioni;
- misurazione di eventi corretti, persi ed errati;
- intervista finale;
- decisione documentata sul flusso tiro.

Gate:

- almeno 90% delle azioni principali catturate dopo il breve onboarding;
- nessun problema critico comune a tutti i tester.

## Epic 1 — Fondazioni

### P0.3 Repository e qualità

- monorepo TypeScript;
- lint, format, typecheck e test;
- CI;
- ambienti locale e staging;
- gestione sicura delle variabili.

### P0.4 Design system minimo

- colori e tipografia;
- componenti touch;
- focus e tastiera;
- stati offline/sync;
- dialoghi e notifiche;
- contrasto WCAG AA.

### P1.1 Telemetria rispettosa della privacy

- errori tecnici;
- metriche UX anonime;
- nessun nome o email nei payload;
- opt-out dove richiesto.

## Epic 2 — Account e organizzazioni

### P1.2 Registrazione e login

- email e password o magic link;
- recupero account;
- sessione persistente;
- lingua e fuso orario.

### P1.3 Organizzazione

- creazione società;
- proprietà;
- modifica nome/logo/colori;
- isolamento fra società testato.

### P1.4 Inviti e ruoli

- coach, assistant e scorekeeper;
- invito con scadenza;
- revoca;
- matrice permessi testata.

## Epic 3 — Squadre e roster

### P0.5 Squadra e stagione locale

- creazione squadra;
- stagione;
- colori;
- roster.

È P0 nel prototipo anche senza backend.

### P1.5 Gestione roster cloud

- crea/modifica/disattiva giocatore;
- numero di maglia;
- controllo duplicati;
- importazione CSV con anteprima;
- nessun dato sensibile obbligatorio.

## Epic 4 — Preparazione partita

### P0.6 Nuova partita

- avversario;
- data;
- casa/trasferta;
- durata;
- modalità Basic/Pro;
- tracciamento una/due squadre.

### P0.7 Convocati e quintetto

- selezione rapida;
- cinque titolari;
- warning su numeri duplicati;
- modifica prima dell'inizio.

### P1.6 Preparazione offline

- download dati;
- verifica IndexedDB;
- indicatore `Pronto per l'offline`;
- recovery dopo refresh.

## Epic 5 — Live game

### P0.8 Punteggio e periodi

- cronometro facoltativo;
- periodo;
- punti 1/2/3;
- inizio/fine periodo;
- overtime;
- parziali.

### P0.9 Eventi giocatore

- tiro;
- rimbalzo;
- assist;
- recupero;
- palla persa;
- stoppata;
- fallo;
- timeout.

### P0.10 Sostituzioni

- uscente/entrante;
- lineup sempre visibile;
- sostituzioni multiple;
- minuti derivati.

### P0.11 Undo e modifica

- undo dell'ultima azione;
- modifica dal play-by-play;
- annullamento logico;
- ricalcolo immediato;
- audit locale.

### P0.12 Shot chart

- campo SVG;
- coordinate normalizzate;
- 2PT/3PT espliciti;
- segnato/sbagliato;
- filtro giocatore.

### P0.13 Persistenza locale

- scrittura evento prima dell'aggiornamento UI;
- recovery dopo chiusura;
- esportazione locale di emergenza;
- nessuna perdita nei test fault injection.

### P1.7 Sincronizzazione

- batch idempotenti;
- retry con backoff;
- stati visibili;
- ricezione aggiornamenti;
- conflitti non distruttivi.

## Epic 6 — Statistiche

### P0.14 Motore box score

- formule pure e deterministiche;
- player/team box score;
- per periodo;
- fixture di test;
- proprietà invarianti.

### P0.15 Minuti e plus/minus

- stint;
- overtime;
- correzioni;
- warning lineup;
- minuti manuali distinti.

### P1.8 Statistiche avanzate

- possessi stimati;
- eFG%, TS%;
- Four Factors;
- ORtg/DRtg/NetRtg;
- formule indicate nel report;
- `N/D` con dati insufficienti.

### P1.9 Quintetti

- minuti;
- punti fatti/subiti;
- plus/minus;
- possessi;
- rating solo con dati sufficienti.

## Epic 7 — Chiusura e report

### P0.16 Controlli di fine partita

- punteggio;
- anomalie;
- warning non bloccanti;
- stato dati completo/parziale;
- chiusura e riapertura autorizzata.

### P1.10 Report web

- risultato e parziali;
- box score;
- shot chart;
- andamento;
- responsive e stampabile.

### P1.11 PDF e CSV

- template italiano;
- logo facoltativo;
- totali coerenti;
- CSV documentato;
- generazione ripetibile.

### P1.12 Dashboard stagione

- totali e medie;
- filtri;
- trend;
- profilo giocatore;
- minimo campione visibile.

## Epic 8 — Condivisione

### P1.13 Link privato

- scope configurabile;
- token non enumerabile;
- scadenza;
- revoca;
- noindex;
- nome abbreviato.

### P2.1 Live viewer

- punteggio realtime;
- parziali;
- play-by-play opzionale;
- resilienza a riconnessione.

## Epic 9 — Sicurezza e conformità

### P1.14 Privacy

- privacy notice;
- impostazioni visibilità;
- export dati;
- cancellazione;
- policy per foto e minori;
- registro fornitori.

### P1.15 Sicurezza

- test isolamento tenant;
- rate limit;
- token hash;
- autorizzazione server-side;
- backup;
- audit ruolo;
- dependency scanning.

## Piano delle release

### Release A — Prototype

Include P0.1, P0.5–P0.12 e P0.14 con dati locali fittizi.

Obiettivo: validare la velocità della schermata live.

### Release B — Private alpha

Include tutti i P0 e account/organizzazione/roster cloud, preparazione offline e
sincronizzazione.

Obiettivo: tre squadre reali, almeno cinque partite complete ciascuna.

### Release C — Pilot

Include tutti i P1 eccetto eventuali elementi emersi come non necessari nei
test.

Obiettivo: 10–20 squadre, misurazione retention e disponibilità a pagare.

## Definition of done

Una storia è completata quando:

- criteri di accettazione verificati;
- test unitari o end-to-end proporzionati al rischio;
- accessibilità controllata;
- caso offline verificato se applicabile;
- autorizzazioni verificate;
- testi in italiano;
- nessun dato personale nei log;
- documentazione aggiornata.

## Rischi principali

| Rischio | Mitigazione |
|---|---|
| Interfaccia troppo lenta | Prototipo e test prima del backend completo |
| Eventi persi offline | Local-first, UUID, batch idempotenti, fault test |
| Statistiche incoerenti | Event sourcing e motore puro condiviso |
| Un solo volontario non registra tutto | Modalità Basic e revisione successiva |
| Dati di minori esposti | Privato di default e link revocabili |
| Scope eccessivo | Gate per release e funzioni fuori ambito esplicite |
| Conflitti multi-device | Nessuna fusione silenziosa e audit revisioni |

## Passo immediatamente successivo

Costruire Release A come prototipo interattivo locale. Prima di implementare
autenticazione e backend, far completare una partita simulata a tre utenti e
usare i risultati per scegliere definitivamente:

- ordine di inserimento del tiro;
- disposizione roster/azioni/campo;
- livello Basic predefinito;
- indicatori mostrati durante il timeout.
