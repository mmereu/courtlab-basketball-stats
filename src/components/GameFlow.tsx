import { useMemo } from "react";
import { calculateLineupStints, elapsedGameSeconds, formatClock, GameState } from "../domain";

type FlowPoint = {
  time: number;
  home: number;
  away: number;
  label: string;
  lineup: string;
};

export default function GameFlow({ state }: { state: GameState }) {
  const { points, runs, maxLead } = useMemo(() => {
    const stints = calculateLineupStints(state);
    let home = 0;
    let away = 0;
    const scoring = state.events
      .filter((event) => event.points !== 0)
      .sort((a, b) => elapsedGameSeconds(a.period, a.clock) - elapsedGameSeconds(b.period, b.clock));
    const flow: FlowPoint[] = [{
      time: 0, home: 0, away: 0, label: "Inizio", lineup: "",
    }];
    scoring.forEach((event) => {
      if (event.isOpponent) away += event.points;
      else home += event.points;
      const at = elapsedGameSeconds(event.period, event.clock);
      const stint = stints.find((item) => at >= item.start && at <= item.end);
      flow.push({
        time: at,
        home,
        away,
        label: `Q${event.period} ${formatClock(event.clock)} · ${event.label}`,
        lineup: stint?.playerIds.map((id) => {
          const player = state.roster.find((item) => item.id === id);
          return player ? `#${player.number}` : "";
        }).filter(Boolean).join(" ") ?? "",
      });
    });

    const detected: { team: string; score: string; from: string; to: string }[] = [];
    let runTeam = "";
    let runStart = 0;
    let runPoints = 0;
    scoring.forEach((event, index) => {
      const team = event.isOpponent ? state.opponentName : state.teamName;
      if (team !== runTeam) {
        if (runPoints >= 6) detected.push({
          team: runTeam, score: `${runPoints}–0`,
          from: flow[runStart]?.label ?? "", to: flow[index]?.label ?? "",
        });
        runTeam = team;
        runStart = index;
        runPoints = Math.max(0, event.points);
      } else runPoints += Math.max(0, event.points);
    });
    if (runPoints >= 6) detected.push({
      team: runTeam, score: `${runPoints}–0`,
      from: flow[runStart]?.label ?? "", to: flow.at(-1)?.label ?? "",
    });
    return {
      points: flow,
      runs: detected.slice(-5).reverse(),
      maxLead: Math.max(0, ...flow.map((point) => Math.abs(point.home - point.away))),
    };
  }, [state]);

  const width = 900;
  const height = 250;
  const pad = 28;
  const maxTime = Math.max(1, ...points.map((point) => point.time));
  const maxScore = Math.max(10, ...points.flatMap((point) => [point.home, point.away]));
  const coords = (key: "home" | "away") => points.map((point) => ({
    x: pad + (point.time / maxTime) * (width - pad * 2),
    y: height - pad - (point[key] / maxScore) * (height - pad * 2),
    point,
  }));
  const home = coords("home");
  const away = coords("away");
  const path = (items: typeof home) => items.map((item, index) =>
    `${index ? "L" : "M"} ${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(" ");

  return (
    <section className="analysis-card game-flow" aria-label="Andamento della partita">
      <div className="analysis-heading">
        <div><p className="eyebrow">GAME FLOW</p><h2>Andamento del punteggio</h2></div>
        <div className="flow-legend">
          <span><i className="home" />{state.teamName}</span>
          <span><i className="away" />{state.opponentName}</span>
          <strong>Vantaggio max {maxLead}</strong>
        </div>
      </div>
      {points.length === 1 ? <p className="analysis-empty">Il grafico apparirà al primo punto registrato.</p> : (
        <div className="flow-chart-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico del punteggio nel tempo">
            {[0, .25, .5, .75, 1].map((value) => (
              <line key={value} x1={pad} x2={width - pad} y1={pad + value * (height - pad * 2)}
                y2={pad + value * (height - pad * 2)} className="flow-gridline" />
            ))}
            <path d={path(home)} className="flow-line flow-line-home" />
            <path d={path(away)} className="flow-line flow-line-away" />
            {home.slice(1).map(({ x, y, point }) => (
              <circle key={`h-${point.time}-${point.home}`} cx={x} cy={y} r="5" className="flow-dot home">
                <title>{point.label} · {point.home}–{point.away}{point.lineup ? ` · Quintetto ${point.lineup}` : ""}</title>
              </circle>
            ))}
            {away.slice(1).map(({ x, y, point }) => (
              <circle key={`a-${point.time}-${point.away}`} cx={x} cy={y} r="5" className="flow-dot away">
                <title>{point.label} · {point.home}–{point.away}{point.lineup ? ` · Quintetto ${point.lineup}` : ""}</title>
              </circle>
            ))}
          </svg>
        </div>
      )}
      {runs.length > 0 && <div className="flow-runs">
        <strong>Parziali significativi</strong>
        {runs.map((run, index) => <span key={`${run.team}-${index}`}><b>{run.score}</b> {run.team}</span>)}
      </div>}
    </section>
  );
}
