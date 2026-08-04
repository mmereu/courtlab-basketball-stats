import type { CloudSnapshot } from "./cloud";

export type CloudSyncStatus =
  | "local"
  | "syncing"
  | "synced"
  | "offline"
  | "conflict"
  | "error";

export type SyncMetadata = {
  version: number;
  dirty: boolean;
};

export type SyncDecision =
  | "upload"
  | "download"
  | "conflict"
  | "idle";

const META_PREFIX = "courtlab-auto-sync:";

export function snapshotIsEmpty(snapshot: CloudSnapshot) {
  return snapshot.teams.length === 0
    && snapshot.games.length === 0
    && Object.values(snapshot.rosters).every((roster) => roster.length === 0);
}

export function snapshotsEqual(left: CloudSnapshot, right: CloudSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Conservatively joins two independently edited devices. New teams and games
 * are kept from both sides; the newest copy wins only when the same id exists.
 */
export function mergeSnapshots(local: CloudSnapshot, remote: CloudSnapshot): CloudSnapshot {
  const mergeById = <T extends { id: string; createdAt: number; updatedAt: number }>(left: T[], right: T[]) => {
    const values = new Map<string, T>();
    for (const item of [...right, ...left]) {
      const current = values.get(item.id);
      if (!current || item.updatedAt >= current.updatedAt) values.set(item.id, item);
    }
    return [...values.values()].sort((a, b) => a.createdAt - b.createdAt);
  };
  const teams = mergeById(local.teams, remote.teams);
  const games = mergeById(local.games, remote.games);
  const localTeams = new Map(local.teams.map((team) => [team.id, team]));
  const remoteTeams = new Map(remote.teams.map((team) => [team.id, team]));
  const rosters = Object.fromEntries(teams.map((team) => {
    const localTeam = localTeams.get(team.id);
    const remoteTeam = remoteTeams.get(team.id);
    const useLocal = localTeam && (!remoteTeam || localTeam.updatedAt >= remoteTeam.updatedAt);
    return [team.id, structuredClone((useLocal ? local.rosters : remote.rosters)[team.id] ?? [])];
  }));
  return { teams: structuredClone(teams), games: structuredClone(games), rosters };
}

export function decideSync(
  metadata: SyncMetadata,
  remoteVersion: number,
  remoteHasData: boolean,
): SyncDecision {
  if (remoteVersion > metadata.version) {
    return metadata.dirty ? "conflict" : "download";
  }
  if (metadata.dirty) return "upload";
  if (remoteHasData && remoteVersion < metadata.version) return "conflict";
  return "idle";
}

export function loadSyncMetadata(workspaceId: string): SyncMetadata | undefined {
  try {
    const raw = localStorage.getItem(`${META_PREFIX}${workspaceId}`);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<SyncMetadata>;
    if (!Number.isInteger(value.version) || typeof value.dirty !== "boolean") return undefined;
    return { version: value.version!, dirty: value.dirty };
  } catch {
    return undefined;
  }
}

export function saveSyncMetadata(workspaceId: string, metadata: SyncMetadata) {
  localStorage.setItem(`${META_PREFIX}${workspaceId}`, JSON.stringify(metadata));
}

export function clearSyncMetadata(workspaceId: string) {
  localStorage.removeItem(`${META_PREFIX}${workspaceId}`);
}
