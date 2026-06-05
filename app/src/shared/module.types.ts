import type { BackupMode, BackupResult } from './types'

export interface CryptoStatus {
  enabled: boolean
  safeStorageAvailable: boolean
  keyStored: boolean
}

export interface BackupStatus {
  mode: BackupMode
  path: string
  lastBackup: BackupLogEntry | null
  spaceWarning: boolean
  freeSpaceMb: number | null
  message: string
}

export interface BackupLogEntry {
  id: number
  ts: string
  mode: BackupMode
  path: string | null
  integrityHash: string | null
  result: BackupResult
}

export interface BackupRunResult {
  ok: boolean
  backupId?: number
  path?: string
  integrityHash?: string
  error?: string
}

export interface BackupVerifyResult {
  ok: boolean
  backupId?: number
  error?: string
}

export interface LimsExportResult {
  ok: boolean
  error?: string
  externalId?: string
}
