import type {
  ArchivedGame,
  CreateGame,
  CreateTeam,
  DeleteOptions,
  GameListFilters,
  RosterPlayer,
  Team,
} from "../models/archive";

export interface ArchiveRepository {
  createTeam(input: CreateTeam): Promise<Team>;
  listTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  updateTeam(id: string, patch: Partial<Pick<Team, "name" | "color" | "season" | "logoUrl" | "clubName" | "category">>): Promise<Team>;
  deleteTeam(id: string, options?: DeleteOptions): Promise<void>;

  replaceRoster(teamId: string, players: Omit<RosterPlayer, "teamId">[]): Promise<RosterPlayer[]>;
  getRoster(teamId: string): Promise<RosterPlayer[]>;

  createGame(input: CreateGame): Promise<ArchivedGame>;
  listGames(filters?: GameListFilters): Promise<ArchivedGame[]>;
  getGame(id: string): Promise<ArchivedGame | undefined>;
  updateGame(
    id: string,
    patch: Partial<Pick<ArchivedGame, "opponentName" | "scheduledAt" | "status" | "state">>,
  ): Promise<ArchivedGame>;
  deleteGame(id: string, options?: DeleteOptions): Promise<void>;
}
