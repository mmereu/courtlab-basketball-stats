import { useMemo, useState } from "react";
import { GameState } from "../domain";
import Court from "./Court";

type ResultFilter = "all" | "made" | "miss";
type Zone = "all" | "paint" | "mid" | "three";

const zoneOf = (x: number, y: number): Exclude<Zone, "all"> => {
  const distance = Math.hypot(x - 50, y - 10);
  if (y < 38 && x > 31 && x < 69) return "paint";
  return distance > 43 || y > 58 ? "three" : "mid";
};

const zoneLabel: Record<Zone, string> = {
  all: "Tutte le zone", paint: "Area", mid: "Media", three: "Tre punti",
};

export default function ShotChartAnalysis({ state }: { state: GameState }) {
  const [playerId, setPlayerId] = useState("all");
  const [period, setPeriod] = useState("all");
  const [result, setResult] = useState<ResultFilter>("all");
  const [zone, setZone] = useState<Zone>("all");
  const shots = useMemo(() => state.events
    .filter((event) => !event.isOpponent && /^(2|3)PT_(MADE|MISS)$/.test(event.type))
    .filter((event) => event.x !== undefined && event.y !== undefined)
    .map((event) => ({
      ...event,
      x: event.x!,
      y: event.y!,
      made: event.type.endsWith("MADE"),
      zone: zoneOf(event.x!, event.y!),
      number: state.roster.find((player) => player.id === event.playerId)?.number,
    })), [state]);
  const filtered = shots.filter((shot) =>
    (playerId === "all" || shot.playerId === playerId) &&
    (period === "all" || shot.period === Number(period)) &&
    (result === "all" || (result === "made" ? shot.made : !shot.made)) &&
    (zone === "all" || shot.zone === zone));
  const made = filtered.filter((shot) => shot.made).length;
  const percentage = filtered.length ? Math.round((made / filtered.length) * 100) : 0;
  const zones = (["paint", "mid", "three"] as const).map((key) => {
    const attempts = filtered.filter((shot) => shot.zone === key);
    const makes = attempts.filter((shot) => shot.made).length;
    return { key, makes, attempts: attempts.length, pct: attempts.length ? Math.round(makes / attempts.length * 100) : 0 };
  });
  const periods = Math.max(4, state.period, ...state.events.map((event) => event.period));

  return (
    <section className="analysis-card shot-analysis" aria-label="Analisi dei tiri">
      <div className="analysis-heading">
        <div><p className="eyebrow">SHOT CHART</p><h2>Tiri per giocatore, periodo e zona</h2></div>
        <strong className="shot-total">{made}/{filtered.length} · {percentage}%</strong>
      </div>
      <div className="shot-filters">
        <label>Giocatore<select value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          <option value="all">Tutta la squadra</option>
          {state.roster.map((player) => <option key={player.id} value={player.id}>#{player.number} {player.shortName}</option>)}
        </select></label>
        <label>Periodo<select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="all">Tutta la gara</option>
          {Array.from({ length: periods }, (_, index) => index + 1).map((value) =>
            <option key={value} value={value}>{value <= 4 ? `Q${value}` : `OT${value - 4}`}</option>)}
        </select></label>
        <label>Esito<select value={result} onChange={(e) => setResult(e.target.value as ResultFilter)}>
          <option value="all">Segnati e sbagliati</option><option value="made">Segnati</option><option value="miss">Sbagliati</option>
        </select></label>
        <label>Zona<select value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
          {Object.entries(zoneLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <div className="shot-analysis-grid">
        <Court active={false} shots={filtered} onSelect={() => undefined} />
        <div className="zone-summary">
          {zones.map((item) => <article key={item.key}>
            <span>{zoneLabel[item.key]}</span><strong>{item.makes}/{item.attempts}</strong><small>{item.pct}%</small>
          </article>)}
          {!filtered.length && <p className="analysis-empty">Nessun tiro corrisponde ai filtri.</p>}
        </div>
      </div>
    </section>
  );
}
