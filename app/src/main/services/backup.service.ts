import { createHash } from 'crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  statfsSync
} from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type {
  BackupRunResult,
  BackupStatus,
  BackupVerifyResult
} from '../../shared/module.types'
import type { BackupMode, BackupResult } from '../../shared/types'
import type Database from 'better-sqlite3'
import type { AuditService } from './audit.service'
import type { ConfigService } from './config.service'
import type { TimeService } from './time.service'

const SPACE_WARN_FREE_PCT = 10

interface BackupLogRow {
  id: number
  ts: string
  mode: string
  path: string | null
  integrity_hash: string | null
  result: string
}

export class BackupService {
  private readonly dataDir: string

  constructor(
    private readonly db: Database.Database,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly timeService: TimeService,
    dataDir?: string
  ) {
    this.dataDir = dataDir ?? join(app.getPath('userData'), 'data')
  }

  getMode(): BackupMode {
    const mode = this.configService.get('backup.mode') ?? 'off'
    if (mode === 'internal' || mode === 'external' || mode === 'off') {
      return mode
    }
    return 'off'
  }

  getBackupRoot(): string {
    const configured = this.configService.get('backup.path')
    if (configured && configured !== '""' && configured !== '') {
      try {
        const parsed = JSON.parse(configured)
        if (typeof parsed === 'string' && parsed) {
          return parsed
        }
      } catch {
        return configured
      }
    }
    return join(app.getPath('userData'), 'backups')
  }

  status(): BackupStatus {
    const mode = this.getMode()
    const path = this.getBackupRoot()
    const lastRow = this.db
      .prepare('SELECT * FROM backup_log ORDER BY id DESC LIMIT 1')
      .get() as BackupLogRow | undefined

    const { freeSpaceMb, spaceWarning } = this.checkDiskSpace(path)

    let message = ''
    if (mode === 'off') {
      message = '백업이 비활성화되어 있습니다.'
    } else if (mode === 'external') {
      message = '외부 백업 모드 — 앱은 백업을 수행하지 않습니다.'
    } else if (spaceWarning) {
      message = `저장공간 부족 경고 — 여유 ${freeSpaceMb ?? 0}MB (URS-063)`
    } else {
      message = '내부 백업 준비됨'
    }

    return {
      mode,
      path,
      lastBackup: lastRow
        ? {
            id: lastRow.id,
            ts: lastRow.ts,
            mode: lastRow.mode as BackupMode,
            path: lastRow.path,
            integrityHash: lastRow.integrity_hash,
            result: lastRow.result as BackupResult
          }
        : null,
      spaceWarning,
      freeSpaceMb,
      message
    }
  }

  runNow(userId: number): BackupRunResult {
    const mode = this.getMode()
    if (mode === 'off') {
      return { ok: false, error: '백업이 비활성화되어 있습니다 (backup.mode=off).' }
    }
    if (mode === 'external') {
      return { ok: false, error: '외부 백업 모드에서는 앱이 백업을 수행하지 않습니다.' }
    }

    const backupRoot = this.getBackupRoot()
    mkdirSync(backupRoot, { recursive: true })

    const { spaceWarning } = this.checkDiskSpace(backupRoot)
    if (spaceWarning) {
      this.auditService.append('backup_warning', {
        userId,
        targetType: 'backup',
        after: 'storage_threshold'
      })
    }

    const ts = this.timeService.now(userId)
    const destDir = join(backupRoot, `backup-${ts.replace(/[:.]/g, '-')}`)

    try {
      mkdirSync(destDir, { recursive: true })
      cpSync(this.dataDir, join(destDir, 'data'), { recursive: true })

      const integrityHash = hashDirectory(join(destDir, 'data'))
      const result = this.db
        .prepare(
          `INSERT INTO backup_log (ts, mode, path, integrity_hash, result)
           VALUES (?, 'internal', ?, ?, 'ok')`
        )
        .run(ts, destDir, integrityHash)

      const backupId = Number((result as { lastInsertRowid: number | bigint }).lastInsertRowid)

      this.auditService.append('backup', {
        userId,
        targetType: 'backup',
        targetId: String(backupId),
        after: JSON.stringify({ path: destDir, integrityHash })
      })

      return { ok: true, backupId, path: destDir, integrityHash }
    } catch (err) {
      const message = err instanceof Error ? err.message : '백업 실패'
      const failTs = this.timeService.now(userId)
      this.db
        .prepare(
          `INSERT INTO backup_log (ts, mode, path, integrity_hash, result)
           VALUES (?, 'internal', ?, NULL, 'fail')`
        )
        .run(failTs, destDir)

      return { ok: false, error: message }
    }
  }

  verify(): BackupVerifyResult {
    const last = this.db
      .prepare("SELECT * FROM backup_log WHERE result = 'ok' ORDER BY id DESC LIMIT 1")
      .get() as BackupLogRow | undefined

    if (!last || !last.path || !last.integrity_hash) {
      return { ok: false, error: '검증할 백업이 없습니다.' }
    }

    const dataPath = join(last.path, 'data')
    if (!existsSync(dataPath)) {
      return { ok: false, backupId: last.id, error: '백업 경로가 존재하지 않습니다.' }
    }

    const recomputed = hashDirectory(dataPath)
    if (recomputed !== last.integrity_hash) {
      return { ok: false, backupId: last.id, error: '무결성 해시 불일치' }
    }

    return { ok: true, backupId: last.id }
  }

  recoverVerify(backupId?: number): BackupVerifyResult {
    let row: BackupLogRow | undefined

    if (backupId) {
      row = this.db.prepare('SELECT * FROM backup_log WHERE id = ?').get(backupId) as
        | BackupLogRow
        | undefined
    } else {
      row = this.db
        .prepare("SELECT * FROM backup_log WHERE result = 'ok' ORDER BY id DESC LIMIT 1")
        .get() as BackupLogRow | undefined
    }

    if (!row || !row.path) {
      return { ok: false, error: '복구검증할 백업이 없습니다.' }
    }

    const backupData = join(row.path, 'data')
    if (!existsSync(backupData)) {
      return { ok: false, backupId: row.id, error: '백업 데이터가 없습니다.' }
    }

    const backupHash = hashDirectory(backupData)
    if (row.integrity_hash && backupHash !== row.integrity_hash) {
      return { ok: false, backupId: row.id, error: '백업 무결성 검증 실패' }
    }

    const backupDb = join(backupData, 'pharmcam.db')
    if (!existsSync(backupDb)) {
      return { ok: false, backupId: row.id, error: '백업에 pharmcam.db가 없습니다.' }
    }

    return { ok: true, backupId: row.id }
  }

  private checkDiskSpace(targetPath: string): { freeSpaceMb: number | null; spaceWarning: boolean } {
    try {
      const stats = statfsSync(targetPath)
      const freeBytes = stats.bfree * stats.bsize
      const totalBytes = stats.blocks * stats.bsize
      const freePct = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 100
      const freeSpaceMb = Math.round(freeBytes / (1024 * 1024))
      return {
        freeSpaceMb,
        spaceWarning: freePct < SPACE_WARN_FREE_PCT
      }
    } catch {
      return { freeSpaceMb: null, spaceWarning: false }
    }
  }
}

function walkFiles(dir: string): string[] {
  const result: string[] = []
  if (!existsSync(dir)) {
    return result
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...walkFiles(full))
    } else {
      result.push(full)
    }
  }
  return result
}

function hashFile(path: string): string {
  const data = readFileSync(path)
  return createHash('sha256').update(data).digest('hex')
}

export function hashDirectory(dir: string): string {
  const files = walkFiles(dir).sort()
  const h = createHash('sha256')
  for (const file of files) {
    const rel = file.replace(dir, '').replace(/\\/g, '/')
    h.update(rel)
    h.update(hashFile(file))
  }
  return h.digest('hex')
}
