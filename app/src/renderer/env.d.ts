/// <reference types="vite/client" />

import type {
  ChangePasswordResult,
  CreateUserInput,
  CreateUserResult,
  DeactivateUserResult,
  LoginResult,
  PermissionMatrix,
  SessionUser,
  UserSummary
} from '../shared/auth.types'
import type {
  CorrectRecordInput,
  MetadataField,
  RecordDetail,
  RecordFilter,
  RecordListItem,
  RecordUserOption,
  SaveRecordInput,
  SaveRecordResult
} from '../shared/record.types'
import type {
  AuditFilter,
  AuditListResult,
  AuditUserOption,
  ExportRequest,
  ExportResult,
  VerifyChainResult
} from '../shared/audit.types'
import type {
  BackupRunResult,
  BackupStatus,
  BackupVerifyResult
} from '../shared/module.types'
import type { ConfigurationSpec, SetConfigResult, StorageInfo } from '../shared/config.types'
import type {
  CreateSignatureResult,
  EsignStatus,
  SignatureView
} from '../shared/sign.types'
import type {
  ControlledPrintPreviewResult,
  ControlledPrintResult
} from '../shared/print.types'
import type {
  AppInfo,
  ExportSelfCheckResult,
  SelfCheckReport
} from '../shared/system.types'
import type { SignatureMeaning } from '../shared/types'

// window.api 전역 타입 — declare global로 감싸야 전역 Window가 확장된다.
// 구현(런타임)은 src/preload/index.ts의 contextBridge.exposeInMainWorld('api', ...)가 단일 출처.
declare global {
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
        listUsers: () => Promise<UserSummary[]>
        getPermissionMatrix: () => Promise<PermissionMatrix>
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
        listUsers: () => Promise<RecordUserOption[]>
        getPrintPreview: (id: number) => Promise<ControlledPrintPreviewResult>
        printControlled: (id: number) => Promise<ControlledPrintResult>
      }
      config: {
        get: (key: string) => Promise<string | null>
        getSpec: () => Promise<ConfigurationSpec>
        set: (key: string, value: string) => Promise<SetConfigResult>
      }
      storage: {
        getInfo: () => Promise<StorageInfo>
        setRoot: (path: string) => Promise<SetConfigResult>
        choose: () => Promise<SetConfigResult>
        openFolder: () => Promise<{ ok: boolean; error?: string }>
      }
      metadata: {
        getFields: () => Promise<MetadataField[]>
        setFields: (fields: MetadataField[]) => Promise<SetConfigResult>
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
        listUsers: () => Promise<AuditUserOption[]>
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
}

export {}
