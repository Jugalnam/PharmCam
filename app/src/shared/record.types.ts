import type { Record, RecordStatus } from './types'

export interface SaveRecordInput {
  testNo: string
  sampleId?: string
  imageDataBase64: string
  meta?: Record<string, string>
}

export interface CorrectRecordInput {
  testNo: string
  sampleId?: string
  imageDataBase64: string
  meta?: Record<string, string>
}

export interface RecordFilter {
  testNo?: string
  limit?: number
}

export interface SaveRecordResult {
  ok: boolean
  recordId?: number
  error?: string
}

export interface RecordDetail extends Record {
  operatorName: string
  integrityOk: boolean
}

export interface RecordListItem {
  id: number
  testNo: string
  sampleId: string | null
  operatorId: number
  operatorName: string
  captureTs: string
  status: RecordStatus
  correctionOf: number | null
  imageHash: string
}
