import { useEffect, useState } from 'react'
import type { SessionUser } from '../shared/auth.types'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import ChangePassword from './pages/ChangePassword'
import Home from './pages/Home'
import Login from './pages/Login'

export default function App(): JSX.Element {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)

  useSessionTimeout(user !== null && !user.mustChangePassword)

  useEffect(() => {
    window.api.auth
      .currentUser()
      .then((current) => setUser(current))
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return (
      <div className="app">
        <main className="app-main">
          <p className="status">세션 확인 중…</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PharmCam</h1>
        <p className="subtitle">GMP 검체·시료 사진 기록 시스템</p>
      </header>
      <main className={`app-main ${user && !user.mustChangePassword ? 'app-main-wide' : ''}`}>
        {user ? (
          user.mustChangePassword ? (
            <ChangePassword
              user={user}
              onChanged={setUser}
              onLogout={() => setUser(null)}
            />
          ) : (
            <Home user={user} onLogout={() => setUser(null)} />
          )
        ) : (
          <Login onLogin={setUser} />
        )}
      </main>
    </div>
  )
}
