/**
 * Logging utility for service layer
 * Provides structured logging with context and audit trail
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  entityType?: string;
  entityId?: string;
  service?: string;
  category?: string;
  audit?: string;
  email?: string;
  ip?: string;
  error?: string;
  isValid?: boolean;
  confirm_password?: string;
  metadata?: Record<string, any>;
  [key: string]: any; // Allow any additional properties
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger class for structured service logging
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (Object.values(LogLevel).includes(envLevel)) {
      this.logLevel = envLevel;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.logLevel);
  }

  private formatLogEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context })
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }

    return entry;
  }

  private writeLog(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.DEBUG:
        console.debug(output);
        break;
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.formatLogEntry(LogLevel.ERROR, message, context, error);
      this.writeLog(entry);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.formatLogEntry(LogLevel.WARN, message, context);
      this.writeLog(entry);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.formatLogEntry(LogLevel.INFO, message, context);
      this.writeLog(entry);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.formatLogEntry(LogLevel.DEBUG, message, context);
      this.writeLog(entry);
    }
  }

  /**
   * Log audit events for compliance and security
   */
  audit(event: string, context: LogContext): void {
    this.info(`AUDIT: ${event}`, {
      ...context,
      audit: 'true'
    });
  }

  /**
   * Log permission-related events
   */
  permission(event: string, context: LogContext): void {
    this.info(`PERMISSION: ${event}`, {
      ...context,
      category: 'permission'
    });
  }

  /**
   * Log authentication events
   */
  auth(event: string, context: LogContext): void {
    this.info(`AUTH: ${event}`, {
      ...context,
      category: 'authentication'
    });
  }

  /**
   * Log data access events for security monitoring
   */
  dataAccess(event: string, context: LogContext): void {
    this.info(`DATA_ACCESS: ${event}`, {
      ...context,
      category: 'data_access'
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

/**
 * Service-specific logger with common context
 */
export class ServiceLogger {
  constructor(
    private serviceName: string,
    private logger: Logger = Logger.getInstance()
  ) {}

  private withServiceContext(context?: LogContext): LogContext {
    return {
      ...context,
      service: this.serviceName
    };
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.logger.error(message, this.withServiceContext(context), error);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.withServiceContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, this.withServiceContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.withServiceContext(context));
  }

  audit(event: string, context?: LogContext): void {
    this.logger.audit(event, this.withServiceContext(context));
  }

  permission(event: string, context?: LogContext): void {
    this.logger.permission(event, this.withServiceContext(context));
  }

  auth(event: string, context?: LogContext): void {
    this.logger.auth(event, this.withServiceContext(context));
  }

  dataAccess(event: string, context?: LogContext): void {
    this.logger.dataAccess(event, this.withServiceContext(context));
  }
}

/**
 * Create service-specific logger instance
 */
export function createServiceLogger(serviceName: string): ServiceLogger {
  return new ServiceLogger(serviceName);
}