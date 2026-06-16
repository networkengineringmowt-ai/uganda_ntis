// Five access levels — per-app field capture + shared dashboard/admin tiers:
//  rms   → NRMS platform field data-entry ONLY (mobile-friendly capture shell)
//  bms   → NBMS standalone field data-entry ONLY (mobile-friendly capture shell)
//  tis   → NTIS standalone field data-entry ONLY (mobile-friendly capture shell)
//  super → dashboards/reports of everything, read-only (no input, no admin/audit)
//  admin → everything, all at once
export type UserRole = 'rms' | 'bms' | 'tis' | 'pms' | 'super' | 'admin';

/** Convenience set of all field-capture roles */
export const FIELD_ROLES: ReadonlySet<UserRole> = new Set(['rms', 'bms', 'tis', 'pms']);

/** Human-readable label for each access level (shown in UI / audit tables). */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin (full system access)',
  super: 'Super (dashboard & reports)',
  rms:   'Field team (NRMS)',
  bms:   'Field team (NBMS)',
  tis:   'Field team (NTIS)',
  pms:   'Field team (NPMS)',
};

/** Safe lookup: returns the label for a known role, else the raw value. */
export function roleLabel(role?: string | null): string {
  return (role && (ROLE_LABELS as Record<string, string>)[role]) || (role ?? '—');
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  region?: string;
  department?: string;
  lastLogin?: string;
  isActive: boolean;
  /** Identity-manager access state: approved | awaiting admin | blocked. */
  access?: 'active' | 'pending' | 'revoked';
}

export interface Permission {
  canViewMaps: boolean;
  canViewTraffic: boolean;
  canViewBudget: boolean;
  canViewBridges: boolean;
  canViewML: boolean;
  canEditRoads: boolean;
  canEditBridges: boolean;
  canSubmitSurvey: boolean;
  canApproveMaintenance: boolean;
  canManageUsers: boolean;
  canExportData: boolean;
  canViewConfidential: boolean;
}

const FIELD_PERMS: Permission = { canViewMaps:false, canViewTraffic:false, canViewBudget:false, canViewBridges:false, canViewML:false, canEditRoads:true,  canEditBridges:true,  canSubmitSurvey:true,  canApproveMaintenance:false, canManageUsers:false, canExportData:false, canViewConfidential:false };

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  rms:   FIELD_PERMS,
  bms:   FIELD_PERMS,
  tis:   FIELD_PERMS,
  pms:   FIELD_PERMS,
  super: { canViewMaps:true,  canViewTraffic:true,  canViewBudget:true,  canViewBridges:true,  canViewML:true,  canEditRoads:false, canEditBridges:false, canSubmitSurvey:false, canApproveMaintenance:false, canManageUsers:false, canExportData:true,  canViewConfidential:true  },
  admin: { canViewMaps:true,  canViewTraffic:true,  canViewBudget:true,  canViewBridges:true,  canViewML:true,  canEditRoads:true,  canEditBridges:true,  canSubmitSurvey:true,  canApproveMaintenance:true,  canManageUsers:true,  canExportData:true,  canViewConfidential:true  },
};

export function hasPermission(user: User | null, perm: keyof Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role][perm];
}
