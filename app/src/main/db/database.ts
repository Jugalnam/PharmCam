import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function createDatabase(dbPath: string): Database.Database {
  const instance = new Database(dbPath)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  runMigrations(instance)
  return instance
}

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData')
  const dataDir = join(userDataPath, 'data')
  mkdirSync(dataDir, { recursive: true })

  const dbPath = join(dataDir, 'pharmcam.db')
  db = createDatabase(dbPath)
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
