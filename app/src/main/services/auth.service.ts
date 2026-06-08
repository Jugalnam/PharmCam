import argon2 from 'argon2'
import type Database from 'better-sqlite3'
import type {
  ChangePasswordResult,
  CreateUserInput,
  CreateUserResult,
  DeactivateUserResult,
  LoginResult,
  PermissionMatrix,
  SessionUser,
  UserSummary
} from '../../shared/auth.types'
import type { UserRole, UserStatus } from '../../shared/types'
import type { AuditService } from './audit.service'
import type { ConfigService } from './config.service'
import { getPermissionMatrix, hasPermission, type Permission } from './rbac'
import type { TimeService } from './time.service'

const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_PASSWORD = 'Admin123!'

interface UserRow {
  id: number
  username: string
  password_hash: string
  role: string
  status: string
  fail_count: number
  password_changed_at: string | null
  must_change_password: number
  created_at: string
  disabled_at: string | null
}

interface ActiveSession {
  userId: number
  username: string
  role: UserRole
  mustChangePassword: boolean
  lastActivityAt: number
}

export class AuthService {
  private session: ActiveSession | null = null

  constructor(
    private readonly db: Database.Database,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly timeService: TimeService
  ) {}

  async seedAdminAccount(): Promise<void> {
    const count = this.db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
    if (count.c > 0) {
      return
    }

    const now = this.timeService.now()
    const passwordHash = await argon2.hash(DEFAULT_ADMIN_PASSWORD)

    this.db
      .prepare(
        `INSERT INTO users
          (username, password_hash, role, status, fail_count, password_changed_at, must_change_password, created_at)
         VALUES (?, ?, 'admin', 'active', 0, ?, 1, ?)`
      )
      .run(DEFAULT_ADMIN_USERNAME, passwordHash, now, now)

    this.auditService.append('user_create', {
      targetType: 'user',
      targetId: DEFAULT_ADMIN_USERNAME,
      after: JSON.stringify({ role: 'admin', seeded: true })
    })
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const user = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as UserRow | undefined

    if (!user) {
      this.auditService.append('login_failed', {
        targetType: 'user',
        targetId: username,
        after: 'unknown_user'
      })
      return { ok: false, error: '사용자명 또는 비밀번호가 올바르지 않습니다.' }
    }

    if (user.status === 'inactive') {
      this.auditService.append('login_failed', {
        userId: user.id,
        targetType: 'user',
        targetId: String(user.id),
        after: 'account_inactive'
      })
      return { ok: false, error: '계정이 잠겨 있습니다. 관리자에게 문의하세요.' }
    }

    const passwordValid = await argon2.verify(user.password_hash, password)
    if (!passwordValid) {
      return this.handleLoginFailure(user)
    }

    if (!user.must_change_password && this.isPasswordExpired(user)) {
      this.auditService.append('login_failed', {
        userId: user.id,
        targetType: 'user',
        targetId: String(user.id),
        after: 'password_expired'
      })
      return {
        ok: false,
        error: '비밀번호가 만료되었습니다. 관리자에게 문의하세요.',
        passwordExpired: true
      }
    }

    this.db.prepare('UPDATE users SET fail_count = 0 WHERE id = ?').run(user.id)

    this.session = {
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      mustChangePassword: user.must_change_password === 1,
      lastActivityAt: Date.now()
    }

    this.auditService.append('login', {
      userId: user.id,
      targetType: 'user',
      targetId: String(user.id)
    })

    return { ok: true, user: this.toSessionUser(user) }
  }

  logout(): void {
    if (!this.session) {
      return
    }

    const userId = this.session.userId
    this.auditService.append('logout', {
      userId,
      targetType: 'user',
      targetId: String(userId)
    })
    this.session = null
  }

  touchActivity(): void {
    if (this.session) {
      this.session.lastActivityAt = Date.now()
    }
  }

  currentUser(): SessionUser | null {
    if (!this.session) {
      return null
    }

    if (this.isSessionExpired()) {
      const userId = this.session.userId
      this.auditService.append('session_expired', {
        userId,
        targetType: 'user',
        targetId: String(userId)
      })
      this.session = null
      return null
    }

    return {
      id: this.session.userId,
      username: this.session.username,
      role: this.session.role,
      mustChangePassword: this.session.mustChangePassword
    }
  }

  requireSession(): SessionUser {
    const user = this.currentUser()
    if (!user) {
      throw new Error('세션이 만료되었거나 로그인이 필요합니다.')
    }
    return user
  }

  requirePermission(permission: Permission): SessionUser {
    const user = this.requireSession()
    if (this.session?.mustChangePassword) {
      throw new Error('비밀번호 변경이 필요합니다. 다른 기능을 사용할 수 없습니다.')
    }
    if (!hasPermission(user.role, permission)) {
      throw new Error('이 작업을 수행할 권한이 없습니다.')
    }
    return user
  }

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    const admin = this.requirePermission('user.manage')

    const policyError = this.validatePasswordPolicy(input.password)
    if (policyError) {
      return { ok: false, error: policyError }
    }

    const existing = this.db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(input.username) as { id: number } | undefined

    if (existing) {
      return { ok: false, error: '이미 존재하는 사용자명입니다.' }
    }

    const now = this.timeService.now()
    const passwordHash = await argon2.hash(input.password)

    const result = this.db
      .prepare(
        `INSERT INTO users
          (username, password_hash, role, status, fail_count, password_changed_at, created_at)
         VALUES (?, ?, ?, 'active', 0, ?, ?)`
      )
      .run(input.username, passwordHash, input.role, now, now)

    const userId = Number(result.lastInsertRowid)

    this.auditService.append('user_create', {
      userId: admin.id,
      targetType: 'user',
      targetId: String(userId),
      after: JSON.stringify({ username: input.username, role: input.role })
    })

    return { ok: true, userId }
  }

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResult> {
    const session = this.requireSession()
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(session.id) as
      | UserRow
      | undefined

    if (!user) {
      return { ok: false, error: '사용자를 찾을 수 없습니다.' }
    }

    const currentValid = await argon2.verify(user.password_hash, currentPassword)
    if (!currentValid) {
      return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' }
    }

    const policyError = this.validatePasswordPolicy(newPassword)
    if (policyError) {
      return { ok: false, error: policyError }
    }

    if (currentPassword === newPassword) {
      return { ok: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' }
    }

    const now = this.timeService.now()
    const newHash = await argon2.hash(newPassword)

    this.db
      .prepare(
        `UPDATE users
         SET password_hash = ?, password_changed_at = ?, must_change_password = 0
         WHERE id = ?`
      )
      .run(newHash, now, user.id)

    if (this.session) {
      this.session.mustChangePassword = false
    }

    this.auditService.append('password_change', {
      userId: user.id,
      targetType: 'user',
      targetId: String(user.id)
    })

    return { ok: true, user: this.currentUser() ?? undefined }
  }

  deactivateUser(targetUserId: number): DeactivateUserResult {
    const admin = this.requirePermission('user.manage')

    if (admin.id === targetUserId) {
      return { ok: false, error: '자신의 계정은 비활성화할 수 없습니다.' }
    }

    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as
      | UserRow
      | undefined

    if (!user) {
      return { ok: false, error: '사용자를 찾을 수 없습니다.' }
    }

    if (user.status === 'inactive') {
      return { ok: false, error: '이미 비활성화된 계정입니다.' }
    }

    const now = this.timeService.now()
    this.db
      .prepare("UPDATE users SET status = 'inactive', disabled_at = ? WHERE id = ?")
      .run(now, targetUserId)

    this.auditService.append('user_deactivate', {
      userId: admin.id,
      targetType: 'user',
      targetId: String(targetUserId),
      before: 'active',
      after: 'inactive'
    })

    if (this.session?.userId === targetUserId) {
      this.session = null
    }

    return { ok: true }
  }

  /** 역할별 권한 매트릭스(읽기전용). 세션만 있으면 조회 가능 — 정책 정보일 뿐 민감 데이터 아님. */
  getPermissionMatrix(): PermissionMatrix {
    this.requireSession()
    return getPermissionMatrix()
  }

  listUsers(): UserSummary[] {
    this.requirePermission('user.manage')
    const rows = this.db
      .prepare(
        'SELECT id, username, role, status, created_at, disabled_at FROM users ORDER BY id'
      )
      .all() as Array<{
      id: number
      username: string
      role: string
      status: string
      created_at: string
      disabled_at: string | null
    }>
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role as UserRole,
      status: r.status as UserStatus,
      createdAt: r.created_at,
      disabledAt: r.disabled_at
    }))
  }

  private handleLoginFailure(user: UserRow): LoginResult {
    const maxFails = this.configService.getNumber('login.maxFails', 5)
    const newFailCount = user.fail_count + 1

    if (newFailCount >= maxFails) {
      const now = this.timeService.now()
      this.db
        .prepare("UPDATE users SET fail_count = ?, status = 'inactive', disabled_at = ? WHERE id = ?")
        .run(newFailCount, now, user.id)

      this.auditService.append('login_failed', {
        userId: user.id,
        targetType: 'user',
        targetId: String(user.id),
        after: String(newFailCount)
      })

      this.auditService.append('account_locked', {
        userId: user.id,
        targetType: 'user',
        targetId: String(user.id),
        before: 'active',
        after: `inactive (fail_count=${newFailCount})`
      })

      // Fix audit append - account_locked should use after not after_value
      return {
        ok: false,
        error: `로그인 실패 ${maxFails}회로 계정이 잠겼습니다. 관리자에게 문의하세요.`
      }
    }

    this.db.prepare('UPDATE users SET fail_count = ? WHERE id = ?').run(newFailCount, user.id)

    this.auditService.append('login_failed', {
      userId: user.id,
      targetType: 'user',
      targetId: String(user.id),
      after: String(newFailCount)
    })

    return { ok: false, error: '사용자명 또는 비밀번호가 올바르지 않습니다.' }
  }

  private isPasswordExpired(user: UserRow): boolean {
    const expiryDays = this.configService.getNumber('password.expiryDays', 90)
    if (!user.password_changed_at) {
      return false
    }

    const changedAt = new Date(user.password_changed_at).getTime()
    const expiresAt = changedAt + expiryDays * 24 * 60 * 60 * 1000
    return Date.now() > expiresAt
  }

  private isSessionExpired(): boolean {
    if (!this.session) {
      return true
    }

    const timeoutMin = this.configService.getNumber('session.timeoutMin', 15)
    const timeoutMs = timeoutMin * 60 * 1000
    return Date.now() - this.session.lastActivityAt > timeoutMs
  }

  private validatePasswordPolicy(password: string): string | null {
    const minLength = this.configService.getNumber('password.minLength', 8)
    if (password.length < minLength) {
      return `비밀번호는 최소 ${minLength}자 이상이어야 합니다.`
    }
    return null
  }

  private toSessionUser(user: UserRow): SessionUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role as UserRole,
      mustChangePassword: user.must_change_password === 1
    }
  }

  async verifyPassword(userId: number, password: string): Promise<boolean> {
    const user = this.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as
      | { password_hash: string }
      | undefined

    if (!user) {
      return false
    }

    return argon2.verify(user.password_hash, password)
  }

  /** 테스트·시드용: 비밀번호 해시 생성 */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password)
  }
}

export { DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD }
