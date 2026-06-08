import { useEffect, useState } from 'react'
import type {
  AuditFilter,
  AuditListItem,
  ExportFormat,
  ExportTarget
} from '../../shared/audit.types'
import type { SessionUser } from '../../shared/auth.types'

interface AuditViewProps {
  user: SessionUser
}

const COMMON_ACTIONS = [
  '',
  'login',
  'logout',
  'login_failed',
  'capture',
  'capture_failed',
  'config_change',
  'signature',
  'export',
  'password_change',
  'account_locked'
]

export default function AuditView({ user }: AuditViewProps): JSX.Element {
  const [entries, setEntries] = useState<AuditListItem[]>([])
  const [filter, setFilter] = useState<AuditFilter>({ limit: 200 })
  const [userIdInput, setUserIdInput] = useState('')
  const [actionInput, setActionInput] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const canExport = user.role === 'reviewer' || user.role === 'admin'

  useEffect(() => {
    loadEntries()
  }, [])

  function buildFilter(): AuditFilter {
    const f: AuditFilter = { limit: filter.limit ?? 200 }
    if (userIdInput.trim()) {
      f.userId = Number(userIdInput)
    }
    if (actionInput) {
      f.action = actionInput
    }
    if (fromDate) {
      f.fromTs = new Date(fromDate).toISOString()
    }
    if (toDate) {
      const end = new Date(toDate)
      end.setHours(23, 59, 59, 999)
      f.toTs = end.toISOString()
    }
    return f
  }

  async function loadEntries(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const f = buildFilter()
      setFilter(f)
      const data = await window.api.audit.list(f)
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '감사추적을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyChain(): Promise<void> {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const result = await window.api.audit.verifyChain()
      if (result.ok) {
        setVerifyResult(`통과 — ${result.entryCount}건 해시체인 무결성 확인됨`)
      } else {
        setVerifyResult(`실패 — seq=${result.brokenSeq}에서 체인 깨짐 (${result.entryCount}건 중)`)
      }
    } catch (err) {
      setVerifyResult(err instanceof Error ? err.message : '검증 중 오류')
    } finally {
      setVerifying(false)
    }
  }

  async function handleExport(target: ExportTarget, format: ExportFormat): Promise<void> {
    setExporting(true)
    setExportMsg(null)
    setError(null)
    try {
      const result = await window.api.audit.export({
        target,
        format,
        filter: target === 'audit' ? buildFilter() : undefined,
        recordFilter: target === 'records' ? { limit: 500 } : undefined
      })
      if (result.ok) {
        setExportMsg(`${target} ${format.toUpperCase()}보내기 완료 (${result.rowCount}건) → ${result.filePath}`)
      } else {
        setError(result.error ?? '보내기 실패')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '보내기 중 오류')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="audit-view-page">
      <div className="list-header">
        <h2>감사추적 (Audit Trail)</h2>
        <button type="button" className="secondary-btn" onClick={loadEntries} disabled={loading}>
          조회
        </button>
      </div>

      <p className="settings-hint">읽기전용 — 수정·삭제 불가 (append-only)</p>

      <div className="audit-filters">
        <label>
          사용자 ID
          <input
            type="number"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="전체"
          />
        </label>
        <label>
          행위 (action)
          <select value={actionInput} onChange={(e) => setActionInput(e.target.value)}>
            {COMMON_ACTIONS.map((a) => (
              <option key={a || 'all'} value={a}>
                {a || '전체'}
              </option>
            ))}
          </select>
        </label>
        <label>
          시작일
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          종료일
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
      </div>

      <div className="audit-actions">
        <button type="button" onClick={handleVerifyChain} disabled={verifying}>
          {verifying ? '검증 중…' : 'verifyChain — 해시체인 무결성 검증'}
        </button>
        {verifyResult && (
          <span className={verifyResult.startsWith('통과') ? 'save-success' : 'login-error'}>
            {verifyResult}
          </span>
        )}
      </div>

      {canExport && (
        <div className="export-actions">
          <span className="export-label">보내기 (로컬 파일):</span>
          <button
            type="button"
            className="secondary-btn"
            disabled={exporting}
            onClick={() => handleExport('audit', 'csv')}
          >
            감사추적 CSV
          </button>
          <button
            type="button"
            className="secondary-btn"
            disabled={exporting}
            onClick={() => handleExport('audit', 'pdf')}
          >
            감사추적 PDF
          </button>
          <button
            type="button"
            className="secondary-btn"
            disabled={exporting}
            onClick={() => handleExport('records', 'csv')}
          >
            기록 CSV
          </button>
          <button
            type="button"
            className="secondary-btn"
            disabled={exporting}
            onClick={() => handleExport('records', 'pdf')}
          >
            기록 PDF
          </button>
        </div>
      )}

      {!canExport && (
        <p className="esign-skip-hint">보내기는 reviewer/admin 권한이 필요합니다.</p>
      )}

      {exportMsg && <p className="save-success">{exportMsg}</p>}
      {error && <p className="login-error">{error}</p>}
      {loading && <p className="status-inline">불러오는 중…</p>}

      <table className="record-table audit-table">
        <thead>
          <tr>
            <th>seq</th>
            <th>시각</th>
            <th>user</th>
            <th>action</th>
            <th>target</th>
            <th>before</th>
            <th>after</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.seq}>
              <td>{e.seq}</td>
              <td>{new Date(e.ts).toLocaleString('ko-KR')}</td>
              <td>{e.userLabel ?? '—'}</td>
              <td>{e.action}</td>
              <td>
                {e.targetType ?? ''}
                {e.targetLabel ? `: ${e.targetLabel}` : ''}
              </td>
              <td className="mono truncate">{e.beforeValue ?? ''}</td>
              <td className="mono truncate">{e.afterValue ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!loading && entries.length === 0 && (
        <p className="status-inline">조건에 맞는 감사추적이 없습니다.</p>
      )}

      <p className="detail-hint">조회자: {user.username} ({user.role})</p>
    </div>
  )
}
