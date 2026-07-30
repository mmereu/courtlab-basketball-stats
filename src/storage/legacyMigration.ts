import type { GameState } from "../domain";
import type { ArchiveRepository } from "./archiveRepository";

export const LEGACY_STORAGE_KEY = "courtlab-release-a";
export const MIGRATION_MARKER_KEY = "courtlab-archive-v1-migrated";

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Imports the Release A browser save exactly once; the legacy value is retained as recovery backup. */
export async function migrateLegacyGame(
  repository: ArchiveRepository,
  storage: KeyValueStorage = localStorage,
) {
  if (storage.getItem(MIGRATION_MARKER_KEY)) return undefined;
  const raw = storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    storage.setItem(MIGRATION_MARKER_KEY, "empty");
    return undefined;
  }

  let state: GameState;
  try {
    state = JSON.parse(raw) as GameState;
    if (!state.teamName || !Array.isArray(state.roster) || !Array.isArray(state.events)) {
      throw new Error("Invalid legacy game");
    }
  } catch {
    // Do not mark corrupt data as migrated: a later app version can recover it.
    return undefined;
  }

  const isUntouchedDemo = state.teamName === "Tigers Cagliari"
    && state.roster.length === 9
    && state.roster.every((player) => /^p(4|5|7|8|9|10|12|14|15)$/.test(player.id))
    && state.events.length === 0;
  if (isUntouchedDemo) {
    storage.setItem(MIGRATION_MARKER_KEY, "demo-skipped");
    return undefined;
  }

  const team = await repository.createTeam({
    name: state.teamName,
    color: state.teamColor,
    season: String(new Date().getFullYear()),
  });
  await repository.replaceRoster(team.id, state.roster.map((player) => ({
    ...player,
    active: true,
  })));
  const game = await repository.createGame({
    teamId: team.id,
    opponentName: state.opponentName,
    scheduledAt: Date.now(),
    status: state.screen === "report" ? "completed" : state.screen === "live" ? "live" : "draft",
    state: { ...state, running: false },
  });
  storage.setItem(MIGRATION_MARKER_KEY, game.id);
  return game;
}
