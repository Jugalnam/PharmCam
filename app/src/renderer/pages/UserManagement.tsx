import { useEffect, useState, type FormEvent } from 'react'
import type { PermissionMatrix, SessionUser, UserSummary } from '../../shared/auth.types'
import type { UserRole } from '../../shared/types'

interface UserManagementProps {
  user: SessionUser
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'operator', label: '작업자 (Operator)' },
  { value: 'reviewer', label: '검토자 (Reviewer)' },
  { value: 'admin', label: '관리자 (Admin)' }
]

const ROLE_LABELS: Record<UserRole, string> = {
  operator: '작업자',
  reviewer: '검토자',
  admin: '관리자'
}

/** 권한 ID → 화면 표시용 라벨·설명. main의 rbac.ts와 ID로 매칭(라벨은 표시 전용). */
const PERMISSION_LABELS: Record<string, { label: string; desc: string }> = {
  capture: { label: '촬영·저장', desc: '검체/시료 사진 촬영 및 기록 저장' },
  sign: { label: '전자서명', desc: '기록에 전자서명 수행' },
  review: { label: '검토', desc: '기록 검토·승인 처리' },
  config: { label: '설정 변경', desc: '시스템 설정·백업·환경점검' },
  'user.manage': { label: '계정 관리', desc: '계정 생성·비활성화' },
  'audit.view': { label: '감사추적 조회', desc: '감사추적·기록 목록 열람' },
  'audit.export': { label: '감사추적 내보내기', desc: '감사추적·기록 CSV/PDF 내보내기' },
  delete: { label: '삭제', desc: '예약됨 — 기록은 append-only라 실제 삭제 동작은 없음' }
}

export default function UserManagement({ user }: UserManagementProps): JSX.Element {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('operator')
  const [submitting, setSubmitting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadUsers()
    loadMatrix()
  }, [])

  async function loadMatrix(): Promise<void> {
    try {
      const m = await window.api.auth.getPermissionMatrix()
      setMatrix(m)
    } catch {
      // 매트릭스 조회 실패는 치명적이지 않음 — 계정 표는 정상 표시
      setMatrix(null)
    }
  }

  async function loadUsers(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const list = await window.api.auth.listUsers()
      setUsers(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  function openCreate(): void {
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setRole('operator')
    setError(null)
    setMessage(null)
    setShowCreate(true)
  }

  function closeCreate(): void {
    setShowCreate(false)
    setError(null)
  }

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!username.trim() || !password) {
      setError('사용자명과 비밀번호를 입력하세요.')
      return
    }
    if (password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setSubmitting(true)
    try {
      const result = await window.api.auth.createUser({
        username: username.trim(),
        password,
        role
      })
      if (result.ok) {
        setMessage(`계정 '${username.trim()}'(${ROLE_LABELS[role]}) 생성 완료`)
        setUsername('')
        setPassword('')
        setConfirmPassword('')
        setRole('operator')
        setShowCreate(false)
        await loadUsers()
      } else {
        setError(result.error ?? '계정 생성에 실패했습니다.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '계정 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(target: UserSummary): Promise<void> {
    setError(null)
    setMessage(null)
    if (!window.confirm(`'${target.username}' 계정을 비활성화하시겠습니까?`)) {
      return
    }
    try {
      const result = await window.api.auth.deactivateUser(target.id)
      if (result.ok) {
        setMessage(`'${target.username}' 계정을 비활성화했습니다.`)
        await loadUsers()
      } else {
        setError(result.error ?? '비활성화에 실패했습니다.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '비활성화 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="settings-page">
      <div className="list-header">
        <h2>계정 관리 (User Management)</h2>
        <div>
          <button type="button" className="secondary-btn" onClick={openCreate}>
            + 계정 추가
          </button>{' '}
          <button type="button" className="secondary-btn" onClick={loadUsers}>
            새로고침
          </button>
        </div>
      </div>

      <p className="settings-hint">
        1인 1계정 원칙(URS-010)에 따라 작업자마다 개별 계정을 발급하세요. 계정 생성·비활성화는
        감사추적에 기록됩니다. 비활성화된 계정은 로그인할 수 없습니다(기록 보존을 위해 삭제는 불가).
      </p>

      {error && <p className="login-error">{error}</p>}
      {message && <p className="save-success">{message}</p>}

      {showCreate && (
        <div className="modal-backdrop" onClick={closeCreate}>
          <div
            className="print-modal"
            style={{ width: 'min(440px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="print-modal-header">
              <div>
                <h3>새 계정 추가</h3>
                <p>1인 1계정 — 생성은 감사추적에 기록됩니다</p>
              </div>
            </div>
            <form onSubmit={handleCreate}>
              <div className="user-modal-body">
                {error && <p className="login-error">{error}</p>}
                <label>
                  사용자명(아이디) <span className="required">*</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="예: hong.gd"
                    autoFocus
                  />
                </label>
                <label>
                  비밀번호 <span className="required">*</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 정책 적용"
                  />
                </label>
                <label>
                  비밀번호 확인 <span className="required">*</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </label>
                <label>
                  역할(권한)
                  <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="print-modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeCreate}
                  disabled={submitting}
                >
                  취소
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? '생성 중…' : '계정 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="status-inline">사용자 목록 불러오는 중…</p>
      ) : (
        <table className="settings-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>사용자명</th>
              <th>역할</th>
              <th>상태</th>
              <th>생성일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.status === 'inactive' ? 'locked-row' : ''}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>
                  {u.status === 'active' ? (
                    <span className="editable-badge">활성</span>
                  ) : (
                    <span className="lock-badge">비활성</span>
                  )}
                </td>
                <td>{u.createdAt?.slice(0, 10)}</td>
                <td>
                  {u.status === 'active' && u.id !== user.id ? (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => handleDeactivate(u)}
                    >
                      비활성화
                    </button>
                  ) : u.id === user.id ? (
                    <span className="setting-key">현재 로그인</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="permission-matrix-section">
        <h3>역할별 권한 (Role Permissions)</h3>
        <p className="settings-hint">
          읽기전용 — 역할별 권한은 코드(rbac.ts)에 고정되어 있으며, 여기 보이는 값이 곧 실제로
          적용·강제되는 값입니다. 권한 변경은 접근통제 변경(GMP 중대사항)으로 별도 요구사항·위험평가·
          재검증 절차가 필요합니다.
        </p>
        {matrix ? (
          <table className="settings-table permission-matrix">
            <thead>
              <tr>
                <th>권한</th>
                {matrix.roles.map((r) => (
                  <th key={r} style={{ textAlign: 'center' }}>
                    {ROLE_LABELS[r as UserRole] ?? r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.permissions.map((p) => (
                <tr key={p}>
                  <td>
                    <strong>{PERMISSION_LABELS[p]?.label ?? p}</strong>
                    <span className="setting-key"> — {PERMISSION_LABELS[p]?.desc ?? p}</span>
                  </td>
                  {matrix.roles.map((r) => (
                    <td key={r} style={{ textAlign: 'center' }}>
                      {matrix.grants[r]?.includes(p) ? (
                        <span className="editable-badge">✓</span>
                      ) : (
                        <span className="setting-key">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="status-inline">권한 매트릭스를 불러오는 중…</p>
        )}
      </section>
    </div>
  )
}
