import type { ConfigurationSpec } from './config.types'

export interface AppInfo {
  appVersion: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
  buildDate: string
  dataDir: string
  usingTestSafeStorage: boolean
}

export type SelfCheckStatus = 'ok' | 'warn' | 'fail'

export interface SelfCheckItem {
  id: string
  label: string
  status: SelfCheckStatus
  detail: string
}

export interface SelfCheckReport {
  ts: string
  appInfo: AppInfo
  items: SelfCheckItem[]
  spec: ConfigurationSpec
  overall: SelfCheckStatus
}

export interface ExportSelfCheckResult {
  ok: boolean
  filePath?: string
  error?: string
}
