import {
  ArchiveError,
  type ArchivedGame,
  type CreateGame,
  type CreateTeam,
  type DeleteOptions,
  type GameListFilters,
  type RosterPlayer,
  type Team,
} from "../models/archive";
import type { ArchiveRepository } from "./archiveRepository";

const clone = <T>(value: T): T => structuredClone(value);
const byUpdatedDesc = <T extends { updatedAt: number }>(a: T, b: T) => b.updatedAt - a.updatedAt;

export class MemoryArchiveRepository implements ArchiveRepository {
  protected teams = new Map<string, Team>();
  protected rosters = new Map<string, RosterPlayer[]>();
  protected games = new Map<string, ArchivedGame>();

  async createTeam(input: CreateTeam) {
    const id = input.id ?? crypto.randomUUID();
    if (this.teams.has(id)) throw new ArchiveError("DUPLICATE", `Team ${id} already exists`);
    if (!input.name.trim()) throw new ArchiveError("INVALID", "Team name is required");
    const now = Date.now();
    const team: Team = { ...input, name: input.name.trim(), id, createdAt: now, updatedAt: now };
    this.teams.set(id, clone(team));
    return clone(team);
  }

  async listTeams() {
    return [...this.teams.values()].sort(byUpdatedDesc).map(clone);
  }

  async getTeam(id: string) {
    const item = this.teams.get(id);
    return item && clone(item);
  }

  async updateTeam(id: string, patch: Partial<Pick<Team, "name" | "color" | "season" | "logoUrl" | "clubName" | "category">>) {
    const current = this.teams.get(id);
    if (!current) throw new ArchiveError("NOT_FOUND", `Team ${id} not found`);
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new ArchiveError("INVALID", "Team name is required");
    }
    const next = { ...current, ...patch, name: patch.name?.trim() ?? current.name, updatedAt: Date.now() };
    this.teams.set(id, clone(next));
    return clone(next);
  }

  async deleteTeam(id: string, options: DeleteOptions = {}) {
    if (!this.teams.has(id)) throw new ArchiveError("NOT_FOUND", `Team ${id} not found`);
    const related = [...this.games.values()].filter((game) => game.teamId === id);
    if (related.length && !options.force) {
      throw new ArchiveError("TEAM_HAS_GAMES", "Team has archived games");
    }
    related.forEach((game) => this.games.delete(game.id));
    this.rosters.delete(id);
    this.teams.delete(id);
  }

  async replaceRoster(teamId: string, players: Omit<RosterPlayer, "teamId">[]) {
    if (!this.teams.has(teamId)) throw new ArchiveError("NOT_FOUND", `Team ${teamId} not found`);
    const ids = new Set<string>();
    const numbers = new Set<number>();
    const roster = players.map((player) => {
      if (ids.has(player.id)) throw new ArchiveError("DUPLICATE", `Duplicate player ${player.id}`);
      if (numbers.has(player.number)) throw new ArchiveError("DUPLICATE", `Duplicate jersey ${player.number}`);
      ids.add(player.id);
      numbers.add(player.number);
      return { ...clone(player), teamId };
    });
    this.rosters.set(teamId, roster);
    return clone(roster);
  }

  async getRoster(teamId: string) {
    return clone(this.rosters.get(teamId) ?? []);
  }

  async createGame(input: CreateGame) {
    if (!this.teams.has(input.teamId)) throw new ArchiveError("NOT_FOUND", `Team ${input.teamId} not found`);
    const id = input.id ?? crypto.randomUUID();
    if (this.games.has(id)) throw new ArchiveError("DUPLICATE", `Game ${id} already exists`);
    const now = Date.now();
    const status = input.status ?? "draft";
    const game: ArchivedGame = {
      ...clone(input),
      opponentName: input.opponentName.trim(),
      id,
      status,
      createdAt: now,
      updatedAt: now,
      completedAt: status === "completed" ? now : undefined,
    };
    this.games.set(id, clone(game));
    return clone(game);
  }

  async listGames(filters: GameListFilters = {}) {
    return [...this.games.values()]
      .filter((game) => !filters.teamId || game.teamId === filters.teamId)
      .filter((game) => !filters.status || game.status === filters.status)
      .filter((game) => filters.from === undefined || game.scheduledAt >= filters.from)
      .filter((game) => filters.to === undefined || game.scheduledAt <= filters.to)
      .sort(byUpdatedDesc)
      .map(clone);
  }

  async getGame(id: string) {
    const item = this.games.get(id);
    return item && clone(item);
  }

  async updateGame(
    id: string,
    patch: Partial<Pick<ArchivedGame, "opponentName" | "scheduledAt" | "status" | "state">>,
  ) {
    const current = this.games.get(id);
    if (!current) throw new ArchiveError("NOT_FOUND", `Game ${id} not found`);
    const now = Date.now();
    const next: ArchivedGame = {
      ...current,
      ...clone(patch),
      opponentName: patch.opponentName?.trim() ?? current.opponentName,
      updatedAt: now,
      completedAt: patch.status === "completed" ? current.completedAt ?? now
        : patch.status ? undefined : current.completedAt,
    };
    this.games.set(id, clone(next));
    return clone(next);
  }

  async deleteGame(id: string, options: DeleteOptions = {}) {
    const game = this.games.get(id);
    if (!game) throw new ArchiveError("NOT_FOUND", `Game ${id} not found`);
    if (game.status === "completed" && !options.force) {
      throw new ArchiveError("PROTECTED", "Completed games require force deletion");
    }
    this.games.delete(id);
  }
}
