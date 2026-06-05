import Database from 'better-sqlite3'
import { join } from 'path'
import { tmpdir } from 'os'
import { runMigrations } from '../src/main/db/migrations'
import { AuditService } from '../src/main/services/audit.service'
import { ConfigService } from '../src/main/services/config.service'
import { IntegrityService } from '../src/main/services/integrity.service'
import { RecordService } from '../src/main/services/record.service'
import { TimeService } from '../src/main/services/time.service'

// 1x1 PNG
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function main(): Promise<void> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const timeService = new TimeService(db)
  const audit = new AuditService(db, timeService)
  timeService.setAuditService(audit)
  const configService = new ConfigService(db, audit, timeService)
  configService.seed()
  const integrity = new IntegrityService(audit)

  const imagesDir = join(tmpdir(), `pharmcam-test-${Date.now()}`)
  const records = new RecordService(
    db,
    audit,
    configService,
    integrity,
    timeService,
    imagesDir
  )

  // operator 사용자
  const now = timeService.now()
  db.prepare(
    `INSERT INTO users
      (username, password_hash, role, status, fail_count, password_changed_at, must_change_password, created_at)
     VALUES ('operator1', 'hash', 'operator', 'active', 0, ?, 0, ?)`
  ).run(now, now)

  console.log('=== M4 RecordService 테스트 ===\n')

  // 1) 필수 항목 누락 → 거부 + capture_failed
  const missing = records.save(
    { testNo: '', imageDataBase64: TEST_PNG_BASE64 },
    1
  )
  console.log(`1) 필수항목 누락 거부: ${!missing.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   error: ${missing.error}`)

  const failedAudits = audit.list(20).filter((e) => e.action === 'capture_failed')
  console.log(`   capture_failed audit: ${failedAudits.length >= 1 ? 'PASS' : 'FAIL'}\n`)

  // 2) 정상 저장 1건
  const saved = records.save(
    {
      testNo: 'T-2026-001',
      sampleId: 'S-42',
      imageDataBase64: TEST_PNG_BASE64
    },
    1
  )
  console.log(`2) 촬영 저장: ${saved.ok ? 'PASS' : 'FAIL'} (recordId=${saved.recordId})`)

  const row = db.prepare('SELECT * FROM records WHERE id = ?').get(saved.recordId) as {
    id: number
    test_no: string
    image_path: string
    image_hash: string
    capture_ts: string
  }

  console.log(`   records INSERT: ${row ? 'PASS' : 'FAIL'}`)
  console.log(`   test_no=${row.test_no}, capture_ts=${row.capture_ts}`)

  const captureAudit = audit.list(20).find((e) => e.action === 'capture')
  console.log(`   audit capture: ${captureAudit ? 'PASS' : 'FAIL'}`)

  const readOnly = integrity.isReadOnly(row.image_path)
  console.log(`   파일 읽기전용: ${readOnly ? 'PASS' : 'FAIL'}`)

  const hashOk = integrity.verifyFile(row.image_path, row.image_hash, 1)
  console.log(`   SHA-256 재검증: ${hashOk ? 'PASS' : 'FAIL'}`)
  console.log(`   image_hash=${row.image_hash.slice(0, 16)}…\n`)

  // 3) get() 무결성 통과
  const detail = records.get(row.id, 1)
  console.log(`3) get() integrityOk: ${detail?.integrityOk ? 'PASS' : 'FAIL'}\n`)

  // 4) 정정 기록
  const corrected = records.correct(
    row.id,
    { testNo: 'T-2026-001', sampleId: 'S-42-corrected', imageDataBase64: TEST_PNG_BASE64 },
    1
  )
  const correctedRow = db
    .prepare('SELECT status, correction_of FROM records WHERE id = ?')
    .get(corrected.recordId) as { status: string; correction_of: number }

  console.log(`4) 정정 기록: ${corrected.ok && correctedRow.status === 'corrected' ? 'PASS' : 'FAIL'}`)
  console.log(`   correction_of=${correctedRow.correction_of}`)

  const correctAudit = audit
    .list(20)
    .find((e) => e.action === 'record_correct' && e.targetId === String(corrected.recordId))
  console.log(`   audit record_correct: ${correctAudit ? 'PASS' : 'FAIL'}`)
  console.log(`   verifyChain: ${audit.verifyChain() === null ? 'PASS' : 'FAIL'}`)

  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
