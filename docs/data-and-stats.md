# Modello dati e motore statistico

## 1. Strategia

La fonte autorevole è il registro degli eventi. Box score, statistiche di
stagione e dashboard sono proiezioni ricalcolabili.

Un evento registrato non viene sovrascritto o cancellato fisicamente:

- una modifica crea una revisione;
- un annullamento lo rende inattivo;
- l'audit conserva autore, dispositivo e timestamp;
- le proiezioni considerano soltanto la revisione valida.

Questa scelta è fondamentale per sincronizzazione offline, correzioni e
spiegabilità dei dati.

## 2. Entità

### Identity e organizzazione

```text
users
  id, email, display_name, locale, created_at

organizations
  id, name, slug, country_code, timezone, owner_user_id

memberships
  id, organization_id, user_id, role, status, invited_at, accepted_at
```

Ruoli iniziali: `owner`, `coach`, `assistant`, `scorekeeper`, `viewer`.

### Squadre

```text
teams
  id, organization_id, name, short_name, primary_color, secondary_color,
  logo_path, visibility

seasons
  id, organization_id, name, starts_on, ends_on, status

players
  id, organization_id, public_display_name, legal_name_encrypted?,
  preferred_name, photo_path, dominant_hand, active

team_players
  id, team_id, season_id, player_id, jersey_number, position, active
```

`legal_name_encrypted` non è necessario per l'MVP se il nome visualizzato è
sufficiente.

### Partite

```text
games
  id, organization_id, team_id, season_id, opponent_name, venue_type,
  scheduled_at, timezone, competition_name, status, tracking_mode,
  tracks_opponent, period_count, period_duration_seconds,
  overtime_duration_seconds, current_period, current_clock_ms,
  revision, created_by, closed_at

game_roster_entries
  id, game_id, side, player_id?, display_name, jersey_number, starter

game_assignments
  id, game_id, user_id, role
```

`side`: `home` o `away`. Gli avversari possono essere nomi locali alla partita
senza creare un profilo persistente.

### Registro eventi

```text
game_events
  id UUID
  game_id UUID
  device_id UUID
  client_sequence BIGINT
  authoritative_sequence BIGINT?
  period SMALLINT
  clock_ms INTEGER?
  side home|away|neutral
  primary_player_id UUID?
  secondary_player_id UUID?
  event_type
  event_subtype?
  points SMALLINT
  x NUMERIC?
  y NUMERIC?
  lineup_home UUID[]
  lineup_away UUID[]
  possession_id UUID?
  metadata JSONB
  recorded_by UUID
  client_created_at TIMESTAMPTZ
  server_received_at TIMESTAMPTZ?
  status active|voided|conflicted
```

Tipi iniziali:

```text
period_started, period_ended
free_throw_made, free_throw_missed
two_point_made, two_point_missed
three_point_made, three_point_missed
offensive_rebound, defensive_rebound, team_rebound
assist, steal, turnover, block
personal_foul, technical_foul, unsportsmanlike_foul
substitution_in, substitution_out
timeout
score_adjustment
note
```

### Revisioni

```text
event_revisions
  id, event_id, revision_number, patch JSONB, reason,
  revised_by, device_id, client_created_at, server_received_at

game_audit_log
  id, game_id, actor_user_id, action, entity_type, entity_id,
  before JSONB, after JSONB, created_at
```

### Condivisione

```text
share_links
  id, game_id?, team_id?, token_hash, scope, expires_at,
  pin_hash?, revoked_at, created_by
```

Il token in chiaro viene mostrato una volta; nel database resta soltanto l'hash.

## 3. Coordinate del campo

Memorizzare coordinate normalizzate:

- `x`: da 0 a 100, sinistra/destra;
- `y`: da 0 a 100, fondo campo/metà campo;
- orientamento sempre verso lo stesso canestro logico;
- la UI trasforma il lato in base al periodo.

Questo rende i dati indipendenti dalla risoluzione SVG e facilita migrazioni.

La classificazione 2PT/3PT deve essere scelta esplicitamente dall'utente
nell'MVP; la posizione può segnalare una possibile incoerenza, ma non deve
cambiare silenziosamente il valore del tiro.

## 4. Quintetti e minuti

All'avvio del periodo esiste un lineup valido. Una sostituzione atomica contiene
giocatore uscente ed entrante anche se in archivio genera due effetti logici.

Regole:

- cinque giocatori per lato quando il roster avversario è tracciato;
- nessun giocatore duplicato;
- un giocatore in panchina non può produrre un evento individuale senza warning;
- i minuti derivano dagli intervalli fra sostituzioni;
- il coach può inserire manualmente i minuti se i cambi non sono stati tracciati;
- minuti manuali e derivati sono distinti.

Il plus/minus viene attribuito ai giocatori in campo per ogni variazione di
punteggio. Una correzione del punteggio richiede l'associazione al periodo e, se
possibile, al lineup.

## 5. Possessi

Il motore può stimare i possessi dal box score:

```text
Poss ≈ FGA + 0,44 × FTA - OREB + TOV
```

Il coefficiente 0,44 deve essere configurabile e documentato. La formula produce
una stima, non un conteggio ufficiale play-by-play.

In modalità Pro il motore costruisce possessi dagli eventi:

- canestro segnato, salvo tiro libero aggiuntivo;
- rimbalzo difensivo;
- palla persa;
- ultimo tiro libero di una sequenza segnato;
- fine periodo;
- palla a due/cambi di possesso manuali in una versione successiva.

Ogni possesso deve mantenere un livello di confidenza e può essere corretto
durante la revisione.

## 6. Formule

Sia `FG` l'insieme dei tiri da 2 e 3.

```text
FG%   = FGM / FGA
2P%   = 2PM / 2PA
3P%   = 3PM / 3PA
FT%   = FTM / FTA
eFG%  = (FGM + 0,5 × 3PM) / FGA
TS%   = PTS / (2 × (FGA + 0,44 × FTA))
AST/TO = AST / TOV
```

Divisioni con denominatore zero restituiscono `N/D`, non zero.

### Four Factors

```text
Shooting       = eFG%
Turnovers      = TOV / Poss
Offensive reb. = OREB / (OREB + Opp DREB)
Free throws    = FTM / FGA
```

La variante `FTA/FGA` può essere offerta come impostazione, ma il report deve
mostrare quale formula è in uso.

### Rating e pace

```text
ORtg = 100 × PTS / Poss
DRtg = 100 × Opp PTS / Opp Poss
NetRtg = ORtg - DRtg
Pace = possessi normalizzati alla durata regolamentare
```

Per una partita FIBA da 40 minuti:

```text
Pace40 = Poss × 40 / minuti_effettivi
```

### Rimbalzi

```text
ORB% = OREB / (OREB + Opp DREB)
DRB% = DREB / (DREB + Opp OREB)
TRB% = REB / (REB + Opp REB)
```

### Usage stimato

Una formula di Usage precisa richiede minuti e totali di squadra affidabili.
Non va mostrata se:

- non sono tracciati i minuti;
- non sono disponibili entrambe le squadre;
- i dati sono incompleti.

## 7. Coerenza statistica

Controlli bloccanti:

- punti evento uguali al punteggio calcolato, salvo aggiustamenti espliciti;
- FGM non superiore a FGA;
- FTM non superiore a FTA;
- nessun evento riferito a una partita diversa;
- sequenza unica per dispositivo;
- una revisione non può precedere la creazione dell'evento.

Controlli non bloccanti:

- canestro assistito senza evento assist;
- tiro sbagliato senza successivo rimbalzo o cambio possesso;
- stoppata senza tiro sbagliato;
- recupero senza palla persa avversaria;
- sostituzione incompleta;
- giocatore non in campo;
- somma minuti diversa da 200 minuti più overtime;
- zona selezionata incompatibile con 2PT/3PT;
- punteggio manualmente corretto.

Il coach può chiudere una partita con warning, ma il report deve indicare che i
dati sono parziali.

## 8. Proiezioni

Proiezioni minime:

- `game_score_projection`;
- `player_game_boxscore`;
- `team_game_boxscore`;
- `period_boxscore`;
- `lineup_stints`;
- `shot_locations`;
- `season_player_totals`;
- `season_team_totals`.

Aggiornamento:

- proiezione locale immediata durante il live;
- conferma server dopo sincronizzazione;
- ricalcolo completo dopo una revisione;
- job di verifica notturno per individuare differenze.

## 9. API iniziale

```text
POST   /organizations
POST   /teams
POST   /teams/:id/seasons
POST   /teams/:id/players
POST   /games
POST   /games/:id/roster
POST   /games/:id/events/batch
POST   /games/:id/events/:eventId/revisions
POST   /games/:id/close
POST   /games/:id/reopen
GET    /games/:id
GET    /games/:id/play-by-play
GET    /games/:id/box-score
GET    /games/:id/shot-chart
GET    /teams/:id/season-summary
POST   /games/:id/share-links
DELETE /share-links/:id
```

`events/batch` è idempotente usando `event.id`. Può accettare eventi già
ricevuti senza duplicarli.

## 10. Sicurezza

- multi-tenancy sempre filtrata per `organization_id`;
- policy server-side, non solo UI;
- rate limit per login, link pubblici e sincronizzazione;
- rotazione sessioni;
- audit delle modifiche di ruolo;
- URL firmati per foto e report privati;
- cifratura dei backup;
- test automatici per impedire accessi tra organizzazioni;
- dati personali esclusi da log applicativi e strumenti di analytics.

## 11. Stack proposto

```text
Frontend: Next.js, TypeScript, React, PWA, IndexedDB/Dexie
UI: componenti accessibili, CSS/Tailwind, SVG per il campo
State/query: TanStack Query + store locale limitato
Backend MVP: Supabase Auth + PostgreSQL + Realtime + Storage
API business: route server Next.js o servizio TypeScript dedicato
Validazione: Zod
Test: Vitest, Testing Library, Playwright
Error monitoring: provider configurato con redazione PII
PDF: generazione server-side da template HTML
```

Il calcolo statistico deve vivere in un package TypeScript puro condiviso fra
client e server. Lo stesso elenco di eventi deve produrre gli stessi risultati
in entrambi gli ambienti.
