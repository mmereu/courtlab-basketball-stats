import { describe, expect, it } from "vitest";
import {
  calculateLine, calculateLineupStints, calculateOpponentStats, calculatePlayerParticipation,
  calculateStats, calculateTeamStats, GameState,
  initialState, opponentScoreTotal, pct, teamScore,
} from "./domain";

const state: GameState = {
  ...initialState,
  events: [
    { id: "1", type: "2PT_MADE", playerId: "p4", period: 1, clock: 590, createdAt: 1, label: "2", points: 2 },
    { id: "2", type: "3PT_MADE", playerId: "p4", period: 1, clock: 580, createdAt: 2, label: "3", points: 3 },
    { id: "3", type: "3PT_MISS", playerId: "p4", period: 1, clock: 570, createdAt: 3, label: "miss", points: 0 },
    { id: "4", type: "AST", playerId: "p7", period: 1, clock: 580, createdAt: 4, label: "ast", points: 0 },
  ],
};

describe("stat engine", () => {
  it("calcola punteggio e box score dagli eventi", () => {
    expect(teamScore(state)).toBe(5);
    const player = calculateStats(state).find((row) => row.player.id === "p4")!;
    expect(player).toMatchObject({ pts: 5, fgm: 2, fga: 3, threePm: 1, threePa: 2 });
  });

  it("gestisce percentuali senza tentativi", () => {
    expect(pct(0, 0)).toBe("—");
    expect(pct(2, 4)).toBe("50%");
  });

  it("calcola EFF FIBA e valutazione europea", () => {
    const enriched: GameState = {
      ...state,
      events: [
        ...state.events,
        { id: "5", type: "DREB", playerId: "p4", period: 1, clock: 560, createdAt: 5, label: "reb", points: 0 },
        { id: "6", type: "FOUL_DRAWN", playerId: "p4", period: 1, clock: 550, createdAt: 6, label: "fd", points: 0 },
        { id: "7", type: "FOUL", playerId: "p4", period: 1, clock: 540, createdAt: 7, label: "fc", points: 0 },
      ],
    };
    const player = calculateStats(enriched).find((row) => row.player.id === "p4")!;
    expect(player.eff).toBe(5);
    expect(player.pir).toBe(5);
  });

  it("include gli eventi non assegnati nei totali squadra", () => {
    const withTeamEvent: GameState = {
      ...state,
      events: [
        ...state.events,
        { id: "8", type: "OREB", period: 1, clock: 530, createdAt: 8, label: "team reb", points: 0 },
      ],
    };
    expect(calculateTeamStats(withTeamEvent).oreb).toBe(1);
    expect(calculateStats(withTeamEvent).every((row) => row.oreb === 0)).toBe(true);
  });

  it("separa completamente statistiche e punteggio avversario", () => {
    const tracked: GameState = {
      ...state,
      trackOpponent: true,
      opponentScore: 99,
      events: [
        ...state.events,
        { id: "opp1", type: "3PT_MADE", isOpponent: true, period: 1, clock: 520, createdAt: 9, label: "opp 3", points: 3 },
        { id: "opp2", type: "DREB", isOpponent: true, period: 1, clock: 510, createdAt: 10, label: "opp reb", points: 0 },
      ],
    };
    expect(teamScore(tracked)).toBe(5);
    expect(opponentScoreTotal(tracked)).toBe(3);
    expect(calculateTeamStats(tracked).dreb).toBe(0);
    expect(calculateOpponentStats(tracked)).toMatchObject({ pts: 3, threePm: 1, dreb: 1 });
  });

  it("conta i punti in contropiede senza duplicare il punteggio", () => {
    const transition: GameState = {
      ...state,
      trackOpponent: true,
      events: [
        ...state.events,
        { id: "fb1", type: "2PT_MADE", fastBreak: true, period: 1, clock: 500, createdAt: 11, label: "cp", points: 2 },
        { id: "fb2", type: "3PT_MADE", fastBreak: true, isOpponent: true, period: 1, clock: 490, createdAt: 12, label: "opp cp", points: 3 },
      ],
    };
    expect(teamScore(transition)).toBe(7);
    expect(calculateTeamStats(transition).fastBreakPoints).toBe(2);
    expect(calculateOpponentStats(transition).fastBreakPoints).toBe(3);
  });

  it("attribuisce le correzioni del punteggio avversario al periodo", () => {
    const manualOpponent: GameState = {
      ...state,
      trackOpponent: false,
      opponentScore: 0,
      events: [
        ...state.events,
        { id: "opp-adjust", type: "SCORE_ADJUST", isOpponent: true, period: 2, clock: 420, createdAt: 13, label: "opp +1", points: 1 },
      ],
    };
    expect(opponentScoreTotal(manualOpponent)).toBe(1);
    expect(calculateLine(manualOpponent.events.filter((event) => event.isOpponent && event.period === 2)).pts).toBe(1);
  });

  it("calcola minuti, plus/minus e stint dei quintetti", () => {
    const starters = initialState.roster.slice(0, 5).map((player) => player.id);
    const incoming = initialState.roster[5].id;
    const lineupState: GameState = {
      ...initialState,
      startingLineup: starters,
      lineup: [...starters.slice(0, 4), incoming],
      period: 1,
      clock: 480,
      events: [
        { id: "own-2", type: "2PT_MADE", playerId: starters[0], period: 1, clock: 570, createdAt: 1, label: "+2", points: 2 },
        { id: "opp-3", type: "3PT_MADE", isOpponent: true, period: 1, clock: 550, createdAt: 2, label: "+3", points: 3 },
        { id: "sub", type: "SUB", playerId: incoming, secondaryPlayerId: starters[4], period: 1, clock: 540, createdAt: 3, label: "cambio", points: 0 },
        { id: "own-3", type: "3PT_MADE", playerId: incoming, period: 1, clock: 500, createdAt: 4, label: "+3", points: 3 },
      ],
    };
    const stints = calculateLineupStints(lineupState);
    expect(stints).toHaveLength(2);
    expect(stints[0]).toMatchObject({ seconds: 60, pointsFor: 2, pointsAgainst: 3, plusMinus: -1 });
    expect(stints[1]).toMatchObject({ seconds: 60, pointsFor: 3, pointsAgainst: 0, plusMinus: 3 });
    const participation = calculatePlayerParticipation(lineupState);
    expect(participation[starters[0]]).toEqual({ seconds: 120, plusMinus: 2 });
    expect(participation[starters[4]]).toEqual({ seconds: 60, plusMinus: -1 });
    expect(participation[incoming]).toEqual({ seconds: 60, plusMinus: 3 });
  });
});
