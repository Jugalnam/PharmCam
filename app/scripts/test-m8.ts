import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { runMigrations } from '../src/main/db/migrations'
import { AuditService } from '../src/main/services/audit.service'
import { AuthService } from '../src/main/services/auth.service'
import { BackupService } from '../src/main/services/backup.service'
import { ConfigService } from '../src/main/services/config.service'
import { CryptoService, isUsingTestSafeStorage } from '../src/main/services/crypto.service'
import { IntegrityService } from '../src/main/services/integrity.service'
import { LimsConnector } from '../src/main/services/lims.connector'
import { RecordService } from '../src/main/services/record.service'
import { TimeService } from '../src/main/services/time.service'

const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function main(): Promise<void> {
  const baseDir = join(tmpdir(), `pharmcam-m8-${Date.now()}`)
  const dataDir = join(baseDir, 'data')
  const imagesDir = join(dataDir, 'images')
  const backupRoot = join(baseDir, 'backups')
  mkdirSync(imagesDir, { recursive: true })
  writeFileSync(join(dataDir, 'pharmcam.db'), 'sqlite-placeholder')

  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const timeService = new TimeService(db)
  const audit = new AuditService(db, timeService)
  timeService.setAuditService(audit)
  const config = new ConfigService(db, audit, timeService)
  config.seed()
  const integrity = new IntegrityService(audit)
  const crypto = new CryptoService(config, dataDir)
  const records = new RecordService(
    db,
    audit,
    config,
    integrity,
    timeService,
    imagesDir,
    crypto
  )
  const backup = new BackupService(db, config, audit, timeService, dataDir)
  const lims = new LimsConnector(config)

  db.prepare(
    `INSERT INTO users
      (username, password_hash, role, status, fail_count, password_changed_at, must_change_password, created_at)
     VALUES ('op', 'hash', 'operator', 'active', 0, '2026-01-01', 0, '2026-01-01')`
  ).run()

  console.log('=== M8 선택 모듈 테스트 ===\n')

  const plain = records.save({ testNo: 'T-PLAIN', imageDataBase64: TEST_PNG_BASE64 }, 1)
  const plainRow = db
    .prepare('SELECT image_path FROM records WHERE id = ?')
    .get(plain.recordId) as { image_path: string }

  console.log('① encryption.enabled=false:')
  console.log(`   저장 성공: ${plain.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   평문 파일 (.png): ${plainRow.image_path.endsWith('.png') ? 'PASS' : 'FAIL'}`)
  console.log(`   key 미생성: ${!crypto.getStatus().keyStored ? 'PASS' : 'FAIL'}\n`)

  config.set('encryption.enabled', 'true', 1)

  let encOk = false
  let safeStorageUsed = false

  try {
    const enc = records.save({ testNo: 'T-ENC', imageDataBase64: TEST_PNG_BASE64 }, 1)
    encOk = enc.ok

    if (enc.ok) {
      const encRow = db
        .prepare('SELECT image_path FROM records WHERE id = ?')
        .get(enc.recordId) as { image_path: string }
      const encData = readFileSync(encRow.image_path)
      const decrypted = crypto.decrypt(encData)
      const cryptoStatus = crypto.getStatus()
      safeStorageUsed = cryptoStatus.safeStorageAvailable && cryptoStatus.keyStored

      console.log('② encryption.enabled=true:')
      console.log(`   저장 성공: PASS`)
      console.log(`   .enc 파일: ${encRow.image_path.endsWith('.enc') ? 'PASS' : 'FAIL'}`)
      const keyViaSafeStorage = cryptoStatus.keyStored && !isUsingTestSafeStorage()
      const keyViaTestAdapter = cryptoStatus.keyStored && isUsingTestSafeStorage()
      console.log(
        `   safeStorage(DPAPI) 사용 가능: ${keyViaSafeStorage ? 'PASS' : keyViaTestAdapter ? 'PASS (test adapter)' : 'FAIL'}`
      )
      console.log(`   키 보관 파일 존재: ${cryptoStatus.keyStored ? 'PASS' : 'FAIL'}`)
      console.log(`   복호화 성공: ${decrypted.length > 0 ? 'PASS' : 'FAIL'}`)
      console.log(`   AES-256-GCM 헤더: ${encData.subarray(0, 6).toString() === 'PHCAM1' ? 'PASS' : 'FAIL'}\n`)
    }
  } catch (err) {
    console.log(`② encryption.enabled=true: FAIL`)
    console.log(`   error: ${err instanceof Error ? err.message : err}\n`)
  }

  if (!encOk) {
    console.log('② encryption.enabled=true: FAIL (저장 실패)\n')
  }

  config.set('backup.mode', 'internal', 1)
  config.set('backup.path', JSON.stringify(backupRoot), 1)

  const run = backup.runNow(1)
  const verify = backup.verify()
  const recover = backup.recoverVerify(run.backupId)
  const backupLog = db.prepare('SELECT COUNT(*) AS c FROM backup_log').get() as { c: number }

  console.log('③ backup.mode=internal:')
  console.log(`   백업 생성: ${run.ok ? 'PASS' : 'FAIL'} → ${run.path}`)
  console.log(`   integrity_hash: ${run.integrityHash ? 'PASS' : 'FAIL'}`)
  console.log(`   무결성 검증(verify): ${verify.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   복구검증(recoverVerify): ${recover.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   backup_log 기록: ${backupLog.c >= 1 ? 'PASS' : 'FAIL'}\n`)

  const limsOff = await lims.exportRecord({
    id: 1,
    testNo: 'T',
    sampleId: null,
    operatorId: 1,
    captureTs: timeService.now(),
    imagePath: '/x',
    imageHash: 'abc',
    status: 'final',
    correctionOf: null,
    metaJson: null,
    createdAt: timeService.now()
  })

  console.log('④ lims.enabled=false:')
  console.log(`   커넥터 비활성: ${!lims.isEnabled() ? 'PASS' : 'FAIL'}`)
  console.log(`   exportRecord 거부: ${!limsOff.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   error: ${limsOff.error}`)

  if (safeStorageUsed && !isUsingTestSafeStorage()) {
    console.log('\n   ※ 암호화 키는 Electron safeStorage(DPAPI)로 보호됨')
  } else if (isUsingTestSafeStorage() && crypto.getStatus().keyStored) {
    console.log('\n   ※ 자동화 테스트: test adapter 사용. 실제 앱(npm start)에서는 DPAPI 적용')
  }

  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
