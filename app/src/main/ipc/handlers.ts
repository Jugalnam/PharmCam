import { dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'fs'
import type { AuditService } from '../services/audit.service'
import type { AuthService } from '../services/auth.service'
import type { ConfigService } from '../services/config.service'
import type { RecordService } from '../services/record.service'
import type { SignatureService } from '../services/signature.service'
import type { BackupService } from '../services/backup.service'
import type { CryptoService } from '../services/crypto.service'
import type { LimsConnector } from '../services/lims.connector'
import type { SystemService } from '../services/system.service'
import type { SignatureMeaning } from '../../shared/types'
import type { CreateUserInput } from '../../shared/auth.types'
import type { AuditFilter, ExportRequest } from '../../shared/audit.types'
import type {
  CorrectRecordInput,
  MetadataField,
  RecordFilter,
  SaveRecordInput
} from '../../shared/record.types'
import { defaultExportFilename, writeExportFile } from '../services/export.service'

export function registerIpcHandlers(
  auditService: AuditService,
  authService: AuthService,
  recordService: RecordService,
  configService: ConfigService,
  signatureService: SignatureService,
  backupService: BackupService,
  cryptoService: CryptoService,
  limsConnector: LimsConnector,
  systemService: SystemService
): void {
  ipcMain.handle('audit:list', (_event, filter?: AuditFilter) => {
    authService.requirePermission('audit.view')
    return auditService.listWithUsers(filter ?? {})
  })

  ipcMain.handle('audit:verifyChain', () => {
    authService.requirePermission('audit.view')
    return auditService.verifyChainDetailed()
  })

  ipcMain.handle('audit:export', async (_event, request: ExportRequest) => {
    const user = authService.requirePermission('audit.export')

    const ext = request.format === 'csv' ? 'csv' : 'pdf'
    const defaultName = defaultExportFilename(request.target, request.format)

    const saveResult = await dialog.showSaveDialog({
      title: `PharmCam ${request.target}보내기`,
      defaultPath: defaultName,
      filters: [{ name: request.format.toUpperCase(), extensions: [ext] }]
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, error: '보내기가 취소되었습니다.' }
    }

    let filePath = saveResult.filePath
    if (!filePath.toLowerCase().endsWith(`.${ext}`)) {
      filePath = `${filePath}.${ext}`
    }

    try {
      const auditEntries =
        request.target === 'audit' ? auditService.listWithUsers(request.filter ?? {}) : []
      const records =
        request.target === 'records'
          ? recordService.list(request.recordFilter ?? { limit: 500 })
          : []

      const rowCount = writeExportFile(
        request.target,
        request.format,
        filePath,
        auditEntries,
        records
      )

      auditService.append('export', {
        userId: user.id,
        targetType: request.target,
        targetId: filePath,
        after: JSON.stringify({
          format: request.format,
          rowCount,
          filter: request.filter ?? request.recordFilter ?? null
        })
      })

      return { ok: true, filePath, rowCount }
    } catch (err) {
      const message = err instanceof Error ? err.message : '보내기 실패'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    return authService.login(username, password)
  })

  ipcMain.handle('auth:logout', () => {
    authService.logout()
    return { ok: true }
  })

  ipcMain.handle('auth:currentUser', () => {
    return authService.currentUser()
  })

  ipcMain.handle('auth:touchActivity', () => {
    authService.touchActivity()
    return { ok: true }
  })

  ipcMain.handle('auth:createUser', async (_event, input: CreateUserInput) => {
    return authService.createUser(input)
  })

  ipcMain.handle('auth:deactivateUser', (_event, userId: number) => {
    return authService.deactivateUser(userId)
  })

  ipcMain.handle('auth:listUsers', () => {
    return authService.listUsers()
  })

  ipcMain.handle('auth:getPermissionMatrix', () => {
    return authService.getPermissionMatrix()
  })

  ipcMain.handle(
    'auth:changePassword',
    async (_event, currentPassword: string, newPassword: string) => {
      return authService.changePassword(currentPassword, newPassword)
    }
  )

  ipcMain.handle('record:save', (_event, input: SaveRecordInput) => {
    const user = authService.requirePermission('capture')
    return recordService.save(input, user.id)
  })

  ipcMain.handle('record:list', (_event, filter?: RecordFilter) => {
    authService.requirePermission('audit.view')
    return recordService.list(filter)
  })

  ipcMain.handle('record:get', (_event, id: number) => {
    const user = authService.requirePermission('audit.view')
    return recordService.get(id, user.id)
  })

  ipcMain.handle('record:correct', (_event, id: number, input: CorrectRecordInput) => {
    const user = authService.requirePermission('capture')
    return recordService.correct(id, input, user.id)
  })

  // 메타데이터 추가 항목(URS-031) — 조회는 세션, 변경은 관리자(config 권한)만.
  ipcMain.handle('metadata:getFields', () => {
    authService.requireSession()
    return recordService.getMetadataFields()
  })

  ipcMain.handle('metadata:setFields', (_event, fields: MetadataField[]) => {
    const user = authService.requirePermission('config')
    return recordService.setMetadataFields(fields, user.id)
  })

  // 저장 위치(D-11) — 조회·변경·폴더 열기. 변경은 관리자(config 권한)만.
  ipcMain.handle('storage:getInfo', () => {
    authService.requirePermission('config')
    return recordService.getStorageInfo()
  })

  ipcMain.handle('storage:setRoot', (_event, path: string) => {
    const user = authService.requirePermission('config')
    return recordService.setStorageRoot(path, user.id)
  })

  ipcMain.handle('storage:choose', async () => {
    const user = authService.requirePermission('config')
    const res = await dialog.showOpenDialog({
      title: 'PharmCam 저장 위치 선택 (로컬 폴더)',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) {
      return { ok: false, error: '선택이 취소되었습니다.' }
    }
    return recordService.setStorageRoot(res.filePaths[0], user.id)
  })

  ipcMain.handle('storage:openFolder', async () => {
    authService.requirePermission('config')
    const root = recordService.ensureStorageRoot()
    const err = await shell.openPath(root)
    return { ok: err === '', error: err || undefined }
  })

  ipcMain.handle('config:get', (_event, key: string) => {
    authService.requirePermission('config')
    return configService.get(key)
  })

  ipcMain.handle('config:getSpec', () => {
    authService.requirePermission('config')
    return configService.getCurrentSpec()
  })

  ipcMain.handle('config:set', (_event, key: string, value: string) => {
    const user = authService.requirePermission('config')
    return configService.set(key, value, user.id)
  })

  ipcMain.handle('sign:getStatus', () => {
    authService.requireSession()
    return signatureService.getEsignStatus()
  })

  ipcMain.handle('sign:isRequired', (_event, meaning: SignatureMeaning) => {
    authService.requireSession()
    return signatureService.isRequired(meaning)
  })

  ipcMain.handle('sign:list', (_event, recordId: number) => {
    authService.requirePermission('audit.view')
    return signatureService.listByRecord(recordId)
  })

  ipcMain.handle(
    'sign:create',
    async (_event, recordId: number, meaning: SignatureMeaning, password: string) => {
      const user = authService.requireSession()
      return signatureService.create(recordId, meaning, password, user.id, user.role)
    }
  )

  ipcMain.handle('backup:status', () => {
    authService.requirePermission('config')
    return backupService.status()
  })

  ipcMain.handle('backup:runNow', () => {
    const user = authService.requirePermission('config')
    return backupService.runNow(user.id)
  })

  ipcMain.handle('backup:verify', () => {
    authService.requirePermission('config')
    return backupService.verify()
  })

  ipcMain.handle('backup:recoverVerify', (_event, backupId?: number) => {
    authService.requirePermission('config')
    return backupService.recoverVerify(backupId)
  })

  ipcMain.handle('crypto:status', () => {
    authService.requirePermission('config')
    return cryptoService.getStatus()
  })

  ipcMain.handle('lims:status', () => {
    authService.requirePermission('config')
    return { enabled: limsConnector.isEnabled() }
  })

  ipcMain.handle('system:about', () => {
    authService.requireSession()
    return systemService.getAppInfo()
  })

  ipcMain.handle('system:selfCheck', () => {
    const user = authService.requirePermission('config')
    return systemService.runSelfCheck(user.id)
  })

  ipcMain.handle('system:exportSelfCheck', async () => {
    const user = authService.requirePermission('config')
    const report = systemService.runSelfCheck(user.id)

    const stamp = report.ts.replace(/[:.]/g, '-')
    const saveResult = await dialog.showSaveDialog({
      title: 'IQ 자가점검 내보내기',
      defaultPath: `pharmcam-iq-selfcheck-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, error: '내보내기가 취소되었습니다.' }
    }

    let filePath = saveResult.filePath
    if (!filePath.toLowerCase().endsWith('.json')) {
      filePath = `${filePath}.json`
    }

    try {
      writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8')
      auditService.append('iq_selfcheck_export', {
        userId: user.id,
        targetType: 'system',
        targetId: filePath
      })
      return { ok: true, filePath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : '내보내기 실패' }
    }
  })
}
