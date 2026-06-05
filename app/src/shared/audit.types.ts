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

export type AuditListResult = AuditEntry[]
