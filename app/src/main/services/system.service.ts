import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync, statSync } from 'fs'
import type { ConfigService } from './config.service'
import type { AuditService } from './audit.service'
import type { CryptoService } from './crypto.service'
import type { TimeService } from './time.service'
import { isUsingTestSafeStorage } from './crypto.service'
import type {
  AppInfo,
  SelfCheckItem,
  SelfCheckReport,
  SelfCheckStatus
} from '../../shared/system.types'

// IQ에서 반드시 잠겨 있어야 하는 무결성 코어 설정 (DEV-01·02 후속조치)
const CORE_LOCK_KEYS = [
  'audit.enabled',
  'integrity.enabled',
  'auth.required',
  'timestamp.source'
]

export class SystemService {
  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
    private readonly timeService: TimeService
  ) {}

  private dataDir(): string {
    return join(app.getPath('userData'), 'data')
  }

  getAppInfo(): AppInfo {
    let buildDate = ''
    try {
      buildDate = statSync(__filename).mtime.toISOString()
    } catch {
      buildDate = ''
    }

    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron ?? '',
      chromeVersion: process.versions.chrome ?? '',
      nodeVersion: process.versions.node ?? '',
      buildDate,
      dataDir: this.dataDir(),
      usingTestSafeStorage: isUsingTestSafeStorage()
    }
  }

  runSelfCheck(userId: number): SelfCheckReport {
    const ts = this.timeService.now(userId)
    const items: SelfCheckItem[] = []

    // 1) safeStorage(DPAPI) — 암호화 모듈이 의존. 미사용 시엔 무관하므로 warn
    const cryptoStatus = this.cryptoService.getStatus()
    items.push({
      id: 'safeStorage',
      label: 'safeStorage(DPAPI) 사용 가능',
      status: cryptoStatus.safeStorageAvailable ? 'ok' : 'warn',
      detail: cryptoStatus.safeStorageAvailable
        ? '사용 가능'
        : '사용 불가 — 암호화 모듈을 켤 경우 필수(DEV-03)'
    })

    // 2) 데이터 폴더 쓰기 권한
    let writeStatus: SelfCheckStatus = 'ok'
    let writeDetail = '쓰기 가능'
    try {
      const probe = join(this.dataDir(), '.iq-write-test')
      writeFileSync(probe, 'ok')
      unlinkSync(probe)
    } catch (err) {
      writeStatus = 'fail'
      writeDetail = `쓰기 실패: ${err instanceof Error ? err.message : '권한 확인 필요'}`
    }
    items.push({
      id: 'dataWrite',
      label: '데이터 폴더 쓰기 권한',
      status: writeStatus,
      detail: writeDetail
    })

    // 3) 감사추적 무결성 (verifyChain)
    const chain = this.auditService.verifyChainDetailed()
    items.push({
      id: 'auditChain',
      label: '감사추적 무결성 (verifyChain)',
      status: chain.ok ? 'ok' : 'fail',
      detail: chain.ok
        ? `정상 (${chain.entryCount}건)`
        : `seq=${chain.brokenSeq}에서 체인 깨짐 — 변조 의심`
    })

    // 4) 무결성 코어 잠금 상태 (URS-072)
    const spec = this.configService.getCurrentSpec()
    const allLocked = CORE_LOCK_KEYS.every(
      (key) => spec.find((e) => e.key === key)?.coreLocked === true
    )
    items.push({
      id: 'coreLock',
      label: '무결성 코어 잠금 상태',
      status: allLocked ? 'ok' : 'fail',
      detail: allLocked
        ? '4개 코어 설정 모두 잠금(core-locked)'
        : '코어 설정 잠금이 해제됨 — 무결성 위험'
    })

    const overall: SelfCheckStatus = items.some((i) => i.status === 'fail')
      ? 'fail'
      : items.some((i) => i.status === 'warn')
        ? 'warn'
        : 'ok'

    const report: SelfCheckReport = {
      ts,
      appInfo: this.getAppInfo(),
      items,
      spec,
      overall
    }

    this.auditService.append('iq_selfcheck', {
      userId,
      after: JSON.stringify({
        overall,
        items: items.map((i) => ({ id: i.id, status: i.status }))
      })
    })

    return report
  }
}
