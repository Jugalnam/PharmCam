import { FormEvent, useState } from 'react'
import type { SessionUser } from '../../shared/auth.types'

interface LoginProps {
  onLogin: (user: SessionUser) => void
}

export default function Login({ onLogin }: LoginProps): JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await window.api.auth.login(username.trim(), password)
      if (result.ok && result.user) {
        onLogin(result.user)
      } else {
        setError(result.error ?? '로그인에 실패했습니다.')
      }
    } catch {
      setError('로그인 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setPassword('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>로그인</h2>
        <p className="login-hint">작업자 식별이 필요합니다 (URS-011)</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            사용자명
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? '확인 중…' : '로그인'}
          </button>
        </form>

        <p className="login-seed-hint">
          최초 설치 시 관리자: <code>admin</code> / <code>Admin123!</code>
          <br />
          최초 로그인 후 비밀번호 변경이 필요합니다.
        </p>
      </div>
    </div>
  )
}
