import Database from 'better-sqlite3'
import { join } from 'path'
import { tmpdir } from 'os'
import { runMigrations } from '../src/main/db/migrations'
import { AuditService } from '../src/main/services/audit.service'
import { AuthService } from '../src/main/services/auth.service'
import { ConfigService } from '../src/main/services/config.service'
import { IntegrityService } from '../src/main/services/integrity.service'
import { RecordService } from '../src/main/services/record.service'
import { SignatureService, computeSigHash } from '../src/main/services/signature.service'
import { TimeService } from '../src/main/services/time.service'

const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function main(): Promise<void> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const timeService = new TimeService(db)
  const audit = new AuditService(db, timeService)
  timeService.setAuditService(audit)
  const config = new ConfigService(db, audit, timeService)
  config.seed()
  const integrity = new IntegrityService(audit)
  const auth = new AuthService(db, audit, config, timeService)
  const imagesDir = join(tmpdir(), `pharmcam-sign-${Date.now()}`)
  const records = new RecordService(db, audit, config, integrity, timeService, imagesDir)
  const sign = new SignatureService(db, audit, config, timeService, auth)

  const now = timeService.now()
  const reviewerHash = await auth.hashPassword('Reviewer1!')
  db.prepare(
    `INSERT INTO users
      (username, password_hash, role, status, fail_count, password_changed_at, must_change_password, created_at)
     VALUES ('reviewer1', ?, 'reviewer', 'active', 0, ?, 0, ?)`
  ).run(reviewerHash, now, now)

  const saved = records.save(
    { testNo: 'T-SIGN-001', imageDataBase64: TEST_PNG_BASE64 },
    1
  )
  const recordId = saved.recordId!

  console.log('=== M6 SignatureService 테스트 ===\n')

  // ① esign.enabled=false → 서명 불필요, create 거부
  const requiredOff = sign.isRequired('approve')
  const createOff = await sign.create(recordId, 'approve', 'Reviewer1!', 1, 'reviewer')
  console.log('① esign.enabled=false:')
  console.log(`   isRequired('approve'): ${!requiredOff ? 'PASS (false)' : 'FAIL'}`)
  console.log(`   create 거부: ${!createOff.ok ? 'PASS' : 'FAIL'}`)
  console.log('   → 서명 단계 생략 가능\n')

  // esign 활성화
  config.set('esign.enabled', 'true', 1)

  // ② esign.enabled=true → 비밀번호 재인증 요구
  const requiredOn = sign.isRequired('approve')
  const noPassword = await sign.create(recordId, 'approve', '', 1, 'reviewer')
  console.log('② esign.enabled=true:')
  console.log(`   isRequired('approve'): ${requiredOn ? 'PASS (true)' : 'FAIL'}`)
  console.log(
    `   빈 비밀번호 거부: ${!noPassword.ok && noPassword.passwordRequired ? 'PASS' : 'FAIL'}`
  )
  console.log(`   error: ${noPassword.error}\n`)

  // ③ 틀린 비밀번호 거부
  const wrongPw = await sign.create(recordId, 'approve', 'wrong-password', 1, 'reviewer')
  const sigCountWrong = (
    db.prepare('SELECT COUNT(*) AS c FROM signatures').get() as { c: number }
  ).c
  console.log('③ 틀린 비밀번호:')
  console.log(`   거부: ${!wrongPw.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   error: ${wrongPw.error}`)
  console.log(`   signatures 미생성: ${sigCountWrong === 0 ? 'PASS' : 'FAIL'}\n`)

  // ④ 정상 서명 → signatures + audit
  const ok = await sign.create(recordId, 'approve', 'Reviewer1!', 1, 'reviewer')
  const sigRow = db.prepare('SELECT * FROM signatures WHERE id = ?').get(ok.signatureId) as {
    record_id: number
    signer_id: number
    meaning: string
    ts: string
    sig_hash: string
  }
  const recordRow = db.prepare('SELECT image_hash FROM records WHERE id = ?').get(recordId) as {
    image_hash: string
  }
  const expectedHash = computeSigHash(recordId, 1, 'approve', sigRow.ts, recordRow.image_hash)
  const sigAudit = audit.list(50).find((e) => e.action === 'signature')

  console.log('④ 정상 서명:')
  console.log(`   create 성공: ${ok.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   signatures INSERT: ${sigRow ? 'PASS' : 'FAIL'}`)
  console.log(`   sig_hash 검증: ${sigRow.sig_hash === expectedHash ? 'PASS' : 'FAIL'}`)
  console.log(`   audit signature: ${sigAudit ? 'PASS' : 'FAIL'}`)
  if (sigAudit) {
    console.log(`   audit targetId=${sigAudit.targetId}`)
  }
  console.log(`   verifyChain: ${audit.verifyChain() === null ? 'PASS' : 'FAIL'}`)

  const operatorDenied = await sign.create(recordId, 'approve', 'x', 99, 'operator')
  console.log(
    `\n   operator RBAC 거부: ${!operatorDenied.ok && operatorDenied.error?.includes('reviewer') ? 'PASS' : 'FAIL'}`
  )

  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
