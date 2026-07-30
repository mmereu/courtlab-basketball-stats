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
  const [cloudVersion, setCloudVersion] = useState(0);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState<string>();
  const [lastSync, setLastSync] = useState<number>();
  const saveTimer = useRef<number | undefined>(undefined);

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
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const status = state.screen === "report" ? "completed" : state.screen === "live" ? "live" : "draft";
      await repository.updateGame(activeGameId, {
        opponentName: state.opponentName,
        status,
        state: { ...state, running: false },
      });
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

  const localSnapshot = (): CloudSnapshot => ({
    teams: workspace.teams,
    games: workspace.games,
    rosters: Object.fromEntries(workspace.teams.map((team) => [
      team.id,
      (workspace.rosters[team.id] ?? []).map((player) => ({ ...player, teamId: team.id, active: true })),
    ])),
  });
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
  };

  const synchronize = async (direction: "download" | "upload") => {
    if (!repository || !cloudUser) return;
    setCloudBusy(true);
    setCloudError(undefined);
    try {
      const remote = await getCloudSnapshot();
      if (direction === "download") {
        if (!remote.payload) throw new Error("Il cloud non contiene ancora un archivio.");
        if (!window.confirm("Sostituire i dati di questo dispositivo con la copia cloud?")) return;
        await restoreSnapshot(remote.payload);
        setCloudVersion(remote.version);
      } else {
        if (remote.version !== cloudVersion) {
          throw new Error("Il cloud è cambiato su un altro dispositivo. Scarica prima la versione cloud; nessun dato è stato sovrascritto.");
        }
        if (!window.confirm(
          `Creare una nuova versione cloud con ${workspace.teams.length} squadre e ${workspace.games.length} partite?`
        )) return;
        const saved = await saveCloudSnapshot(localSnapshot(), remote.version);
        setCloudVersion(saved.version);
      }
      setLastSync(Date.now());
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Sincronizzazione non riuscita");
    } finally {
      setCloudBusy(false);
    }
  };

  useEffect(() => {
    if (!repository || !cloudToken()) return;
    getCloudUser().then((user) => {
      setCloudUser(user);
      return getCloudSnapshot();
    }).then((remote) => {
      setCloudVersion(remote.version);
    }).catch(() => clearCloudToken());
  }, [repository]);

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
      onSelectTeam={setSelectedTeamId}
      onCreateTeam={async (input) => {
        if (!repository) return;
        const team = await repository.createTeam(input);
        setSelectedTeamId(team.id);
        await refresh();
      }}
      onUpdateTeam={async (team) => {
        await repository?.updateTeam(team.id, {
          name: team.name, season: team.season, color: team.color, logoUrl: team.logoUrl,
          clubName: team.clubName, category: team.category,
        });
        await refresh();
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
      }}
      onDeleteGame={async (id) => {
        if (!repository || !window.confirm("Eliminare questa partita dall’archivio?")) return;
        await repository.deleteGame(id, { force: true });
        await refresh();
      }}
      onAddPlayer={async (teamId, player) => {
        if (!repository) return;
        const roster = await repository.getRoster(teamId);
        await repository.replaceRoster(teamId, [...roster, { ...player, id: crypto.randomUUID(), active: true }]);
        await refresh();
      }}
      onUpdatePlayer={async (teamId, player) => {
        if (!repository) return;
        const roster = await repository.getRoster(teamId);
        await repository.replaceRoster(teamId, roster.map((item) => item.id === player.id ? { ...item, ...player } : item));
        await refresh();
      }}
      onRemovePlayer={async (teamId, playerId) => {
        if (!repository) return;
        const roster = await repository.getRoster(teamId);
        await repository.replaceRoster(teamId, roster.filter((item) => item.id !== playerId));
        await refresh();
      }}
      onDeleteTeam={async (teamId) => {
        if (!repository) return;
        try {
          await repository.deleteTeam(teamId);
          await refresh();
        } catch {
          window.alert("Questa categoria contiene partite. Elimina prima le partite archiviate.");
        }
      }}
    />
    <CloudAccount
      user={cloudUser}
      syncing={cloudBusy}
      lastSync={lastSync}
      error={cloudError}
      onLogin={async (email, password) => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          const user = await loginCloud(email, password);
          setCloudUser(user);
          const remote = await getCloudSnapshot();
          setCloudVersion(remote.version);
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "Accesso non riuscito");
        } finally { setCloudBusy(false); }
      }}
      onRegister={async (email, password, displayName) => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          const user = await registerCloud(email, password, displayName);
          setCloudUser(user);
          setCloudVersion(0);
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "Registrazione non riuscita");
        } finally { setCloudBusy(false); }
      }}
      onAcceptInvite={async (token, email, password) => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          const user = await acceptCloudInvitation(token, email, password);
          setCloudUser(user);
          const remote = await getCloudSnapshot();
          setCloudVersion(remote.version);
          window.history.replaceState({}, "", window.location.pathname);
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "Invito non valido");
        } finally { setCloudBusy(false); }
      }}
      onLogout={() => {
        clearCloudToken(); setCloudUser(undefined); setCloudVersion(0); setLastSync(undefined);
      }}
      onUpload={() => synchronize("upload")}
      onDownload={() => synchronize("download")}
      onListRevisions={listCloudRevisions}
      onRestoreRevision={async (revision) => {
        const remote = await getCloudSnapshot();
        if (!window.confirm(`Ripristinare la versione cloud ${revision}? Lo stato attuale resterà nella cronologia.`)) return;
        const restored = await restoreCloudRevision(revision, remote.version);
        setCloudVersion(restored.version);
        const current = await getCloudSnapshot();
        if (current.payload) await restoreSnapshot(current.payload);
        setLastSync(Date.now());
      }}
      onDeleteAccount={async () => {
        setCloudBusy(true); setCloudError(undefined);
        try {
          await deleteCloudAccount();
          clearCloudToken(); setCloudUser(undefined); setCloudVersion(0); setLastSync(undefined);
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
