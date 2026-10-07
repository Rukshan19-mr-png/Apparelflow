import type { UserRole } from '@/types';

export type RoleResource = 'orders' | 'verification' | 'sewing_queue';

const access: Record<UserRole, RoleResource[]> = {
  cutting_supervisor: ['orders'],
  cutting_verifier: ['verification'],
  sewing_supervisor: ['sewing_queue'],
};

export function canAccessRoleResource(role: UserRole, resource: RoleResource) {
  return access[role].includes(resource);
}
