import { describe, expect, it } from "vitest";
import type { GameState } from "./domain";
import { periodColumns, periodRows } from "./exports";

describe("export per quarto", () => {
  it("espone RT e tiene PP accanto a PR nello stesso ordine dei valori", () => {
    const state = {
      period: 1,
      events: [
        { id: "r", type: "DREB", label: "Rimbalzo difensivo", points: 0, period: 1, clock: 590 },
        { id: "s", type: "STL", label: "Palla rubata", points: 0, period: 1, clock: 580 },
        { id: "t", type: "TOV", label: "Palla persa", points: 0, period: 1, clock: 570 },
        { id: "a", type: "AST", label: "Assist", points: 0, period: 1, clock: 560 },
      ],
    } as GameState;

    expect(periodColumns).toEqual([
      "Periodo", "PT", "PT avversario", "2P", "3P", "TL", "RT", "PR", "PP", "AS", "CPF", "CPS", "VAL",
    ]);
    expect(periodRows(state)[0].slice(6, 10)).toEqual([1, 1, 1, 1]);
  });
});
