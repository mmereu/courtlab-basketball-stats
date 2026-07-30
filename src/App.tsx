import { useEffect, useRef, useState } from "react";
import Setup from "./components/Setup";
import LiveGame, { Report } from "./components/LiveGame";
import WorkspaceDashboard, {
  type ArchivedGame as DashboardGame,
  type TeamProfile,
} from "./components/WorkspaceDashboard";
import CloudAccount from "./components/CloudAccount";
import {
  acceptCloudInvitation, clearCloudToken, cloudToken, deleteCloudAccount,
  getCloudSnapshot, getCloudUser, loginCloud, registerCloud, saveCloudSnapshot,
  listCloudRevisions, restoreCloudRevision,
  type CloudSnapshot, type CloudUser,
} from "./cloud";
import {
  clearSyncMetadata, decideSync, loadSyncMetadata, saveSyncMetadata,
  snapshotIsEmpty, snapshotsEqual, type CloudSyncStatus,
} from "./autoSync";
import { initialState, opponentScoreTotal, teamScore, type GameState, type Player } from "./domain";
import {
  IndexedDbArchiveRepository,
  migrateLegacyGame,
  type ArchiveRepository,
  type ArchivedGame,
  type Team,
} from "./storage";
import { useGame } from "./useGame";

type WorkspaceData = { teams: Team[]; games: ArchivedGame[]; rosters: Record<string, Player[]> };
const DEFAULT_TEAM_LOGO = "/novara-basket-v4.jpeg";
const currentTeamLogo = (logoUrl?: string) =>
  !logoUrl
    || logoUrl === "/novara-basket.png"
    || logoUrl === "/novara-basket-v2.png"
    || logoUrl === "/novara-basket-v3.png"
    ? DEFAULT_TEAM_LOGO
    : logoUrl;
const logoForTeam = (team?: Team, logoUrl?: string) =>
  team && `${team.clubName ?? ""} ${team.name}`.toLocaleLowerCase("it").includes("novara")
    ? DEFAULT_TEAM_LOGO
    : currentTeamLogo(logoUrl);

export default function App() {
  const game = useGame();
  const { state, patch } = game;
  const [repository, setRepository] = useState<ArchiveRepository>();
  const [workspace, setWorkspace] = useState<WorkspaceData>({ teams: [], games: [], rosters: {} });
  const [selectedTeamId, setSelectedTeamId] = useState<string>();
  const [activeGameId, setActiveGameId] = useState<string>();
  const [view, setView] = useState<"loading" | "workspace" | "game">("loading");
  const [cloudUser, setCloudUser] = useState<CloudUser>();
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState<string>();
  const [lastSync, setLastSync] = useState<number>();
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>("local");
  const saveTimer = useRef<number | undefined>(undefined);
  const autoSyncTimer = useRef<number | undefined>(undefined);
  const syncRunning = useRef(false);
  const cloudVersionRef = useRef(0);
  const cloudDirtyRef = useRef(false);
  const cloudUserRef = useRef<CloudUser | undefined>(undefined);
  const runAutoSyncRef = useRef<() => Promise<void>>(async () => undefined);
  const skipNextGameSave = useRef(false);

  const setTrackedCloudVersion = (version: number) => {
    cloudVersionRef.current = version;
  };

  const persistCloudMetadata = (dirty = cloudDirtyRef.current) => {
    const user = cloudUserRef.current;
    if (!user) return;
    cloudDirtyRef.current = dirty;
    saveSyncMetadata(user.workspaceId, { version: cloudVersionRef.current, dirty });
  };

  const queueAutomaticSync = (delay = 900) => {
    window.clearTimeout(autoSyncTimer.current);
    autoSyncTimer.current = window.setTimeout(() => void runAutoSyncRef.current(), delay);
  };

  const markCloudDirty = () => {
    const user = cloudUserRef.current;
    if (!user || user.role === "viewer") return;
    persistCloudMetadata(true);
    setCloudStatus(navigator.onLine ? "local" : "offline");
    queueAutomaticSync();
  };

  const refresh = async (repo = repository) => {
    if (!repo) return;
    const [teams, games] = await Promise.all([repo.listTeams(), repo.listGames()]);
    const rosterEntries = await Promise.all(teams.map(async (team) => {
      const roster = await repo.getRoster(team.id);
      return [team.id, roster.filter((player) => player.active).map(({ teamId: _teamId, active: _active, ...player }) => player)] as const;
    }));
    setWorkspace({ teams, games, rosters: Object.fromEntries(rosterEntries) });
    setSelectedTeamId((current) =>
      current && teams.some((team) => team.id === current) ? current : teams[0]?.id);
  };

  useEffect(() => {
    let cancelled = false;
    IndexedDbArchiveRepository.open().then(async (repo) => {
      await migrateLegacyGame(repo);
      if (cancelled) return;
      setRepository(repo);
      const teams = await repo.listTeams();
      const games = await repo.listGames();
      if (cancelled) return;
      const rosterEntries = await Promise.all(teams.map(async (team) => {
        const roster = await repo.getRoster(team.id);
        return [team.id, roster.filter((player) => player.active).map(({ teamId: _teamId, active: _active, ...player }) => player)] as const;
      }));
      setWorkspace({ teams, games, rosters: Object.fromEntries(rosterEntries) });
      setSelectedTeamId(teams[0]?.id);
      setView("workspace");
    }).catch((error) => {
      console.error("Archivio locale non disponibile", error);
      setView("workspace");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!repository || !activeGameId || view !== "game") return;
    if (skipNextGameSave.current) {
      skipNextGameSave.current = false;
      return;
    }
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const status = state.screen === "report" ? "completed" : state.screen === "live" ? "live" : "draft";
      await repository.updateGame(activeGameId, {
        opponentName: state.opponentName,
        status,
        state: { ...state, running: false },
      });
      markCloudDirty();
    }, 250);
    return () => window.clearTimeout(saveTimer.current);
  }, [repository, activeGameId, state, view]);

  const teams: TeamProfile[] = workspace.teams.map((team) => ({
    id: team.id,
    name: team.name,
    season: team.season,
    color: team.color,
    logoUrl: logoForTeam(team, team.logoUrl),
    clubName: team.clubName,
    category: team.category,
    roster: workspace.rosters[team.id] ?? [],
  }));
  const dashboardGames: DashboardGame[] = workspace.games.map((item) => ({
    id: item.id,
    teamId: item.teamId,
    opponent: item.opponentName,
    date: new Date(item.scheduledAt).toISOString().slice(0, 10),
    teamScore: teamScore(item.state),
    opponentScore: opponentScoreTotal(item.state),
    status: item.status === "completed" ? "final" : item.status,
    updatedAt: new Date(item.updatedAt).toISOString(),
    state: item.state,
  }));

  const localSnapshot = async (repo = repository): Promise<CloudSnapshot> => {
    if (!repo) return { teams: [], games: [], rosters: {} };
    const [localTeams, localGames] = await Promise.all([repo.listTeams(), repo.listGames()]);
    const rosterEntries = await Promise.all(localTeams.map(async (team) => [
      team.id,
      await repo.getRoster(team.id),
    ] as const));
    return { teams: localTeams, games: localGames, rosters: Object.fromEntries(rosterEntries) };
  };
  const restoreSnapshot = async (snapshot: CloudSnapshot) => {
    if (!repository) return;
    const current = await repository.listTeams();
    for (const team of current) await repository.deleteTeam(team.id, { force: true });
    for (const team of snapshot.teams) {
      await repository.createTeam({
        id: team.id, name: team.name, season: team.season, color: team.color,
        logoUrl: team.logoUrl, clubName: team.clubName, category: team.category,
      });
      await repository.replaceRoster(team.id, snapshot.rosters[team.id] ?? []);
    }
    for (const archived of snapshot.games) {
      await repository.createGame({
        id: archived.id,
        teamId: archived.teamId,
        opponentName: archived.opponentName,
        scheduledAt: archived.scheduledAt,
        status: archived.status,
        state: archived.state,
      });
    }
    await refresh(repository);
    if (activeGameId) {
      const archived = snapshot.games.find((item) => item.id === activeGameId);
      if (archived) {
        const team = snapshot.teams.find((item) => item.id === archived.teamId);
        skipNextGameSave.current = true;
        game.load({
          ...archived.state,
          teamLogoUrl: logoForTeam(team, archived.state.teamLogoUrl ?? team?.logoUrl),
          running: false,
        });
      } else {
        setActiveGameId(undefined);
        setView("workspace");
      }
    }
  };

  const resolveCloud = async (direction: "download" | "upload") => {
    const user = cloudUserRef.current;
    if (!repository || !user) return;
    setCloudBusy(true);
    setCloudStatus("syncing");
    setCloudError(undefined);
    try {
      const remote = await getCloudSnapshot();
      if (direction === "download") {
        if (!remote.payload) throw new Error("Il cloud non contiene ancora un archivio.");
        if (!window.confirm("Usare la versione cloud su questo dispositivo? La versione locale resterà nella cronologia cloud se era già stata sincronizzata.")) return;
        await restoreSnapshot(remote.payload);
        setTrackedCloudVersion(remote.version);
        persistCloudMetadata(false);
      } else {
        if (!window.confirm("Usare i dati di questo dispositivo come nuova versione cloud?")) return;
        const saved = await saveCloudSnapshot(await localSnapshot(), remote.version);
        setTrackedCloudVersion(saved.version);
        persistCloudMetadata(false);
      }
      setLastSync(Date.now());
      setCloudStatus("synced");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Sincronizzazione non riuscita");
      setCloudStatus(navigator.onLine ? "error" : "offline");
    } finally {
      setCloudBusy(false);
    }
  };

  const runAutomaticSync = async () => {
    const user = cloudUserRef.current;
    if (!repository || !user || syncRunning.current) return;
    if (!navigator.onLine) {
      setCloudStatus("offline");
      return;
    }
    syncRunning.current = true;
    setCloudBusy(true);
    setCloudStatus("syncing");
    setCloudError(undefined);
    try {
      const [remote, local] = await Promise.all([getCloudSnapshot(), localSnapshot()]);
      const metadata = {
        version: cloudVersionRef.current,
        dirty: cloudDirtyRef.current,
      };
      const decision = user.role === "viewer"
        ? remote.version > metadata.version ? "download" : "idle"
        : decideSync(metadata, remote.version, Boolean(remote.payload));
      if (decision === "conflict") {
        setCloudStatus("conflict");
        setCloudError("Modifiche presenti su due dispositivi. Scegli quale versione conservare: nessun dato è stato sovrascritto.");
        return;
      }
      if (decision === "download" && remote.payload) {
        await restoreSnapshot(remote.payload);
        setTrackedCloudVersion(remote.version);
        persistCloudMetadata(false);
      } else if (decision === "upload") {
        const saved = await saveCloudSnapshot(local, remote.version);
        setTrackedCloudVersion(saved.version);
        persistCloudMetadata(false);
      }
      setLastSync(Date.now());
      setCloudStatus("synced");
    } catch (error) {
      const value = error as Error & { code?: string };
      if (value.code === "VERSION_CONFLICT") {
        setCloudStatus("conflict");
        setCloudError("Il cloud è cambiato durante la sincronizzazione. Nessun dato è stato sovrascritto.");
      } else {
        setCloudStatus(navigator.onLine ? "error" : "offline");
        setCloudError(navigator.onLine ? value.message : undefined);
      }
    } finally {
      syncRunning.current = false;
      setCloudBusy(false);
    }
  };
  runAutoSyncRef.current = runAutomaticSync;

  const startCloudSession = async (user: CloudUser) => {
    if (!repository) return;
    cloudUserRef.current = user;
    setCloudUser(user);
    const [remote, local] = await Promise.all([getCloudSnapshot(), localSnapshot(repository)]);
    const stored = loadSyncMetadata(user.workspaceId);
    if (stored) {
      setTrackedCloudVersion(stored.version);
      cloudDirtyRef.current = stored.dirty;
      queueAutomaticSync(0);
      return;
    }
    if (!remote.payload) {
      setTrackedCloudVersion(remote.version);
      persistCloudMetadata(!snapshotIsEmpty(local));
      queueAutomaticSync(0);
    } else if (snapshotIsEmpty(local)) {
      await restoreSnapshot(remote.payload);
      setTrackedCloudVersion(remote.version);
      persistCloudMetadata(false);
      setCloudStatus("synced");
    } else if (snapshotsEqual(local, remote.payload)) {
      setTrackedCloudVersion(remote.version);
      persistCloudMetadata(false);
      setCloudStatus("synced");
    } else {
      setTrackedCloudVersion(0);
      persistCloudMetadata(true);
      setCloudStatus("conflict");
      setCloudError("Questo dispositivo e il cloud contengono dati diversi. Scegli una versione una sola volta; poi la sincronizzazione sarà automatica.");
    }
  };

  useEffect(() => {
    if (!repository || !cloudToken()) return;
    getCloudUser()
      .then(startCloudSession)
      .catch(() => {
        clearCloudToken();
        setCloudStatus("local");
      });
  }, [repository]);

  useEffect(() => {
    const poll = window.setInterval(() => void runAutoSyncRef.current(), 5000);
    const online = () => {
      setCloudStatus(cloudUserRef.current ? "syncing" : "local");
      queueAutomaticSync(0);
    };
    const offline = () => cloudUserRef.current && setCloudStatus("offline");
    const visible = () => document.visibilityState === "visible" && queueAutomaticSync(0);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(autoSyncTimer.current);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const openGame = async (id: string) => {
    const archived = await repository?.getGame(id);
    if (!archived) return;
    const team = workspace.teams.find((item) => item.id === archived.teamId);
    game.load({
      ...archived.state,
      teamLogoUrl: logoForTeam(team, archived.state.teamLogoUrl ?? team?.logoUrl),
      screen: cloudUser?.role === "viewer" ? "report" : archived.state.screen,
    });
    setActiveGameId(id);
    setSelectedTeamId(archived.teamId);
    setView("game");
  };

  const createGame = async (teamId: string) => {
    if (!repository) return;
    const team = workspace.teams.find((item) => item.id === teamId);
    const roster = await repository.getRoster(teamId);
    const players = roster.filter((player) => player.active).map(({ teamId: _teamId, active: _active, ...player }) => player);
    const next: GameState = {
      ...initialState,
      teamName: team ? [team.clubName, team.category || team.name].filter(Boolean).join(" · ") : "La mia squadra",
      teamColor: team?.color ?? initialState.teamColor,
      teamLogoUrl: logoForTeam(team, team?.logoUrl),
      opponentName: "",
      roster: players,
      lineup: players.slice(0, 5).map((player) => player.id),
      events: [],
    };
    const archived = await repository.createGame({
      teamId,
      opponentName: "Avversario da definire",
      scheduledAt: Date.now(),
      state: next,
    });
    game.load(next);
    setActiveGameId(archived.id);
    setView("game");
    await refresh();
    markCloudDirty();
  };

  if (view === "loading") {
    return <main className="ws-shell ws-empty-workspace"><p>Caricamento archivio CourtLab…</p></main>;
  }

  if (view === "workspace") {
    return <>
    <WorkspaceDashboard
      teams={teams}
      games={dashboardGames}
      selectedTeamId={selectedTeamId}
      readOnly={cloudUser?.role === "viewer"}
      syncStatus={cloudStatus}
      onSelectTeam={setSelectedTeamId}
      onCreateTeam={async (input) => {
        if (!repository) return;
        const team = await repository.createTeam(input);
        setSelectedTeamId(team.id);
        await refresh();
        markCloudDirty();
      }}
      onUpdateTeam={async (team) => {
        await repository?.updateTeam(team.id, {
          name: team.name, season: team.season, color: team.color, logoUrl: team.logoUrl,
          clubName: team.clubName, category: team.category,
        });
        await refresh();
        markCloudDirty();
      }}
      onCreateGame={createGame}
      onOpenGame={openGame}
      onDuplicateGame={async (id) => {
        const source = await repository?.getGame(id);
        if (!repository || !source) return;
        await repository.createGame({
          teamId: source.teamId,
          opponentName: source.opponentName,
          scheduledAt: Date.now(),
          state: {
            ...source.state,
            screen: "setup",
            events: [],
            running: false,
            period: 1,
            clock: 600,
            periodClocks: { 1: 600, 2: 600, 3: 600, 4: 600 },
          },
        });
        await refresh();
        markCloudDirty();
      }}
      onDeleteGame={async (id) => {
        if (!repository || !window.confirm("Eliminare questa partita dall’archivio?")) return;
        await repository.deleteGame(id, { force: true });
        await refresh();
        markCloudDirty();
      }}
      onAddPlayer={async (teamId, player) => {
        if (!repository) return;
        const roster = await repository.getRoster(teamId);
        await repository.replaceRoster(teamId, [...roster, { ...player, id: crypto.randomUUID(), active: true }]);
        await refresh();
        markCloudDirty();
      }}
      onUpdatePlayer={async (teamId, player) => {
        if (!repository) return;
        const roster = await repository.getRoster(teamId);
        await repository.replaceRoster(teamId, roster.map((item) => item.id === player.id ? { ...item, ...player } : item));
        await refresh();
        markCloudDirty();
      }}
      onRemovePlayer={async (teamId, playerId) => {
        if (!repository) return;
        const roster = await repository.getRoster(teamId);
        await repository.replaceRoster(teamId, roster.filter((item) => item.id !== playerId));
        await refresh();
        markCloudDirty();
      }}
      onDeleteTeam={async (teamId) => {
        if (!repository) return;
        try {
          await repository.deleteTeam(teamId);
          await refresh();
          markCloudDirty();
        } catch {
          window.alert("Questa categoria contiene partite. Elimina prima le partite archiviate.");
        }
      }}
    />
    <CloudAccount
      user={cloudUser}
      syncing={cloudBusy}
      status={cloudStatus}
      lastSync={lastSync}
      error={cloudError}
      onLogin={async (email, password) => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          const user = await loginCloud(email, password);
          await startCloudSession(user);
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "Accesso non riuscito");
        } finally { setCloudBusy(false); }
      }}
      onRegister={async (email, password, displayName) => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          const user = await registerCloud(email, password, displayName);
          await startCloudSession(user);
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "Registrazione non riuscita");
        } finally { setCloudBusy(false); }
      }}
      onAcceptInvite={async (token, email, password) => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          const user = await acceptCloudInvitation(token, email, password);
          await startCloudSession(user);
          window.history.replaceState({}, "", window.location.pathname);
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "Invito non valido");
        } finally { setCloudBusy(false); }
      }}
      onLogout={() => {
        clearCloudToken(); cloudUserRef.current = undefined; setCloudUser(undefined);
        setTrackedCloudVersion(0); cloudDirtyRef.current = false;
        setLastSync(undefined); setCloudStatus("local"); setCloudError(undefined);
      }}
      onUpload={() => resolveCloud("upload")}
      onDownload={() => resolveCloud("download")}
      onListRevisions={listCloudRevisions}
      onRestoreRevision={async (revision) => {
        const remote = await getCloudSnapshot();
        if (!window.confirm(`Ripristinare la versione cloud ${revision}? Lo stato attuale resterà nella cronologia.`)) return;
        const restored = await restoreCloudRevision(revision, remote.version);
        setTrackedCloudVersion(restored.version);
        const current = await getCloudSnapshot();
        if (current.payload) await restoreSnapshot(current.payload);
        persistCloudMetadata(false);
        setLastSync(Date.now());
        setCloudStatus("synced");
      }}
      onDeleteAccount={async () => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          await deleteCloudAccount();
          if (cloudUserRef.current) clearSyncMetadata(cloudUserRef.current.workspaceId);
          clearCloudToken(); cloudUserRef.current = undefined; setCloudUser(undefined);
          setTrackedCloudVersion(0); cloudDirtyRef.current = false;
          setLastSync(undefined); setCloudStatus("local");
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "Eliminazione non riuscita");
        } finally { setCloudBusy(false); }
      }}
    />
    </>;
  }

  const goHome = async () => {
    window.clearTimeout(saveTimer.current);
    if (repository && activeGameId) {
      await repository.updateGame(activeGameId, {
        opponentName: state.opponentName,
        status: state.screen === "report" ? "completed" : state.screen === "live" ? "live" : "draft",
        state: { ...state, running: false },
      });
      markCloudDirty();
    }
    setActiveGameId(undefined);
    await refresh();
    setView("workspace");
  };

  if (state.screen === "setup") {
    return <Setup state={state} patch={patch} onReset={() => {
      const team = workspace.teams.find((item) => item.id === selectedTeamId);
      const roster = workspace.rosters[selectedTeamId ?? ""] ?? [];
      game.load({
        ...initialState,
        teamName: team
          ? [team.clubName, team.category || team.name].filter(Boolean).join(" · ")
          : initialState.teamName,
        teamColor: team?.color ?? initialState.teamColor,
        teamLogoUrl: logoForTeam(team, team?.logoUrl),
        roster,
        lineup: roster.slice(0, 5).map((p: Player) => p.id),
      });
    }} onHome={goHome} onStart={() => patch({
      screen: "live",
      running: false,
      startingLineup: [...state.lineup],
    })} />;
  }

  if (state.screen === "report") {
    return <Report
      state={state}
      patch={patch}
      readOnly={cloudUser?.role === "viewer"}
      onBack={() => patch({ screen: "live" })}
      onSetup={goHome}
    />;
  }

  return <LiveGame state={state} patch={patch} addEvent={game.addEvent} undo={game.undo}
    updateEvent={game.updateEvent} deleteEvent={game.deleteEvent}
    onExit={goHome} onReport={() => patch({ screen: "report", running: false })} />;
}
