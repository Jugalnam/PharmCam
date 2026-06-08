import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './db/database'
import { TimeService } from './services/time.service'
import { AuditService } from './services/audit.service'
import { ConfigService } from './services/config.service'
import { AuthService } from './services/auth.service'
import { IntegrityService } from './services/integrity.service'
import { RecordService } from './services/record.service'
import { SignatureService } from './services/signature.service'
import { CryptoService } from './services/crypto.service'
import { BackupService } from './services/backup.service'
import { LimsConnector } from './services/lims.connector'
import { SystemService } from './services/system.service'
import { registerIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: `PharmCam v${app.getVersion()}`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  // HTML <title>가 윈도우 제목을 덮어쓰지 않도록 고정 (버전 항상 표시)
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.setTitle(`PharmCam v${app.getVersion()}`)
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupSecurity(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  // 폐쇄망: 외부 origin 차단 CSP
  // 프로덕션(배포본)은 엄격하게 유지하고, 개발 서버일 때만 Vite HMR/Fast Refresh를
  // 위해 inline/eval·ws(localhost)를 허용한다. 검증 대상인 프로덕션 빌드의 CSP는 불변.
  const isDev = !!process.env.ELECTRON_RENDERER_URL
  const csp = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* http://localhost:*; font-src 'self'; object-src 'none'; base-uri 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
}

app.whenReady().then(async () => {
  setupSecurity()
  const db = initDatabase()
  const timeService = new TimeService(db)
  const auditService = new AuditService(db, timeService)
  timeService.setAuditService(auditService)
  const configService = new ConfigService(db, auditService, timeService)
  configService.seed()
  const integrityService = new IntegrityService(auditService)
  const cryptoService = new CryptoService(configService)
  const authService = new AuthService(db, auditService, configService, timeService)
  await authService.seedAdminAccount()
  const recordService = new RecordService(
    db,
    auditService,
    configService,
    integrityService,
    timeService,
    undefined,
    cryptoService
  )
  const backupService = new BackupService(db, configService, auditService, timeService)
  const limsConnector = new LimsConnector(configService)
  const signatureService = new SignatureService(
    db,
    auditService,
    configService,
    timeService,
    authService
  )
  const systemService = new SystemService(
    configService,
    auditService,
    cryptoService,
    timeService
  )
  registerIpcHandlers(
    auditService,
    authService,
    recordService,
    configService,
    signatureService,
    backupService,
    cryptoService,
    limsConnector,
    systemService
  )
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})
