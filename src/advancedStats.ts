import { calculateLine, GameEvent } from "./domain";

export type AdvancedStats = {
  possessions: number;
  effectiveFieldGoalPct: number | null;
  trueShootingPct: number | null;
  turnoverRate: number | null;
  offensiveReboundPct: number | null;
  freeThrowRate: number | null;
  offensiveRating: number | null;
  assistTurnoverRatio: number | null;
};

const divide = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null;

/**
 * Calcola gli indicatori avanzati disponibili dal box score.
 *
 * I possessi sono una stima FIBA/NBA-style:
 * FGA + 0,44 × FTA - OREB + TOV.
 * La percentuale di rimbalzo offensivo richiede i rimbalzi difensivi avversari;
 * se non sono disponibili restituisce null invece di inventare il dato.
 */
export function calculateAdvancedStats(
  events: GameEvent[],
  opponentDefensiveRebounds?: number,
): AdvancedStats {
  const line = calculateLine(events);
  const possessions = Math.max(0, line.fga + 0.44 * line.fta - line.oreb + line.tov);
  const effectiveFieldGoalPct = divide(line.fgm + 0.5 * line.threePm, line.fga);
  const trueShootingPct = divide(line.pts, 2 * (line.fga + 0.44 * line.fta));
  const turnoverRate = divide(line.tov, possessions);
  const offensiveReboundPct =
    opponentDefensiveRebounds === undefined
      ? null
      : divide(line.oreb, line.oreb + opponentDefensiveRebounds);
  const freeThrowRate = divide(line.ftm, line.fga);
  const offensiveRating = possessions > 0 ? (100 * line.pts) / possessions : null;
  const assistTurnoverRatio = divide(line.ast, line.tov);

  return {
    possessions,
    effectiveFieldGoalPct,
    trueShootingPct,
    turnoverRate,
    offensiveReboundPct,
    freeThrowRate,
    offensiveRating,
    assistTurnoverRatio,
  };
}

export function formatAdvancedPercent(value: number | null) {
  return value === null ? "N/D" : `${(value * 100).toFixed(1)}%`;
}
