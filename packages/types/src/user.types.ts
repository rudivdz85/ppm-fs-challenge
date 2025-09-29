export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  isActive: boolean;
  role: UserRole;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserRole {
  id: string;
  name: string;
  description?: string;
  level: number;
  permissions: Permission[];
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

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleId: string;
}

export interface UpdateUserRequest {
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