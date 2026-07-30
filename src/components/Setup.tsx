import { GameState } from "../domain";

type SetupProps = {
  state: GameState;
  patch: (value: Partial<GameState>) => void;
  onStart: () => void;
  onReset: () => void;
  onHome?: () => void;
};

export default function Setup({ state, patch, onStart, onReset, onHome }: SetupProps) {
  const toggleLineup = (id: string) => {
    if (state.lineup.includes(id)) {
      patch({ lineup: state.lineup.filter((playerId) => playerId !== id) });
    } else if (state.lineup.length < 5) {
      patch({ lineup: [...state.lineup, id] });
    }
  };

  return (
    <main className="setup-shell">
      <header className="brandbar">
        <a className="brand" href="#" aria-label="CourtLab home">
          <span className="brand-ball">C</span>
          <span>CourtLab</span>
        </a>
        <span className="prototype-pill">Release A · Prototipo</span>
      </header>

      <section className="setup-hero">
        <div>
          <p className="eyebrow">PREPARAZIONE PARTITA</p>
          <h1>Pronti per il campo.</h1>
          <p className="lede">
            Imposta la gara, scegli il quintetto e prova il flusso di registrazione
            pensato per non perdere l’azione successiva.
          </p>
        </div>
        {state.teamLogoUrl ? (
          <img className="setup-team-logo" src={state.teamLogoUrl} alt={`Logo ${state.teamName}`} />
        ) : <div className="game-mark" aria-hidden="true">
          <span>5</span><small>VS</small><span>5</span>
        </div>}
      </section>

      <section className="setup-grid">
        <article className="panel setup-card">
          <div className="section-title">
            <span className="step">01</span>
            <div><h2>Dettagli gara</h2><p>Partita amichevole · 4 × 10 minuti</p></div>
          </div>
          <label>
            La tua squadra
            <input
              value={state.teamName}
              onChange={(event) => patch({ teamName: event.target.value })}
            />
          </label>
          <label>
            Avversario
            <input
              value={state.opponentName}
              onChange={(event) => patch({ opponentName: event.target.value })}
            />
          </label>
          <div className="segmented">
            <button
              className={state.mode === "basic" ? "active" : ""}
              onClick={() => patch({ mode: "basic" })}
            >
              <strong>Basic</strong><small>Più rapido</small>
            </button>
            <button
              className={state.mode === "pro" ? "active" : ""}
              onClick={() => patch({ mode: "pro" })}
            >
              <strong>Pro</strong><small>Shot chart e dettagli</small>
            </button>
          </div>
          <label className="setup-opponent-toggle">
            <input
              type="checkbox"
              checked={state.trackOpponent}
              onChange={(event) => patch({ trackOpponent: event.target.checked })}
            />
            <span>
              <strong>Statistiche avversario</strong>
              <small>Registra anche tiri, rimbalzi, perse e falli dell’altra squadra.</small>
            </span>
          </label>
        </article>

        <article className="panel lineup-card">
          <div className="section-title">
            <span className="step">02</span>
            <div><h2>Quintetto iniziale</h2><p>{state.lineup.length}/5 selezionati</p></div>
          </div>
          <div className="roster-list">
            {state.roster.map((player) => {
              const selected = state.lineup.includes(player.id);
              return (
                <button
                  key={player.id}
                  className={`roster-row ${selected ? "selected" : ""}`}
                  onClick={() => toggleLineup(player.id)}
                  aria-pressed={selected}
                >
                  <span className="jersey" style={{ background: player.color }}>#{player.number}</span>
                  <span><strong>{player.name}</strong><small>{player.role}</small></span>
                  <span className="check">{selected ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <footer className="setup-footer">
        <div>
          {onHome && <button className="text-button" onClick={onHome}>← Dashboard</button>}
          <button className="text-button" onClick={onReset}>Ripristina demo</button>
        </div>
        <div className="offline-ready"><span>●</span> Dati pronti per l’offline</div>
        <button
          className="primary-button"
          disabled={state.lineup.length !== 5 || !state.teamName || !state.opponentName}
          onClick={onStart}
        >
          Inizia partita <span>→</span>
        </button>
      </footer>
    </main>
  );
}
