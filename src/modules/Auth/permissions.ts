import type { UserRole } from './authTypes';
import { FIELD_ROLES } from './authTypes';

// Views that only the admin level may open. super gets every dashboard and
// report but no input, audit, or admin tooling; field roles (rms/bms/tis)
// never reach the main shell at all (they get the dedicated mobile capture
// interface).
export const ADMIN_ONLY_VIEWS = new Set([
  'admin', 'dataaudit', 'datacapture', 'pendingsurveys',
]);

export function canAccessView(role: UserRole | undefined, view: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (role === 'super') return !ADMIN_ONLY_VIEWS.has(view);
  return false; // field roles (rms/bms/tis) use their own shell
}

/** Returns true if the role is a field-capture role (rms/bms/tis). */
export function isFieldRole(role: UserRole | undefined): boolean {
  if (!role) return false;
  return FIELD_ROLES.has(role);
}
