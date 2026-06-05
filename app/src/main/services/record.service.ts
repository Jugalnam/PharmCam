import { app } from 'electron'
import { chmodSync, constants, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'
import type {
  CorrectRecordInput,
  RecordDetail,
  RecordFilter,
  RecordListItem,
  SaveRecordInput,
  SaveRecordResult
} from '../../shared/record.types'
import type { RecordStatus } from '../../shared/types'
import type { AuditService } from './audit.service'
import type { ConfigService } from './config.service'
import type { CryptoService } from './crypto.service'
import type { IntegrityService } from './integrity.service'
import type { TimeService } from './time.service'

interface RecordRow {
  id: number
  test_no: string
  sample_id: string | null
  operator_id: number
  capture_ts: string
  image_path: string
  image_hash: string
  status: string
  correction_of: number | null
  meta_json: string | null
  created_at: string
}

export class RecordService {
  private readonly imagesDir: string

  constructor(
    private readonly db: Database.Database,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly integrityService: IntegrityService,
    private readonly timeService: TimeService,
    imagesDir?: string,
    private readonly cryptoService?: CryptoService
  ) {
    this.imagesDir = imagesDir ?? join(app.getPath('userData'), 'data', 'images')
    mkdirSync(this.imagesDir, { recursive: true })
  }

  save(input: SaveRecordInput, operatorId: number): SaveRecordResult {
    return this.persistRecord(input, operatorId, 'final', null)
  }

  correct(
    originalId: number,
    input: CorrectRecordInput,
    operatorId: number
  ): SaveRecordResult {
    const original = this.getRow(originalId)
    if (!original) {
      return { ok: false, error: '원본 기록을 찾을 수 없습니다.' }
    }

    const result = this.persistRecord(input, operatorId, 'corrected', originalId, 'record_correct')
    return result
  }

  list(filter: RecordFilter = {}): RecordListItem[] {
    const limit = filter.limit ?? 100
    let sql = `
      SELECT r.*, u.username AS operator_name
      FROM records r
      JOIN users u ON u.id = r.operator_id
    `
    const params: Array<string | number> = []

    if (filter.testNo) {
      sql += ' WHERE r.test_no = ?'
      params.push(filter.testNo)
    }

    sql += ' ORDER BY r.id DESC LIMIT ?'
    params.push(limit)

    const rows = this.db.prepare(sql).all(...params) as Array<
      RecordRow & { operator_name: string }
    >

    return rows.map((row) => this.toListItem(row))
  }

  get(id: number, viewerId: number): RecordDetail | null {
    const row = this.db
      .prepare(
        `SELECT r.*, u.username AS operator_name
         FROM records r
         JOIN users u ON u.id = r.operator_id
         WHERE r.id = ?`
      )
      .get(id) as (RecordRow & { operator_name: string }) | undefined

    if (!row) {
      return null
    }

    const integrityOk = existsSync(row.image_path)
      ? this.integrityService.verifyFile(row.image_path, row.image_hash, viewerId)
      : false

    return {
      ...this.toRecord(row),
      operatorName: row.operator_name,
      integrityOk
    }
  }

  private persistRecord(
    input: SaveRecordInput | CorrectRecordInput,
    operatorId: number,
    status: RecordStatus,
    correctionOf: number | null,
    auditAction: 'capture' | 'record_correct' = 'capture'
  ): SaveRecordResult {
    let imagePath: string | null = null

    try {
      const metadata = this.buildMetadata(input, operatorId)
      this.validateRequiredFields(metadata)

      const captureTs = this.timeService.now(operatorId)
      const imageBuffer = this.decodeImage(input.imageDataBase64)

      const filename = this.buildFilename(captureTs, operatorId, input.testNo)
      const useEncryption = this.cryptoService?.isEnabled() ?? false

      if (useEncryption && this.cryptoService) {
        imagePath = join(this.imagesDir, `${filename}.enc`)
        const encrypted = this.cryptoService.encryptFile(imageBuffer)
        writeFileSync(imagePath, encrypted)
      } else {
        imagePath = join(this.imagesDir, filename)
        writeFileSync(imagePath, imageBuffer)
      }

      const imageHash = this.integrityService.hashFile(imagePath)
      this.integrityService.setReadOnly(imagePath)

      const createdAt = this.timeService.now(operatorId)
      let metaJson: string | null = input.meta ? JSON.stringify(input.meta) : null
      if (metaJson && useEncryption && this.cryptoService) {
        metaJson = this.cryptoService.encryptString(metaJson)
      }

      const insert = this.db.transaction(() => {
        const result = this.db
          .prepare(
            `INSERT INTO records
              (test_no, sample_id, operator_id, capture_ts, image_path, image_hash,
               status, correction_of, meta_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            input.testNo,
            input.sampleId ?? null,
            operatorId,
            captureTs,
            imagePath,
            imageHash,
            status,
            correctionOf,
            metaJson,
            createdAt
          )

        const recordId = Number(result.lastInsertRowid)

        this.auditService.append(auditAction, {
          userId: operatorId,
          targetType: 'record',
          targetId: String(recordId),
          after: JSON.stringify({
            testNo: input.testNo,
            sampleId: input.sampleId ?? null,
            imageHash,
            status,
            correctionOf
          })
        })

        return recordId
      })

      const recordId = insert()
      return { ok: true, recordId }
    } catch (err) {
      if (imagePath && existsSync(imagePath)) {
        try {
          chmodWritable(imagePath)
          unlinkSync(imagePath)
        } catch {
          // rollback cleanup best-effort
        }
      }

      const message = err instanceof Error ? err.message : '알 수 없는 오류'
      this.auditService.append('capture_failed', {
        userId: operatorId,
        targetType: 'record',
        after: message
      })

      return { ok: false, error: message }
    }
  }

  private buildMetadata(
    input: SaveRecordInput | CorrectRecordInput,
    operatorId: number
  ): Record<string, unknown> {
    return {
      testNo: input.testNo?.trim(),
      operatorId,
      sampleId: input.sampleId?.trim() ?? null,
      ...input.meta
    }
  }

  private validateRequiredFields(metadata: Record<string, unknown>): void {
    const required = this.configService.getJson<string[]>('metadata.requiredFields', [
      'testNo',
      'operatorId'
    ])

    const missing = required.filter((field) => {
      const value = metadata[field]
      return value === undefined || value === null || value === ''
    })

    if (missing.length > 0) {
      throw new Error(`필수 항목이 누락되었습니다: ${missing.join(', ')}`)
    }
  }

  private decodeImage(imageDataBase64: string): Buffer {
    const base64 = imageDataBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length === 0) {
      throw new Error('이미지 데이터가 비어 있습니다.')
    }
    return buffer
  }

  private buildFilename(captureTs: string, operatorId: number, testNo: string): string {
    const safeTestNo = testNo.replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeTs = captureTs.replace(/[:.]/g, '-')
    return `${safeTs}_${operatorId}_${safeTestNo}.png`
  }

  private getRow(id: number): RecordRow | undefined {
    return this.db.prepare('SELECT * FROM records WHERE id = ?').get(id) as
      | RecordRow
      | undefined
  }

  private toRecord(row: RecordRow) {
    return {
      id: row.id,
      testNo: row.test_no,
      sampleId: row.sample_id,
      operatorId: row.operator_id,
      captureTs: row.capture_ts,
      imagePath: row.image_path,
      imageHash: row.image_hash,
      status: row.status as RecordStatus,
      correctionOf: row.correction_of,
      metaJson: row.meta_json,
      createdAt: row.created_at
    }
  }

  private toListItem(row: RecordRow & { operator_name: string }): RecordListItem {
    return {
      id: row.id,
      testNo: row.test_no,
      sampleId: row.sample_id,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      captureTs: row.capture_ts,
      status: row.status as RecordStatus,
      correctionOf: row.correction_of,
      imageHash: row.image_hash
    }
  }
}

function chmodWritable(path: string): void {
  chmodSync(path, constants.S_IWUSR | constants.S_IRUSR)
}
