// Database entity for users (hierarchical permission system)
export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string;
  base_hierarchy_id: string;
  base_hierarchy_level: number;
  metadata?: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at?: Date;
  last_login_at?: Date;
  is_active: boolean;
  // Joined fields from hierarchy
  hierarchy_path?: string;
  hierarchy_name?: string;
}

// Legacy user interface for backward compatibility
export interface UserLegacy {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  isActive: boolean;
  role: UserRole;
  permissions: any[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Legacy user role (kept for backward compatibility)
export interface UserRole {
  id: string;
  name: string;
  description?: string;
  level: number;
  permissions: any[];
}

// User hierarchy association
export interface UserHierarchy {
  user_id: string;
  hierarchy_id: string;
  assigned_at: Date;
  assigned_by: string;
  is_primary: boolean;
}

export interface UserProfile {
  id: string;
  userId: string;
  bio?: string;
  department?: string;
  position?: string;
  phoneNumber?: string;
  location?: string;
  timeZone?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface PrivacySettings {
  showEmail: boolean;
  showProfile: boolean;
  allowMessages: boolean;
}

// User management request types
export interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  base_hierarchy_id: string;
  phone?: string;
  metadata?: Record<string, any>;
}

// Legacy create user request
export interface CreateUserRequestLegacy {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleId: string;
}

export interface UpdateUserRequest {
  email?: string;
  full_name?: string;
  phone?: string;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

// Legacy update user request
export interface UpdateUserRequestLegacy {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  roleId?: string;
  isActive?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Password requirements and validation
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfoInPassword: boolean;
}

// User search and filtering
export interface UserSearchFilters {
  search?: string;
  hierarchy_id?: string;
  is_active?: boolean;
  created_after?: Date;
  created_before?: Date;
  page?: number;
  limit?: number;
  sort_by?: 'full_name' | 'email' | 'created_at' | 'hierarchy_path';
  sort_order?: 'asc' | 'desc';
}

// User activity and audit
export interface UserActivity {
  id: string;
  user_id: string;
  action: 'login' | 'logout' | 'password_change' | 'profile_update' | 'permission_granted' | 'permission_revoked';
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

// User session management
export interface UserSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  last_accessed_at: Date;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
}