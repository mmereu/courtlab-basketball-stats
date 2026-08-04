import { describe, expect, it } from "vitest";
import { decideSync, mergeSnapshots, snapshotIsEmpty, snapshotsEqual } from "./autoSync";
import type { CloudSnapshot } from "./cloud";

const empty: CloudSnapshot = { teams: [], games: [], rosters: {} };

describe("automatic cloud synchronisation", () => {
  it("uploads queued local changes when the cloud base is unchanged", () => {
    expect(decideSync({ version: 4, dirty: true }, 4, true)).toBe("upload");
  });

  it("downloads a newer cloud version when there are no local changes", () => {
    expect(decideSync({ version: 4, dirty: false }, 5, true)).toBe("download");
  });

  it("never overwrites simultaneous changes silently", () => {
    expect(decideSync({ version: 4, dirty: true }, 5, true)).toBe("conflict");
  });

  it("recognises empty and identical workspaces", () => {
    expect(snapshotIsEmpty(empty)).toBe(true);
    expect(snapshotsEqual(empty, structuredClone(empty))).toBe(true);
    expect(snapshotIsEmpty({
      ...empty,
      teams: [{
        id: "u15", name: "Under 15", color: "#fff", season: "2026",
        createdAt: 1, updatedAt: 1,
      }],
    })).toBe(false);
  });

  it("unisce le partite create su dispositivi diversi senza perderne una", () => {
    const team = { id: "u15", name: "U15", color: "#fff", season: "2026", createdAt: 1, updatedAt: 1 };
    const game = (id: string, updatedAt: number) => ({
      id, teamId: team.id, opponentName: id, scheduledAt: 1, status: "draft" as const,
      state: {} as CloudSnapshot["games"][number]["state"], createdAt: updatedAt, updatedAt,
    });
    const local = { teams: [team], rosters: { u15: [] }, games: [game("pc", 2)] };
    const remote = { teams: [team], rosters: { u15: [] }, games: [game("cell", 3)] };

    expect(mergeSnapshots(local, remote).games.map((item) => item.id)).toEqual(["pc", "cell"]);
  });
});
