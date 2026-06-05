import type { UserRole } from './types'

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
