import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerStats } from "../domain";
import BoxScore from "./BoxScore";

const stats: PlayerStats[] = [{
  player: {
    id: "p4", number: 4, name: "Giocatore 4", shortName: "G4",
    role: "Play", color: "#fff",
  },
  pts: 9, fgm: 3, fga: 5, twoPm: 2, twoPa: 3, threePm: 1, threePa: 2,
  ftm: 2, fta: 2, oreb: 1, dreb: 2, ast: 4, stl: 3, tov: 1, blk: 2,
  foul: 2, foulDrawn: 3, blockedAgainst: 1, eff: 18, pir: 18,
  fastBreakPoints: 5, secondsPlayed: 300, plusMinus: 4,
}];

describe("full report box score", () => {
  it("shows every requested statistic after steals for players and totals", () => {
    render(<BoxScore stats={stats} fastBreakPointsAgainst={6} />);
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);

    expect(headers.slice(-8)).toEqual(["AS", "STF", "STS", "FS", "FC", "CPF", "CPS", "VAL"]);
    expect(within(table).getAllByText("18")).toHaveLength(2);
    expect(within(table).getByText("TOTALE")).toBeTruthy();
  });
});
