// User types
export * from './user.types';

// Permission and hierarchy types
export * from './permission.types';

// Database entity types
export * from './database.types';

// API types
export * from './api.types';

// Common utility types
export type ID = string;
export type Timestamp = string | Date;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// Status types
export type Status = 'active' | 'inactive' | 'pending' | 'suspended' | 'deleted';

// Common response types
export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SoftDeleteEntity extends BaseEntity {
  deletedAt?: Timestamp;
  isDeleted: boolean;
}

export interface AuditableEntity extends BaseEntity {
  createdBy: ID;
  updatedBy: ID;
  version: number;
}

// Event types
export interface DomainEvent {
  id: ID;
  type: string;
  aggregateId: ID;
  aggregateType: string;
  version: number;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Timestamp;
}

// Configuration types
export interface AppConfig {
  environment: Environment;
  database: DatabaseConfig;
  auth: AuthConfig;
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  logging: LoggingConfig;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
}

export interface CorsConfig {
  origin: string | string[];
  credentials: boolean;
  methods: string[];
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'simple';
  file?: string;
}