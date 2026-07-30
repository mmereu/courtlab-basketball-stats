export type Player = {
  id: string;
  number: number;
  name: string;
  shortName: string;
  role: string;
  color: string;
};

export type EventType =
  | "1PT_MADE"
  | "1PT_MISS"
  | "2PT_MADE"
  | "2PT_MISS"
  | "3PT_MADE"
  | "3PT_MISS"
  | "OREB"
  | "DREB"
  | "AST"
  | "STL"
  | "TOV"
  | "BLK"
  | "BLK_AGAINST"
  | "FOUL"
  | "FOUL_DRAWN"
  | "SCORE_ADJUST"
  | "TIMEOUT"
  | "SUB";

export type GameEvent = {
  id: string;
  type: EventType;
  playerId?: string;
  secondaryPlayerId?: string;
  period: number;
  clock: number;
  createdAt: number;
  x?: number;
  y?: number;
  label: string;
  points: number;
  isOpponent?: boolean;
  revisedAt?: number;
  fastBreak?: boolean;
};

/**
 * Solo metadati e riferimenti temporali: il file video non viene mai
 * serializzato né inviato al server.
 */
export type VideoPeriodAnchor = {
  period: number;
  clock: number;
  videoSeconds: number;
};

export type LocalVideoAnalysis = {
  fileName: string;
  durationSeconds: number;
  periodAnchors: VideoPeriodAnchor[];
  eventLinks: Record<string, number>;
  eventNotes: Record<string, string>;
};

export type GameState = {
  screen: "setup" | "live" | "report";
  teamName: string;
  opponentName: string;
  teamColor: string;
  teamLogoUrl?: string;
  mode: "basic" | "pro";
  trackOpponent: boolean;
  liveView: "sheet" | "court";
  period: number;
  clock: number;
  periodClocks?: Record<number, number>;
  running: boolean;
  opponentScore: number;
  opponentFouls: number;
  roster: Player[];
  lineup: string[];
  startingLineup?: string[];
  events: GameEvent[];
  selectedPlayerId?: string;
  videoAnalysis?: LocalVideoAnalysis;
};

export type PlayerStats = {
  player: Player;
  pts: number;
  fgm: number;
  fga: number;
  twoPm: number;
  twoPa: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  tov: number;
  blk: number;
  foul: number;
  foulDrawn: number;
  blockedAgainst: number;
  eff: number;
  pir: number;
  fastBreakPoints: number;
  secondsPlayed?: number;
  plusMinus?: number;
};

export type LineupStint = {
  playerIds: string[];
  start: number;
  end: number;
  seconds: number;
  pointsFor: number;
  pointsAgainst: number;
  plusMinus: number;
};

export type LineupSummary = {
  playerIds: string[];
  seconds: number;
  pointsFor: number;
  pointsAgainst: number;
  plusMinus: number;
};

export const demoRoster: Player[] = [
  { id: "p4", number: 4, name: "Luca Rossi", shortName: "Rossi", role: "Play", color: "#f0b46a" },
  { id: "p7", number: 7, name: "Marco Bianchi", shortName: "Bianchi", role: "Guardia", color: "#8fc9b4" },
  { id: "p9", number: 9, name: "Andrea Serra", shortName: "Serra", role: "Ala", color: "#a9b7e8" },
  { id: "p12", number: 12, name: "Paolo Piras", shortName: "Piras", role: "Ala forte", color: "#e99d8f" },
  { id: "p15", number: 15, name: "Davide Mereu", shortName: "Mereu", role: "Centro", color: "#c8b2e4" },
  { id: "p5", number: 5, name: "Nico Carta", shortName: "Carta", role: "Play", color: "#e6c56d" },
  { id: "p8", number: 8, name: "Edo Sanna", shortName: "Sanna", role: "Guardia", color: "#91c6dc" },
  { id: "p10", number: 10, name: "Fabio Melis", shortName: "Melis", role: "Ala", color: "#d3a6bc" },
  { id: "p14", number: 14, name: "Milo Lai", shortName: "Lai", role: "Centro", color: "#a5c989" },
];

export const initialState: GameState = {
  screen: "setup",
  teamName: "La mia squadra",
  opponentName: "",
  teamColor: "#e75b30",
  mode: "pro",
  trackOpponent: false,
  liveView: "sheet",
  period: 1,
  clock: 600,
  periodClocks: { 1: 600, 2: 600, 3: 600, 4: 600 },
  running: false,
  opponentScore: 0,
  opponentFouls: 0,
  roster: demoRoster,
  lineup: demoRoster.slice(0, 5).map((player) => player.id),
  startingLineup: demoRoster.slice(0, 5).map((player) => player.id),
  events: [],
};

export function calculateStats(state: GameState): PlayerStats[] {
  const participation = calculatePlayerParticipation(state);
  return state.roster.map((player) => {
    const events = state.events.filter((event) => !event.isOpponent && event.playerId === player.id);
    return {
      player,
      ...calculateLine(events),
      secondsPlayed: participation[player.id]?.seconds ?? 0,
      plusMinus: participation[player.id]?.plusMinus ?? 0,
    };
  });
}

export function elapsedGameSeconds(period: number, clock: number) {
  let elapsed = 0;
  for (let current = 1; current < period; current += 1) elapsed += current <= 4 ? 600 : 300;
  return elapsed + (period <= 4 ? 600 : 300) - clock;
}

export function calculateLineupStints(state: GameState): LineupStint[] {
  const substitutions = state.events
    .filter((event) => !event.isOpponent && event.type === "SUB")
    .sort((a, b) => elapsedGameSeconds(a.period, a.clock) - elapsedGameSeconds(b.period, b.clock));
  const timelineEnd = Math.max(
    elapsedGameSeconds(state.period, state.clock),
    ...state.events.map((event) => elapsedGameSeconds(event.period, event.clock)),
    0,
  );
  let lineup = [...(state.startingLineup?.length ? state.startingLineup : state.lineup)];
  let start = 0;
  const stints: LineupStint[] = [];

  const closeStint = (end: number) => {
    if (end <= start || !lineup.length) return;
    const pointsFor = state.events
      .filter((event) => !event.isOpponent && event.type !== "SUB")
      .filter((event) => {
        const at = elapsedGameSeconds(event.period, event.clock);
        return at >= start && at < end;
      })
      .reduce((total, event) => total + event.points, 0);
    const pointsAgainst = state.events
      .filter((event) => event.isOpponent)
      .filter((event) => {
        const at = elapsedGameSeconds(event.period, event.clock);
        return at >= start && at < end;
      })
      .reduce((total, event) => total + event.points, 0);
    stints.push({
      playerIds: [...lineup],
      start,
      end,
      seconds: end - start,
      pointsFor,
      pointsAgainst,
      plusMinus: pointsFor - pointsAgainst,
    });
  };

  substitutions.forEach((event) => {
    const at = elapsedGameSeconds(event.period, event.clock);
    closeStint(at);
    if (event.secondaryPlayerId) {
      lineup = lineup.map((id) => id === event.secondaryPlayerId ? event.playerId ?? id : id);
    } else if (event.playerId && !lineup.includes(event.playerId)) {
      lineup = [...lineup.slice(0, 4), event.playerId];
    }
    start = at;
  });
  closeStint(timelineEnd);
  return stints;
}

export function calculatePlayerParticipation(state: GameState) {
  const result: Record<string, { seconds: number; plusMinus: number }> = {};
  state.roster.forEach((player) => { result[player.id] = { seconds: 0, plusMinus: 0 }; });
  calculateLineupStints(state).forEach((stint) => {
    stint.playerIds.forEach((id) => {
      result[id] ??= { seconds: 0, plusMinus: 0 };
      result[id].seconds += stint.seconds;
      result[id].plusMinus += stint.plusMinus;
    });
  });
  return result;
}

export function calculateLineupSummaries(state: GameState): LineupSummary[] {
  const summaries = new Map<string, LineupSummary>();
  calculateLineupStints(state).forEach((stint) => {
    const playerIds = [...stint.playerIds].sort();
    const key = playerIds.join("|");
    const current = summaries.get(key) ?? {
      playerIds, seconds: 0, pointsFor: 0, pointsAgainst: 0, plusMinus: 0,
    };
    current.seconds += stint.seconds;
    current.pointsFor += stint.pointsFor;
    current.pointsAgainst += stint.pointsAgainst;
    current.plusMinus += stint.plusMinus;
    summaries.set(key, current);
  });
  return [...summaries.values()].sort((a, b) => b.seconds - a.seconds);
}

export function calculateLine(events: GameEvent[]) {
  const count = (type: EventType) => events.filter((event) => event.type === type).length;
  const twoMade = count("2PT_MADE");
  const twoMiss = count("2PT_MISS");
  const threeMade = count("3PT_MADE");
  const threeMiss = count("3PT_MISS");
  const ftm = count("1PT_MADE");
  const ftMiss = count("1PT_MISS");
  const fgm = twoMade + threeMade;
  const fga = fgm + twoMiss + threeMiss;
  const fta = ftm + ftMiss;
  const scoreAdjust = events
    .filter((event) => event.type === "SCORE_ADJUST")
    .reduce((total, event) => total + event.points, 0);
  const pts = twoMade * 2 + threeMade * 3 + ftm + scoreAdjust;
  const oreb = count("OREB");
  const dreb = count("DREB");
  const ast = count("AST");
  const stl = count("STL");
  const tov = count("TOV");
  const blk = count("BLK");
  const foul = count("FOUL");
  const foulDrawn = count("FOUL_DRAWN");
  const blockedAgainst = count("BLK_AGAINST");
  const missedFg = fga - fgm;
  const missedFt = fta - ftm;
  const eff = pts - missedFg - missedFt + oreb + dreb + ast - tov + stl + blk;
  const pir = eff + foulDrawn - foul - blockedAgainst;
  const fastBreakPoints = events
    .filter((event) => event.fastBreak)
    .reduce((total, event) => total + event.points, 0);
  return {
    pts, fgm, fga, twoPm: twoMade, twoPa: twoMade + twoMiss,
    threePm: threeMade, threePa: threeMade + threeMiss,
    ftm, fta, oreb, dreb, ast, stl, tov, blk, foul, foulDrawn,
    blockedAgainst, eff, pir, fastBreakPoints,
  };
}

export const calculateTeamStats = (state: GameState) =>
  calculateLine(state.events.filter((event) => !event.isOpponent));

export const calculateOpponentStats = (state: GameState) =>
  calculateLine(state.events.filter((event) => event.isOpponent));

export const teamScore = (state: GameState) =>
  state.events.reduce((total, event) => total + (event.isOpponent ? 0 : event.points), 0);

export const opponentScoreTotal = (state: GameState) => {
  const tracked = state.events
    .filter((event) => event.isOpponent)
    .reduce((total, event) => total + event.points, 0);
  const periodAdjustments = state.events
    .filter((event) => event.isOpponent && event.type === "SCORE_ADJUST")
    .reduce((total, event) => total + event.points, 0);
  return state.trackOpponent ? tracked : Math.max(0, state.opponentScore + periodAdjustments);
};

export function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function formatMinutes(seconds = 0) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function pct(made: number, attempted: number) {
  return attempted ? `${Math.round((made / attempted) * 100)}%` : "—";
}
