/**
 * CleanSlate Structured Logger
 *
 * Structured logging with sanitization.
 * NEVER logs: passwords, cookies, tokens, messages, private content.
 * Provides sanitized diagnostic export.
 */

/** Log levels */
export enum LogLevel {
  Debug = 'DEBUG',
  Info = 'INFO',
  Warn = 'WARN',
  Error = 'ERROR',
}

/** A single structured log entry */
export interface LogEntry {
  readonly timestamp: number;
  readonly level: LogLevel;
  readonly operationId?: string;
  readonly category?: string;
  readonly phase?: string;
  readonly result?: string;
  readonly errorCode?: string;
  readonly message: string;
  readonly context?: Record<string, string | number | boolean>;
}

/** Maximum number of log entries to retain in memory */
const MAX_LOG_ENTRIES = 2000;

/** Fields that must NEVER appear in logs */
const SENSITIVE_PATTERNS = [
  'password',
  'token',
  'cookie',
  'session',
  'credential',
  'auth',
  'secret',
  'access_token',
  'csrf',
  'bearer',
];

/**
 * Sanitize a value to ensure no sensitive data is logged.
 */
function sanitizeValue(value: string): string {
  let sanitized = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    const regex = new RegExp(`(${pattern})[=:]["']?[^\\s"',;]+`, 'gi');
    sanitized = sanitized.replace(regex, `$1=[REDACTED]`);
  }
  return sanitized;
}

/**
 * Sanitize a context object, redacting any sensitive keys.
 */
function sanitizeContext(
  context: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_PATTERNS.some((p) => lowerKey.includes(p))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeValue(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** Structured logger for CleanSlate */
export class Logger {
  private entries: LogEntry[] = [];
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.Info) {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.Debug, LogLevel.Info, LogLevel.Warn, LogLevel.Error];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private addEntry(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    this.entries.push(entry);

    // Prevent unbounded memory growth
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries = this.entries.slice(-MAX_LOG_ENTRIES);
    }
  }

  /** Log a debug message */
  debug(
    message: string,
    meta?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>,
  ): void {
    this.addEntry({
      timestamp: Date.now(),
      level: LogLevel.Debug,
      message: sanitizeValue(message),
      ...meta,
      context: meta?.context ? sanitizeContext(meta.context) : undefined,
    });
  }

  /** Log an info message */
  info(
    message: string,
    meta?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>,
  ): void {
    this.addEntry({
      timestamp: Date.now(),
      level: LogLevel.Info,
      message: sanitizeValue(message),
      ...meta,
      context: meta?.context ? sanitizeContext(meta.context) : undefined,
    });
  }

  /** Log a warning */
  warn(
    message: string,
    meta?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>,
  ): void {
    this.addEntry({
      timestamp: Date.now(),
      level: LogLevel.Warn,
      message: sanitizeValue(message),
      ...meta,
      context: meta?.context ? sanitizeContext(meta.context) : undefined,
    });
  }

  /** Log an error */
  error(
    message: string,
    meta?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>,
  ): void {
    this.addEntry({
      timestamp: Date.now(),
      level: LogLevel.Error,
      message: sanitizeValue(message),
      ...meta,
      context: meta?.context ? sanitizeContext(meta.context) : undefined,
    });
  }

  /** Get all log entries (sanitized copy) */
  getEntries(): ReadonlyArray<LogEntry> {
    return [...this.entries];
  }

  /** Export logs for diagnostics (sanitized) */
  export(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /** Clear all log entries */
  clear(): void {
    this.entries = [];
  }

  /** Set minimum log level */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

/** Singleton logger instance */
export const logger = new Logger(LogLevel.Info);
