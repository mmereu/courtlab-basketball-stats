import type { GameState, Player } from "../domain";

export type GameStatus = "draft" | "live" | "completed";

export type Team = {
  id: string;
  name: string;
  color: string;
  season: string;
  logoUrl?: string;
  clubName?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
};

export type RosterPlayer = Player & {
  teamId: string;
  active: boolean;
};

export type ArchivedGame = {
  id: string;
  teamId: string;
  opponentName: string;
  scheduledAt: number;
  status: GameStatus;
  state: GameState;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type CreateTeam = Pick<Team, "name" | "color" | "season" | "logoUrl" | "clubName" | "category"> & { id?: string };
export type CreateGame = Pick<ArchivedGame, "teamId" | "opponentName" | "scheduledAt" | "state"> & {
  id?: string;
  status?: GameStatus;
};

export type GameListFilters = {
  teamId?: string;
  status?: GameStatus;
  from?: number;
  to?: number;
};

export type DeleteOptions = {
  /** Completed games and teams with games are protected unless explicitly forced. */
  force?: boolean;
};

export class ArchiveError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "DUPLICATE"
      | "INVALID"
      | "PROTECTED"
      | "TEAM_HAS_GAMES",
    message: string,
  ) {
    super(message);
    this.name = "ArchiveError";
  }
}
