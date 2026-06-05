/// <reference types="vite/client" />

import type {
  ChangePasswordResult,
  CreateUserInput,
  CreateUserResult,
  DeactivateUserResult,
  LoginResult,
  SessionUser
} from '../shared/auth.types'
import type {
  CorrectRecordInput,
  RecordDetail,
  RecordFilter,
  RecordListItem,
  SaveRecordInput,
  SaveRecordResult
} from '../shared/record.types'
import type {
  AuditFilter,
  AuditListResult,
  ExportRequest,
  ExportResult,
  VerifyChainResult
} from '../shared/audit.types'
import type {
  BackupRunResult,
  BackupStatus,
  BackupVerifyResult,
  CryptoStatus
} from '../shared/module.types'
import type { ConfigurationSpec, SetConfigResult } from '../shared/config.types'
import type {
  CreateSignatureResult,
  EsignStatus,
  SignatureView
} from '../shared/sign.types'
import type {
  AppInfo,
  ExportSelfCheckResult,
  SelfCheckReport
} from '../shared/system.types'
import type { AuditEntry, SignatureMeaning } from '../shared/types'

interface Window {
  api: {
    app: {
      version: string
    }
    auth: {
      login: (username: string, password: string) => Promise<LoginResult>
      logout: () => Promise<{ ok: boolean }>
      currentUser: () => Promise<SessionUser | null>
      touchActivity: () => Promise<{ ok: boolean }>
      createUser: (input: CreateUserInput) => Promise<CreateUserResult>
      deactivateUser: (userId: number) => Promise<DeactivateUserResult>
      changePassword: (
        currentPassword: string,
        newPassword: string
      ) => Promise<ChangePasswordResult>
    }
    record: {
      save: (input: SaveRecordInput) => Promise<SaveRecordResult>
      list: (filter?: RecordFilter) => Promise<RecordListItem[]>
      get: (id: number) => Promise<RecordDetail | null>
      correct: (id: number, input: CorrectRecordInput) => Promise<SaveRecordResult>
    }
    config: {
      get: (key: string) => Promise<string | null>
      getSpec: () => Promise<ConfigurationSpec>
      set: (key: string, value: string) => Promise<SetConfigResult>
    }
    sign: {
      getStatus: () => Promise<EsignStatus>
      isRequired: (meaning: SignatureMeaning) => Promise<boolean>
      list: (recordId: number) => Promise<SignatureView[]>
      create: (
        recordId: number,
        meaning: SignatureMeaning,
        password: string
      ) => Promise<CreateSignatureResult>
    }
    backup: {
      status: () => Promise<BackupStatus>
      runNow: () => Promise<BackupRunResult>
      verify: () => Promise<BackupVerifyResult>
      recoverVerify: (backupId?: number) => Promise<BackupVerifyResult>
    }
    audit: {
      list: (filter?: AuditFilter) => Promise<AuditListResult>
      verifyChain: () => Promise<VerifyChainResult>
      export: (request: ExportRequest) => Promise<ExportResult>
    }
    system: {
      about: () => Promise<AppInfo>
      selfCheck: () => Promise<SelfCheckReport>
      exportSelfCheck: () => Promise<ExportSelfCheckResult>
    }
  }
}
