import type Database from 'better-sqlite3'

export const SCHEMA_VERSION = 3

const DDL_V1 = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  fail_count INTEGER NOT NULL DEFAULT 0,
  password_changed_at TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY,
  test_no TEXT NOT NULL,
  sample_id TEXT,
  operator_id INTEGER NOT NULL REFERENCES users(id),
  capture_ts TEXT NOT NULL,
  image_path TEXT NOT NULL,
  image_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'final',
  correction_of INTEGER REFERENCES records(id),
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_entries (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_value TEXT,
  after_value TEXT,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signatures (
  id INTEGER PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES records(id),
  signer_id INTEGER NOT NULL REFERENCES users(id),
  meaning TEXT NOT NULL,
  ts TEXT NOT NULL,
  sig_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  core_locked INTEGER NOT NULL DEFAULT 0,
  changed_by INTEGER,
  changed_ts TEXT
);

CREATE TABLE IF NOT EXISTS backup_log (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  mode TEXT NOT NULL,
  path TEXT,
  integrity_hash TEXT,
  result TEXT NOT NULL
);
`

const AUDIT_APPEND_ONLY_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS audit_no_update
  BEFORE UPDATE ON audit_entries
  BEGIN
    SELECT RAISE(ABORT, 'audit append-only');
  END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete
  BEFORE DELETE ON audit_entries
  BEGIN
    SELECT RAISE(ABORT, 'audit append-only');
  END;
`

export function runMigrations(db: Database.Database): void {
  db.exec(DDL_V1)

  const versionRow = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined

  const currentVersion = versionRow?.version ?? 0

  if (currentVersion === 0) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1)
  }

  if (currentVersion < 2) {
    db.exec(AUDIT_APPEND_ONLY_TRIGGERS)
    db.prepare('UPDATE schema_version SET version = 2').run()
  }

  if (currentVersion < 3) {
    const columns = db.pragma('table_info(users)') as Array<{ name: string }>
    if (!columns.some((c) => c.name === 'must_change_password')) {
      db.exec(
        'ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0'
      )
    }
    db.prepare('UPDATE schema_version SET version = 3').run()
  }
}
