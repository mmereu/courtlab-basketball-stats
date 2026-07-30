#!/usr/bin/env python3
"""Create a consistent SQLite backup and retain the newest copies."""

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

source = Path(os.environ.get("COURTLAB_DATABASE", "/var/lib/courtlab/courtlab.sqlite3"))
destination = Path(os.environ.get("COURTLAB_BACKUP_DIR", "/var/backups/courtlab"))
retention = max(3, int(os.environ.get("COURTLAB_BACKUP_RETENTION", "14")))
destination.mkdir(parents=True, exist_ok=True)
target = destination / f"courtlab-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.sqlite3"

with sqlite3.connect(source) as source_db, sqlite3.connect(target) as backup_db:
    source_db.backup(backup_db)
    if backup_db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise RuntimeError("Backup integrity check failed")

target.chmod(0o600)
for stale in sorted(destination.glob("courtlab-*.sqlite3"), reverse=True)[retention:]:
    stale.unlink()
