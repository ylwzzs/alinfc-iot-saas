/**
 * 统一日志模块
 * 支持多级别、格式化输出、文件存储
 */
import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  traceId?: string;
}

class Logger {
  private logDir: string;
  private level: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, module, message, data, traceId } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${module}]`;
    const tracePart = traceId ? ` [${traceId}]` : '';
    const dataPart = data ? ` ${JSON.stringify(data)}` : '';
    return `${prefix}${tracePart} ${message}${dataPart}`;
  }

  private writeToFile(entry: LogEntry, level: LogLevel): void {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `${level === 'error' ? 'error' : 'app'}-${date}.log`);
    const message = this.formatMessage(entry) + '\n';
    fs.appendFileSync(logFile, message, 'utf-8');
  }

  private log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>, traceId?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
      traceId,
    };

    // 控制台输出
    const consoleMsg = this.formatMessage(entry);
    switch (level) {
      case 'error':
        console.error(consoleMsg);
        break;
      case 'warn':
        console.warn(consoleMsg);
        break;
      case 'debug':
        // debug 级别用灰色
        console.log(`\x1b[90m${consoleMsg}\x1b[0m`);
        break;
      default:
        console.log(consoleMsg);
    }

    // 写入文件（error 级别单独文件）
    this.writeToFile(entry, level);
  }

  debug(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', module, message, data);
  }

  info(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', module, message, data);
  }

  error(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', module, message, data);
  }

  // 带追踪 ID 的日志
  withTrace(traceId: string) {
    return {
      debug: (module: string, message: string, data?: Record<string, unknown>) =>
        this.log('debug', module, message, data, traceId),
      info: (module: string, message: string, data?: Record<string, unknown>) =>
        this.log('info', module, message, data, traceId),
      warn: (module: string, message: string, data?: Record<string, unknown>) =>
        this.log('warn', module, message, data, traceId),
      error: (module: string, message: string, data?: Record<string, unknown>) =>
        this.log('error', module, message, data, traceId),
    };
  }
}

export const logger = new Logger();
export default logger;
