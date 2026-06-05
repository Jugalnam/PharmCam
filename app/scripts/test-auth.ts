import Database from 'better-sqlite3'
import { runMigrations } from '../src/main/db/migrations'
import { AuditService } from '../src/main/services/audit.service'
import { AuthService } from '../src/main/services/auth.service'
import { ConfigService } from '../src/main/services/config.service'
import { TimeService } from '../src/main/services/time.service'

async function main(): Promise<void> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const timeService = new TimeService(db)
  const audit = new AuditService(db, timeService)
  timeService.setAuditService(audit)
  const configService = new ConfigService(db, audit, timeService)
  configService.seed()

  // 잠금 테스트를 빠르게: maxFails=3
  db.prepare("UPDATE config SET value = '3' WHERE key = 'login.maxFails'").run()
  const auth = new AuthService(db, audit, configService, timeService)

  await auth.seedAdminAccount()

  // 테스트용 operator 계정 생성
  const now = timeService.now()
  const operatorHash = await auth.hashPassword('Operator1!')
  db.prepare(
    `INSERT INTO users
      (username, password_hash, role, status, fail_count, password_changed_at, created_at)
     VALUES ('operator1', ?, 'operator', 'active', 0, ?, ?)`
  ).run(operatorHash, now, now)

  console.log('=== M3 AuthService 테스트 ===\n')

  // 1) admin 로그인 — must_change_password=true
  const okLogin = await auth.login('admin', 'Admin123!')
  const mustChange = okLogin.user?.mustChangePassword === true
  console.log(`1) admin 로그인 성공: ${okLogin.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   must_change_password: ${mustChange ? 'PASS (true)' : 'FAIL'}`)

  // 1b) must_change_password 상태에서 권한 기능 차단
  let blocked = false
  try {
    auth.requirePermission('audit.view')
  } catch (err) {
    blocked = err instanceof Error && err.message.includes('비밀번호 변경')
  }
  console.log(`   기능 차단 (requirePermission): ${blocked ? 'PASS' : 'FAIL'}`)

  // 1c) 비밀번호 변경 → audit password_change, 플래그 해제
  const changed = await auth.changePassword('Admin123!', 'NewAdmin123!')
  const flagCleared = changed.user?.mustChangePassword === false
  console.log(`   비밀번호 변경: ${changed.ok ? 'PASS' : 'FAIL'}`)
  console.log(`   must_change_password 해제: ${flagCleared ? 'PASS' : 'FAIL'}`)
  auth.logout()

  // 2) 로그인 실패 3회 → 잠금
  for (let i = 1; i <= 3; i++) {
    const fail = await auth.login('operator1', 'wrong-password')
    console.log(`   실패 ${i}회: ok=${fail.ok} error="${fail.error}"`)
  }

  const locked = db
    .prepare("SELECT status, fail_count FROM users WHERE username = 'operator1'")
    .get() as { status: string; fail_count: number }

  console.log(
    `2) operator1 잠금: ${locked.status === 'inactive' && locked.fail_count === 3 ? 'PASS' : 'FAIL'} (status=${locked.status}, fail_count=${locked.fail_count})\n`
  )

  // 3) 잠긴 계정 로그인 거부
  const lockedLogin = await auth.login('operator1', 'Operator1!')
  console.log(`3) 잠긴 계정 로그인 거부: ${!lockedLogin.ok ? 'PASS' : 'FAIL'}\n`)

  // 4) audit 기록 확인
  const entries = audit.list(50)
  const actions = entries.map((e) => e.action)

  console.log('4) audit 기록:')
  for (const entry of entries) {
    const uid = entry.userId ?? '-'
    const target = entry.targetId ?? '-'
    const after = entry.afterValue ?? ''
    console.log(`   seq=${entry.seq} action=${entry.action} user=${uid} target=${target} after=${after}`)
  }

  const hasLogin = actions.includes('login')
  const hasLoginFailed = actions.filter((a) => a === 'login_failed').length >= 3
  const hasAccountLocked = actions.includes('account_locked')
  const hasUserCreate = actions.includes('user_create')
  const hasLogout = actions.includes('logout')
  const hasPasswordChange = actions.includes('password_change')

  console.log()
  console.log(`   login 기록: ${hasLogin ? 'PASS' : 'FAIL'}`)
  console.log(`   login_failed 기록 (≥3): ${hasLoginFailed ? 'PASS' : 'FAIL'}`)
  console.log(`   account_locked 기록: ${hasAccountLocked ? 'PASS' : 'FAIL'}`)
  console.log(`   user_create 기록 (admin 시드): ${hasUserCreate ? 'PASS' : 'FAIL'}`)
  console.log(`   logout 기록: ${hasLogout ? 'PASS' : 'FAIL'}`)
  console.log(`   password_change 기록: ${hasPasswordChange ? 'PASS' : 'FAIL'}`)
  console.log(`   verifyChain: ${audit.verifyChain() === null ? 'PASS' : 'FAIL'}`)

  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
