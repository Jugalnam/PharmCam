import { createHash } from 'crypto'
import type Database from 'better-sqlite3'
import type {
  CreateSignatureResult,
  EsignStatus,
  SignatureView
} from '../../shared/sign.types'
import type { SignatureMeaning, UserRole } from '../../shared/types'
import type { AuditService } from './audit.service'
import type { AuthService } from './auth.service'
import type { ConfigService } from './config.service'
import { hasPermission } from './rbac'
import type { TimeService } from './time.service'

interface RecordRow {
  id: number
  image_hash: string
}

interface SignatureRow {
  id: number
  record_id: number
  signer_id: number
  meaning: string
  ts: string
  sig_hash: string
  signer_name?: string
}

export function computeSigHash(
  recordId: number,
  signerId: number,
  meaning: string,
  ts: string,
  imageHash: string
): string {
  const payload = String(recordId) + String(signerId) + meaning + ts + imageHash
  return createHash('sha256').update(payload).digest('hex')
}

export class SignatureService {
  constructor(
    private readonly db: Database.Database,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly timeService: TimeService,
    private readonly authService: AuthService
  ) {}

  getEsignStatus(): EsignStatus {
    const enabled = this.configService.get('esign.enabled') === 'true'
    const actions = this.configService.getJson<string[]>('esign.actions', ['approve'])
    return { enabled, actions }
  }

  isRequired(meaning: SignatureMeaning): boolean {
    const { enabled, actions } = this.getEsignStatus()
    return enabled && actions.includes(meaning)
  }

  async create(
    recordId: number,
    meaning: SignatureMeaning,
    password: string,
    signerId: number,
    signerRole: UserRole
  ): Promise<CreateSignatureResult> {
    if (!this.isRequired(meaning)) {
      return { ok: false, error: '이 행위에는 전자서명이 필요하지 않습니다.' }
    }

    const rbacError = this.checkCanSign(signerRole, meaning)
    if (rbacError) {
      return { ok: false, error: rbacError }
    }

    if (!password) {
      return { ok: false, error: '서명을 위해 비밀번호 재인증이 필요합니다.', passwordRequired: true }
    }

    const record = this.db.prepare('SELECT id, image_hash FROM records WHERE id = ?').get(recordId) as
      | RecordRow
      | undefined

    if (!record) {
      return { ok: false, error: '기록을 찾을 수 없습니다.' }
    }

    const passwordValid = await this.authService.verifyPassword(signerId, password)
    if (!passwordValid) {
      return {
        ok: false,
        error: '비밀번호가 올바르지 않습니다. 서명이 거부되었습니다.',
        passwordRequired: true
      }
    }

    const existing = this.db
      .prepare(
        'SELECT id FROM signatures WHERE record_id = ? AND signer_id = ? AND meaning = ?'
      )
      .get(recordId, signerId, meaning) as { id: number } | undefined

    if (existing) {
      return { ok: false, error: '이미 동일한 의미의 서명이 존재합니다.' }
    }

    const ts = this.timeService.now(signerId)
    const sigHash = computeSigHash(recordId, signerId, meaning, ts, record.image_hash)

    const result = this.db
      .prepare(
        `INSERT INTO signatures (record_id, signer_id, meaning, ts, sig_hash)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(recordId, signerId, meaning, ts, sigHash)

    const signatureId = Number(result.lastInsertRowid)

    this.auditService.append('signature', {
      userId: signerId,
      targetType: 'signature',
      targetId: String(signatureId),
      after: JSON.stringify({ recordId, meaning, sigHash })
    })

    return { ok: true, signatureId }
  }

  listByRecord(recordId: number): SignatureView[] {
    const rows = this.db
      .prepare(
        `SELECT s.*, u.username AS signer_name
         FROM signatures s
         JOIN users u ON u.id = s.signer_id
         WHERE s.record_id = ?
         ORDER BY s.ts ASC`
      )
      .all(recordId) as SignatureRow[]

    return rows.map((row) => ({
      id: row.id,
      recordId: row.record_id,
      signerId: row.signer_id,
      signerName: row.signer_name ?? '',
      meaning: row.meaning as SignatureMeaning,
      ts: row.ts,
      sigHash: row.sig_hash
    }))
  }

  private checkCanSign(role: UserRole, meaning: SignatureMeaning): string | null {
    if (meaning === 'author') {
      if (!hasPermission(role, 'capture')) {
        return '작성자 서명 권한이 없습니다.'
      }
      return null
    }

    if (meaning === 'review' || meaning === 'approve') {
      if (!hasPermission(role, 'sign')) {
        return '검토·승인 서명은 reviewer 또는 admin만 가능합니다.'
      }
      return null
    }

    return '알 수 없는 서명 의미입니다.'
  }
}
