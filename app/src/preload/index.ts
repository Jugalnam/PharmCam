import { contextBridge, ipcRenderer } from 'electron'
import type { CreateUserInput } from '../shared/auth.types'
import type { CorrectRecordInput, RecordFilter, SaveRecordInput } from '../shared/record.types'
import type { AuditFilter, ExportRequest } from '../shared/audit.types'
import type { SignatureMeaning } from '../shared/types'

contextBridge.exposeInMainWorld('api', {
  app: {
    version: process.env.npm_package_version ?? '0.1.0'
  },
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    currentUser: () => ipcRenderer.invoke('auth:currentUser'),
    touchActivity: () => ipcRenderer.invoke('auth:touchActivity'),
    createUser: (input: CreateUserInput) => ipcRenderer.invoke('auth:createUser', input),
    deactivateUser: (userId: number) => ipcRenderer.invoke('auth:deactivateUser', userId),
    changePassword: (currentPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:changePassword', currentPassword, newPassword)
  },
  record: {
    save: (input: SaveRecordInput) => ipcRenderer.invoke('record:save', input),
    list: (filter?: RecordFilter) => ipcRenderer.invoke('record:list', filter),
    get: (id: number) => ipcRenderer.invoke('record:get', id),
    correct: (id: number, input: CorrectRecordInput) =>
      ipcRenderer.invoke('record:correct', id, input)
  },
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    getSpec: () => ipcRenderer.invoke('config:getSpec'),
    set: (key: string, value: string) => ipcRenderer.invoke('config:set', key, value)
  },
  sign: {
    getStatus: () => ipcRenderer.invoke('sign:getStatus'),
    isRequired: (meaning: SignatureMeaning) => ipcRenderer.invoke('sign:isRequired', meaning),
    list: (recordId: number) => ipcRenderer.invoke('sign:list', recordId),
    create: (recordId: number, meaning: SignatureMeaning, password: string) =>
      ipcRenderer.invoke('sign:create', recordId, meaning, password)
  },
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    runNow: () => ipcRenderer.invoke('backup:runNow'),
    verify: () => ipcRenderer.invoke('backup:verify'),
    recoverVerify: (backupId?: number) => ipcRenderer.invoke('backup:recoverVerify', backupId)
  },
  audit: {
    list: (filter?: AuditFilter) => ipcRenderer.invoke('audit:list', filter),
    verifyChain: () => ipcRenderer.invoke('audit:verifyChain'),
    export: (request: ExportRequest) => ipcRenderer.invoke('audit:export', request)
  },
  system: {
    about: () => ipcRenderer.invoke('system:about'),
    selfCheck: () => ipcRenderer.invoke('system:selfCheck'),
    exportSelfCheck: () => ipcRenderer.invoke('system:exportSelfCheck')
  }
})
