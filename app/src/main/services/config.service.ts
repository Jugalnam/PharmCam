import type Database from 'better-sqlite3'
import type { ConfigurationSpec, SetConfigResult } from '../../shared/config.types'
import type { ConfigEntry } from '../../shared/types'
import type { AuditService } from './audit.service'
import type { TimeService } from './time.service'

interface ConfigRow {
  key: string
  value: string
  core_locked: number
  changed_by: number | null
  changed_ts: string | null
}

const CONFIG_SEED: Array<{ key: string; value: string; coreLocked: boolean }> = [
  { key: 'audit.enabled', value: 'true', coreLocked: true },
  { key: 'integrity.enabled', value: 'true', coreLocked: true },
  { key: 'auth.required', value: 'true', coreLocked: true },
  { key: 'timestamp.source', value: 'os', coreLocked: true },
  { key: 'esign.enabled', value: 'false', coreLocked: false },
  { key: 'esign.actions', value: '["approve"]', coreLocked: false },
  { key: 'session.timeoutMin', value: '15', coreLocked: false },
  { key: 'password.minLength', value: '8', coreLocked: false },
  { key: 'password.expiryDays', value: '90', coreLocked: false },
  { key: 'login.maxFails', value: '5', coreLocked: false },
  { key: 'metadata.requiredFields', value: '["testNo","operatorId"]', coreLocked: false },
  // 회사별 추가 메타데이터 항목(URS-031) — [{key,label,required}] JSON. 기본 없음(빌트인만)
  { key: 'metadata.fields', value: '[]', coreLocked: false },
  { key: 'backup.mode', value: 'off', coreLocked: false },
  { key: 'backup.path', value: '""', coreLocked: false },
  { key: 'retention.days', value: '3650', coreLocked: false },
  { key: 'encryption.enabled', value: 'false', coreLocked: false },
  { key: 'lims.enabled', value: 'false', coreLocked: false },
  // 저장 위치(D-11) — 빈 값이면 기본 경로(userData/data) 사용. coreLocked=false(관리자 변경 가능)
  { key: 'storage.root', value: '', coreLocked: false }
]

export class ConfigService {
  constructor(
    private readonly db: Database.Database,
    private readonly auditService: AuditService,
    private readonly timeService: TimeService
  ) {}

  seed(): void {
    // INSERT OR IGNORE로 누락된 키만 추가한다(키는 PRIMARY KEY). 기존 값은 덮어쓰지 않으므로
    // 이미 운영 중인 DB에 신규 설정 키(예: storage.root)를 안전하게 추가할 수 있다(멱등).
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO config (key, value, core_locked) VALUES (?, ?, ?)'
    )

    for (const item of CONFIG_SEED) {
      insert.run(item.key, item.value, item.coreLocked ? 1 : 0)
    }
  }

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  getNumber(key: string, fallback = 0): number {
    const value = this.get(key)
    if (value === null) {
      return fallback
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  getJson<T>(key: string, fallback: T): T {
    const value = this.get(key)
    if (value === null) {
      return fallback
    }
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  set(key: string, value: string, changedBy: number): SetConfigResult {
    const row = this.db.prepare('SELECT * FROM config WHERE key = ?').get(key) as
      | ConfigRow
      | undefined

    if (!row) {
      return { ok: false, error: '설정 키를 찾을 수 없습니다.' }
    }

    if (row.core_locked === 1) {
      return { ok: false, error: '이 설정은 코어 잠금(core-locked)으로 변경할 수 없습니다.' }
    }

    if (row.value === value) {
      return { ok: true }
    }

    const changedTs = this.timeService.now(changedBy)

    this.db
      .prepare(
        'UPDATE config SET value = ?, changed_by = ?, changed_ts = ? WHERE key = ?'
      )
      .run(value, changedBy, changedTs, key)

    this.auditService.append('config_change', {
      userId: changedBy,
      targetType: 'config',
      targetId: key,
      before: row.value,
      after: value
    })

    return { ok: true }
  }

  getCurrentSpec(): ConfigurationSpec {
    const rows = this.db
      .prepare(
        'SELECT key, value, core_locked, changed_by, changed_ts FROM config ORDER BY key'
      )
      .all() as ConfigRow[]

    return rows.map((row) => this.toEntry(row))
  }

  private toEntry(row: ConfigRow): ConfigEntry {
    return {
      key: row.key,
      value: row.value,
      coreLocked: row.core_locked === 1,
      changedBy: row.changed_by,
      changedTs: row.changed_ts
    }
  }
}
