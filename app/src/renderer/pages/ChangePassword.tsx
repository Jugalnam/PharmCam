import { FormEvent, useState } from 'react'
import type { SessionUser } from '../../shared/auth.types'

interface ChangePasswordProps {
  user: SessionUser
  onChanged: (user: SessionUser) => void
  onLogout: () => void
}

export default function ChangePassword({
  user,
  onChanged,
  onLogout
}: ChangePasswordProps): JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const result = await window.api.auth.changePassword(currentPassword, newPassword)
      if (result.ok && result.user) {
        onChanged(result.user)
      } else {
        setError(result.error ?? '비밀번호 변경에 실패했습니다.')
      }
    } catch {
      setError('비밀번호 변경 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function handleLogout(): Promise<void> {
    await window.api.auth.logout()
    onLogout()
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>비밀번호 변경 필수</h2>
        <p className="login-hint">
          <strong>{user.username}</strong> 계정은 최초 로그인입니다. 비밀번호를 변경해야 다른
          기능을 사용할 수 있습니다.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            현재 비밀번호
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>

          <label>
            새 비밀번호
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={loading}
            />
          </label>

          <label>
            새 비밀번호 확인
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              disabled={loading}
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          >
            {loading ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>

        <button type="button" className="text-btn" onClick={handleLogout} disabled={loading}>
          로그아웃
        </button>
      </div>
    </div>
  )
}
