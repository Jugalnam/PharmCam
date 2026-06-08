import type { Record as RecordEntity, RecordStatus } from './types'

/** 회사별로 구성 가능한 촬영 메타데이터 추가 항목(URS-031).
 *  시험번호(testNo)·시료ID(sampleId)는 빌트인이라 이 목록에 포함하지 않는다. */
export interface MetadataField {
  /** 저장 키(영문 시작, 영문/숫자/_). 기록의 meta에 이 키로 저장된다 */
  key: string
  /** 화면 표시 이름(예: 배치번호) */
  label: string
  /** 필수 입력 여부 */
  required: boolean
}

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

export interface RecordDetail extends RecordEntity {
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
