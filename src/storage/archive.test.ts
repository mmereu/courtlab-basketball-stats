import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "../domain";
import { ArchiveError } from "../models/archive";
import { LEGACY_STORAGE_KEY, MIGRATION_MARKER_KEY, migrateLegacyGame } from "./legacyMigration";
import { MemoryArchiveRepository } from "./memoryArchive";

const player = {
  id: "p1",
  number: 4,
  name: "Luca Rossi",
  shortName: "Rossi",
  role: "Play",
  color: "#fff",
  active: true,
};

describe("archive repository contract", () => {
  let repository: MemoryArchiveRepository;

  beforeEach(() => {
    repository = new MemoryArchiveRepository();
  });

  it("creates and updates teams and persists a validated roster", async () => {
    const team = await repository.createTeam({ id: "t1", name: " Tigers ", color: "#f00", season: "26/27" });
    expect(team.name).toBe("Tigers");
    await repository.replaceRoster(team.id, [player]);
    expect(await repository.getRoster(team.id)).toEqual([{ ...player, teamId: "t1" }]);
    expect((await repository.updateTeam(team.id, { season: "27/28" })).season).toBe("27/28");
  });

  it("rejects duplicate jersey numbers", async () => {
    const team = await repository.createTeam({ name: "Tigers", color: "#f00", season: "26/27" });
    await expect(repository.replaceRoster(team.id, [
      player,
      { ...player, id: "p2", number: 4 },
    ])).rejects.toMatchObject({ code: "DUPLICATE" });
  });

  it("supports multiple games, statuses and filters", async () => {
    const team = await repository.createTeam({ name: "Tigers", color: "#f00", season: "26/27" });
    await repository.createGame({
      id: "g1", teamId: team.id, opponentName: "A", scheduledAt: 100, state: initialState,
    });
    await repository.createGame({
      id: "g2", teamId: team.id, opponentName: "B", scheduledAt: 200,
      status: "live", state: { ...initialState, screen: "live" },
    });
    expect(await repository.listGames({ status: "live" })).toHaveLength(1);
    const completed = await repository.updateGame("g2", { status: "completed" });
    expect(completed.completedAt).toBeTypeOf("number");
    expect(await repository.listGames({ from: 150, to: 250 })).toHaveLength(1);
  });

  it("protects completed games and teams with history from accidental deletion", async () => {
    const team = await repository.createTeam({ name: "Tigers", color: "#f00", season: "26/27" });
    await repository.createGame({
      id: "g1", teamId: team.id, opponentName: "A", scheduledAt: 100,
      status: "completed", state: initialState,
    });
    await expect(repository.deleteGame("g1")).rejects.toEqual(
      expect.objectContaining<Partial<ArchiveError>>({ code: "PROTECTED" }),
    );
    await expect(repository.deleteTeam(team.id)).rejects.toMatchObject({ code: "TEAM_HAS_GAMES" });
    await repository.deleteTeam(team.id, { force: true });
    expect(await repository.getGame("g1")).toBeUndefined();
  });

  it("returns defensive copies so callers cannot corrupt stored data", async () => {
    const team = await repository.createTeam({ name: "Tigers", color: "#f00", season: "26/27" });
    const game = await repository.createGame({
      teamId: team.id, opponentName: "A", scheduledAt: 100, state: initialState,
    });
    game.state.events.push({ id: "bad", type: "AST", period: 1, clock: 1, createdAt: 1, label: "", points: 0 });
    expect((await repository.getGame(game.id))?.state.events).toHaveLength(0);
  });
});

describe("legacy migration", () => {
  it("imports the old save once and keeps it as backup", async () => {
    const values = new Map<string, string>([
      [LEGACY_STORAGE_KEY, JSON.stringify({ ...initialState, screen: "live", running: true })],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const repository = new MemoryArchiveRepository();
    const game = await migrateLegacyGame(repository, storage);
    expect(game?.status).toBe("live");
    expect(game?.state.running).toBe(false);
    expect(await repository.getRoster(game!.teamId)).toHaveLength(initialState.roster.length);
    expect(values.get(MIGRATION_MARKER_KEY)).toBe(game?.id);
    expect(values.has(LEGACY_STORAGE_KEY)).toBe(true);
    expect(await migrateLegacyGame(repository, storage)).toBeUndefined();
    expect(await repository.listGames()).toHaveLength(1);
  });

  it("does not mark corrupt legacy data as migrated", async () => {
    const values = new Map([[LEGACY_STORAGE_KEY, "{broken"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    expect(await migrateLegacyGame(new MemoryArchiveRepository(), storage)).toBeUndefined();
    expect(values.has(MIGRATION_MARKER_KEY)).toBe(false);
  });
});

