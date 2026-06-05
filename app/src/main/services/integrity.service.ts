import { createHash } from 'crypto'
import { accessSync, chmodSync, constants, readFileSync } from 'fs'
import type { AuditService } from './audit.service'

export class IntegrityService {
  constructor(private readonly auditService?: AuditService) {}

  hashFile(path: string): string {
    const data = readFileSync(path)
    return createHash('sha256').update(data).digest('hex')
  }

  setReadOnly(path: string): void {
    chmodSync(path, constants.S_IRUSR | constants.S_IRGRP | constants.S_IROTH)
  }

  verifyFile(path: string, expectedHash: string, userId?: number): boolean {
    const actual = this.hashFile(path)
    const ok = actual === expectedHash

    if (!ok && this.auditService) {
      this.auditService.append('integrity_warning', {
        userId: userId ?? null,
        targetType: 'file',
        targetId: path,
        before: expectedHash,
        after: actual
      })
    }

    return ok
  }

  isReadOnly(path: string): boolean {
    try {
      accessSync(path, constants.W_OK)
      return false
    } catch {
      return true
    }
  }
}
