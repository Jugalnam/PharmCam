import { useState } from 'react'
import type { SessionUser } from '../../shared/auth.types'
import Capture from './Capture'
import RecordList from './RecordList'
import AuditView from './AuditView'
import Settings from './Settings'
import SystemCheck from './SystemCheck'
import UserManagement from './UserManagement'
import Help from './Help'

interface HomeProps {
  user: SessionUser
  onLogout: () => void
}

type Tab = 'capture' | 'list' | 'audit' | 'users' | 'settings' | 'system' | 'help'

const ROLE_LABELS: Record<SessionUser['role'], string> = {
  operator: '작업자 (Operator)',
  reviewer: '검토자 (Reviewer)',
  admin: '관리자 (Admin)'
}

export default function Home({ user, onLogout }: HomeProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('capture')

  async function handleLogout(): Promise<void> {
    await window.api.auth.logout()
    onLogout()
  }

  return (
    <div className="home-shell">
      <nav className="main-nav">
        <div className="nav-user">
          <span className="nav-username">{user.username}</span>
          <span className="nav-role">{ROLE_LABELS[user.role]}</span>
        </div>
        <div className="nav-tabs">
          <button
            type="button"
            className={tab === 'capture' ? 'active' : ''}
            onClick={() => setTab('capture')}
          >
            촬영
          </button>
          <button
            type="button"
            className={tab === 'list' ? 'active' : ''}
            onClick={() => setTab('list')}
          >
            기록 목록
          </button>
          <button
            type="button"
            className={tab === 'audit' ? 'active' : ''}
            onClick={() => setTab('audit')}
          >
            감사추적
          </button>
          {user.role === 'admin' && (
            <button
              type="button"
              className={tab === 'users' ? 'active' : ''}
              onClick={() => setTab('users')}
            >
              계정 관리
            </button>
          )}
          {user.role === 'admin' && (
            <button
              type="button"
              className={tab === 'settings' ? 'active' : ''}
              onClick={() => setTab('settings')}
            >
              설정
            </button>
          )}
          {user.role === 'admin' && (
            <button
              type="button"
              className={tab === 'system' ? 'active' : ''}
              onClick={() => setTab('system')}
            >
              환경 점검
            </button>
          )}
          <button
            type="button"
            className={tab === 'help' ? 'active' : ''}
            onClick={() => setTab('help')}
          >
            도움말
          </button>
        </div>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
      </nav>

      <div className="tab-content">
        {tab === 'capture' && <Capture user={user} />}
        {tab === 'list' && <RecordList user={user} />}
        {tab === 'audit' && <AuditView user={user} />}
        {tab === 'users' && user.role === 'admin' && <UserManagement user={user} />}
        {tab === 'settings' && user.role === 'admin' && <Settings />}
        {tab === 'system' && user.role === 'admin' && <SystemCheck />}
        {tab === 'help' && <Help user={user} />}
      </div>
    </div>
  )
}
