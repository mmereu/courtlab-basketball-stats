import { FormEvent, useMemo, useState } from "react";
import { calculateStats, type GameState, type Player } from "../domain";
import "./workspace-dashboard.css";

export type TeamProfile = {
  id: string;
  name: string;
  season: string;
  color: string;
  logoUrl?: string;
  clubName?: string;
  category?: string;
  roster: Player[];
};

export type ArchivedGame = {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  venue?: string;
  competition?: string;
  teamScore?: number;
  opponentScore?: number;
  status: "draft" | "live" | "final";
  updatedAt?: string;
  state?: GameState;
};

export type WorkspaceDashboardProps = {
  teams: TeamProfile[];
  games: ArchivedGame[];
  selectedTeamId?: string;
  onSelectTeam: (teamId: string) => void;
  onCreateTeam: (team: Omit<TeamProfile, "id" | "roster">) => void;
  onUpdateTeam: (team: TeamProfile) => void;
  onCreateGame: (teamId: string) => void;
  onOpenGame: (gameId: string) => void;
  onDuplicateGame?: (gameId: string) => void;
  onDeleteGame?: (gameId: string) => void;
  onAddPlayer: (teamId: string, player: Omit<Player, "id">) => void;
  onUpdatePlayer: (teamId: string, player: Player) => void;
  onRemovePlayer?: (teamId: string, playerId: string) => void;
  onDeleteTeam?: (teamId: string) => void;
  readOnly?: boolean;
};

const statusLabel = { draft: "Bozza", live: "In corso", final: "Terminata" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function DashboardOverview({
  team, games, onCreateGame, onOpenGame,
}: {
  team: TeamProfile;
  games: ArchivedGame[];
  onCreateGame?: () => void;
  onOpenGame: (id: string) => void;
}) {
  const finals = games.filter((game) => game.status === "final");
  const wins = finals.filter((game) =>
    (game.teamScore ?? 0) > (game.opponentScore ?? 0)).length;
  const nextGame = games
    .filter((game) => game.status !== "final")
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <section className="ws-overview" aria-labelledby="overview-title">
      <div className="ws-heading">
        <div className="ws-team-identity">
          {team.logoUrl && <img className="ws-team-logo" src={team.logoUrl} alt={`Logo ${team.name}`} />}
          <div>
          <p className="ws-kicker">{team.season}</p>
          <h1 id="overview-title">{team.category || team.name}</h1>
          {team.clubName && <strong className="ws-club-name">{team.clubName}</strong>}
          <p>Il centro di controllo della tua stagione.</p>
          </div>
        </div>
        {onCreateGame && <button className="ws-primary" onClick={onCreateGame}>
          <span aria-hidden="true">＋</span> Nuova partita
        </button>}
      </div>

      <div className="ws-metrics">
        <article><span>Partite</span><strong>{finals.length}</strong><small>terminate</small></article>
        <article><span>Vittorie</span><strong>{wins}</strong><small>{finals.length ? `${Math.round(wins / finals.length * 100)}%` : "—"} successi</small></article>
        <article><span>Roster</span><strong>{team.roster.length}</strong><small>giocatori attivi</small></article>
        <article className="ws-next">
          <span>Prossimo impegno</span>
          {nextGame ? (
            <button onClick={() => onOpenGame(nextGame.id)}>
              <strong>vs {nextGame.opponent}</strong>
              <small>{formatDate(nextGame.date)} · Apri →</small>
            </button>
          ) : <strong className="ws-empty-value">Da programmare</strong>}
        </article>
      </div>
    </section>
  );
}

export function TeamRosterManager({
  team, onUpdateTeam, onAddPlayer, onUpdatePlayer, onRemovePlayer,
  readOnly,
}: {
  team: TeamProfile;
  onUpdateTeam: (team: TeamProfile) => void;
  onAddPlayer: (player: Omit<Player, "id">) => void;
  onUpdatePlayer: (player: Player) => void;
  onRemovePlayer?: (playerId: string) => void;
  readOnly?: boolean;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const editing = team.roster.find((player) => player.id === editingId);

  const submitPlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "").trim();
    const number = Number(values.get("number"));
    const role = String(values.get("role") ?? "").trim();
    if (!name || !Number.isInteger(number) || number < 0 || number > 99) return;
    const payload = {
      number, name, role: role || "Giocatore",
      shortName: name.split(/\s+/).at(-1) ?? name,
      color: String(values.get("color") || team.color),
    };
    if (editing) onUpdatePlayer({ ...editing, ...payload });
    else onAddPlayer(payload);
    setEditingId(undefined);
    setShowForm(false);
  };

  return (
    <section className="ws-panel" aria-labelledby="roster-title">
      <div className="ws-section-head">
        <div><p className="ws-kicker">SQUADRA</p><h2 id="roster-title">Roster</h2></div>
        {!readOnly && <button className="ws-secondary" onClick={() => { setEditingId(undefined); setShowForm(true); }}>
          ＋ Giocatore
        </button>}
      </div>
      <div className="ws-team-settings">
        <label>Società
          <input disabled={readOnly} value={team.clubName ?? ""} onChange={(e) => onUpdateTeam({ ...team, clubName: e.target.value })} />
        </label>
        <label>Categoria
          <input disabled={readOnly} value={team.category ?? team.name} onChange={(e) => onUpdateTeam({ ...team, category: e.target.value, name: e.target.value })} placeholder="Under 14" />
        </label>
        <label>Nome squadra
          <input disabled={readOnly} value={team.name} onChange={(e) => onUpdateTeam({ ...team, name: e.target.value })} />
        </label>
        <label>Stagione
          <input disabled={readOnly} value={team.season} onChange={(e) => onUpdateTeam({ ...team, season: e.target.value })} />
        </label>
        <label className="ws-color">Colore
          <input disabled={readOnly} type="color" value={team.color} onChange={(e) => onUpdateTeam({ ...team, color: e.target.value })} />
        </label>
        <label className="ws-logo-upload">Logo squadra
          <span>
            {team.logoUrl && <img src={team.logoUrl} alt="" />}
            <input
              type="file"
              disabled={readOnly}
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => onUpdateTeam({ ...team, logoUrl: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </span>
        </label>
      </div>

      {showForm && (
        <form className="ws-player-form" onSubmit={submitPlayer} aria-label={editing ? "Modifica giocatore" : "Nuovo giocatore"}>
          <label>Numero<input name="number" type="number" min="0" max="99" required defaultValue={editing?.number ?? ""} /></label>
          <label>Nome e cognome<input name="name" required autoFocus defaultValue={editing?.name ?? ""} /></label>
          <label>Ruolo<input name="role" defaultValue={editing?.role ?? ""} placeholder="Play, Ala, Centro…" /></label>
          <input name="color" type="hidden" value={editing?.color ?? team.color} />
          <div>
            <button type="button" className="ws-quiet" onClick={() => { setShowForm(false); setEditingId(undefined); }}>Annulla</button>
            <button className="ws-primary" type="submit">Salva giocatore</button>
          </div>
        </form>
      )}

      <div className="ws-roster" role="list">
        {team.roster.map((player) => (
          <article className="ws-player" role="listitem" key={player.id}>
            <span className="ws-number" style={{ backgroundColor: player.color }}>#{player.number}</span>
            <span><strong>{player.name}</strong><small>{player.role}</small></span>
            {!readOnly && <div className="ws-row-actions">
              <button aria-label={`Modifica ${player.name}`} onClick={() => { setEditingId(player.id); setShowForm(true); }}>Modifica</button>
              {onRemovePlayer && <button className="ws-danger" aria-label={`Rimuovi ${player.name}`} onClick={() => onRemovePlayer(player.id)}>Rimuovi</button>}
            </div>}
          </article>
        ))}
        {!team.roster.length && <p className="ws-empty">Nessun giocatore. Aggiungi il primo elemento del roster.</p>}
      </div>
    </section>
  );
}

export function GameArchive({
  games, onOpen, onDuplicate, onDelete,
}: {
  games: ArchivedGame[];
  onOpen: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ArchivedGame["status"]>("all");
  const visible = useMemo(() => games
    .filter((game) => status === "all" || game.status === status)
    .filter((game) => game.opponent.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [games, query, status]);

  return (
    <section className="ws-panel" aria-labelledby="archive-title">
      <div className="ws-section-head">
        <div><p className="ws-kicker">STAGIONE</p><h2 id="archive-title">Archivio partite</h2></div>
        <span className="ws-count">{visible.length} gare</span>
      </div>
      <div className="ws-filters">
        <label className="ws-search"><span className="ws-sr-only">Cerca avversario</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca avversario…" /></label>
        <label><span className="ws-sr-only">Filtra stato</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Tutte</option><option value="draft">Bozze</option>
            <option value="live">In corso</option><option value="final">Terminate</option>
          </select>
        </label>
      </div>
      <div className="ws-games">
        {visible.map((game) => (
          <article className="ws-game" key={game.id}>
            <time dateTime={game.date}><strong>{formatDate(game.date)}</strong><small>{game.competition || "Partita"}</small></time>
            <div><span className={`ws-status ws-${game.status}`}>{statusLabel[game.status]}</span><h3>vs {game.opponent}</h3><small>{game.venue || "Luogo da definire"}</small></div>
            <strong className="ws-score">{game.status === "final" ? `${game.teamScore}–${game.opponentScore}` : "—"}</strong>
            <div className="ws-row-actions">
              <button className="ws-open" onClick={() => onOpen(game.id)}>{game.status === "draft" ? "Continua" : "Apri"}</button>
              {onDuplicate && <button aria-label={`Duplica partita contro ${game.opponent}`} onClick={() => onDuplicate(game.id)}>Duplica</button>}
              {onDelete && <button className="ws-danger" aria-label={`Elimina partita contro ${game.opponent}`} onClick={() => onDelete(game.id)}>Elimina</button>}
            </div>
          </article>
        ))}
        {!visible.length && <p className="ws-empty">Nessuna partita corrisponde ai filtri.</p>}
      </div>
    </section>
  );
}

type SeasonPlayerLine = {
  player: Player;
  games: number;
  pts: number;
  rebounds: number;
  ast: number;
  stl: number;
  tov: number;
  pir: number;
};

function SeasonStats({ team, games }: { team: TeamProfile; games: ArchivedGame[] }) {
  const [range, setRange] = useState<"all" | "5" | "10">("all");
  const [query, setQuery] = useState("");
  const completed = useMemo(() => games
    .filter((game) => game.status === "final" && game.state)
    .filter((game) => game.opponent.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [games, query]);
  const selectedGames = range === "all" ? completed : completed.slice(0, Number(range));

  const summary = useMemo(() => {
    const players = new Map<string, SeasonPlayerLine>();
    let pointsFor = 0;
    let pointsAgainst = 0;
    let wins = 0;
    selectedGames.forEach((game) => {
      pointsFor += game.teamScore ?? 0;
      pointsAgainst += game.opponentScore ?? 0;
      if ((game.teamScore ?? 0) > (game.opponentScore ?? 0)) wins += 1;
      calculateStats(game.state!).forEach((line) => {
        const current = players.get(line.player.id) ?? {
          player: line.player, games: 0, pts: 0, rebounds: 0, ast: 0, stl: 0, tov: 0, pir: 0,
        };
        const appeared = (line.secondsPlayed ?? 0) > 0
          || line.pts + line.fga + line.fta + line.oreb + line.dreb + line.ast + line.stl + line.tov + line.foul > 0;
        if (appeared) current.games += 1;
        current.pts += line.pts;
        current.rebounds += line.oreb + line.dreb;
        current.ast += line.ast;
        current.stl += line.stl;
        current.tov += line.tov;
        current.pir += line.pir;
        players.set(line.player.id, current);
      });
    });
    return {
      pointsFor, pointsAgainst, wins,
      players: [...players.values()].filter((line) => line.games > 0).sort((a, b) => b.pts - a.pts),
    };
  }, [selectedGames]);

  const average = (value: number, divisor = selectedGames.length) =>
    divisor ? (value / divisor).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—";
  const chronological = [...selectedGames].reverse();
  const maxScore = Math.max(1, ...chronological.flatMap((game) => [game.teamScore ?? 0, game.opponentScore ?? 0]));

  return (
    <section className="ws-panel ws-season" aria-labelledby="season-title">
      <div className="ws-section-head">
        <div>
          <p className="ws-kicker">ANALISI STAGIONALE</p>
          <h2 id="season-title">{team.category || team.name} · {team.season}</h2>
          <p>Totali, medie e andamento delle partite terminate.</p>
        </div>
        <span className="ws-count">{selectedGames.length} gare analizzate</span>
      </div>
      <div className="ws-season-filters">
        <label>Cerca avversario
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tutti gli avversari" />
        </label>
        <label>Periodo
          <select value={range} onChange={(event) => setRange(event.target.value as typeof range)}>
            <option value="all">Tutta la stagione</option>
            <option value="5">Ultime 5 partite</option>
            <option value="10">Ultime 10 partite</option>
          </select>
        </label>
      </div>

      <div className="ws-season-metrics">
        <article><span>Bilancio</span><strong>{summary.wins}–{selectedGames.length - summary.wins}</strong><small>{selectedGames.length ? `${Math.round(summary.wins / selectedGames.length * 100)}% vittorie` : "Nessuna gara"}</small></article>
        <article><span>Punti fatti</span><strong>{summary.pointsFor}</strong><small>{average(summary.pointsFor)} di media</small></article>
        <article><span>Punti subiti</span><strong>{summary.pointsAgainst}</strong><small>{average(summary.pointsAgainst)} di media</small></article>
        <article><span>Differenziale</span><strong>{summary.pointsFor - summary.pointsAgainst > 0 ? "+" : ""}{summary.pointsFor - summary.pointsAgainst}</strong><small>{average(summary.pointsFor - summary.pointsAgainst)} per gara</small></article>
      </div>

      <div className="ws-season-grid">
        <article className="ws-season-card">
          <h3>Andamento ultime partite</h3>
          {chronological.length ? <div className="ws-trend" aria-label="Andamento del punteggio">
            {chronological.map((game) => {
              const won = (game.teamScore ?? 0) > (game.opponentScore ?? 0);
              return <div className="ws-trend-game" key={game.id}>
                <div className="ws-trend-bars">
                  <span className="ws-trend-for" style={{ height: `${Math.max(6, (game.teamScore ?? 0) / maxScore * 100)}%` }} title={`CourtLab ${game.teamScore}`} />
                  <span className="ws-trend-against" style={{ height: `${Math.max(6, (game.opponentScore ?? 0) / maxScore * 100)}%` }} title={`${game.opponent} ${game.opponentScore}`} />
                </div>
                <strong className={won ? "win" : "loss"}>{won ? "V" : "S"}</strong>
                <small>{game.teamScore}–{game.opponentScore}</small>
                <span title={game.opponent}>{game.opponent}</span>
              </div>;
            })}
          </div> : <p className="ws-empty">Nessuna partita terminata per questo filtro.</p>}
          <div className="ws-trend-legend"><span><i className="for" /> {team.category || team.name}</span><span><i className="against" /> Avversari</span></div>
        </article>

        <article className="ws-season-card ws-player-season">
          <h3>Rendimento giocatori</h3>
          <div className="ws-season-table-wrap">
            <table>
              <thead><tr><th>Giocatore</th><th>PG</th><th>PT</th><th>PT/G</th><th>RT/G</th><th>AS/G</th><th>PR/G</th><th>PP/G</th><th>VAL/G</th></tr></thead>
              <tbody>{summary.players.map((line) => <tr key={line.player.id}>
                <th><span>#{line.player.number}</span> {line.player.shortName}</th>
                <td>{line.games}</td><td>{line.pts}</td><td>{average(line.pts, line.games)}</td>
                <td>{average(line.rebounds, line.games)}</td><td>{average(line.ast, line.games)}</td>
                <td>{average(line.stl, line.games)}</td><td>{average(line.tov, line.games)}</td>
                <td><strong>{average(line.pir, line.games)}</strong></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!summary.players.length && <p className="ws-empty">Le statistiche giocatore compariranno dopo la prima partita completata.</p>}
        </article>
      </div>
    </section>
  );
}

export default function WorkspaceDashboard(props: WorkspaceDashboardProps) {
  const [tab, setTab] = useState<"home" | "teams" | "roster" | "games" | "season">("home");
  const [showNewTeam, setShowNewTeam] = useState(false);
  const selected = props.teams.find((team) => team.id === props.selectedTeamId) ?? props.teams[0];
  if (!selected) {
    return <EmptyWorkspace onCreate={props.onCreateTeam} />;
  }
  const games = props.games.filter((game) => game.teamId === selected.id);

  return (
    <main className="ws-shell">
      <header className="ws-topbar">
        <a href="#" className="ws-brand" aria-label="CourtLab home">
          {selected.logoUrl ? <img src={selected.logoUrl} alt="" /> : <span>C</span>}CourtLab
        </a>
        <label className="ws-team-select"><span className="ws-sr-only">Squadra attiva</span>
          <select value={selected.id} onChange={(e) => props.onSelectTeam(e.target.value)}>
            {props.teams.map((team) => <option key={team.id} value={team.id}>{team.category || team.name} · {team.season}</option>)}
          </select>
        </label>
        {!props.readOnly && <button className="ws-add-team" onClick={() => setShowNewTeam(true)}>＋ Categoria</button>}
        <span className="ws-sync" aria-label="Dati salvati sul dispositivo">● Salvato sul dispositivo</span>
      </header>
      {showNewTeam && <NewTeamDialog
        source={selected}
        onClose={() => setShowNewTeam(false)}
        onCreate={(team) => {
          props.onCreateTeam(team);
          setShowNewTeam(false);
        }}
      />}
      <nav className="ws-tabs" aria-label="Area squadra">
        {([["home", "Dashboard"], ["teams", "Società e squadre"], ["roster", "Roster"], ["games", "Partite"], ["season", "Stagione"]] as const).map(([id, label]) =>
          <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      {props.readOnly && <p className="ws-readonly">Modalità viewer · consultazione senza modifiche</p>}
      {tab === "home" && <>
        <DashboardOverview team={selected} games={games} onCreateGame={props.readOnly ? undefined : () => props.onCreateGame(selected.id)} onOpenGame={props.onOpenGame} />
        <GameArchive games={games.slice(0, 4)} onOpen={props.onOpenGame} />
      </>}
      {tab === "teams" && (
        <section className="ws-panel ws-club-manager" aria-labelledby="club-manager-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-kicker">SOCIETÀ</p>
              <h2 id="club-manager-title">{selected.clubName || "Novara Basket"} · Squadre</h2>
              <p>Ogni categoria mantiene un roster e un archivio partite indipendenti.</p>
            </div>
            {!props.readOnly && <button className="ws-primary" onClick={() => setShowNewTeam(true)}>＋ Nuova categoria</button>}
          </div>
          <div className="ws-team-cards">
            {props.teams.map((team) => {
              const teamGames = props.games.filter((game) => game.teamId === team.id);
              const active = team.id === selected.id;
              return <article className={`ws-team-card ${active ? "active" : ""}`} key={team.id}>
                {team.logoUrl && <img src={team.logoUrl} alt="" />}
                <div>
                  <small>{team.clubName || "Società"}</small>
                  <h3>{team.category || team.name}</h3>
                  <span>{team.season} · {team.roster.length} giocatori · {teamGames.length} partite</span>
                </div>
                <div className="ws-team-card-actions">
                  <button className="ws-open" onClick={() => props.onSelectTeam(team.id)}>
                    {active ? "Selezionata" : "Gestisci"}
                  </button>
                  {!props.readOnly && props.onDeleteTeam && (
                    <button
                      className="ws-danger"
                      disabled={teamGames.length > 0}
                      title={teamGames.length ? "Prima elimina le partite archiviate" : "Elimina categoria"}
                      onClick={() => {
                        if (window.confirm(`Eliminare la categoria ${team.category || team.name}?`)) props.onDeleteTeam?.(team.id);
                      }}
                    >Elimina</button>
                  )}
                </div>
              </article>;
            })}
          </div>
        </section>
      )}
      {tab === "roster" && <TeamRosterManager team={selected}
        onUpdateTeam={props.onUpdateTeam}
        onAddPlayer={(player) => props.onAddPlayer(selected.id, player)}
        onUpdatePlayer={(player) => props.onUpdatePlayer(selected.id, player)}
        onRemovePlayer={props.onRemovePlayer ? (id) => props.onRemovePlayer?.(selected.id, id) : undefined}
        readOnly={props.readOnly} />}
      {tab === "games" && <GameArchive games={games} onOpen={props.onOpenGame} onDuplicate={props.readOnly ? undefined : props.onDuplicateGame} onDelete={props.readOnly ? undefined : props.onDeleteGame} />}
      {tab === "season" && <SeasonStats team={selected} games={games} />}
    </main>
  );
}

function NewTeamDialog({
  source, onClose, onCreate,
}: {
  source: TeamProfile;
  onClose: () => void;
  onCreate: WorkspaceDashboardProps["onCreateTeam"];
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const clubName = String(data.get("clubName") ?? "").trim();
    const category = String(data.get("category") ?? "").trim();
    onCreate({
      name: category,
      clubName,
      category,
      season: String(data.get("season") ?? ""),
      color: source.color,
      logoUrl: source.logoUrl,
    });
  };
  return <div className="ws-modal-backdrop" role="presentation">
    <form className="ws-new-team" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-team-title">
      <p className="ws-kicker">NUOVA CATEGORIA</p>
      <h2 id="new-team-title">Aggiungi una squadra della società</h2>
      <p>Avrà roster, partite e statistiche separati, mantenendo logo e colori della società.</p>
      <label>Società<input name="clubName" required defaultValue={source.clubName || "Novara Basket"} /></label>
      <label>Categoria<input name="category" required autoFocus placeholder="Under 14, Under 15, Under 17…" /></label>
      <label>Stagione<input name="season" required defaultValue={source.season} /></label>
      <div><button type="button" className="ws-quiet" onClick={onClose}>Annulla</button><button className="ws-primary">Crea categoria</button></div>
    </form>
  </div>;
}

function EmptyWorkspace({ onCreate }: { onCreate: WorkspaceDashboardProps["onCreateTeam"] }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const clubName = String(data.get("clubName"));
    const category = String(data.get("category"));
    onCreate({
      name: category,
      season: String(data.get("season")),
      color: "#c9141b",
      logoUrl: "/novara-basket-v4.jpeg",
      clubName,
      category,
    });
  };
  return <main className="ws-shell ws-empty-workspace"><form className="ws-panel" onSubmit={submit}>
    <p className="ws-kicker">BENVENUTO IN COURTLAB</p><h1>Crea la tua prima squadra</h1>
    <p>Imposta il roster una volta, poi riutilizzalo per tutta la stagione.</p>
    <img className="ws-welcome-logo" src="/novara-basket-v4.jpeg" alt="Logo Novara Basket" />
    <label>Società<input name="clubName" required defaultValue="Novara Basket" /></label>
    <label>Prima categoria<input name="category" required autoFocus defaultValue="Under 14" /></label>
    <label>Stagione<input name="season" required defaultValue="2026/27" /></label>
    <button className="ws-primary">Crea squadra</button>
  </form></main>;
}
