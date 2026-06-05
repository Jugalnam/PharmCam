import { useEffect, useState } from 'react'
import type { ConfigurationSpec } from '../../shared/config.types'
import type { ConfigEntry } from '../../shared/types'

const KEY_LABELS: Record<string, string> = {
  'audit.enabled': '감사추적 활성화',
  'integrity.enabled': '무결성 검증 활성화',
  'auth.required': '인증 필수',
  'timestamp.source': '시각 출처',
  'esign.enabled': '전자서명 활성화',
  'esign.actions': '전자서명 적용 행위',
  'session.timeoutMin': '세션 타임아웃 (분)',
  'password.minLength': '비밀번호 최소 길이',
  'password.expiryDays': '비밀번호 만료 (일)',
  'login.maxFails': '로그인 최대 실패 횟수',
  'metadata.requiredFields': '필수 메타데이터',
  'backup.mode': '백업 모드',
  'backup.path': '백업 경로',
  'retention.days': '보존 기간 (일)',
  'encryption.enabled': '암호화 활성화',
  'lims.enabled': 'LIMS 연동 활성화'
}

export default function Settings(): JSX.Element {
  const [spec, setSpec] = useState<ConfigurationSpec>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    loadSpec()
  }, [])

  async function loadSpec(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.config.getSpec()
      setSpec(data)
      setDrafts(Object.fromEntries(data.map((e) => [e.key, e.value])))
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleDraftChange(key: string, value: string): void {
    setDrafts((prev) => ({ ...prev, [key]: value }))
    setMessage(null)
  }

  async function handleSave(entry: ConfigEntry): Promise<void> {
    if (entry.coreLocked) {
      return
    }

    setSavingKey(entry.key)
    setError(null)
    setMessage(null)

    try {
      const result = await window.api.config.set(entry.key, drafts[entry.key])
      if (result.ok) {
        setMessage(`${entry.key} 저장 완료`)
        await loadSpec()
      } else {
        setError(result.error ?? '저장에 실패했습니다.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 처리 중 오류가 발생했습니다.')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return <p className="status-inline">설정 불러오는 중…</p>
  }

  return (
    <div className="settings-page">
      <div className="list-header">
        <h2>시스템 설정 (Configuration Spec)</h2>
        <button type="button" className="secondary-btn" onClick={loadSpec}>
          새로고침
        </button>
      </div>

      <p className="settings-hint">
        코어 잠금(core-locked) 항목은 GMP 무결성 코어로 변경할 수 없습니다.
      </p>

      {error && <p className="login-error">{error}</p>}
      {message && <p className="save-success">{message}</p>}

      <table className="settings-table">
        <thead>
          <tr>
            <th>설정</th>
            <th>값</th>
            <th>상태</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {spec.map((entry) => (
            <tr key={entry.key} className={entry.coreLocked ? 'locked-row' : ''}>
              <td>
                <span className="setting-label">{KEY_LABELS[entry.key] ?? entry.key}</span>
                <span className="setting-key">{entry.key}</span>
              </td>
              <td>
                <input
                  className="setting-input"
                  value={drafts[entry.key] ?? entry.value}
                  onChange={(e) => handleDraftChange(entry.key, e.target.value)}
                  disabled={entry.coreLocked}
                  readOnly={entry.coreLocked}
                />
              </td>
              <td>
                {entry.coreLocked ? (
                  <span className="lock-badge" title="코어 잠금 — 변경 불가">
                    🔒 core-locked
                  </span>
                ) : (
                  <span className="editable-badge">편집 가능</span>
                )}
              </td>
              <td>
                {!entry.coreLocked && (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={savingKey === entry.key || drafts[entry.key] === entry.value}
                    onClick={() => handleSave(entry)}
                  >
                    {savingKey === entry.key ? '저장 중…' : '저장'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
