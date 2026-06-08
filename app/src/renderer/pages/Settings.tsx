import { useEffect, useState } from 'react'
import type { ConfigurationSpec, StorageInfo } from '../../shared/config.types'
import type { MetadataField } from '../../shared/record.types'
import type { ConfigEntry } from '../../shared/types'

// 전용 UI(저장 위치·메타데이터 항목)로 다루는 키는 일반 설정표에서 숨긴다.
const HIDDEN_KEYS = new Set(['storage.root', 'metadata.fields', 'metadata.requiredFields'])

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

type EditorSpec =
  | { kind: 'bool' }
  | { kind: 'number'; min?: number }
  | { kind: 'enum'; options: Array<{ value: string; label: string }> }
  | { kind: 'multiselect'; options: Array<{ value: string; label: string }> }

// 백업 모드 — backup.service가 인식하는 값: off | internal | external
const BACKUP_MODE_OPTIONS = [
  { value: 'off', label: '사용 안 함' },
  { value: 'internal', label: '내장 백업' },
  { value: 'external', label: '외부 경로' }
]

// 전자서명 적용 행위 — SignatureMeaning: author | review | approve
const ESIGN_ACTION_OPTIONS = [
  { value: 'author', label: '작성' },
  { value: 'review', label: '검토' },
  { value: 'approve', label: '승인' }
]

// 설정 키별 입력 위젯. 여기 없는 키(backup.path 등)는 기존 텍스트 입력을 사용한다.
const KEY_EDITORS: Record<string, EditorSpec> = {
  'esign.enabled': { kind: 'bool' },
  'encryption.enabled': { kind: 'bool' },
  'lims.enabled': { kind: 'bool' },
  'backup.mode': { kind: 'enum', options: BACKUP_MODE_OPTIONS },
  'esign.actions': { kind: 'multiselect', options: ESIGN_ACTION_OPTIONS },
  'session.timeoutMin': { kind: 'number', min: 1 },
  'password.minLength': { kind: 'number', min: 1 },
  'password.expiryDays': { kind: 'number', min: 0 },
  'login.maxFails': { kind: 'number', min: 1 },
  'retention.days': { kind: 'number', min: 1 }
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export default function Settings(): JSX.Element {
  const [spec, setSpec] = useState<ConfigurationSpec>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [storageBusy, setStorageBusy] = useState(false)
  const [metaFields, setMetaFields] = useState<MetadataField[]>([])
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newRequired, setNewRequired] = useState(false)
  const [metaBusy, setMetaBusy] = useState(false)

  useEffect(() => {
    loadSpec()
    loadStorage()
    loadMetaFields()
  }, [])

  async function loadMetaFields(): Promise<void> {
    try {
      setMetaFields(await window.api.metadata.getFields())
    } catch {
      setMetaFields([])
    }
  }

  function handleAddField(): void {
    const key = newKey.trim()
    const label = newLabel.trim()
    if (!key || !label) {
      setError('항목 키와 이름을 모두 입력하세요.')
      return
    }
    if (metaFields.some((f) => f.key === key)) {
      setError(`이미 정의된 키입니다: ${key}`)
      return
    }
    setMetaFields((prev) => [...prev, { key, label, required: newRequired }])
    setNewKey('')
    setNewLabel('')
    setNewRequired(false)
    setError(null)
  }

  function handleRemoveField(key: string): void {
    setMetaFields((prev) => prev.filter((f) => f.key !== key))
  }

  function handleToggleRequired(key: string): void {
    setMetaFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, required: !f.required } : f))
    )
  }

  async function handleSaveFields(): Promise<void> {
    setMetaBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.metadata.setFields(metaFields)
      if (result.ok) {
        setMessage('메타데이터 항목을 저장했습니다. (촬영 화면에 즉시 반영)')
        await loadMetaFields()
      } else {
        setError(result.error ?? '메타데이터 항목 저장에 실패했습니다.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '메타데이터 항목 저장 중 오류가 발생했습니다.')
    } finally {
      setMetaBusy(false)
    }
  }

  async function loadStorage(): Promise<void> {
    try {
      setStorage(await window.api.storage.getInfo())
    } catch {
      setStorage(null)
    }
  }

  async function handleChooseStorage(): Promise<void> {
    setStorageBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.storage.choose()
      if (result.ok) {
        setMessage('저장 위치가 변경되었습니다. (기존 기록은 옛 위치에 그대로 보존됩니다)')
        await loadStorage()
      } else if (result.error && result.error !== '선택이 취소되었습니다.') {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 위치 변경 중 오류가 발생했습니다.')
    } finally {
      setStorageBusy(false)
    }
  }

  async function handleOpenFolder(): Promise<void> {
    try {
      await window.api.storage.openFolder()
    } catch {
      setError('폴더를 열 수 없습니다.')
    }
  }

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

  function renderValueEditor(entry: ConfigEntry): JSX.Element {
    const value = drafts[entry.key] ?? entry.value
    const spec = KEY_EDITORS[entry.key]

    // 코어 잠금 항목 또는 전용 위젯이 없는 키는 기존 텍스트 입력 유지
    if (entry.coreLocked || !spec) {
      return (
        <input
          className="setting-input"
          value={value}
          onChange={(e) => handleDraftChange(entry.key, e.target.value)}
          disabled={entry.coreLocked}
          readOnly={entry.coreLocked}
        />
      )
    }

    if (spec.kind === 'bool') {
      return (
        <select
          className="setting-input"
          value={value}
          onChange={(e) => handleDraftChange(entry.key, e.target.value)}
        >
          <option value="true">사용함</option>
          <option value="false">사용 안 함</option>
        </select>
      )
    }

    if (spec.kind === 'enum') {
      return (
        <select
          className="setting-input"
          value={value}
          onChange={(e) => handleDraftChange(entry.key, e.target.value)}
        >
          {spec.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    if (spec.kind === 'number') {
      return (
        <input
          type="number"
          className="setting-input"
          value={value}
          min={spec.min}
          onChange={(e) => handleDraftChange(entry.key, e.target.value)}
        />
      )
    }

    // multiselect — JSON 배열 문자열로 저장/직렬화
    const selected = parseJsonArray(value)
    return (
      <div className="checkbox-group">
        {spec.options.map((opt) => (
          <label key={opt.value} className="checkbox-item">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt.value]
                  : selected.filter((v) => v !== opt.value)
                handleDraftChange(entry.key, JSON.stringify(next))
              }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    )
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

      <section className="storage-section">
        <h3>저장 위치 (Storage Location)</h3>
        <p className="settings-hint">
          신규 원본 이미지가 저장되는 로컬 폴더입니다. 변경해도 <strong>기존 기록은 이전 위치에
          그대로 보존</strong>되며(마이그레이션 없음), 무결성 검증은 위치와 무관하게 항상 적용됩니다.
          네트워크/공유 폴더(UNC)는 지정할 수 없습니다.
        </p>
        <table className="settings-table">
          <tbody>
            <tr>
              <td>
                <span className="setting-label">현재 데이터 루트</span>
                <span className="setting-key">storage.root</span>
              </td>
              <td className="mono">
                {storage ? storage.root : '불러오는 중…'}{' '}
                {storage &&
                  (storage.isDefault ? (
                    <span className="lock-badge">기본값</span>
                  ) : (
                    <span className="editable-badge">사용자 지정</span>
                  ))}
              </td>
              <td>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleChooseStorage}
                  disabled={storageBusy}
                >
                  {storageBusy ? '변경 중…' : '폴더 선택…'}
                </button>{' '}
                <button type="button" className="secondary-btn" onClick={handleOpenFolder}>
                  폴더 열기
                </button>
              </td>
            </tr>
            <tr>
              <td>
                <span className="setting-label">이미지 폴더</span>
                <span className="setting-key">root/images</span>
              </td>
              <td className="mono" colSpan={2}>
                {storage ? storage.imagesDir : '—'}{' '}
                {storage && !storage.exists && (
                  <span className="setting-key">(첫 저장 시 생성됨)</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="metadata-section">
        <h3>촬영 메타데이터 항목 (Metadata Fields)</h3>
        <p className="settings-hint">
          시험번호(필수)·시료 ID는 기본 제공 항목입니다. 아래에서 회사별 추가 항목(예: 배치번호)을
          정의하면 <strong>촬영 화면에 입력란으로 표시</strong>되고, 필수로 지정하면 미입력 시 저장이
          차단됩니다. 변경은 감사추적에 기록됩니다. (추가/삭제 후 <strong>항목 저장</strong>을 눌러야 적용)
        </p>
        <table className="settings-table">
          <thead>
            <tr>
              <th>이름(label)</th>
              <th>키(key)</th>
              <th>필수</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {metaFields.length === 0 && (
              <tr>
                <td colSpan={4} className="setting-key">
                  추가 항목이 없습니다 (기본 항목만 사용 중)
                </td>
              </tr>
            )}
            {metaFields.map((f) => (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td className="mono">{f.key}</td>
                <td>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={() => handleToggleRequired(f.key)}
                    />
                    필수
                  </label>
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => handleRemoveField(f.key)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <input
                  className="setting-input"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="예: 배치번호"
                />
              </td>
              <td>
                <input
                  className="setting-input"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="예: batchNo (영문)"
                />
              </td>
              <td>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={(e) => setNewRequired(e.target.checked)}
                  />
                  필수
                </label>
              </td>
              <td>
                <button type="button" className="secondary-btn" onClick={handleAddField}>
                  추가
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <button type="button" onClick={handleSaveFields} disabled={metaBusy}>
          {metaBusy ? '저장 중…' : '항목 저장'}
        </button>
      </section>

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
          {spec
            .filter((entry) => !HIDDEN_KEYS.has(entry.key))
            .map((entry) => (
            <tr key={entry.key} className={entry.coreLocked ? 'locked-row' : ''}>
              <td>
                <span className="setting-label">{KEY_LABELS[entry.key] ?? entry.key}</span>
                <span className="setting-key">{entry.key}</span>
              </td>
              <td>{renderValueEditor(entry)}</td>
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
