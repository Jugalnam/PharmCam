import { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { basename } from 'path'
import { existsSync, readFileSync } from 'fs'
import type {
  ControlledPrintPreviewResult,
  ControlledPrintResult,
  ControlledPrintTemplateInput
} from '../../shared/print.types'
import type { RecordQueryUser } from '../../shared/record.types'
import { buildControlledPrintHtml } from '../../shared/print-template'
import type { AuditService } from './audit.service'
import type { CryptoService } from './crypto.service'
import type { IntegrityService } from './integrity.service'
import type { TimeService } from './time.service'

interface PrintRecordRow {
  id: number
  test_no: string
  operator_id: number
  operator_name: string
  capture_ts: string
  image_path: string
  image_hash: string
}

const DISPLAYED_FIELDS = ['User ID', '시험번호', '촬영일시', '기록 ID', '파일명']

export class PrintService {
  constructor(
    private readonly db: Database.Database,
    private readonly auditService: AuditService,
    private readonly integrityService: IntegrityService,
    private readonly timeService: TimeService,
    private readonly cryptoService?: CryptoService
  ) {}

  buildPreview(
    recordId: number,
    userId: number,
    queryUser?: RecordQueryUser
  ): ControlledPrintPreviewResult {
    try {
      const html = this.buildHtml(recordId, userId, queryUser)
      return { ok: true, html }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : '인쇄 미리보기를 생성할 수 없습니다.'
      }
    }
  }

  async print(
    recordId: number,
    userId: number,
    queryUser?: RecordQueryUser,
    parentWindow?: BrowserWindow
  ): Promise<ControlledPrintResult> {
    let printJobId: number | undefined

    try {
      const html = this.buildHtml(recordId, userId, queryUser)
      printJobId = this.insertPrintJob(recordId, userId, 'requested')
      await this.printHtml(html, parentWindow)

      this.updatePrintJob(printJobId, 'ok')
      this.auditService.append('print', {
        userId,
        targetType: 'record',
        targetId: String(recordId),
        after: JSON.stringify({
          printJobId,
          displayedFields: DISPLAYED_FIELDS
        })
      })

      return { ok: true, printJobId }
    } catch (err) {
      const error = err instanceof Error ? err.message : '인쇄 실패'
      if (printJobId !== undefined) {
        this.updatePrintJob(printJobId, 'fail', error)
      } else {
        printJobId = this.insertPrintJob(recordId, userId, 'fail', error)
      }

      this.auditService.append('print_failed', {
        userId,
        targetType: 'record',
        targetId: String(recordId),
        after: JSON.stringify({ printJobId, error })
      })

      return { ok: false, printJobId, error }
    }
  }

  private buildHtml(recordId: number, userId: number, queryUser?: RecordQueryUser): string {
    const row = this.getRecord(recordId)
    if (!row) {
      throw new Error('기록을 찾을 수 없습니다.')
    }
    if (queryUser?.role === 'operator' && row.operator_id !== queryUser.id) {
      throw new Error('이 기록을 조회할 권한이 없습니다.')
    }
    if (!existsSync(row.image_path)) {
      throw new Error('원본 이미지 파일을 찾을 수 없습니다.')
    }
    if (!this.integrityService.verifyFile(row.image_path, row.image_hash, userId)) {
      throw new Error('원본 이미지 무결성 검증에 실패하여 인쇄할 수 없습니다.')
    }

    const input: ControlledPrintTemplateInput = {
      recordId: row.id,
      testNo: row.test_no,
      captureTs: row.capture_ts,
      userId: `${row.operator_name} (#${row.operator_id})`,
      fileName: basename(row.image_path),
      imageDataUrl: this.imageDataUrl(row.image_path)
    }

    return buildControlledPrintHtml(input)
  }

  private imageDataUrl(path: string): string {
    const stored = readFileSync(path)
    const data =
      this.cryptoService?.isEncryptedFile(path) && this.cryptoService.isEnabled()
        ? this.cryptoService.decrypt(stored)
        : stored
    return `data:image/png;base64,${data.toString('base64')}`
  }

  private async printHtml(html: string, parentWindow?: BrowserWindow): Promise<void> {
    const win = new BrowserWindow({
      parent: parentWindow,
      width: 900,
      height: 700,
      show: false,
      title: 'PharmCam 통제 인쇄',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    try {
      const dataUrl = `data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`
      await win.loadURL(dataUrl)
      win.show()
      win.moveTop()
      win.focus()
      await win.webContents.executeJavaScript('document.fonts?.ready ?? Promise.resolve()')
      // Windows 프린터 다이얼로그가 parent 창 뒤에 묻히지 않도록 실제 창이 그려진 뒤 호출한다.
      await new Promise((resolve) => setTimeout(resolve, 500))
      await win.webContents.executeJavaScript('window.print()')
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } finally {
      if (!win.isDestroyed()) {
        win.close()
      }
    }
  }

  private getRecord(recordId: number): PrintRecordRow | undefined {
    return this.db
      .prepare(
        `SELECT r.id, r.test_no, r.operator_id, u.username AS operator_name,
                r.capture_ts, r.image_path, r.image_hash
         FROM records r
         JOIN users u ON u.id = r.operator_id
         WHERE r.id = ?`
      )
      .get(recordId) as PrintRecordRow | undefined
  }

  private insertPrintJob(
    recordId: number,
    userId: number,
    result: string,
    error?: string
  ): number {
    const printTs = this.timeService.now(userId)
    const insert = this.db
      .prepare(
        `INSERT INTO print_jobs
          (record_id, printed_by, print_ts, displayed_fields, target_printer, result, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        recordId,
        userId,
        printTs,
        JSON.stringify(DISPLAYED_FIELDS),
        null,
        result,
        error ?? null
      )
    return Number(insert.lastInsertRowid)
  }

  private updatePrintJob(printJobId: number, result: string, error?: string): void {
    this.db
      .prepare('UPDATE print_jobs SET result = ?, error = ? WHERE id = ?')
      .run(result, error ?? null, printJobId)
  }
}
