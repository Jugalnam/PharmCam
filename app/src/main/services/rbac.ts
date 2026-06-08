import type { UserRole } from '../../shared/types'
import type { PermissionMatrix } from '../../shared/auth.types'

export type Permission =
  | 'capture'
  | 'sign'
  | 'review'
  | 'config'
  | 'user.manage'
  | 'audit.view'
  | 'audit.export'
  | 'delete'

/** 전체 권한 목록(표시 순서) — 권한 매트릭스 조회 화면의 행 순서로 사용 */
export const ALL_PERMISSIONS: readonly Permission[] = [
  'capture',
  'sign',
  'review',
  'config',
  'user.manage',
  'audit.view',
  'audit.export',
  'delete'
]

/** 전체 역할 목록(표시 순서) — 권한 매트릭스 조회 화면의 열 순서로 사용 */
export const ALL_ROLES: readonly UserRole[] = ['operator', 'reviewer', 'admin']

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

/** 코드에 고정된 역할→권한 매핑을 직렬화해 반환(읽기전용 조회용).
 *  이 매트릭스가 실제 강제값(ROLE_PERMISSIONS)과 동일하므로, 화면에 보이는 것이 곧 적용값이다. */
export function getPermissionMatrix(): PermissionMatrix {
  const grants: Record<string, string[]> = {}
  for (const role of ALL_ROLES) {
    grants[role] = [...ROLE_PERMISSIONS[role]]
  }
  return {
    roles: [...ALL_ROLES],
    permissions: [...ALL_PERMISSIONS],
    grants
  }
}
