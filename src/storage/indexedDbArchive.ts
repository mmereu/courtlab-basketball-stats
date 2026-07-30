import type { ArchivedGame, RosterPlayer, Team } from "../models/archive";
import { MemoryArchiveRepository } from "./memoryArchive";

const DATABASE_NAME = "courtlab";
const DATABASE_VERSION = 1;
const SNAPSHOT_KEY = "archive-v1";

type Snapshot = { teams: Team[]; rosters: RosterPlayer[][]; games: ArchivedGame[] };

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/**
 * IndexedDB-backed archive. Mutations are serialized as one versioned snapshot,
 * making team/roster/game cascades atomic. The public API remains record-oriented.
 */
export class IndexedDbArchiveRepository extends MemoryArchiveRepository {
  private db?: IDBDatabase;
  private writeQueue = Promise.resolve();

  static async open(name = DATABASE_NAME) {
    const repository = new IndexedDbArchiveRepository();
    const request = indexedDB.open(name, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots");
    };
    repository.db = await requestResult(request);
    repository.db.onversionchange = () => repository.db?.close();
    await repository.hydrate();
    return repository;
  }

  close() {
    this.db?.close();
    this.db = undefined;
  }

  private async hydrate() {
    const tx = this.db!.transaction("snapshots", "readonly");
    const snapshot = await requestResult<Snapshot | undefined>(
      tx.objectStore("snapshots").get(SNAPSHOT_KEY),
    );
    snapshot?.teams.forEach((item) => this.teams.set(item.id, item));
    snapshot?.rosters.forEach((items) => {
      if (items[0]) this.rosters.set(items[0].teamId, items);
    });
    snapshot?.games.forEach((item) => this.games.set(item.id, item));
  }

  private persist() {
    const snapshot: Snapshot = {
      teams: [...this.teams.values()],
      rosters: [...this.rosters.values()],
      games: [...this.games.values()],
    };
    this.writeQueue = this.writeQueue.then(async () => {
      const tx = this.db!.transaction("snapshots", "readwrite");
      await requestResult(tx.objectStore("snapshots").put(snapshot, SNAPSHOT_KEY));
    });
    return this.writeQueue;
  }

  override async createTeam(input: Parameters<MemoryArchiveRepository["createTeam"]>[0]) {
    const value = await super.createTeam(input); await this.persist(); return value;
  }
  override async updateTeam(...args: Parameters<MemoryArchiveRepository["updateTeam"]>) {
    const value = await super.updateTeam(...args); await this.persist(); return value;
  }
  override async deleteTeam(...args: Parameters<MemoryArchiveRepository["deleteTeam"]>) {
    await super.deleteTeam(...args); await this.persist();
  }
  override async replaceRoster(...args: Parameters<MemoryArchiveRepository["replaceRoster"]>) {
    const value = await super.replaceRoster(...args); await this.persist(); return value;
  }
  override async createGame(...args: Parameters<MemoryArchiveRepository["createGame"]>) {
    const value = await super.createGame(...args); await this.persist(); return value;
  }
  override async updateGame(...args: Parameters<MemoryArchiveRepository["updateGame"]>) {
    const value = await super.updateGame(...args); await this.persist(); return value;
  }
  override async deleteGame(...args: Parameters<MemoryArchiveRepository["deleteGame"]>) {
    await super.deleteGame(...args); await this.persist();
  }
}

