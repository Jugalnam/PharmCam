import Database from 'better-sqlite3'
import { runMigrations } from '../src/main/db/migrations'
import { AuditService } from '../src/main/services/audit.service'
import { AuthService } from '../src/main/services/auth.service'
import { ConfigService } from '../src/main/services/config.service'
import { TimeService } from '../src/main/services/time.service'

function trySet(
  auth: AuthService,
  config: ConfigService,
  key: string,
  value: string
): { ok: boolean; error?: string } {
  try {
    const user = auth.requirePermission('config')
    return config.set(key, value, user.id)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '거부됨' }
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

  console.log('=== M5 ConfigService 테스트 ===\n')

  // ① operator가 set 시도 → 거부
  await auth.login('operator1', 'Operator1!')
  const opSet = trySet(auth, config, 'session.timeoutMin', '30')
  console.log(`① operator set 거부: ${!opSet.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   error: ${opSet.error}`)
  auth.logout()

  // ② admin이 core_locked audit.enabled 끄기 시도 → 거부
  await auth.login('admin', 'Admin123!')
  const coreSet = trySet(auth, config, 'audit.enabled', 'false')
  console.log(`\n② core_locked 변경 거부: ${!coreSet.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   error: ${coreSet.error}`)
  console.log(`   audit.enabled 값 유지: ${config.get('audit.enabled') === 'true' ? 'PASS' : 'FAIL'}`)

  // ③ 설정가능 항목 변경 → 성공 + config_change audit
  const editableSet = trySet(auth, config, 'session.timeoutMin', '20')
  const changedValue = config.get('session.timeoutMin')
  const configAudit = audit
    .list(20)
    .find(
      (e) =>
        e.action === 'config_change' &&
        e.targetId === 'session.timeoutMin' &&
        e.beforeValue === '15' &&
        e.afterValue === '20'
    )

  console.log(`\n③ 설정가능 항목 변경: ${editableSet.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   session.timeoutMin: 15 → ${changedValue}`)
  console.log(`   config_change audit: ${configAudit ? 'PASS' : 'FAIL'}`)
  if (configAudit) {
    console.log(`   audit before=${configAudit.beforeValue} after=${configAudit.afterValue}`)
  }

  const spec = config.getCurrentSpec()
  console.log(`\n   getCurrentSpec(): ${spec.length === 18 ? 'PASS' : 'FAIL'} (${spec.length}항목)`)
  const lockedCount = spec.filter((e) => e.coreLocked).length
  console.log(`   core_locked 항목 수: ${lockedCount} (기대 4)`)
  console.log(`   verifyChain: ${audit.verifyChain() === null ? 'PASS' : 'FAIL'}`)

  auth.logout()
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
