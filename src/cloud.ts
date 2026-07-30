import type { ArchivedGame, RosterPlayer, Team } from "./storage";

const TOKEN_KEY = "courtlab-cloud-token";

export type CloudUser = {
  email: string;
  displayName: string;
  workspaceId: string;
  role: "owner" | "coach" | "viewer";
};

export type CloudSnapshot = {
  teams: Team[];
  rosters: Record<string, RosterPlayer[]>;
  games: ArchivedGame[];
};
export type CloudMember = {
  id: string;
  email: string;
  role: CloudUser["role"];
  createdAt: number;
};

type AuthResponse = { token: string };
type ApiUser = { email: string; workspaceId: string; workspaceName: string; role: CloudUser["role"] };
type ApiSnapshotResponse = { version: number; data: CloudSnapshot | Record<string, never>; updatedAt?: number };
export type SnapshotResponse = { version: number; payload: CloudSnapshot | null; updatedAt?: number };
export type CloudRevision = {
  version: number;
  createdAt: number;
  teams: number;
  games: number;
};

export const cloudToken = () => localStorage.getItem(TOKEN_KEY);
export const clearCloudToken = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, init: RequestInit = {}) {
  const token = cloudToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.error === "string"
      ? body.error
      : body.error?.message || `Errore cloud ${response.status}`;
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = body.error?.code;
    throw error;
  }
  return body as T;
}

export async function registerCloud(email: string, password: string, displayName: string) {
  const result = await request<AuthResponse>("/register", {
    method: "POST",
    body: JSON.stringify({ email, password, workspaceName: displayName || "CourtLab" }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return getCloudUser();
}

export async function loginCloud(email: string, password: string) {
  const result = await request<AuthResponse>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return getCloudUser();
}

export const getCloudUser = () => request<ApiUser>("/me").then((value) => ({
  email: value.email,
  workspaceId: value.workspaceId,
  displayName: value.workspaceName,
  role: value.role,
}));
export const getCloudSnapshot = () => request<ApiSnapshotResponse>("/snapshot").then((value) => ({
  version: value.version,
  payload: value.data && "teams" in value.data ? value.data as CloudSnapshot : null,
  updatedAt: value.updatedAt,
}));

export const saveCloudSnapshot = (payload: CloudSnapshot, baseVersion: number) =>
  request<{ version: number; updatedAt?: number }>("/snapshot", {
    method: "PUT",
    body: JSON.stringify({ data: payload, version: baseVersion }),
  });

export const listCloudRevisions = () =>
  request<{ revisions: CloudRevision[] }>("/snapshot/revisions")
    .then((value) => value.revisions);

export const restoreCloudRevision = (revision: number, baseVersion: number) =>
  request<{ version: number; updatedAt?: number }>("/snapshot/restore", {
    method: "POST",
    body: JSON.stringify({ revision, version: baseVersion }),
  });

export const listCloudMembers = () =>
  request<{ members: CloudMember[] }>("/members").then((value) => value.members);

export const createCloudInvitation = (role: "coach" | "viewer", expiresIn = 7 * 24 * 60 * 60) =>
  request<{ token: string; role: string; expiresAt: number }>("/invitations", {
    method: "POST",
    body: JSON.stringify({ role, expiresIn }),
  });

export const acceptCloudInvitation = async (token: string, email: string, password: string) => {
  const result = await request<AuthResponse>("/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token, email, password }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return getCloudUser();
};

export const updateCloudMember = (id: string, role: CloudUser["role"]) =>
  request<{ id: string; role: string }>(`/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });

export const removeCloudMember = (id: string) =>
  request<{ removed: true }>(`/members/${id}`, { method: "DELETE" });

export const deleteCloudAccount = () =>
  request<{ deleted: true }>("/account", { method: "DELETE" });
