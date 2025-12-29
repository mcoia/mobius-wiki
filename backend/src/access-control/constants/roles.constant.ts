export const ROLE_LEVELS = {
  guest: 0,
  library_staff: 1,
  mobius_staff: 2,
  site_admin: 3,
};

export function hasRoleAccess(userRole: string | undefined, requiredRole: string): boolean {
  const userLevel = ROLE_LEVELS[userRole] || 0;  // Guest if no role
  const requiredLevel = ROLE_LEVELS[requiredRole] || 0;
  return userLevel >= requiredLevel;
}
