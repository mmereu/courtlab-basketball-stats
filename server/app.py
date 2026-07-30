#!/usr/bin/env python3
"""CourtLab minimal self-hosted API (Python stdlib + SQLite)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ROLES = {"owner", "coach", "viewer"}
MAX_BODY = 5 * 1024 * 1024


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def b64e(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def b64d(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str, salt: bytes | None = None) -> str:
    if len(password) < 12:
        raise ApiError(400, "WEAK_PASSWORD", "Password must be at least 12 characters")
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt$16384$8$1${b64e(salt)}${b64e(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt, expected = encoded.split("$")
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(
            password.encode(), salt=b64d(salt), n=int(n), r=int(r), p=int(p), dklen=32
        )
        return hmac.compare_digest(actual, b64d(expected))
    except (ValueError, TypeError):
        return False


@dataclass(frozen=True)
class Config:
    database: str
    token_secret: bytes
    token_ttl: int = 8 * 60 * 60
    allow_registration: bool = False
    allowed_origin: str = "https://basketcoach.duckdns.org"

    @classmethod
    def from_env(cls) -> "Config":
        secret = os.environ.get("COURTLAB_TOKEN_SECRET", "")
        if len(secret) < 32:
            raise RuntimeError("COURTLAB_TOKEN_SECRET must contain at least 32 characters")
        return cls(
            database=os.environ.get("COURTLAB_DATABASE", "/var/lib/courtlab/courtlab.sqlite3"),
            token_secret=secret.encode(),
            token_ttl=int(os.environ.get("COURTLAB_TOKEN_TTL", str(8 * 60 * 60))),
            allow_registration=os.environ.get("COURTLAB_ALLOW_REGISTRATION", "false").lower() == "true",
            allowed_origin=os.environ.get(
                "COURTLAB_ALLOWED_ORIGIN", "https://basketcoach.duckdns.org"
            ),
        )


class CourtLabService:
    def __init__(self, config: Config):
        self.config = config
        Path(config.database).parent.mkdir(parents=True, exist_ok=True)
        self.init_database()

    def connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.config.database, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=10000")
        return db

    def init_database(self) -> None:
        with self.connect() as db:
            db.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS users (
                  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
                  password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workspaces (
                  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS memberships (
                  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  role TEXT NOT NULL CHECK(role IN ('owner','coach','viewer')),
                  PRIMARY KEY(workspace_id, user_id)
                );
                CREATE TABLE IF NOT EXISTS snapshots (
                  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
                  version INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL DEFAULT '{}',
                  updated_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS snapshot_revisions (
                  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                  version INTEGER NOT NULL, payload TEXT NOT NULL,
                  created_at INTEGER NOT NULL, created_by TEXT NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
                  PRIMARY KEY(workspace_id, version)
                );
                CREATE INDEX IF NOT EXISTS snapshot_revisions_workspace_idx
                  ON snapshot_revisions(workspace_id, version DESC);
                CREATE TABLE IF NOT EXISTS invitations (
                  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL
                    REFERENCES workspaces(id) ON DELETE CASCADE,
                  token_hash TEXT NOT NULL UNIQUE,
                  role TEXT NOT NULL CHECK(role IN ('coach','viewer')),
                  expires_at INTEGER NOT NULL, created_by TEXT NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
                  used_at INTEGER, created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS invitations_workspace_idx
                  ON invitations(workspace_id);
                """
            )
            # Preserve the pre-upgrade state as the first immutable recovery point.
            db.execute(
                """INSERT OR IGNORE INTO snapshot_revisions
                   (workspace_id,version,payload,created_at,created_by)
                   SELECT s.workspace_id,s.version,s.payload,s.updated_at,m.user_id
                   FROM snapshots s
                   JOIN memberships m ON m.workspace_id=s.workspace_id
                   JOIN users u ON u.id=m.user_id
                   WHERE s.version>0
                   ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END"""
            )

    def issue_token(self, user_id: str, workspace_id: str, role: str) -> str:
        now = int(time.time())
        payload = b64e(
            json.dumps(
                {"sub": user_id, "wid": workspace_id, "role": role, "iat": now,
                 "exp": now + self.config.token_ttl},
                separators=(",", ":"), sort_keys=True,
            ).encode()
        )
        signature = b64e(hmac.new(self.config.token_secret, payload.encode(), hashlib.sha256).digest())
        return f"{payload}.{signature}"

    def authenticate(self, token: str) -> dict[str, Any]:
        try:
            payload, signature = token.split(".", 1)
            expected = hmac.new(self.config.token_secret, payload.encode(), hashlib.sha256).digest()
            if not hmac.compare_digest(expected, b64d(signature)):
                raise ValueError
            claims = json.loads(b64d(payload))
            if int(claims["exp"]) < int(time.time()) or claims["role"] not in ROLES:
                raise ValueError
            with self.connect() as db:
                member = db.execute(
                    "SELECT role FROM memberships WHERE workspace_id=? AND user_id=?",
                    (claims["wid"], claims["sub"]),
                ).fetchone()
            if not member or member["role"] != claims["role"]:
                raise ValueError
            return claims
        except (ValueError, KeyError, json.JSONDecodeError):
            raise ApiError(401, "UNAUTHORIZED", "Invalid or expired token")

    def register(self, email: str, password: str, workspace_name: str) -> dict[str, Any]:
        if not self.config.allow_registration:
            raise ApiError(403, "REGISTRATION_DISABLED", "Registration is disabled")
        email = email.strip().lower()
        if not EMAIL_RE.match(email):
            raise ApiError(400, "INVALID_EMAIL", "A valid email is required")
        now, user_id, workspace_id = int(time.time()), secrets.token_hex(16), secrets.token_hex(16)
        password_hash = hash_password(password)
        try:
            with self.connect() as db:
                db.execute("INSERT INTO users VALUES (?,?,?,?)", (user_id, email, password_hash, now))
                db.execute(
                    "INSERT INTO workspaces VALUES (?,?,?)",
                    (workspace_id, workspace_name.strip() or "La mia squadra", now),
                )
                db.execute("INSERT INTO memberships VALUES (?,?,?)", (workspace_id, user_id, "owner"))
                db.execute("INSERT INTO snapshots VALUES (?,0,'{}',?)", (workspace_id, now))
        except sqlite3.IntegrityError:
            raise ApiError(409, "EMAIL_EXISTS", "Account already exists")
        return {"token": self.issue_token(user_id, workspace_id, "owner")}

    def login(self, email: str, password: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute(
                """SELECT u.id, u.password_hash, m.workspace_id, m.role
                   FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=?""",
                (email.strip().lower(),),
            ).fetchone()
        # Always run scrypt to reduce account-enumeration timing differences.
        encoded = row["password_hash"] if row else hash_password("invalid-password-placeholder")
        if not verify_password(password, encoded) or not row:
            raise ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password")
        return {"token": self.issue_token(row["id"], row["workspace_id"], row["role"])}

    def me(self, claims: dict[str, Any]) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute(
                """SELECT u.email, w.name FROM users u
                   JOIN workspaces w ON w.id=? WHERE u.id=?""",
                (claims["wid"], claims["sub"]),
            ).fetchone()
        if not row:
            raise ApiError(404, "NOT_FOUND", "Account not found")
        return {"email": row["email"], "workspaceId": claims["wid"],
                "workspaceName": row["name"], "role": claims["role"]}

    def get_snapshot(self, claims: dict[str, Any]) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute(
                "SELECT version,payload,updated_at FROM snapshots WHERE workspace_id=?",
                (claims["wid"],),
            ).fetchone()
        return {"version": row["version"], "data": json.loads(row["payload"]),
                "updatedAt": row["updated_at"]}

    def put_snapshot(self, claims: dict[str, Any], version: int, data: Any) -> dict[str, Any]:
        if claims["role"] == "viewer":
            raise ApiError(403, "READ_ONLY", "Viewer cannot update data")
        payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        now = int(time.time())
        with self.connect() as db:
            cursor = db.execute(
                """UPDATE snapshots SET version=version+1,payload=?,updated_at=?
                   WHERE workspace_id=? AND version=?""",
                (payload, now, claims["wid"], version),
            )
            if cursor.rowcount != 1:
                current = db.execute(
                    "SELECT version FROM snapshots WHERE workspace_id=?", (claims["wid"],)
                ).fetchone()
                raise ApiError(409, "VERSION_CONFLICT",
                               f"Snapshot changed; current version is {current['version']}")
            db.execute(
                """INSERT INTO snapshot_revisions
                   (workspace_id,version,payload,created_at,created_by) VALUES (?,?,?,?,?)""",
                (claims["wid"], version + 1, payload, now, claims["sub"]),
            )
        return {"version": version + 1, "updatedAt": now}

    def list_snapshot_revisions(self, claims: dict[str, Any]) -> dict[str, Any]:
        with self.connect() as db:
            rows = db.execute(
                """SELECT version,payload,created_at FROM snapshot_revisions
                   WHERE workspace_id=? ORDER BY version DESC LIMIT 50""",
                (claims["wid"],),
            ).fetchall()
        revisions = []
        for row in rows:
            data = json.loads(row["payload"])
            revisions.append({
                "version": row["version"],
                "createdAt": row["created_at"],
                "teams": len(data.get("teams", [])) if isinstance(data, dict) else 0,
                "games": len(data.get("games", [])) if isinstance(data, dict) else 0,
            })
        return {"revisions": revisions}

    def restore_snapshot_revision(
        self, claims: dict[str, Any], revision: int, current_version: int
    ) -> dict[str, Any]:
        if claims["role"] == "viewer":
            raise ApiError(403, "READ_ONLY", "Viewer cannot restore data")
        with self.connect() as db:
            row = db.execute(
                """SELECT payload FROM snapshot_revisions
                   WHERE workspace_id=? AND version=?""",
                (claims["wid"], revision),
            ).fetchone()
        if not row:
            raise ApiError(404, "REVISION_NOT_FOUND", "Snapshot revision not found")
        return self.put_snapshot(claims, current_version, json.loads(row["payload"]))

    def require_owner(self, claims: dict[str, Any]) -> None:
        if claims["role"] != "owner":
            raise ApiError(403, "OWNER_REQUIRED", "Owner permission required")

    def list_members(self, claims: dict[str, Any]) -> dict[str, Any]:
        self.require_owner(claims)
        with self.connect() as db:
            rows = db.execute(
                """SELECT u.id,u.email,m.role,u.created_at FROM memberships m
                   JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?
                   ORDER BY u.email""", (claims["wid"],)
            ).fetchall()
        return {"members": [
            {"id": row["id"], "email": row["email"], "role": row["role"],
             "createdAt": row["created_at"]} for row in rows
        ]}

    def create_invitation(
        self, claims: dict[str, Any], role: str, expires_in: int = 7 * 24 * 60 * 60
    ) -> dict[str, Any]:
        self.require_owner(claims)
        if role not in {"coach", "viewer"}:
            raise ApiError(400, "INVALID_ROLE", "Invitation role must be coach or viewer")
        if expires_in < 300 or expires_in > 30 * 24 * 60 * 60:
            raise ApiError(400, "INVALID_EXPIRY", "Expiry must be between 5 minutes and 30 days")
        token = secrets.token_urlsafe(32)
        now, invitation_id = int(time.time()), secrets.token_hex(16)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with self.connect() as db:
            db.execute(
                "INSERT INTO invitations VALUES (?,?,?,?,?,?,NULL,?)",
                (invitation_id, claims["wid"], token_hash, role, now + expires_in,
                 claims["sub"], now),
            )
        # Raw token is returned once and never stored.
        return {"token": token, "role": role, "expiresAt": now + expires_in}

    def accept_invitation(self, token: str, email: str, password: str) -> dict[str, Any]:
        email = email.strip().lower()
        if not EMAIL_RE.match(email):
            raise ApiError(400, "INVALID_EMAIL", "A valid email is required")
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        password_hash = hash_password(password)
        now, user_id = int(time.time()), secrets.token_hex(16)
        try:
            with self.connect() as db:
                invitation = db.execute(
                    """SELECT id,workspace_id,role,expires_at,used_at FROM invitations
                       WHERE token_hash=?""", (token_hash,)
                ).fetchone()
                if not invitation or invitation["used_at"] is not None:
                    raise ApiError(400, "INVALID_INVITATION", "Invitation is invalid or already used")
                if invitation["expires_at"] < now:
                    raise ApiError(410, "INVITATION_EXPIRED", "Invitation has expired")
                db.execute("INSERT INTO users VALUES (?,?,?,?)", (user_id, email, password_hash, now))
                db.execute(
                    "INSERT INTO memberships VALUES (?,?,?)",
                    (invitation["workspace_id"], user_id, invitation["role"]),
                )
                updated = db.execute(
                    "UPDATE invitations SET used_at=? WHERE id=? AND used_at IS NULL",
                    (now, invitation["id"]),
                )
                if updated.rowcount != 1:
                    raise ApiError(409, "INVITATION_USED", "Invitation was already used")
        except sqlite3.IntegrityError:
            raise ApiError(409, "EMAIL_EXISTS", "Account already exists")
        return {"token": self.issue_token(
            user_id, invitation["workspace_id"], invitation["role"]
        )}

    def change_member_role(
        self, claims: dict[str, Any], member_id: str, role: str
    ) -> dict[str, Any]:
        self.require_owner(claims)
        if role not in ROLES:
            raise ApiError(400, "INVALID_ROLE", "Invalid member role")
        with self.connect() as db:
            member = db.execute(
                "SELECT role FROM memberships WHERE workspace_id=? AND user_id=?",
                (claims["wid"], member_id),
            ).fetchone()
            if not member:
                raise ApiError(404, "NOT_FOUND", "Member not found")
            if member["role"] == "owner" and role != "owner":
                owners = db.execute(
                    "SELECT COUNT(*) count FROM memberships WHERE workspace_id=? AND role='owner'",
                    (claims["wid"],),
                ).fetchone()["count"]
                if owners <= 1:
                    raise ApiError(409, "LAST_OWNER", "The last owner cannot be demoted")
            db.execute(
                "UPDATE memberships SET role=? WHERE workspace_id=? AND user_id=?",
                (role, claims["wid"], member_id),
            )
        return {"id": member_id, "role": role}

    def remove_member(self, claims: dict[str, Any], member_id: str) -> None:
        self.require_owner(claims)
        with self.connect() as db:
            member = db.execute(
                "SELECT role FROM memberships WHERE workspace_id=? AND user_id=?",
                (claims["wid"], member_id),
            ).fetchone()
            if not member:
                raise ApiError(404, "NOT_FOUND", "Member not found")
            if member["role"] == "owner":
                owners = db.execute(
                    "SELECT COUNT(*) count FROM memberships WHERE workspace_id=? AND role='owner'",
                    (claims["wid"],),
                ).fetchone()["count"]
                if owners <= 1:
                    raise ApiError(409, "LAST_OWNER", "The last owner cannot be removed")
            db.execute(
                "DELETE FROM memberships WHERE workspace_id=? AND user_id=?",
                (claims["wid"], member_id),
            )

    def delete_account(self, claims: dict[str, Any]) -> None:
        """Delete personal data; a sole-member workspace is removed with its snapshot."""
        with self.connect() as db:
            memberships = db.execute(
                "SELECT workspace_id,role FROM memberships WHERE user_id=?", (claims["sub"],)
            ).fetchall()
            workspaces_to_delete: list[str] = []
            for membership in memberships:
                if membership["role"] != "owner":
                    continue
                counts = db.execute(
                    """SELECT COUNT(*) total,
                       SUM(CASE WHEN role='owner' THEN 1 ELSE 0 END) owners
                       FROM memberships WHERE workspace_id=?""",
                    (membership["workspace_id"],),
                ).fetchone()
                if counts["owners"] <= 1 and counts["total"] > 1:
                    raise ApiError(
                        409, "TRANSFER_REQUIRED",
                        "Transfer ownership or remove collaborators before deleting the account",
                    )
                if counts["total"] == 1:
                    workspaces_to_delete.append(membership["workspace_id"])
            for workspace_id in workspaces_to_delete:
                db.execute("DELETE FROM workspaces WHERE id=?", (workspace_id,))
            deleted = db.execute("DELETE FROM users WHERE id=?", (claims["sub"],))
            if deleted.rowcount != 1:
                raise ApiError(404, "NOT_FOUND", "Account not found")


class Handler(BaseHTTPRequestHandler):
    server_version = "CourtLabAPI/1"

    @property
    def service(self) -> CourtLabService:
        return self.server.service  # type: ignore[attr-defined]

    def send_json(self, status: int, data: Any) -> None:
        body = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        origin = self.headers.get("Origin")
        if origin == self.service.config.allowed_origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ApiError(413, "INVALID_SIZE", "Invalid request size")
            value = json.loads(self.rfile.read(length))
            if not isinstance(value, dict):
                raise ValueError
            return value
        except json.JSONDecodeError:
            raise ApiError(400, "INVALID_JSON", "Invalid JSON body")
        except ValueError:
            raise ApiError(400, "INVALID_REQUEST", "JSON object required")

    def claims(self) -> dict[str, Any]:
        value = self.headers.get("Authorization", "")
        if not value.startswith("Bearer "):
            raise ApiError(401, "UNAUTHORIZED", "Bearer token required")
        return self.service.authenticate(value[7:])

    def dispatch(self) -> tuple[int, Any]:
        path = self.path.split("?", 1)[0]
        if self.command == "GET" and path == "/api/health":
            return 200, {"ok": True}
        if self.command == "POST" and path == "/api/register":
            body = self.read_json()
            return 201, self.service.register(
                str(body.get("email", "")), str(body.get("password", "")),
                str(body.get("workspaceName", "")),
            )
        if self.command == "POST" and path == "/api/login":
            body = self.read_json()
            return 200, self.service.login(str(body.get("email", "")), str(body.get("password", "")))
        if self.command == "POST" and path == "/api/invitations/accept":
            body = self.read_json()
            return 201, self.service.accept_invitation(
                str(body.get("token", "")), str(body.get("email", "")),
                str(body.get("password", "")),
            )
        if self.command == "GET" and path == "/api/me":
            return 200, self.service.me(self.claims())
        if self.command == "DELETE" and path == "/api/account":
            self.service.delete_account(self.claims())
            return 200, {"deleted": True}
        if self.command == "GET" and path == "/api/snapshot":
            return 200, self.service.get_snapshot(self.claims())
        if self.command == "PUT" and path == "/api/snapshot":
            claims, body = self.claims(), self.read_json()
            if not isinstance(body.get("version"), int) or "data" not in body:
                raise ApiError(400, "INVALID_REQUEST", "version and data are required")
            return 200, self.service.put_snapshot(claims, body["version"], body["data"])
        if self.command == "GET" and path == "/api/snapshot/revisions":
            return 200, self.service.list_snapshot_revisions(self.claims())
        if self.command == "POST" and path == "/api/snapshot/restore":
            claims, body = self.claims(), self.read_json()
            if not isinstance(body.get("revision"), int) or not isinstance(body.get("version"), int):
                raise ApiError(400, "INVALID_REQUEST", "revision and version are required")
            return 200, self.service.restore_snapshot_revision(
                claims, body["revision"], body["version"]
            )
        if self.command == "GET" and path == "/api/members":
            return 200, self.service.list_members(self.claims())
        if self.command == "POST" and path == "/api/invitations":
            claims, body = self.claims(), self.read_json()
            expires_in = body.get("expiresIn", 7 * 24 * 60 * 60)
            if not isinstance(expires_in, int):
                raise ApiError(400, "INVALID_EXPIRY", "expiresIn must be an integer")
            return 201, self.service.create_invitation(
                claims, str(body.get("role", "")), expires_in
            )
        member_prefix = "/api/members/"
        if path.startswith(member_prefix):
            member_id = path[len(member_prefix):]
            if not member_id or "/" in member_id:
                raise ApiError(404, "NOT_FOUND", "Endpoint not found")
            if self.command == "PATCH":
                body = self.read_json()
                return 200, self.service.change_member_role(
                    self.claims(), member_id, str(body.get("role", ""))
                )
            if self.command == "DELETE":
                self.service.remove_member(self.claims(), member_id)
                return 200, {"removed": True}
        raise ApiError(404, "NOT_FOUND", "Endpoint not found")

    def handle_request(self) -> None:
        try:
            status, body = self.dispatch()
            self.send_json(status, body)
        except ApiError as error:
            self.send_json(error.status, {"error": {"code": error.code, "message": error.message}})
        except Exception:
            print("Unhandled API error", file=sys.stderr)
            self.send_json(500, {"error": {"code": "INTERNAL", "message": "Internal server error"}})

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = handle_request

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin == self.service.config.allowed_origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            self.send_header("Vary", "Origin")
        self.end_headers()

    def log_message(self, message: str, *args: Any) -> None:
        print(f"{self.address_string()} {message % args}", file=sys.stderr)


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], service: CourtLabService):
        self.service = service
        super().__init__(address, Handler)


def main() -> None:
    config = Config.from_env()
    address = os.environ.get("COURTLAB_BIND", "127.0.0.1")
    port = int(os.environ.get("COURTLAB_PORT", "8092"))
    server = Server((address, port), CourtLabService(config))
    print(f"CourtLab API listening on {address}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
