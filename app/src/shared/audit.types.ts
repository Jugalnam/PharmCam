import type { AuditEntry } from './types'

export interface AuditFilter {
  userId?: number
  action?: string
  fromTs?: string
  toTs?: string
  limit?: number
}

export type ExportTarget = 'audit' | 'records'
export type ExportFormat = 'csv' | 'pdf'

export interface ExportRequest {
  target: ExportTarget
  format: ExportFormat
  filter?: AuditFilter
  recordFilter?: { testNo?: string; limit?: number }
}

export interface ExportResult {
  ok: boolean
  filePath?: string
  rowCount?: number
  error?: string
}

export interface VerifyChainResult {
  ok: boolean
  brokenSeq: number | null
  entryCount: number
}

/** 감사추적 표시용 DTO — 저장값(불변)에 사람이 읽을 수 있는 사용자 라벨을 덧붙인다.
 *  userLabel/targetLabel은 표시·내보내기 전용이며 해시 계산·저장에는 영향이 없다. */
export interface AuditListItem extends AuditEntry {
  /** 행위자: "username (#id)" 형식. userId가 없으면 null */
  userLabel: string | null
  /** 대상: user 대상이면 "username (#id)", 그 외엔 원본 targetId */
  targetLabel: string | null
}

export type AuditListResult = AuditListItem[]

export interface AuditUserOption {
  id: number
  username: string
}
