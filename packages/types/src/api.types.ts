export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: Record<string, any>;
    stack?: string;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  filters?: Record<string, any>;
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export interface ListParams extends PaginationParams, FilterParams {}

export interface AuthRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface HealthCheckResponse {
  status: 'OK' | 'ERROR';
  message: string;
  timestamp: string;
  version?: string;
  uptime?: number;
  checks?: {
    database?: HealthStatus;
    redis?: HealthStatus;
    external_apis?: HealthStatus;
  };
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  responseTime?: number;
  message?: string;
}

export interface FileUploadResponse {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface FileUploadRequest {
  file: File;
  folder?: string;
  isPublic?: boolean;
}

export interface BulkOperation<T> {
  items: T[];
  operation: 'create' | 'update' | 'delete';
}

export interface BulkOperationResponse<T> {
  successful: T[];
  failed: BulkOperationError[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface BulkOperationError {
  item: any;
  error: string;
  index: number;
}

export interface SearchRequest {
  query: string;
  filters?: Record<string, any>;
  facets?: string[];
  highlight?: boolean;
  pagination?: PaginationParams;
}

export interface SearchResponse<T> {
  results: SearchResult<T>[];
  facets?: SearchFacet[];
  pagination: PaginationMeta;
  searchTime: number;
  totalResults: number;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchFacet {
  field: string;
  values: SearchFacetValue[];
}

export interface SearchFacetValue {
  value: string;
  count: number;
  selected?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiValidationError extends ApiError {
  error: {
    message: string;
    code: 'VALIDATION_ERROR';
    details: {
      validationErrors: ValidationError[];
    };
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Re-export types from other modules for convenience
export type { User, UserRole, CreateUserRequest, UpdateUserRequest } from './user.types';
export type { Permission, Hierarchy, PermissionAction, PermissionScope } from './permission.types';