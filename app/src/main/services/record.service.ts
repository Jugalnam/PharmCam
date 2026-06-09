import { app } from 'electron'
import { chmodSync, constants, existsSync, mkdirSync, statfsSync, unlinkSync, writeFileSync } from 'fs'
import { isAbsolute, join } from 'path'
import type Database from 'better-sqlite3'
import type {
  CorrectRecordInput,
  MetadataField,
  RecordDetail,
  RecordFilter,
  RecordListItem,
  RecordQueryUser,
  RecordUserOption,
  SaveRecordInput,
  SaveRecordResult
} from '../../shared/record.types'
import type { SetConfigResult, StorageInfo, StorageSpace } from '../../shared/config.types'
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
  /** 테스트·특수배포용 고정 경로 override. 지정 시 config(storage.root)보다 우선한다. */
  private readonly imagesDirOverride?: string

  constructor(
    private readonly db: Database.Database,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly integrityService: IntegrityService,
    private readonly timeService: TimeService,
    imagesDir?: string,
    private readonly cryptoService?: CryptoService
  ) {
    this.imagesDirOverride = imagesDir
  }

  /** 기본 데이터 루트 — storage.root가 비어 있을 때 사용 */
  private defaultStorageRoot(): string {
    return join(app.getPath('userData'), 'data')
  }

  /** 현재 적용 중인 데이터 루트(절대경로). config storage.root가 비어 있으면 기본값. */
  getStorageRoot(): string {
    const configured = this.configService.get('storage.root')
    if (configured && configured.trim()) {
      return configured.trim()
    }
    return this.defaultStorageRoot()
  }

  /** 신규 이미지가 저장될 폴더(root/images)를 보장(없으면 생성)하고 반환.
   *  D-11: 저장 시점에 config를 읽어 경로를 결정한다(런타임 반영, 재시작 불필요). */
  private resolveImagesDir(): string {
    const dir = this.imagesDirOverride ?? join(this.getStorageRoot(), 'images')
    mkdirSync(dir, { recursive: true })
    return dir
  }

  /** 데이터 루트 폴더를 보장(없으면 생성)하고 절대경로를 반환 — '폴더 열기'용 */
  ensureStorageRoot(): string {
    const root = this.imagesDirOverride
      ? join(this.imagesDirOverride, '..')
      : this.getStorageRoot()
    mkdirSync(root, { recursive: true })
    return root
  }

  /** 저장 위치(실제 데이터 루트)의 디스크 여유 공간 점검(URS-063). 백업과 무관하게 상시 조회. */
  getStorageSpace(): StorageSpace {
    const minFreeMb = this.configService.getNumber('storage.minFreeMb', 500)
    const root = this.imagesDirOverride ?? this.getStorageRoot()
    try {
      mkdirSync(root, { recursive: true })
      const st = statfsSync(root)
      const freeMb = Math.round((st.bavail * st.bsize) / (1024 * 1024))
      const totalMb = Math.round((st.blocks * st.bsize) / (1024 * 1024))
      return { freeMb, totalMb, minFreeMb, lowSpace: freeMb < minFreeMb }
    } catch {
      return { freeMb: null, totalMb: null, minFreeMb, lowSpace: false }
    }
  }

  /** UI 표시용 현재 저장 위치 정보 */
  getStorageInfo(): StorageInfo {
    const configured = this.configService.get('storage.root')
    const isDefault = !configured || !configured.trim()
    const root = this.imagesDirOverride ?? this.getStorageRoot()
    const imagesDir = this.imagesDirOverride ?? join(root, 'images')
    return { root, imagesDir, isDefault, exists: existsSync(imagesDir) }
  }

  /** 저장 위치 후보 경로 검증 — 로컬 절대경로 + 쓰기권한(D-11). 네트워크/UNC 거부. */
  validateStorageRoot(target: string): { ok: boolean; error?: string } {
    const p = target?.trim()
    if (!p) {
      return { ok: false, error: '경로를 입력하세요.' }
    }
    if (p.startsWith('\\\\') || p.startsWith('//')) {
      return {
        ok: false,
        error: '네트워크/공유 폴더(UNC 경로)는 지정할 수 없습니다. 로컬 경로만 허용됩니다.'
      }
    }
    if (!isAbsolute(p) || !/^[a-zA-Z]:[\\/]/.test(p)) {
      return { ok: false, error: '로컬 드라이브 절대경로(예: C:\\PharmCam\\data)만 허용됩니다.' }
    }
    try {
      mkdirSync(p, { recursive: true })
      const probe = join(p, '.pharmcam-write-test')
      writeFileSync(probe, 'ok')
      unlinkSync(probe)
    } catch {
      return { ok: false, error: '해당 경로에 쓰기 권한이 없거나 폴더를 만들 수 없습니다.' }
    }
    return { ok: true }
  }

  /** 저장 위치 변경 — 검증 통과 시 config에 저장(config.set이 이전→이후 경로를 감사추적에 기록).
   *  D-11: 마이그레이션은 하지 않는다. 기존 기록은 절대경로(image_path)로 옛 위치에서 계속 조회된다. */
  setStorageRoot(target: string, userId: number): SetConfigResult {
    const validation = this.validateStorageRoot(target)
    if (!validation.ok) {
      return { ok: false, error: validation.error }
    }
    return this.configService.set('storage.root', target.trim(), userId)
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

  list(filter: RecordFilter = {}, queryUser?: RecordQueryUser): RecordListItem[] {
    const limit = filter.limit ?? 100
    let sql = `
      SELECT r.*, u.username AS operator_name
      FROM records r
      JOIN users u ON u.id = r.operator_id
      WHERE 1=1
    `
    const params: Array<string | number> = []

    if (filter.testNo) {
      sql += ' AND r.test_no = ?'
      params.push(filter.testNo)
    }

    if (filter.fromTs) {
      sql += ' AND r.capture_ts >= ?'
      params.push(filter.fromTs)
    }

    if (filter.toTs) {
      sql += ' AND r.capture_ts <= ?'
      params.push(filter.toTs)
    }

    if (queryUser?.role === 'operator') {
      sql += ' AND r.operator_id = ?'
      params.push(queryUser.id)
    } else if (filter.operatorId !== undefined) {
      sql += ' AND r.operator_id = ?'
      params.push(filter.operatorId)
    }

    sql += ' ORDER BY r.id DESC LIMIT ?'
    params.push(limit)

    const rows = this.db.prepare(sql).all(...params) as Array<
      RecordRow & { operator_name: string }
    >

    return rows.map((row) => this.toListItem(row))
  }

  get(id: number, viewerId: number, queryUser?: RecordQueryUser): RecordDetail | null {
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

    if (queryUser?.role === 'operator' && row.operator_id !== queryUser.id) {
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

  listRecordUsers(): RecordUserOption[] {
    return this.db
      .prepare(
        `SELECT DISTINCT u.id, u.username
         FROM records r
         JOIN users u ON u.id = r.operator_id
         ORDER BY u.username`
      )
      .all() as RecordUserOption[]
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
      // 저장 시점에 현재 설정된 저장 위치를 해석(D-11)
      const imagesDir = this.resolveImagesDir()

      if (useEncryption && this.cryptoService) {
        imagePath = join(imagesDir, `${filename}.enc`)
        const encrypted = this.cryptoService.encryptFile(imageBuffer)
        writeFileSync(imagePath, encrypted)
      } else {
        imagePath = join(imagesDir, filename)
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
    // 회사가 추가한 사용자 정의 필수 항목도 함께 강제(URS-031)
    const customRequired = this.getMetadataFields()
      .filter((f) => f.required)
      .map((f) => f.key)
    const all = [...new Set([...required, ...customRequired])]

    const missing = all.filter((field) => {
      const value = metadata[field]
      return value === undefined || value === null || value === ''
    })

    if (missing.length > 0) {
      throw new Error(`필수 항목이 누락되었습니다: ${missing.join(', ')}`)
    }
  }

  /** 회사별 추가 메타데이터 항목 목록(URS-031). 손상된 항목은 걸러서 반환. */
  getMetadataFields(): MetadataField[] {
    const raw = this.configService.getJson<MetadataField[]>('metadata.fields', [])
    if (!Array.isArray(raw)) {
      return []
    }
    return raw
      .filter((f) => f && typeof f.key === 'string' && typeof f.label === 'string')
      .map((f) => ({ key: f.key, label: f.label, required: !!f.required }))
  }

  /** 추가 메타데이터 항목 저장 — 키 형식·중복·예약어 검증 후 config에 기록(감사추적됨). */
  setMetadataFields(fields: MetadataField[], userId: number): SetConfigResult {
    if (!Array.isArray(fields)) {
      return { ok: false, error: '항목 목록이 올바르지 않습니다.' }
    }
    if (fields.length > 20) {
      return { ok: false, error: '추가 항목은 최대 20개까지 정의할 수 있습니다.' }
    }
    const reserved = ['testNo', 'sampleId', 'operatorId', 'id', 'captureTs']
    const seen = new Set<string>()
    const normalized: MetadataField[] = []
    for (const f of fields) {
      const key = (f?.key ?? '').trim()
      const label = (f?.label ?? '').trim()
      if (!key || !label) {
        return { ok: false, error: '항목 키와 이름을 모두 입력하세요.' }
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) {
        return {
          ok: false,
          error: `키 형식 오류: "${key}" (영문으로 시작, 영문·숫자·_ 만 허용)`
        }
      }
      if (reserved.includes(key)) {
        return { ok: false, error: `예약된 키는 사용할 수 없습니다: ${key}` }
      }
      if (seen.has(key)) {
        return { ok: false, error: `중복된 키: ${key}` }
      }
      seen.add(key)
      normalized.push({ key, label, required: !!f.required })
    }
    return this.configService.set('metadata.fields', JSON.stringify(normalized), userId)
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
