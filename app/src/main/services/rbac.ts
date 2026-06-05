import type { UserRole } from '../../shared/types'

export type Permission =
  | 'capture'
  | 'sign'
  | 'review'
  | 'config'
  | 'user.manage'
  | 'audit.view'
  | 'audit.export'
  | 'delete'

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  operator: ['capture', 'audit.view'],
  reviewer: ['capture', 'sign', 'review', 'audit.view', 'audit.export'],
  admin: [
    'capture',
    'sign',
    'review',
    'config',
    'user.manage',
    'audit.view',
    'audit.export',
    'delete'
  ]
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}
