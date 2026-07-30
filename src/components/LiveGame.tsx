import { useMemo, useState } from "react";
import {
  calculateLine, calculateOpponentStats, calculateStats, calculateTeamStats, EventType, formatClock, GameEvent,
  GameState, opponentScoreTotal, teamScore,
} from "../domain";
import Court from "./Court";
import BoxScore from "./BoxScore";
import CoachSheet from "./CoachSheet";
import GameFlow from "./GameFlow";
import ShotChartAnalysis from "./ShotChartAnalysis";
import VideoAnalysis from "./VideoAnalysis";
import { exportGameExcel, exportGamePdf } from "../exports";

type Props = {
  state: GameState;
  patch: (value: Partial<GameState>) => void;
  addEvent: (event: Omit<GameEvent, "id" | "createdAt" | "period" | "clock">) => void;
  updateEvent: (id: string, patch: Partial<GameEvent>) => void;
  deleteEvent: (id: string) => void;
  undo: () => void;
  onExit: () => void;
  onReport: () => void;
};

type ShotDraft = { points: 2 | 3; x?: number; y?: number } | null;

const actionButtons: { type: EventType; short: string; label: string }[] = [
  { type: "OREB", short: "RO+", label: "Rimb. off." },
  { type: "DREB", short: "RD", label: "Rimb. dif." },
  { type: "AST", short: "AS", label: "Assist" },
  { type: "STL", short: "PR", label: "Recupero" },
  { type: "TOV", short: "PP", label: "Palla persa" },
  { type: "BLK", short: "STF", label: "Stoppata fatta" },
  { type: "BLK_AGAINST", short: "STS", label: "Stoppata subita" },
  { type: "FOUL", short: "F", label: "Fallo" },
];

export default function LiveGame({
  state, patch, addEvent, updateEvent, deleteEvent, undo, onExit, onReport,
}: Props) {
  const [shotDraft, setShotDraft] = useState<ShotDraft>(null);
  const [tab, setTab] = useState<"actions" | "box">("actions");
  const [subOut, setSubOut] = useState<string | null>(null);
  const [fastBreakShot, setFastBreakShot] = useState(false);
  const [correctionPlayerId, setCorrectionPlayerId] = useState<string | null>(null);
  const score = teamScore(state);
  const awayScore = opponentScoreTotal(state);
  const selected = state.roster.find((player) => player.id === state.selectedPlayerId);
  const stats = useMemo(() => calculateStats(state), [state]);
  const shots = state.events
    .filter((event) => event.type.includes("PT_") && !event.type.startsWith("1"))
    .map((event) => ({
      id: event.id,
      x: event.x,
      y: event.y,
      made: event.type.endsWith("MADE"),
      number: state.roster.find((player) => player.id === event.playerId)?.number,
    }));

  const addSimple = (type: EventType, label: string) => {
    if (!selected && type !== "TIMEOUT") return;
    addEvent({ type, playerId: selected?.id, label: selected ? `${selected.shortName} · ${label}` : label, points: 0 });
  };

  const chooseShot = (points: 2 | 3) => {
    if (!selected) return;
    if (state.mode === "basic") setShotDraft({ points, x: 50, y: points === 3 ? 65 : 35 });
    else setShotDraft({ points });
  };

  const finishShot = (made: boolean) => {
    if (!shotDraft || !selected || shotDraft.x === undefined) return;
    const type = `${shotDraft.points}PT_${made ? "MADE" : "MISS"}` as EventType;
    addEvent({
      type,
      playerId: selected.id,
      label: `${selected.shortName} · ${shotDraft.points}PT ${made ? "segnato" : "sbagliato"}`,
      points: made ? shotDraft.points : 0,
      x: shotDraft.x,
      y: shotDraft.y,
      fastBreak: fastBreakShot,
    });
    setShotDraft(null);
    setFastBreakShot(false);
  };

  const freeThrow = (made: boolean) => {
    if (!selected) return;
    addEvent({
      type: made ? "1PT_MADE" : "1PT_MISS",
      playerId: selected.id,
      label: `${selected.shortName} · TL ${made ? "segnato" : "sbagliato"}`,
      points: made ? 1 : 0,
    });
  };

  const handlePlayer = (id: string) => {
    if (subOut) {
      if (!state.lineup.includes(id)) {
        const outgoing = state.roster.find((player) => player.id === subOut)!;
        const incoming = state.roster.find((player) => player.id === id)!;
        patch({ lineup: state.lineup.map((playerId) => playerId === subOut ? id : playerId) });
        addEvent({
          type: "SUB",
          playerId: incoming.id,
          secondaryPlayerId: outgoing.id,
          label: `Cambio · ${incoming.shortName} per ${outgoing.shortName}`,
          points: 0,
        });
        setSubOut(null);
      }
      return;
    }
    patch({ selectedPlayerId: state.selectedPlayerId === id ? undefined : id });
    setShotDraft(null);
  };

  const advancePeriod = () => {
    if (state.period >= 4 && !window.confirm("Avviare un tempo supplementare?")) return;
    switchPeriod(state.period + 1);
  };

  const switchPeriod = (period: number) => {
    const periodClocks = { ...state.periodClocks, [state.period]: state.clock };
    patch({
      period,
      periodClocks,
      clock: periodClocks[period] ?? (period > 4 ? 300 : 600),
      running: false,
      selectedPlayerId: undefined,
    });
    setShotDraft(null);
  };

  const visiblePeriods = Math.max(
    4,
    state.period,
    ...state.events.map((event) => event.period),
  );

  const addOpponentEvent = (type: EventType, label: string, points = 0) =>
    addEvent({ type, isOpponent: true, label: `${state.opponentName} · ${label}`, points });

  return (
    <main className="live-shell">
      <header className="scorebar">
        <button className="icon-button" onClick={onExit} aria-label="Torna alla preparazione">←</button>
        <div className="score-team home">
          {state.teamLogoUrl
            ? <img className="team-logo-live" src={state.teamLogoUrl} alt="" />
            : <span className="team-badge">TC</span>}
          <strong>{state.teamName}</strong>
        </div>
        <div className="score-number">{score}</div>
        <button className="clock-block" onClick={() => patch({ running: !state.running })}>
          <small>{state.period <= 4 ? `${state.period}° QUARTO` : `OT ${state.period - 4}`}</small>
          <strong>{formatClock(state.clock)}</strong>
          <span>{state.running ? "PAUSA" : "AVVIA"}</span>
        </button>
        <div className="score-number score-number--away">{awayScore}</div>
        <div className="score-team away"><strong>{state.opponentName}</strong><span className="team-badge away-badge">ES</span></div>
        <button className="icon-button more" onClick={onReport} aria-label="Apri report">↗</button>
      </header>

      <div className="sync-strip">
        <span><i /> Salvato sul dispositivo</span>
        <div className="live-view-switch">
          <button className={state.liveView === "sheet" ? "active" : ""} onClick={() => patch({ liveView: "sheet" })}>Foglio Coach</button>
          <button className={state.liveView === "court" ? "active" : ""} onClick={() => patch({ liveView: "court" })}>Tracking campo</button>
        </div>
        <button className="stats-correction-button" onClick={() => setCorrectionPlayerId(state.selectedPlayerId ?? "")}>
          ✎ Correggi statistiche
        </button>
        <span>Modalità {state.mode === "pro" ? "Pro" : "Basic"}</span>
      </div>
      <nav className="period-navigator" aria-label="Navigazione quarti">
        <span>QUARTO DI REGISTRAZIONE</span>
        {Array.from({ length: visiblePeriods }, (_, index) => index + 1).map((period) => (
          <button
            key={period}
            className={state.period === period ? "active" : ""}
            aria-current={state.period === period ? "step" : undefined}
            onClick={() => switchPeriod(period)}
          >
            {period <= 4 ? `Q${period}` : `OT${period - 4}`}
          </button>
        ))}
        {state.period >= 4 && <button onClick={() => {
          if (window.confirm("Aggiungere un tempo supplementare?")) switchPeriod(visiblePeriods + 1);
        }}>＋ OT</button>}
        <small>I nuovi eventi saranno salvati nel periodo selezionato</small>
      </nav>

      {state.liveView === "sheet" ? (
        <CoachSheet state={state} patch={patch} addEvent={addEvent} />
      ) : (
      <section className="live-layout">
        <aside className="players-panel">
          <div className="panel-label"><span>IN CAMPO</span><small>{selected ? `${selected.shortName} selezionato` : "Scegli giocatore"}</small></div>
          <div className="court-players">
            {state.lineup.map((id) => {
              const player = state.roster.find((item) => item.id === id)!;
              const row = stats.find((item) => item.player.id === id)!;
              return (
                <button
                  key={id}
                  className={`player-card ${state.selectedPlayerId === id ? "active" : ""} ${subOut === id ? "sub-out" : ""}`}
                  onClick={() => subOut ? setSubOut(id) : handlePlayer(id)}
                >
                  <span className="player-number" style={{ background: player.color }}>#{player.number}</span>
                  <span className="player-info"><strong>{player.shortName}</strong><small>{row.pts} PT · {row.foul} F</small></span>
                  <span className="select-ring">{state.selectedPlayerId === id ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
          <div className="bench-head"><span>PANCHINA</span>{subOut && <small>Ora scegli chi entra</small>}</div>
          <div className="bench-grid">
            {state.roster.filter((player) => !state.lineup.includes(player.id)).map((player) => (
              <button key={player.id} onClick={() => handlePlayer(player.id)} className={subOut ? "waiting-in" : ""}>
                <strong>#{player.number}</strong><span>{player.shortName}</span>
              </button>
            ))}
          </div>
          <button
            className={`sub-button ${subOut ? "active" : ""}`}
            onClick={() => {
              if (subOut) setSubOut(null);
              else if (selected && state.lineup.includes(selected.id)) setSubOut(selected.id);
            }}
            disabled={!selected && !subOut}
          >
            {subOut ? "Annulla cambio" : "↔ Effettua cambio"}
          </button>
        </aside>

        <section className="court-stage">
          <Court
            active={Boolean(shotDraft && shotDraft.x === undefined)}
            shots={shots}
            onSelect={(x, y) => setShotDraft((draft) => draft ? { ...draft, x, y } : null)}
          />
          {shotDraft && shotDraft.x !== undefined && (
            <div className="shot-result-card">
              <div><small>{shotDraft.points} PUNTI</small><strong>{selected?.shortName}</strong></div>
              <button className="miss-button" onClick={() => finishShot(false)}>× Sbagliato</button>
              <button className="made-button" onClick={() => finishShot(true)}>✓ Segnato</button>
            </div>
          )}
          {!selected && !shotDraft && (
            <div className="stage-hint"><span>1</span> Seleziona un giocatore per registrare un’azione</div>
          )}
        </section>

        <aside className="actions-panel">
          <div className="tabs">
            <button className={tab === "actions" ? "active" : ""} onClick={() => setTab("actions")}>Azioni</button>
            <button className={tab === "box" ? "active" : ""} onClick={() => setTab("box")}>Live stats</button>
          </div>
          {tab === "actions" ? (
            <>
              <div className="selected-banner">
                {selected ? <><span style={{ background: selected.color }}>#{selected.number}</span><div><small>AZIONE PER</small><strong>{selected.name}</strong></div></> : <p>Nessun giocatore selezionato</p>}
              </div>
              <div className="shots-actions">
                <button disabled={!selected} onClick={() => chooseShot(2)}><strong>+2</strong><span>Tiro da 2</span></button>
                <button disabled={!selected} onClick={() => chooseShot(3)}><strong>+3</strong><span>Tiro da 3</span></button>
              </div>
              <button
                className={`fast-break-toggle ${fastBreakShot ? "active" : ""}`}
                aria-pressed={fastBreakShot}
                onClick={() => setFastBreakShot(!fastBreakShot)}
              >
                ⚡ {fastBreakShot ? "Contropiede attivo" : "Segna come contropiede"}
              </button>
              <div className="free-throws">
                <button disabled={!selected} onClick={() => freeThrow(false)}>TL ×</button>
                <button disabled={!selected} onClick={() => freeThrow(true)}>TL ✓</button>
              </div>
              <div className="action-grid">
                {actionButtons.map((action) => (
                  <button key={action.type} disabled={!selected} onClick={() => addSimple(action.type, action.label)}>
                    <strong>{action.short}</strong><span>{action.label}</span>
                  </button>
                ))}
              </div>
              <button className="timeout-button" onClick={() => addSimple("TIMEOUT", "Timeout")}>Ⅱ Timeout squadra</button>
            </>
          ) : (
            <div className="mini-stats">
              {stats.filter((row) => state.lineup.includes(row.player.id)).map((row) => (
                <div key={row.player.id}><span>#{row.player.number} {row.player.shortName}</span><strong>{row.pts}</strong><small>PT</small></div>
              ))}
            </div>
          )}
        </aside>
      </section>
      )}

      <footer className="eventbar">
        <button className="undo-button" onClick={undo} disabled={!state.events.length}>↶ <span>Annulla</span></button>
        <div className="last-event">
          <small>ULTIMA AZIONE</small>
          <strong>{state.events.at(-1)?.label ?? "La partita è pronta"}</strong>
          {state.events.length > 0 && <span>{formatClock(state.events.at(-1)!.clock)}</span>}
        </div>
        {state.trackOpponent ? (
          <details className="opponent-tracker">
            <summary>Avversari <strong>{awayScore}</strong></summary>
            <div>
              <small>TIRI</small>
              <button onClick={() => addOpponentEvent("1PT_MADE", "TL segnato", 1)}>TL ✓</button>
              <button onClick={() => addOpponentEvent("1PT_MISS", "TL sbagliato")}>TL ×</button>
              <button onClick={() => addOpponentEvent("2PT_MADE", "2PT segnato", 2)}>2 ✓</button>
              <button onClick={() => addOpponentEvent("2PT_MISS", "2PT sbagliato")}>2 ×</button>
              <button onClick={() => addOpponentEvent("3PT_MADE", "3PT segnato", 3)}>3 ✓</button>
              <button onClick={() => addOpponentEvent("3PT_MISS", "3PT sbagliato")}>3 ×</button>
              <small>AZIONI</small>
              <button onClick={() => addOpponentEvent("OREB", "Rimbalzo attacco")}>RO</button>
              <button onClick={() => addOpponentEvent("DREB", "Rimbalzo difesa")}>RD</button>
              <button onClick={() => addOpponentEvent("TOV", "Palla persa")}>PP</button>
              <button onClick={() => addOpponentEvent("STL", "Palla rubata")}>PR</button>
              <button onClick={() => addOpponentEvent("AST", "Assist")}>AS</button>
              <button onClick={() => addOpponentEvent("BLK", "Stoppata fatta")}>STF</button>
              <button onClick={() => addOpponentEvent("BLK_AGAINST", "Stoppata subita")}>STS</button>
              <button onClick={() => addOpponentEvent("FOUL", "Fallo commesso")}>FC</button>
            </div>
          </details>
        ) : (
          <div className="opponent-controls">
            <span>AVVERSARI</span>
            <button
              disabled={awayScore <= 0}
              onClick={() => addEvent({
                type: "SCORE_ADJUST",
                isOpponent: true,
                label: `${state.opponentName} · Correzione punteggio −1`,
                points: -1,
              })}
            >−</button>
            <strong>{awayScore}</strong>
            <button onClick={() => addEvent({
              type: "SCORE_ADJUST",
              isOpponent: true,
              label: `${state.opponentName} · Punto avversario +1`,
              points: 1,
            })}>+</button>
          </div>
        )}
        <button className="period-button" onClick={advancePeriod}>Fine periodo →</button>
        <button className="report-button" onClick={onReport}>Report live ↗</button>
      </footer>

      <details className="playbyplay-drawer">
        <summary>Play-by-play <span>{state.events.length} eventi</span></summary>
        <div>
          {[...state.events].reverse().map((event) => (
            <EventEditor
              key={event.id}
              event={event}
              state={state}
              onUpdate={(value) => updateEvent(event.id, value)}
              onDelete={() => deleteEvent(event.id)}
            />
          ))}
          {!state.events.length && <p className="empty-row">Nessun evento registrato.</p>}
        </div>
      </details>

      {correctionPlayerId !== null && (
        <div className="correction-backdrop" role="presentation" onMouseDown={() => setCorrectionPlayerId(null)}>
          <section
            className="correction-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="correction-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>CORREZIONE IN QUALSIASI MOMENTO</small>
                <h2 id="correction-title">Statistiche giocatore</h2>
              </div>
              <button className="icon-button" onClick={() => setCorrectionPlayerId(null)} aria-label="Chiudi">×</button>
            </header>
            <label className="correction-player-select">
              Scegli il giocatore
              <select value={correctionPlayerId} onChange={(event) => setCorrectionPlayerId(event.target.value)}>
                <option value="">Seleziona…</option>
                {state.roster.map((player) => (
                  <option key={player.id} value={player.id}>#{player.number} {player.name}</option>
                ))}
              </select>
            </label>
            {correctionPlayerId ? (
              <div className="correction-events">
                <p>Apri un’azione per cambiarla, riassegnarla o eliminarla. I totali vengono ricalcolati subito.</p>
                {[...state.events]
                  .filter((event) => !event.isOpponent && event.playerId === correctionPlayerId)
                  .reverse()
                  .map((event) => (
                    <EventEditor
                      key={event.id}
                      event={event}
                      state={state}
                      onUpdate={(value) => updateEvent(event.id, value)}
                      onDelete={() => deleteEvent(event.id)}
                    />
                  ))}
                {!state.events.some((event) => !event.isOpponent && event.playerId === correctionPlayerId) && (
                  <p className="empty-row">Nessuna azione registrata per questo giocatore.</p>
                )}
              </div>
            ) : (
              <p className="empty-row">Seleziona un giocatore per vedere tutte le sue azioni.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

const editableEventTypes: { value: EventType; label: string; points: number }[] = [
  { value: "1PT_MADE", label: "TL segnato", points: 1 },
  { value: "1PT_MISS", label: "TL sbagliato", points: 0 },
  { value: "2PT_MADE", label: "2PT segnato", points: 2 },
  { value: "2PT_MISS", label: "2PT sbagliato", points: 0 },
  { value: "3PT_MADE", label: "3PT segnato", points: 3 },
  { value: "3PT_MISS", label: "3PT sbagliato", points: 0 },
  { value: "OREB", label: "Rimbalzo attacco", points: 0 },
  { value: "DREB", label: "Rimbalzo difesa", points: 0 },
  { value: "AST", label: "Assist", points: 0 },
  { value: "STL", label: "Palla rubata", points: 0 },
  { value: "TOV", label: "Palla persa", points: 0 },
  { value: "BLK", label: "Stoppata", points: 0 },
  { value: "BLK_AGAINST", label: "Stoppata subita", points: 0 },
  { value: "FOUL_DRAWN", label: "Fallo subito", points: 0 },
  { value: "FOUL", label: "Fallo commesso", points: 0 },
];

function EventEditor({
  event, state, onUpdate, onDelete,
}: {
  event: GameEvent;
  state: GameState;
  onUpdate: (patch: Partial<GameEvent>) => void;
  onDelete: () => void;
}) {
  const applyType = (type: EventType) => {
    const option = editableEventTypes.find((item) => item.value === type);
    if (!option) return;
    const subject = event.isOpponent
      ? state.opponentName
      : state.roster.find((player) => player.id === event.playerId)?.shortName ?? "Squadra";
    onUpdate({ type, points: option.points, label: `${subject} · ${option.label}` });
  };

  return (
    <details className={`review-event ${event.isOpponent ? "is-opponent" : ""}`}>
      <summary>
        <time>Q{event.period} · {formatClock(event.clock)}</time>
        <strong>{event.label}</strong>
        {event.revisedAt && <small>Modificato</small>}
        {event.points > 0 && <span>+{event.points}</span>}
      </summary>
      <div className="review-event-form">
        <label>
          Azione
          <select value={event.type} onChange={(e) => applyType(e.target.value as EventType)}>
            {editableEventTypes.map((item) =>
              <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        {!event.isOpponent && (
          <label>
            Giocatore
            <select
              value={event.playerId ?? "team"}
              onChange={(e) => {
                const playerId = e.target.value === "team" ? undefined : e.target.value;
                const player = state.roster.find((item) => item.id === playerId);
                const action = editableEventTypes.find((item) => item.value === event.type)?.label ?? event.label;
                onUpdate({ playerId, label: `${player?.shortName ?? "Squadra"} · ${action}` });
              }}
            >
              <option value="team">Squadra / da assegnare</option>
              {state.roster.map((player) =>
                <option key={player.id} value={player.id}>#{player.number} {player.name}</option>)}
            </select>
          </label>
        )}
        {event.points > 0 && (
          <label className="review-fast-break">
            <input
              type="checkbox"
              checked={Boolean(event.fastBreak)}
              onChange={(e) => onUpdate({ fastBreak: e.target.checked })}
            />
            Punto in contropiede
          </label>
        )}
        <button className="review-delete" onClick={() => {
          if (window.confirm("Eliminare questo evento? I totali verranno ricalcolati.")) onDelete();
        }}>Elimina evento</button>
      </div>
    </details>
  );
}

export function Report({
  state,
  patch,
  onBack,
  onSetup,
  readOnly = false,
}: {
  state: GameState;
  patch: (value: Partial<GameState>) => void;
  onBack: () => void;
  onSetup: () => void;
  readOnly?: boolean;
}) {
  const stats = calculateStats(state);
  const team = calculateTeamStats(state);
  const score = teamScore(state);
  const opponent = calculateOpponentStats(state);
  const awayScore = opponentScoreTotal(state);
  const periods = Array.from(
    { length: Math.max(4, state.period, ...state.events.map((event) => event.period)) },
    (_, index) => index + 1,
  );
  const periodGroups = [
    ...periods.map((period) => ({
      label: period <= 4 ? `Q${period}` : `OT${period - 4}`,
      periods: [period],
      aggregate: false,
    })),
    { label: "1° TEMPO", periods: [1, 2], aggregate: true },
    { label: "2° TEMPO", periods: [3, 4], aggregate: true },
    { label: "TOTALE 4Q", periods: [1, 2, 3, 4], aggregate: true },
    ...(periods.length > 4 ? [{
      label: "TOTALE GARA",
      periods,
      aggregate: true,
    }] : []),
  ];
  return (
    <main className="report-shell">
      <header className="report-top">
        <button className="icon-button" onClick={readOnly ? onSetup : onBack}>←</button>
        <div className="brand">
          {state.teamLogoUrl
            ? <img className="team-logo-live" src={state.teamLogoUrl} alt="" />
            : <span className="brand-ball">C</span>}
          <span>CourtLab</span>
        </div>
        <div className="report-export-buttons">
          <button className="secondary-button" onClick={() => void exportGamePdf(state)}>Scarica PDF</button>
          <button className="secondary-button" onClick={() => void exportGameExcel(state)}>Scarica Excel</button>
          <button className="secondary-button" onClick={() => window.print()}>Stampa</button>
        </div>
      </header>
      <section className="report-hero">
        <p className="eyebrow">REPORT LIVE · {state.events.length} EVENTI</p>
        <div className="report-score">
          <div><small>{state.teamName}</small><strong>{score}</strong></div>
          <span>—</span>
          <div><small>{state.opponentName}</small><strong>{awayScore}</strong></div>
        </div>
        <p>Q{state.period} · {formatClock(state.clock)} rimanenti</p>
      </section>
      <section className="report-content">
        <div className="report-title"><div><p className="eyebrow">BOX SCORE</p><h1>La partita, in numeri.</h1></div>{!readOnly && <button className="primary-button" onClick={onBack}>Continua a registrare</button>}</div>
        <BoxScore
          stats={stats}
          teamStats={team}
          teamPlusMinus={score - awayScore}
          fastBreakPointsAgainst={opponent.fastBreakPoints}
        />
        <GameFlow state={state} />
        <ShotChartAnalysis state={state} />
        <VideoAnalysis
          state={state}
          readOnly={readOnly}
          onChange={(videoAnalysis) => patch({ videoAnalysis })}
        />
        <section className="transition-report">
          <article><span>Palle rubate squadra</span><strong>{team.stl}</strong></article>
          <article><span>Punti in contropiede realizzati</span><strong>{team.fastBreakPoints}</strong></article>
          <article><span>Punti in contropiede subiti</span><strong>{opponent.fastBreakPoints}</strong></article>
        </section>
        <section className="quarter-report">
          <div><p className="eyebrow">PARZIALI</p><h2>Statistiche per quarto</h2></div>
          <div className="quarter-table-wrap">
            <table>
              <thead><tr><th>Periodo</th><th>Parziale</th><th>2P</th><th>3P</th><th>TL</th><th>R</th><th>PR</th><th>AS</th><th>PP</th><th>CPF</th><th>VAL</th></tr></thead>
              <tbody>{periodGroups.map((group) => {
                const row = calculateLine(state.events.filter((event) => !event.isOpponent && group.periods.includes(event.period)));
                const away = calculateLine(state.events.filter((event) => event.isOpponent && group.periods.includes(event.period)));
                return <tr key={group.label} className={group.aggregate ? "aggregate" : ""}>
                  <th>{group.label}</th>
                  <td>{row.pts}–{away.pts}</td>
                  <td>{row.twoPm}/{row.twoPa}</td><td>{row.threePm}/{row.threePa}</td>
                  <td>{row.ftm}/{row.fta}</td><td>{row.oreb + row.dreb}</td>
                  <td>{row.stl}</td><td>{row.ast}</td><td>{row.tov}</td>
                  <td>{row.fastBreakPoints}</td><td>{row.pir}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>
        {state.trackOpponent && (
          <section className="opponent-report">
            <div>
              <p className="eyebrow">AVVERSARIO</p>
              <h2>Totali {state.opponentName}</h2>
            </div>
            <div className="advanced-grid">
              <article><span>Punti</span><strong>{opponent.pts}</strong></article>
              <article><span>2 punti</span><strong>{opponent.twoPm}/{opponent.twoPa}</strong></article>
              <article><span>3 punti</span><strong>{opponent.threePm}/{opponent.threePa}</strong></article>
              <article><span>Liberi</span><strong>{opponent.ftm}/{opponent.fta}</strong></article>
              <article><span>Rimbalzi</span><strong>{opponent.oreb + opponent.dreb}</strong></article>
              <article><span>Perse</span><strong>{opponent.tov}</strong></article>
              <article><span>Assist</span><strong>{opponent.ast}</strong></article>
              <article><span>VAL</span><strong>{opponent.pir}</strong></article>
            </div>
          </section>
        )}
        <div className="report-actions">
          <button className="secondary-button" onClick={onSetup}>Chiudi e torna al setup</button>
        </div>
      </section>
    </main>
  );
}
