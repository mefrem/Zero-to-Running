/**
 * Logger utility for structured console logging with timestamps
 * Provides consistent logging format across the application
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = this.getTimestamp();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      return `${baseMessage} ${JSON.stringify(meta)}`;
    }

    return baseMessage;
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(this.formatMessage(LogLevel.INFO, message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }
}

// Export singleton instance
export const logger = new Logger();
