import { useEffect, useState } from 'react'
import type { AppInfo, SelfCheckReport, SelfCheckStatus } from '../../shared/system.types'

const STATUS_STYLE: Record<SelfCheckStatus, { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: '#15803d', bg: '#dcfce7' },
  warn: { label: '경고', color: '#92400e', bg: '#fef3c7' },
  fail: { label: '실패', color: '#b91c1c', bg: '#fee2e2' }
}

function StatusBadge({ status }: { status: SelfCheckStatus }): JSX.Element {
  const s = STATUS_STYLE[status]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 4,
        fontWeight: 700,
        fontSize: 12,
        color: s.color,
        background: s.bg
      }}
    >
      {s.label}
    </span>
  )
}

export default function SystemCheck(): JSX.Element {
  const [about, setAbout] = useState<AppInfo | null>(null)
  const [report, setReport] = useState<SelfCheckReport | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    window.api.system.about().then(setAbout).catch(() => undefined)
  }, [])

  async function handleRun(): Promise<void> {
    setRunning(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.system.selfCheck()
      setReport(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '자가점검 실행 실패')
    } finally {
      setRunning(false)
    }
  }

  async function handleExport(): Promise<void> {
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.system.exportSelfCheck()
      if (result.ok) {
        setMessage(`내보내기 완료: ${result.filePath}`)
      } else {
        setError(result.error ?? '내보내기 실패')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기 처리 중 오류')
    }
  }

  return (
    <div className="settings-page">
      <div className="list-header">
        <h2>환경 점검 (IQ Self-Check)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary-btn" onClick={handleRun} disabled={running}>
            {running ? '점검 중…' : '자가점검 실행'}
          </button>
          <button type="button" className="secondary-btn" onClick={handleExport}>
            결과 내보내기(JSON)
          </button>
        </div>
      </div>

      <p className="settings-hint">
        설치 환경 전제조건(IQ)을 앱이 스스로 점검합니다. 결과는 로컬 파일로만 저장됩니다(폐쇄망).
      </p>

      {error && <p className="login-error">{error}</p>}
      {message && <p className="save-success">{message}</p>}

      {/* About / 버전 정보 (②) */}
      <h3 style={{ marginTop: 16 }}>정보 (About)</h3>
      {about ? (
        <table className="settings-table">
          <tbody>
            <tr>
              <td>앱 버전</td>
              <td>v{about.appVersion}</td>
            </tr>
            <tr>
              <td>Electron / Chromium / Node</td>
              <td>
                {about.electronVersion} / {about.chromeVersion} / {about.nodeVersion}
              </td>
            </tr>
            <tr>
              <td>빌드 일자</td>
              <td>{about.buildDate || '—'}</td>
            </tr>
            <tr>
              <td>데이터 폴더</td>
              <td>{about.dataDir}</td>
            </tr>
            {about.usingTestSafeStorage && (
              <tr>
                <td>safeStorage</td>
                <td style={{ color: '#92400e' }}>테스트 어댑터 (실제 DPAPI 아님)</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <p className="status-inline">정보 불러오는 중…</p>
      )}

      {/* 자가점검 결과 (③) */}
      {report && (
        <>
          <h3 style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            점검 결과 <StatusBadge status={report.overall} />
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>{report.ts}</span>
          </h3>
          <table className="settings-table">
            <thead>
              <tr>
                <th>항목</th>
                <th>상태</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
