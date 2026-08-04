import { useState } from "react";
import { calculateLine, calculateOpponentStats, calculateStats, calculateTeamStats, EventType, formatMinutes, GameEvent, GameState, pct } from "../domain";
import { exportGameExcel, exportGamePdf } from "../exports";

type Props = {
  state: GameState;
  patch: (value: Partial<GameState>) => void;
  addEvent: (event: Omit<GameEvent, "id" | "createdAt" | "period" | "clock">) => void;
};

type GuidedPrompt =
  | { kind: "assist"; scorerId?: string }
  | { kind: "rebound" }
  | { kind: "foul" }
  | { kind: "freeThrows"; attempts: 1 | 2 | 3 };

const counters: { type: EventType; code: string; label: string; tone?: string }[] = [
  { type: "OREB", code: "RO", label: "Rimb. attacco" },
  { type: "DREB", code: "RD", label: "Rimb. difesa" },
  { type: "TOV", code: "PP", label: "Palla persa", tone: "negative" },
  { type: "STL", code: "PR", label: "Palla rubata" },
  { type: "AST", code: "AS", label: "Assist" },
  { type: "BLK", code: "STF", label: "Stoppata fatta" },
  { type: "BLK_AGAINST", code: "STS", label: "Stoppata subita", tone: "negative" },
  { type: "FOUL_DRAWN", code: "FS", label: "Fallo subito" },
  { type: "FOUL", code: "FC", label: "Fallo commesso", tone: "negative" },
];

export default function CoachSheet({ state, patch, addEvent }: Props) {
  const [fastBreakEntry, setFastBreakEntry] = useState<"made" | "conceded" | null>(null);
  const [guidedPrompt, setGuidedPrompt] = useState<GuidedPrompt | null>(null);
  const team = calculateTeamStats(state);
  const opponent = calculateOpponentStats(state);
  const quarter = calculateLine(state.events.filter((event) => !event.isOpponent && event.period === state.period));
  const opponentQuarter = calculateLine(state.events.filter((event) => event.isOpponent && event.period === state.period));
  const visiblePeriods = Math.max(4, state.period, ...state.events.map((event) => event.period));
  const periodScores = Array.from({ length: visiblePeriods }, (_, index) => {
    const period = index + 1;
    const home = calculateLine(state.events.filter((event) => !event.isOpponent && event.period === period));
    const away = calculateLine(state.events.filter((event) => event.isOpponent && event.period === period));
    return { period, home: home.pts, away: away.pts };
  });
  const players = calculateStats(state);
  const selected = state.roster.find((player) => player.id === state.selectedPlayerId);

  const record = (type: EventType, label: string, points = 0, fastBreak = false) => {
    const playerId = selected?.id;
    addEvent({
      type,
      playerId,
      label: `${selected?.shortName ?? "Squadra"} · ${label}`,
      points,
      fastBreak,
    });
    // Nel foglio rapido il soggetto resta selezionato per inserire più azioni
    // consecutive senza doverlo scegliere ogni volta.
    if (playerId) patch({ selectedPlayerId: playerId });
    if (type === "2PT_MADE" || type === "3PT_MADE") {
      setGuidedPrompt({ kind: "assist", scorerId: playerId });
    } else if (type === "2PT_MISS" || type === "3PT_MISS" || type === "1PT_MISS") {
      setGuidedPrompt({ kind: "rebound" });
    } else if (type === "FOUL") {
      setGuidedPrompt({ kind: "foul" });
    }
  };

  const recordPlayerFollowUp = (type: EventType, playerId: string | undefined, label: string) => {
    const player = state.roster.find((item) => item.id === playerId);
    addEvent({
      type,
      playerId,
      label: `${player?.shortName ?? "Squadra"} · ${label}`,
      points: 0,
    });
    if (selected?.id) patch({ selectedPlayerId: selected.id });
    setGuidedPrompt(null);
  };

  const recordOpponentFollowUp = (type: EventType, label: string) => {
    addEvent({
      type,
      isOpponent: true,
      label: `${state.opponentName} · ${label}`,
      points: 0,
    });
    if (selected?.id) patch({ selectedPlayerId: selected.id });
  };

  const startOpponentFreeThrows = (attempts: 1 | 2 | 3) => {
    recordOpponentFollowUp("FOUL_DRAWN", "Fallo subito");
    setGuidedPrompt({ kind: "freeThrows", attempts });
  };

  const recordOpponentFreeThrows = (attempts: 1 | 2 | 3, made: number) => {
    for (let index = 0; index < attempts; index += 1) {
      const scored = index < made;
      addEvent({
        type: scored ? "1PT_MADE" : "1PT_MISS",
        isOpponent: true,
        label: `${state.opponentName} · TL ${index + 1}/${attempts} ${scored ? "segnato" : "sbagliato"}`,
        points: scored ? 1 : 0,
      });
    }
    if (selected?.id) patch({ selectedPlayerId: selected.id });
    setGuidedPrompt(null);
  };

  const recordFastBreak = (kind: "made" | "conceded", points: 1 | 2 | 3) => {
    const type = kind === "conceded" && !state.trackOpponent
      ? "SCORE_ADJUST"
      : `${points}PT_MADE` as EventType;
    if (kind === "made") {
      record(type, `CPF +${points}`, points, true);
    } else {
      addEvent({
        type,
        isOpponent: true,
        label: `${state.opponentName} · CPS +${points}`,
        points,
        fastBreak: true,
      });
    }
    setFastBreakEntry(null);
  };

  return (
    <section className="coach-sheet">
      <div className="sheet-head">
        <div>
          <p className="eyebrow">FOGLIO COACH</p>
          <h2>Un tocco, un dato.</h2>
        </div>
        <div className="sheet-head-tools">
          <div className="sheet-export-buttons">
            <button onClick={() => void exportGamePdf(state)}>↓ PDF</button>
            <button onClick={() => void exportGameExcel(state)}>↓ Excel</button>
          </div>
          <div className="subject-picker">
            <small>REGISTRA PER</small>
            <select
              value={state.selectedPlayerId ?? "team"}
              onChange={(event) => patch({ selectedPlayerId: event.target.value === "team" ? undefined : event.target.value })}
            >
              <option value="team">Squadra / da assegnare</option>
              {state.roster.map((player) => (
                <option key={player.id} value={player.id}>#{player.number} {player.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="team-kpis">
        <div className="points-kpi"><small>PUNTI</small><strong>{team.pts}</strong></div>
        <div><small>2 PUNTI</small><strong>{team.twoPm}/{team.twoPa}</strong><span>{pct(team.twoPm, team.twoPa)}</span></div>
        <div><small>3 PUNTI</small><strong>{team.threePm}/{team.threePa}</strong><span>{pct(team.threePm, team.threePa)}</span></div>
        <div><small>LIBERI</small><strong>{team.ftm}/{team.fta}</strong><span>{pct(team.ftm, team.fta)}</span></div>
        <div><small>RIMBALZI</small><strong>{team.oreb + team.dreb}</strong><span>{team.oreb} OFF · {team.dreb} DIF</span></div>
        <div className="eff-kpi"><small>VAL</small><strong>{team.pir}</strong><span>Valutazione complessiva</span></div>
      </div>
      <div className="transition-kpis">
        <span>Palle rubate squadra <strong>{team.stl}</strong></span>
        <span>PP · Palle perse squadra <strong>{team.tov}</strong></span>
        <span>CPF · Contropiede fatto <strong>{team.fastBreakPoints}</strong></span>
        <span>CPS · Contropiede subito <strong>{opponent.fastBreakPoints}</strong></span>
      </div>
      <div className="quarter-live-summary">
        <div className="quarter-score-strip" aria-label="Parziali di tutti i quarti">
          {periodScores.map(({ period, home, away }) => (
            <div key={period} className={period === state.period ? "active" : ""}>
              <strong>{period <= 4 ? `Q${period}` : `OT${period - 4}`}</strong>
              <span>{home}–{away}</span>
            </div>
          ))}
        </div>
        <div className="quarter-current-detail">
          <strong>{state.period <= 4 ? `Q${state.period}` : `OT${state.period - 4}`} · DETTAGLIO</strong>
          <span>{quarter.pts}–{opponentQuarter.pts}</span>
          <small>2P {quarter.twoPm}/{quarter.twoPa}</small>
          <small>3P {quarter.threePm}/{quarter.threePa}</small>
          <small>TL {quarter.ftm}/{quarter.fta}</small>
          <small>R {quarter.oreb + quarter.dreb}</small>
          <small>PR {quarter.stl}</small>
          <small>AS {quarter.ast}</small>
          <small>PP {quarter.tov}</small>
          <small>CPF {quarter.fastBreakPoints}</small>
        </div>
      </div>

      {guidedPrompt && (
        <aside className="guided-flow" aria-live="polite" aria-label="Suggerimento azione successiva">
          <div className="guided-flow-head">
            <div>
              <small>AZIONE SUCCESSIVA · FACOLTATIVA</small>
              <strong>
                {guidedPrompt.kind === "assist" && "Chi ha fatto assist?"}
                {guidedPrompt.kind === "rebound" && "Chi ha preso il rimbalzo?"}
                {guidedPrompt.kind === "foul" && "Fallo subito e tiri liberi"}
                {guidedPrompt.kind === "freeThrows" && `Serie da ${guidedPrompt.attempts}: quanti segnati?`}
              </strong>
            </div>
            <button className="guided-skip" onClick={() => setGuidedPrompt(null)}>Salta ×</button>
          </div>

          {guidedPrompt.kind === "assist" && (
            <div className="guided-player-grid">
              {state.roster
                .filter((player) => state.lineup.includes(player.id) && player.id !== guidedPrompt.scorerId)
                .map((player) => (
                  <button key={player.id} onClick={() => recordPlayerFollowUp("AST", player.id, "Assist")}>
                    <b>#{player.number}</b><span>{player.shortName}</span>
                  </button>
                ))}
              <button onClick={() => recordPlayerFollowUp("AST", undefined, "Assist da assegnare")}>
                <b>TEAM</b><span>Da assegnare</span>
              </button>
            </div>
          )}

          {guidedPrompt.kind === "rebound" && (
            <>
              <p className="guided-hint">Rimbalzo offensivo della tua squadra</p>
              <div className="guided-player-grid">
                {state.roster.filter((player) => state.lineup.includes(player.id)).map((player) => (
                  <button key={player.id} onClick={() => recordPlayerFollowUp("OREB", player.id, "Rimbalzo attacco")}>
                    <b>#{player.number}</b><span>{player.shortName}</span>
                  </button>
                ))}
                <button onClick={() => recordPlayerFollowUp("OREB", undefined, "Rimbalzo attacco di squadra")}>
                  <b>TEAM</b><span>Rimbalzo squadra</span>
                </button>
                <button className="guided-opponent" onClick={() => {
                  recordOpponentFollowUp("DREB", "Rimbalzo difesa");
                  setGuidedPrompt(null);
                }}>
                  <b>AVV</b><span>Rimbalzo difensivo avversario</span>
                </button>
              </div>
            </>
          )}

          {guidedPrompt.kind === "foul" && (
            <div className="guided-choice-grid">
              <button onClick={() => {
                recordOpponentFollowUp("FOUL_DRAWN", "Fallo subito");
                setGuidedPrompt(null);
              }}><b>0 TL</b><span>Solo fallo subito</span></button>
              {([1, 2, 3] as const).map((attempts) => (
                <button key={attempts} onClick={() => startOpponentFreeThrows(attempts)}>
                  <b>{attempts} TL</b><span>Registra la serie</span>
                </button>
              ))}
            </div>
          )}

          {guidedPrompt.kind === "freeThrows" && (
            <div className="guided-choice-grid">
              {Array.from({ length: guidedPrompt.attempts + 1 }, (_, made) => (
                <button key={made} onClick={() => recordOpponentFreeThrows(guidedPrompt.attempts, made)}>
                  <b>{made}/{guidedPrompt.attempts}</b><span>segnati</span>
                </button>
              ))}
            </div>
          )}
        </aside>
      )}

      {state.trackOpponent && (
        <div className="sheet-opponent-entry">
          <div>
            <small>AVVERSARIO</small>
            <strong>{state.opponentName}</strong>
            <span>Registrazione rapida di squadra</span>
          </div>
          {([
            ["1PT_MADE", "TL ✓", 1], ["1PT_MISS", "TL ×", 0],
            ["2PT_MADE", "2 ✓", 2, false], ["2PT_MISS", "2 ×", 0, false],
            ["3PT_MADE", "3 ✓", 3, false], ["3PT_MISS", "3 ×", 0, false],
            ["OREB", "RO", 0], ["DREB", "RD", 0], ["TOV", "PP", 0],
            ["STL", "PR", 0], ["AST", "AS", 0],
            ["BLK", "STF", 0], ["BLK_AGAINST", "STS", 0], ["FOUL", "FC", 0],
          ] as [EventType, string, number, boolean?][]).map(([type, label, points, fastBreak], index) => (
            <button key={`${type}-${index}`} onClick={() => addEvent({
              type,
              isOpponent: true,
              label: `${state.opponentName} · ${label}`,
              points,
              fastBreak,
            })}>{label}</button>
          ))}
        </div>
      )}

      <div className="sheet-entry">
        <div className="shooting-pad">
          <h3>Tiri</h3>
          <div className="shot-counter-row">
            <button className="miss" onClick={() => record("2PT_MISS", "2PT sbagliato")}><b>2×</b><span>Sbagliato</span></button>
            <button className="made" onClick={() => record("2PT_MADE", "2PT segnato", 2)}><b>2✓</b><span>Segnato</span></button>
          </div>
          <div className="shot-counter-row">
            <button className="miss" onClick={() => record("3PT_MISS", "3PT sbagliato")}><b>3×</b><span>Sbagliato</span></button>
            <button className="made" onClick={() => record("3PT_MADE", "3PT segnato", 3)}><b>3✓</b><span>Segnato</span></button>
          </div>
          <div className="shot-counter-row compact">
            <button className="miss" onClick={() => record("1PT_MISS", "TL sbagliato")}><b>TL ×</b></button>
            <button className="made" onClick={() => record("1PT_MADE", "TL segnato", 1)}><b>TL ✓</b></button>
          </div>
          <div className="shot-counter-row fast-break-row">
            <button className="made" onClick={() => setFastBreakEntry(fastBreakEntry === "made" ? null : "made")}><b>CPF</b><span>Contropiede fatto</span></button>
            <button className="miss" onClick={() => setFastBreakEntry(fastBreakEntry === "conceded" ? null : "conceded")}><b>CPS</b><span>Contropiede subito</span></button>
          </div>
          {fastBreakEntry && (
            <div className="shot-counter-row compact" aria-label={fastBreakEntry === "made" ? "Punti in contropiede fatti" : "Punti in contropiede subiti"}>
              {([1, 2, 3] as const).map((points) => (
                <button
                  className={fastBreakEntry === "made" ? "made" : "miss"}
                  key={points}
                  onClick={() => recordFastBreak(fastBreakEntry, points)}
                >
                  <b>+{points}</b>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="stat-pad">
          <h3>Azioni</h3>
          <div className="sheet-counter-grid">
            {counters.map((counter) => (
              <button
                key={counter.type}
                className={counter.tone ?? ""}
                onClick={() => record(counter.type, counter.label)}
              >
                <b>{counter.code}<i>+</i></b>
                <span>{counter.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sheet-table-wrap">
        <div className="sheet-table-title">
          <div><h3>Squadra e giocatori</h3><p>I totali si aggiornano automaticamente</p></div>
          <span>VAL include falli subiti, falli commessi e stoppate subite</span>
        </div>
        <table className="sheet-table">
          <thead>
            <tr><th>Giocatore</th><th>PT</th><th>MIN</th><th>+/-</th><th>2P</th><th>2P%</th><th>3P</th><th>3P%</th><th>TL</th><th>TL%</th><th>RT</th><th>RO</th><th>RD</th><th>PP</th><th>PR</th><th>AS</th><th>STF</th><th>STS</th><th>FS</th><th>FC</th><th>CPF</th><th>VAL</th></tr>
          </thead>
          <tbody>
            <tr className="team-total">
              <td>SQUADRA</td><td>{team.pts}</td><td>—</td><td>—</td><td>{team.twoPm}/{team.twoPa}</td><td>{pct(team.twoPm, team.twoPa)}</td><td>{team.threePm}/{team.threePa}</td><td>{pct(team.threePm, team.threePa)}</td><td>{team.ftm}/{team.fta}</td><td>{pct(team.ftm, team.fta)}</td><td>{team.oreb + team.dreb}</td><td>{team.oreb}</td><td>{team.dreb}</td><td>{team.tov}</td><td>{team.stl}</td><td>{team.ast}</td><td>{team.blk}</td><td>{team.blockedAgainst}</td><td>{team.foulDrawn}</td><td>{team.foul}</td><td>{team.fastBreakPoints}</td><td>{team.pir}</td>
            </tr>
            {players.map((row) => (
              <tr key={row.player.id} className={state.selectedPlayerId === row.player.id ? "selected-row" : ""} onClick={() => patch({ selectedPlayerId: row.player.id })}>
                <td><strong>#{row.player.number}</strong> {row.player.shortName}</td><td>{row.pts}</td><td>{formatMinutes(row.secondsPlayed)}</td><td>{(row.plusMinus ?? 0) > 0 ? "+" : ""}{row.plusMinus ?? 0}</td><td>{row.twoPm}/{row.twoPa}</td><td>{pct(row.twoPm, row.twoPa)}</td><td>{row.threePm}/{row.threePa}</td><td>{pct(row.threePm, row.threePa)}</td><td>{row.ftm}/{row.fta}</td><td>{pct(row.ftm, row.fta)}</td><td>{row.oreb + row.dreb}</td><td>{row.oreb}</td><td>{row.dreb}</td><td>{row.tov}</td><td>{row.stl}</td><td>{row.ast}</td><td>{row.blk}</td><td>{row.blockedAgainst}</td><td>{row.foulDrawn}</td><td>{row.foul}</td><td>{row.fastBreakPoints}</td><td>{row.pir}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
