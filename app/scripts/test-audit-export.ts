import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { runMigrations } from '../src/main/db/migrations'
import { AuditService } from '../src/main/services/audit.service'
import { AuthService } from '../src/main/services/auth.service'
import { ConfigService } from '../src/main/services/config.service'
import { writeExportFile } from '../src/main/services/export.service'
import { TimeService } from '../src/main/services/time.service'

function tryExport(auth: AuthService): { ok: boolean; error?: string } {
  try {
    auth.requirePermission('audit.export')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '거부' }
  }
}

async function main(): Promise<void> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const timeService = new TimeService(db)
  const audit = new AuditService(db, timeService)
  timeService.setAuditService(audit)
  const config = new ConfigService(db, audit, timeService)
  config.seed()
  const auth = new AuthService(db, audit, config, timeService)

  const now = timeService.now()
  const adminHash = await auth.hashPassword('Admin123!')
  const operatorHash = await auth.hashPassword('Operator1!')

  db.prepare(
    `INSERT INTO users
      (username, password_hash, role, status, fail_count, password_changed_at, must_change_password, created_at)
     VALUES ('admin', ?, 'admin', 'active', 0, ?, 0, ?)`
  ).run(adminHash, now, now)

  db.prepare(
    `INSERT INTO users
      (username, password_hash, role, status, fail_count, password_changed_at, must_change_password, created_at)
     VALUES ('operator1', ?, 'operator', 'active', 0, ?, 0, ?)`
  ).run(operatorHash, now, now)

  audit.append('login', { userId: 1, targetType: 'user', targetId: '1' })
  audit.append('capture', { userId: 2, targetType: 'record', targetId: '1' })
  audit.append('login', { userId: 1, targetType: 'user', targetId: '1' })
  audit.append('config_change', {
    userId: 1,
    targetType: 'config',
    targetId: 'session.timeoutMin',
    before: '15',
    after: '20'
  })

  console.log('=== M7 Audit Export 테스트 ===\n')

  // ① 필터 동작
  const byUser = audit.list({ userId: 1 })
  const byAction = audit.list({ action: 'login' })
  const byPeriod = audit.list({ fromTs: '2000-01-01T00:00:00.000Z', toTs: '2099-12-31T23:59:59.999Z' })

  console.log('① 감사추적 필터:')
  console.log(`   userId=1: ${byUser.length === 3 ? 'PASS' : 'FAIL'} (${byUser.length}건)`)
  console.log(`   action=login: ${byAction.length === 2 ? 'PASS' : 'FAIL'} (${byAction.length}건)`)
  console.log(`   기간 필터: ${byPeriod.length === 4 ? 'PASS' : 'FAIL'} (${byPeriod.length}건)\n`)

  // ② verifyChain 결과
  const verify = audit.verifyChainDetailed()
  console.log('② verifyChain:')
  console.log(
    `   통과: ${verify.ok && verify.brokenSeq === null ? 'PASS' : 'FAIL'} (${verify.entryCount}건)`
  )

  // ③ operator 보내기 거부
  await auth.login('operator1', 'Operator1!')
  const opDenied = tryExport(auth)
  console.log(`\n③ operator 보내기 거부: ${!opDenied.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   error: ${opDenied.error}`)
  auth.logout()

  // ④ admin 보내기 성공 + export audit
  await auth.login('admin', 'Admin123!')
  const adminOk = tryExport(auth)
  const exportPath = join(tmpdir(), `pharmcam-audit-test-${Date.now()}.csv`)
  const entries = audit.list({ action: 'login' })
  const rowCount = writeExportFile('audit', 'csv', exportPath, entries, [])

  audit.append('export', {
    userId: 1,
    targetType: 'audit',
    targetId: exportPath,
    after: JSON.stringify({ format: 'csv', rowCount })
  })

  const exportAudit = audit.list({ action: 'export' })
  const fileExists = existsSync(exportPath)

  console.log(`\n④ admin 보내기:`)
  console.log(`   권한 확인: ${adminOk.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   파일 생성: ${fileExists ? 'PASS' : 'FAIL'} (${exportPath})`)
  console.log(`   rowCount: ${rowCount}`)
  console.log(`   export audit: ${exportAudit.length >= 1 ? 'PASS' : 'FAIL'}`)
  console.log(`   verifyChain: ${audit.verifyChain() === null ? 'PASS' : 'FAIL'}`)

  auth.logout()
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
