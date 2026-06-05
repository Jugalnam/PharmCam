import type { LimsExportResult } from '../../shared/module.types'
import type { Record } from '../../shared/types'
import type { ConfigService } from './config.service'

export class LimsConnector {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get('lims.enabled') === 'true'
  }

  async exportRecord(record: Record): Promise<LimsExportResult> {
    if (!this.isEnabled()) {
      return { ok: false, error: 'LIMS 커넥터가 비활성화되어 있습니다 (lims.enabled=false).' }
    }

    // 스텁: 실제 어댑터는 후속 변경관리(DEV-07)
    return {
      ok: false,
      error: 'LIMS 어댑터가 구성되지 않았습니다 (스텁).'
    }
  }
}
