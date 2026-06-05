import Database from 'better-sqlite3'
import { runMigrations } from '../src/main/db/migrations'
import { AuditService } from '../src/main/services/audit.service'
import { TimeService } from '../src/main/services/time.service'

function main(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const timeService = new TimeService(db)
  const audit = new AuditService(db, timeService)
  timeService.setAuditService(audit)

  console.log('=== M2 AuditService 테스트 ===\n')

  // 1) 엔트리 3개 append
  const e1 = audit.append('login', { userId: 1, targetType: 'user', targetId: '1' })
  const e2 = audit.append('capture', {
    userId: 1,
    targetType: 'record',
    targetId: '42',
    after: '{"testNo":"T-001"}'
  })
  const e3 = audit.append('config_change', {
    userId: 1,
    targetType: 'config',
    targetId: 'session.timeoutMin',
    before: '15',
    after: '30'
  })

  console.log('1) append 3건 완료')
  console.log(`   seq=${e1.seq} action=${e1.action} prev=${e1.prevHash.slice(0, 8)}… hash=${e1.entryHash.slice(0, 8)}…`)
  console.log(`   seq=${e2.seq} action=${e2.action} prev=${e2.prevHash.slice(0, 8)}… hash=${e2.entryHash.slice(0, 8)}…`)
  console.log(`   seq=${e3.seq} action=${e3.action} prev=${e3.prevHash.slice(0, 8)}… hash=${e3.entryHash.slice(0, 8)}…`)
  console.log(`   e2.prevHash === e1.entryHash: ${e2.prevHash === e1.entryHash}`)
  console.log(`   e3.prevHash === e2.entryHash: ${e3.prevHash === e2.entryHash}\n`)

  // 2) verifyChain 통과
  const intact = audit.verifyChain()
  console.log(`2) verifyChain() (정상): ${intact === null ? 'PASS (null)' : `FAIL (broken seq=${intact})`}\n`)

  // 3) UPDATE 차단 확인
  let updateBlocked = false
  try {
    db.prepare('UPDATE audit_entries SET action = ? WHERE seq = ?').run('tampered', 2)
  } catch (err) {
    updateBlocked = err instanceof Error && err.message.includes('audit append-only')
  }
  console.log(`3) UPDATE 차단 (트리거): ${updateBlocked ? 'PASS (ABORT)' : 'FAIL'}\n`)

  // 4) 변조 시뮬레이션 — 트리거 제거 후 행 수정, verifyChain 실패
  db.exec('DROP TRIGGER audit_no_update')
  db.prepare('UPDATE audit_entries SET action = ? WHERE seq = ?').run('tampered', 2)

  const broken = audit.verifyChain()
  console.log(`4) 변조 후 verifyChain(): ${broken === 2 ? `PASS (broken seq=${broken})` : `FAIL (got ${broken})`}`)

  db.close()
}

main()
