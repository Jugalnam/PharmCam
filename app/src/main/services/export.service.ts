import { writeFileSync } from 'fs'
import type { AuditListItem, ExportFormat, ExportTarget } from '../../shared/audit.types'
import type { RecordListItem } from '../../shared/record.types'

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildAuditCsv(entries: AuditListItem[]): string {
  // user_id/target_id(불변 원본) + user_label/target_label(가독성)을 함께 내보내
  // 기계 추적성과 사람 가독성을 모두 보존한다.
  const header =
    'seq,ts,user_id,user_label,action,target_type,target_id,target_label,before_value,after_value,entry_hash'
  const rows = entries.map((e) =>
    [
      e.seq,
      e.ts,
      e.userId ?? '',
      e.userLabel ?? '',
      e.action,
      e.targetType ?? '',
      e.targetId ?? '',
      e.targetLabel ?? '',
      e.beforeValue ?? '',
      e.afterValue ?? '',
      e.entryHash
    ]
      .map(escapeCsv)
      .join(',')
  )
  return [header, ...rows].join('\n')
}

function buildRecordsCsv(records: RecordListItem[]): string {
  const header =
    'id,test_no,sample_id,operator_id,operator_name,capture_ts,status,correction_of,image_hash'
  const rows = records.map((r) =>
    [
      r.id,
      r.testNo,
      r.sampleId ?? '',
      r.operatorId,
      r.operatorName,
      r.captureTs,
      r.status,
      r.correctionOf ?? '',
      r.imageHash
    ]
      .map(escapeCsv)
      .join(',')
  )
  return [header, ...rows].join('\n')
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildSimplePdf(title: string, lines: string[]): Buffer {
  const contentLines = [title, '', ...lines]
  let y = 800
  const textOps: string[] = ['BT', '/F1 10 Tf']

  for (const line of contentLines) {
    textOps.push(`1 0 0 1 50 ${y} Tm`)
    textOps.push(`(${escapePdfText(line.slice(0, 120))}) Tj`)
    y -= 14
    if (y < 50) {
      break
    }
  }

  textOps.push('ET')
  const stream = textOps.join('\n')
  const streamLen = Buffer.byteLength(stream, 'utf8')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += obj
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}

export function writeExportFile(
  target: ExportTarget,
  format: ExportFormat,
  filePath: string,
  auditEntries: AuditListItem[],
  records: RecordListItem[]
): number {
  let rowCount = 0

  if (target === 'audit') {
    rowCount = auditEntries.length
    if (format === 'csv') {
      writeFileSync(filePath, buildAuditCsv(auditEntries), 'utf8')
    } else {
      const lines = auditEntries.map(
        (e) =>
          `${e.seq} | ${e.ts} | user=${e.userLabel ?? '-'} | ${e.action} | ${e.targetType ?? ''}${e.targetLabel ? `: ${e.targetLabel}` : ''}`
      )
      writeFileSync(filePath, buildSimplePdf('PharmCam Audit Trail Export', lines))
    }
  } else {
    rowCount = records.length
    if (format === 'csv') {
      writeFileSync(filePath, buildRecordsCsv(records), 'utf8')
    } else {
      const lines = records.map(
        (r) =>
          `#${r.id} | ${r.testNo} | ${r.operatorName} | ${r.captureTs} | ${r.status} | ${r.imageHash.slice(0, 16)}…`
      )
      writeFileSync(filePath, buildSimplePdf('PharmCam Records Export', lines))
    }
  }

  return rowCount
}

export function defaultExportFilename(target: ExportTarget, format: ExportFormat): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const ext = format === 'csv' ? 'csv' : 'pdf'
  return `pharmcam-${target}-${ts}.${ext}`
}
