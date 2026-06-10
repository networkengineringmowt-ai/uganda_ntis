export type UserRole = 'viewer' | 'inspector' | 'engineer' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  region?: string;
  department?: string;
  lastLogin?: string;
  isActive: boolean;
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

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  viewer:    { canViewMaps:true,  canViewTraffic:true,  canViewBudget:false, canViewBridges:true,  canViewML:false, canEditRoads:false, canEditBridges:false, canSubmitSurvey:false, canApproveMaintenance:false, canManageUsers:false, canExportData:false, canViewConfidential:false },
  inspector: { canViewMaps:true,  canViewTraffic:true,  canViewBudget:false, canViewBridges:true,  canViewML:false, canEditRoads:false, canEditBridges:false, canSubmitSurvey:true,  canApproveMaintenance:false, canManageUsers:false, canExportData:true,  canViewConfidential:false },
  engineer:  { canViewMaps:true,  canViewTraffic:true,  canViewBudget:true,  canViewBridges:true,  canViewML:true,  canEditRoads:true,  canEditBridges:true,  canSubmitSurvey:true,  canApproveMaintenance:false, canManageUsers:false, canExportData:true,  canViewConfidential:false },
  manager:   { canViewMaps:true,  canViewTraffic:true,  canViewBudget:true,  canViewBridges:true,  canViewML:true,  canEditRoads:true,  canEditBridges:true,  canSubmitSurvey:true,  canApproveMaintenance:true,  canManageUsers:false, canExportData:true,  canViewConfidential:true  },
  admin:     { canViewMaps:true,  canViewTraffic:true,  canViewBudget:true,  canViewBridges:true,  canViewML:true,  canEditRoads:true,  canEditBridges:true,  canSubmitSurvey:true,  canApproveMaintenance:true,  canManageUsers:true,  canExportData:true,  canViewConfidential:true  },
};

export function hasPermission(user: User | null, perm: keyof Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role][perm];
}
