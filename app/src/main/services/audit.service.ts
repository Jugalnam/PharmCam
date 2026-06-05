import { createHash } from 'crypto'
import type Database from 'better-sqlite3'
import type { AuditFilter } from '../../shared/audit.types'
import type { AuditEntry } from '../../shared/types'
import type { TimeService } from './time.service'

export const GENESIS_HASH = '0'.repeat(64)

export interface AuditAppendOptions {
  userId?: number | null
  targetType?: string | null
  targetId?: string | null
  before?: string | null
  after?: string | null
}

interface AuditRow {
  seq: number
  ts: string
  user_id: number | null
  action: string
  target_type: string | null
  target_id: string | null
  before_value: string | null
  after_value: string | null
  prev_hash: string
  entry_hash: string
}

export function computeEntryHash(
  seq: number,
  ts: string,
  userId: number | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  before: string | null,
  after: string | null,
  prevHash: string
): string {
  const payload =
    String(seq) +
    ts +
    (userId !== null ? String(userId) : '') +
    action +
    (targetType ?? '') +
    (targetId ?? '') +
    (before ?? '') +
    (after ?? '') +
    prevHash

  return createHash('sha256').update(payload).digest('hex')
}

function rowToEntry(row: AuditRow): AuditEntry {
  return {
    seq: row.seq,
    ts: row.ts,
    userId: row.user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    beforeValue: row.before_value,
    afterValue: row.after_value,
    prevHash: row.prev_hash,
    entryHash: row.entry_hash
  }
}

export class AuditService {
  constructor(
    private readonly db: Database.Database,
    private readonly timeService: TimeService
  ) {}

  append(action: string, options: AuditAppendOptions = {}): AuditEntry {
    const userId = options.userId ?? null
    const targetType = options.targetType ?? null
    const targetId = options.targetId ?? null
    const before = options.before ?? null
    const after = options.after ?? null

    const insert = this.db.transaction(() => {
      const lastRow = this.db
        .prepare('SELECT entry_hash FROM audit_entries ORDER BY seq DESC LIMIT 1')
        .get() as { entry_hash: string } | undefined

      const prevHash = lastRow?.entry_hash ?? GENESIS_HASH

      const maxRow = this.db
        .prepare('SELECT COALESCE(MAX(seq), 0) AS max_seq FROM audit_entries')
        .get() as { max_seq: number }

      const nextSeq = maxRow.max_seq + 1
      const ts = this.timeService.now()
      const entryHash = computeEntryHash(
        nextSeq,
        ts,
        userId,
        action,
        targetType,
        targetId,
        before,
        after,
        prevHash
      )

      this.db
        .prepare(
          `INSERT INTO audit_entries
            (ts, user_id, action, target_type, target_id, before_value, after_value, prev_hash, entry_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(ts, userId, action, targetType, targetId, before, after, prevHash, entryHash)

      const row = this.db
        .prepare('SELECT * FROM audit_entries WHERE seq = ?')
        .get(nextSeq) as AuditRow

      return rowToEntry(row)
    })

    return insert()
  }

  list(filter: AuditFilter = {}): AuditEntry[] {
    const limit = filter.limit ?? 500
    let sql = 'SELECT * FROM audit_entries WHERE 1=1'
    const params: Array<string | number> = []

    if (filter.userId !== undefined) {
      sql += ' AND user_id = ?'
      params.push(filter.userId)
    }

    if (filter.action) {
      sql += ' AND action = ?'
      params.push(filter.action)
    }

    if (filter.fromTs) {
      sql += ' AND ts >= ?'
      params.push(filter.fromTs)
    }

    if (filter.toTs) {
      sql += ' AND ts <= ?'
      params.push(filter.toTs)
    }

    sql += ' ORDER BY seq ASC LIMIT ?'
    params.push(limit)

    const rows = this.db.prepare(sql).all(...params) as AuditRow[]
    return rows.map(rowToEntry)
  }

  count(filter: AuditFilter = {}): number {
    let sql = 'SELECT COUNT(*) AS c FROM audit_entries WHERE 1=1'
    const params: Array<string | number> = []

    if (filter.userId !== undefined) {
      sql += ' AND user_id = ?'
      params.push(filter.userId)
    }

    if (filter.action) {
      sql += ' AND action = ?'
      params.push(filter.action)
    }

    if (filter.fromTs) {
      sql += ' AND ts >= ?'
      params.push(filter.fromTs)
    }

    if (filter.toTs) {
      sql += ' AND ts <= ?'
      params.push(filter.toTs)
    }

    const row = this.db.prepare(sql).get(...params) as { c: number }
    return row.c
  }

  verifyChainDetailed(): { ok: boolean; brokenSeq: number | null; entryCount: number } {
    const brokenSeq = this.verifyChain()
    return {
      ok: brokenSeq === null,
      brokenSeq,
      entryCount: this.count()
    }
  }

  verifyChain(): number | null {
    const rows = this.db
      .prepare('SELECT * FROM audit_entries ORDER BY seq ASC')
      .all() as AuditRow[]

    let expectedPrevHash = GENESIS_HASH

    for (const row of rows) {
      if (row.prev_hash !== expectedPrevHash) {
        return row.seq
      }

      const recomputed = computeEntryHash(
        row.seq,
        row.ts,
        row.user_id,
        row.action,
        row.target_type,
        row.target_id,
        row.before_value,
        row.after_value,
        expectedPrevHash
      )

      if (recomputed !== row.entry_hash) {
        return row.seq
      }

      expectedPrevHash = row.entry_hash
    }

    return null
  }
}
