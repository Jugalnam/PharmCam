export type UserRole = 'operator' | 'reviewer' | 'admin'
export type UserStatus = 'active' | 'inactive'
export type RecordStatus = 'final' | 'corrected' | 'failed'
export type SignatureMeaning = 'author' | 'review' | 'approve'
export type BackupMode = 'internal' | 'external' | 'off'
export type BackupResult = 'ok' | 'fail'

export interface User {
  id: number
  username: string
  role: UserRole
  status: UserStatus
  failCount: number
  passwordChangedAt: string | null
  mustChangePassword: boolean
  createdAt: string
  disabledAt: string | null
}

export interface Record {
  id: number
  testNo: string
  sampleId: string | null
  operatorId: number
  captureTs: string
  imagePath: string
  imageHash: string
  status: RecordStatus
  correctionOf: number | null
  metaJson: string | null
  createdAt: string
}

export interface AuditEntry {
  seq: number
  ts: string
  userId: number | null
  action: string
  targetType: string | null
  targetId: string | null
  beforeValue: string | null
  afterValue: string | null
  prevHash: string
  entryHash: string
}

export interface ConfigEntry {
  key: string
  value: string
  coreLocked: boolean
  changedBy: number | null
  changedTs: string | null
}
