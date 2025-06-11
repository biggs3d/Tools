// Define log levels
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

// Define log level numerical values for comparison
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3
};

// Default logger configuration
let currentLogLevel: LogLevel = LogLevel.INFO;
let customLogger: Logger | null = null;

// Logger interface
export interface Logger {
    debug(message: string, context?: any): void;
    info(message: string, context?: any): void;
    warn(message: string, context?: any): void;
    error(message: string | Error, context?: any): void;
}

/**
 * Configure the logger
 * @param options Configuration options for the logger
 */
export function configureLogger(options: { level?: LogLevel; logger?: Logger }): void {
    if (options.level) {
        currentLogLevel = options.level;
    }
    
    if (options.logger) {
        customLogger = options.logger;
    }
}

/**
 * Get the current log level
 * @returns The current log level
 */
export function getLogLevel(): LogLevel {
    return currentLogLevel;
}

/**
 * Check if a log level is enabled
 * @param level The log level to check
 * @returns True if the log level is enabled
 */
export function isLogLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[currentLogLevel];
}

/**
 * Log a debug message
 * @param message Message to log
 * @param context Optional context object
 */
export function logDebug(message: string, context?: any): void {
    if (!isLogLevelEnabled(LogLevel.DEBUG)) return;
    
    if (customLogger) {
        customLogger.debug(message, context);
    } else {
        if (context) {
            console.debug(`[DEBUG] ${message}`, context);
        } else {
            console.debug(`[DEBUG] ${message}`);
        }
    }
}

/**
 * Log an info message
 * @param message Message to log
 * @param context Optional context object
 */
export function logInfo(message: string, context?: any): void {
    if (!isLogLevelEnabled(LogLevel.INFO)) return;
    
    if (customLogger) {
        customLogger.info(message, context);
    } else {
        if (context) {
            console.info(`[INFO] ${message}`, context);
        } else {
            console.info(`[INFO] ${message}`);
        }
    }
}

/**
 * Log a warning message
 * @param message Message to log
 * @param context Optional context object
 */
export function logWarn(message: string, context?: any): void {
    if (!isLogLevelEnabled(LogLevel.WARN)) return;
    
    if (customLogger) {
        customLogger.warn(message, context);
    } else {
        if (context) {
            console.warn(`[WARN] ${message}`, context);
        } else {
            console.warn(`[WARN] ${message}`);
        }
    }
}

/**
 * Log an error message
 * @param error Error or error message to log
 * @param context Optional context object
 */
export function logError(error: string | Error, context?: any): void {
    if (!isLogLevelEnabled(LogLevel.ERROR)) return;
    
    const message = error instanceof Error ? `${error.name}: ${error.message}` : error;
    
    if (customLogger) {
        customLogger.error(message, context);
    } else {
        if (context) {
            console.error(`[ERROR] ${message}`, context);
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
        } else {
            console.error(`[ERROR] ${message}`);
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
        }
    }
}