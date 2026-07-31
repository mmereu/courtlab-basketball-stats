import tempfile
import threading
import time
import unittest
import json
import hashlib
import urllib.error
import urllib.request
from pathlib import Path

from app import ApiError, Config, CourtLabService, Server, hash_password, verify_password


class CourtLabServiceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.service = CourtLabService(Config(
            database=str(Path(self.temp.name) / "test.sqlite3"),
            token_secret=b"x" * 32,
            token_ttl=3600,
            allow_registration=True,
            allowed_origin="https://example.test",
        ))

    def tearDown(self):
        self.temp.cleanup()

    def register(self):
        result = self.service.register("coach@example.test", "very-secure-password", "Tigers")
        return result["token"], self.service.authenticate(result["token"])

    def test_password_scrypt_roundtrip(self):
        encoded = hash_password("very-secure-password")
        self.assertTrue(verify_password("very-secure-password", encoded))
        self.assertFalse(verify_password("wrong-password", encoded))
        self.assertNotIn("very-secure-password", encoded)

    def test_register_login_me(self):
        token, claims = self.register()
        self.assertEqual("owner", claims["role"])
        login = self.service.login("COACH@example.test", "very-secure-password")
        me = self.service.me(self.service.authenticate(login["token"]))
        self.assertEqual("coach@example.test", me["email"])
        self.assertEqual("Tigers", me["workspaceName"])
        self.assertNotEqual("", token)

    def test_registration_can_be_disabled(self):
        self.service.config = Config(
            database=self.service.config.database, token_secret=b"x" * 32,
            allow_registration=False,
        )
        with self.assertRaises(ApiError) as context:
            self.service.register("coach@example.test", "very-secure-password", "Tigers")
        self.assertEqual("REGISTRATION_DISABLED", context.exception.code)

    def test_expired_and_tampered_tokens_are_rejected(self):
        token, _ = self.register()
        with self.assertRaises(ApiError):
            self.service.authenticate(token + "x")
        self.service.config = Config(
            database=self.service.config.database, token_secret=b"x" * 32, token_ttl=-1,
            allow_registration=True,
        )
        expired = self.service.login("coach@example.test", "very-secure-password")["token"]
        time.sleep(0.01)
        with self.assertRaises(ApiError):
            self.service.authenticate(expired)

    def test_snapshot_optimistic_versioning(self):
        _, claims = self.register()
        self.assertEqual(0, self.service.get_snapshot(claims)["version"])
        saved = self.service.put_snapshot(claims, 0, {"teams": [{"id": "t1"}]})
        self.assertEqual(1, saved["version"])
        self.assertEqual("t1", self.service.get_snapshot(claims)["data"]["teams"][0]["id"])
        with self.assertRaises(ApiError) as context:
            self.service.put_snapshot(claims, 0, {"stale": True})
        self.assertEqual("VERSION_CONFLICT", context.exception.code)

    def test_tester_application_is_validated_deduplicated_and_admin_only(self):
        application = {
            "name": "Coach Test", "email": "tester@example.test",
            "phone": "+39 300 0000000", "organization": "Basket Test",
            "category": "Under 15", "role": "Allenatore", "device": "Tablet",
            "message": "Vorrei provare lo scouting live.", "consent": True,
        }
        self.assertEqual({"received": True}, self.service.create_tester_application(application))
        self.assertEqual({"received": True}, self.service.create_tester_application(application))
        with self.service.connect() as db:
            count = db.execute("SELECT COUNT(*) count FROM tester_applications").fetchone()["count"]
        self.assertEqual(1, count)

        _, claims = self.register()
        with self.assertRaises(ApiError) as context:
            self.service.list_tester_applications(claims)
        self.assertEqual("ADMIN_REQUIRED", context.exception.code)

        self.service.config = Config(
            database=self.service.config.database,
            token_secret=self.service.config.token_secret,
            token_ttl=self.service.config.token_ttl,
            allow_registration=True,
            allowed_origin=self.service.config.allowed_origin,
            tester_admin_email="coach@example.test",
        )
        applications = self.service.list_tester_applications(claims)["applications"]
        self.assertEqual("Basket Test", applications[0]["organization"])
        self.assertEqual("new", applications[0]["status"])

        invalid = {**application, "email": "not-an-email"}
        with self.assertRaises(ApiError) as context:
            self.service.create_tester_application(invalid)
        self.assertEqual("INVALID_EMAIL", context.exception.code)

    def test_snapshot_revisions_are_immutable_and_restorable(self):
        _, claims = self.register()
        self.service.put_snapshot(claims, 0, {"teams": [{"id": "novara"}], "games": []})
        self.service.put_snapshot(claims, 1, {"teams": [{"id": "u17"}], "games": [{"id": "g1"}]})
        revisions = self.service.list_snapshot_revisions(claims)["revisions"]
        self.assertEqual([2, 1], [item["version"] for item in revisions])
        self.assertEqual(1, revisions[0]["games"])

        restored = self.service.restore_snapshot_revision(claims, 1, 2)
        self.assertEqual(3, restored["version"])
        current = self.service.get_snapshot(claims)
        self.assertEqual("novara", current["data"]["teams"][0]["id"])
        self.assertEqual([3, 2, 1], [
            item["version"] for item in self.service.list_snapshot_revisions(claims)["revisions"]
        ])

    def test_viewer_is_read_only(self):
        _, claims = self.register()
        with self.service.connect() as db:
            db.execute("UPDATE memberships SET role='viewer' WHERE user_id=?", (claims["sub"],))
        claims["role"] = "viewer"
        with self.assertRaises(ApiError) as context:
            self.service.put_snapshot(claims, 0, {})
        self.assertEqual("READ_ONLY", context.exception.code)

    def test_owner_invites_new_coach_once_and_manages_members(self):
        _, owner = self.register()
        invitation = self.service.create_invitation(owner, "coach", 600)
        accepted = self.service.accept_invitation(
            invitation["token"], "assistant@example.test", "another-secure-password"
        )
        coach = self.service.authenticate(accepted["token"])
        self.assertEqual("coach", coach["role"])
        members = self.service.list_members(owner)["members"]
        self.assertEqual(2, len(members))
        coach_id = next(item["id"] for item in members if item["role"] == "coach")
        changed = self.service.change_member_role(owner, coach_id, "viewer")
        self.assertEqual("viewer", changed["role"])
        self.service.remove_member(owner, coach_id)
        self.assertEqual(1, len(self.service.list_members(owner)["members"]))
        with self.assertRaises(ApiError) as context:
            self.service.accept_invitation(
                invitation["token"], "second@example.test", "another-secure-password"
            )
        self.assertEqual("INVALID_INVITATION", context.exception.code)

    def test_non_owner_cannot_administer_members_and_invites_expire(self):
        _, owner = self.register()
        invitation = self.service.create_invitation(owner, "viewer", 600)
        accepted = self.service.accept_invitation(
            invitation["token"], "viewer@example.test", "another-secure-password"
        )
        viewer = self.service.authenticate(accepted["token"])
        with self.assertRaises(ApiError) as context:
            self.service.list_members(viewer)
        self.assertEqual("OWNER_REQUIRED", context.exception.code)
        expired = self.service.create_invitation(owner, "coach", 600)
        token_hash = hashlib.sha256(expired["token"].encode()).hexdigest()
        with self.service.connect() as db:
            db.execute("UPDATE invitations SET expires_at=0 WHERE token_hash=?", (token_hash,))
        with self.assertRaises(ApiError) as context:
            self.service.accept_invitation(
                expired["token"], "late@example.test", "another-secure-password"
            )
        self.assertEqual("INVITATION_EXPIRED", context.exception.code)

    def test_last_owner_cannot_be_removed_or_demoted(self):
        _, owner = self.register()
        with self.assertRaises(ApiError) as context:
            self.service.change_member_role(owner, owner["sub"], "coach")
        self.assertEqual("LAST_OWNER", context.exception.code)
        with self.assertRaises(ApiError) as context:
            self.service.remove_member(owner, owner["sub"])
        self.assertEqual("LAST_OWNER", context.exception.code)

    def test_delete_account_removes_private_workspace_if_solo(self):
        _, owner = self.register()
        workspace_id = owner["wid"]
        self.service.delete_account(owner)
        with self.service.connect() as db:
            self.assertIsNone(db.execute(
                "SELECT id FROM workspaces WHERE id=?", (workspace_id,)
            ).fetchone())
            self.assertIsNone(db.execute(
                "SELECT workspace_id FROM snapshots WHERE workspace_id=?", (workspace_id,)
            ).fetchone())

    def test_delete_last_owner_requires_transfer_when_collaborators_exist(self):
        _, owner = self.register()
        invitation = self.service.create_invitation(owner, "coach", 600)
        self.service.accept_invitation(
            invitation["token"], "coach2@example.test", "another-secure-password"
        )
        with self.assertRaises(ApiError) as context:
            self.service.delete_account(owner)
        self.assertEqual("TRANSFER_REQUIRED", context.exception.code)
        self.assertEqual(2, len(self.service.list_members(owner)["members"]))


class CourtLabHttpTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        config = Config(
            database=str(Path(self.temp.name) / "http.sqlite3"),
            token_secret=b"z" * 32, allow_registration=True,
            allowed_origin="https://example.test",
        )
        try:
            self.server = Server(("127.0.0.1", 0), CourtLabService(config))
        except PermissionError:
            self.temp.cleanup()
            raise unittest.SkipTest("environment does not permit loopback sockets")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, body=None, token=None):
        headers = {"Content-Type": "application/json", "Origin": "https://example.test"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(
            self.base + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers, method=method,
        )
        with urllib.request.urlopen(request) as response:
            return response.status, dict(response.headers), json.load(response)

    def test_complete_http_flow_and_cors(self):
        status, headers, result = self.request("POST", "/api/register", {
            "email": "api@example.test", "password": "very-secure-password",
            "workspaceName": "API Tigers",
        })
        self.assertEqual(201, status)
        self.assertEqual("https://example.test", headers["Access-Control-Allow-Origin"])
        token = result["token"]
        self.assertEqual("owner", self.request("GET", "/api/me", token=token)[2]["role"])
        self.assertEqual(0, self.request("GET", "/api/snapshot", token=token)[2]["version"])
        saved = self.request("PUT", "/api/snapshot", {"version": 0, "data": {"games": []}}, token)[2]
        self.assertEqual(1, saved["version"])
        invite = self.request(
            "POST", "/api/invitations", {"role": "viewer", "expiresIn": 600}, token
        )[2]
        viewer_token = self.request("POST", "/api/invitations/accept", {
            "token": invite["token"], "email": "http-viewer@example.test",
            "password": "another-secure-password",
        })[2]["token"]
        members = self.request("GET", "/api/members", token=token)[2]["members"]
        viewer_id = next(item["id"] for item in members if item["role"] == "viewer")
        self.request("PATCH", f"/api/members/{viewer_id}", {"role": "coach"}, token)
        viewer_token = self.request("POST", "/api/login", {
            "email": "http-viewer@example.test", "password": "another-secure-password",
        })[2]["token"]
        self.request("DELETE", "/api/account", token=viewer_token)
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request("PUT", "/api/snapshot", {"version": 0, "data": {}}, token)
        self.assertEqual(409, error.exception.code)


if __name__ == "__main__":
    unittest.main()
