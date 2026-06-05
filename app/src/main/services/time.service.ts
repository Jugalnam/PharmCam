import type Database from 'better-sqlite3'
import type { AuditService } from './audit.service'

const MAX_FORWARD_JUMP_MS = 24 * 60 * 60 * 1000

export class TimeService {
  private auditService?: AuditService

  constructor(private readonly db?: Database.Database) {}

  setAuditService(auditService: AuditService): void {
    this.auditService = auditService
  }

  now(userId?: number | null): string {
    const ts = new Date().toISOString()
    this.checkAnomaly(ts, userId)
    return ts
  }

  private checkAnomaly(ts: string, userId?: number | null): void {
    if (!this.db || !this.auditService) {
      return
    }

    const lastRecord = this.db
      .prepare('SELECT capture_ts AS ts FROM records ORDER BY id DESC LIMIT 1')
      .get() as { ts: string } | undefined

    const lastAudit = this.db
      .prepare('SELECT ts FROM audit_entries ORDER BY seq DESC LIMIT 1')
      .get() as { ts: string } | undefined

    const candidates = [lastRecord?.ts, lastAudit?.ts].filter(Boolean) as string[]
    if (candidates.length === 0) {
      return
    }

    const lastTs = candidates.reduce((latest, current) =>
      new Date(current) > new Date(latest) ? current : latest
    )

    const currentMs = new Date(ts).getTime()
    const lastMs = new Date(lastTs).getTime()

    if (currentMs < lastMs) {
      this.auditService.append('time_anomaly', {
        userId: userId ?? null,
        targetType: 'timestamp',
        after: `backward: ${ts} < ${lastTs}`
      })
      return
    }

    if (currentMs - lastMs > MAX_FORWARD_JUMP_MS) {
      this.auditService.append('time_anomaly', {
        userId: userId ?? null,
        targetType: 'timestamp',
        after: `jump: ${currentMs - lastMs}ms (${lastTs} → ${ts})`
      })
    }
  }
}
