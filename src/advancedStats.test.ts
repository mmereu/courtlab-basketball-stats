import { describe, expect, it } from "vitest";
import { calculateAdvancedStats, formatAdvancedPercent } from "./advancedStats";
import { GameEvent } from "./domain";

const event = (
  id: string,
  type: GameEvent["type"],
  points = 0,
): GameEvent => ({
  id,
  type,
  period: 1,
  clock: 600,
  createdAt: 1,
  label: type,
  points,
});

describe("advanced stats", () => {
  it("calcola possessi, eFG, TS e rating senza arrotondare i dati grezzi", () => {
    const events = [
      event("1", "2PT_MADE", 2),
      event("2", "3PT_MADE", 3),
      event("3", "3PT_MISS"),
      event("4", "1PT_MADE", 1),
      event("5", "1PT_MISS"),
      event("6", "OREB"),
      event("7", "TOV"),
      event("8", "AST"),
    ];

    const result = calculateAdvancedStats(events, 4);
    expect(result.possessions).toBeCloseTo(3.88);
    expect(result.effectiveFieldGoalPct).toBeCloseTo(2.5 / 3);
    expect(result.trueShootingPct).toBeCloseTo(6 / (2 * 3.88));
    expect(result.offensiveReboundPct).toBeCloseTo(0.2);
    expect(result.offensiveRating).toBeCloseTo((600 / 3.88));
    expect(result.assistTurnoverRatio).toBe(1);
  });

  it("restituisce N/D quando il denominatore o il dato avversario manca", () => {
    const result = calculateAdvancedStats([]);
    expect(result.effectiveFieldGoalPct).toBeNull();
    expect(result.offensiveReboundPct).toBeNull();
    expect(formatAdvancedPercent(null)).toBe("N/D");
  });
});
