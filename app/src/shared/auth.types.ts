import type { UserRole, UserStatus } from './types'

export interface SessionUser {
  id: number
  username: string
  role: UserRole
  mustChangePassword: boolean
}

export interface ChangePasswordResult {
  ok: boolean
  user?: SessionUser
  error?: string
}

export interface LoginResult {
  ok: boolean
  user?: SessionUser
  error?: string
  passwordExpired?: boolean
}

export interface CreateUserInput {
  username: string
  password: string
  role: UserRole
}

export interface CreateUserResult {
  ok: boolean
  userId?: number
  error?: string
}

export interface DeactivateUserResult {
  ok: boolean
  error?: string
}

export interface UserSummary {
  id: number
  username: string
  role: UserRole
  status: UserStatus
  createdAt: string
  disabledAt: string | null
}

/** 역할별 권한 매트릭스(읽기전용 표시용). 실제 강제 출처는 main의 rbac.ts.
 *  permissions/grants의 값은 권한 ID 문자열(예: 'capture'), 라벨은 화면에서 매핑. */
export interface PermissionMatrix {
  roles: UserRole[]
  permissions: string[]
  grants: Record<string, string[]>
}
