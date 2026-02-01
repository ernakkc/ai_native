const { format } = require('util');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better console readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Log level configurations
const logLevels = {
  DEBUG: { priority: 0, color: colors.dim + colors.cyan, icon: '🔍', label: 'DEBUG' },
  INFO: { priority: 1, color: colors.blue, icon: 'ℹ️', label: 'INFO ' },
  WARN: { priority: 2, color: colors.yellow, icon: '⚠️', label: 'WARN ' },
  ERROR: { priority: 3, color: colors.red, icon: '❌', label: 'ERROR' },
  SUCCESS: { priority: 1, color: colors.green, icon: '✅', label: 'SUCCESS' }
};

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // Directory already exists or permission denied
  }
}

/**
 * Format timestamp for display
 * @param {Date} date - Date object
 * @returns {String} - Formatted time string
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format date for log files (daily rotation)
 * @param {Date} date - Date object
 * @returns {String} - Formatted date string (YYYY-MM-DD)
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely stringify objects for logging
 * @param {*} obj - Object to stringify
 * @returns {String} - Stringified object
 */
function safeStringify(obj) {
  if (typeof obj === 'string') return obj;
  if (obj === undefined) return 'undefined';
  if (obj === null) return 'null';
  
  try {
    // Handle circular references
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (error) {
    return String(obj);
  }
}

/**
 * Create a beautiful, structured logger
 * @param {String} name - Logger name (e.g., 'brain.analyzer')
 * @param {Object} options - Logger options
 * @returns {Object} - Logger instance
 */
function createLogger(name = 'app', options = {}) {
  const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const minLevel = options.minLevel || 'DEBUG';
  const minPriority = logLevels[minLevel]?.priority || 0;

  // Prepare log directory with daily rotation
  const logDir = path.resolve(process.cwd(), 'data', 'logs');
  ensureDir(logDir);

  /**
   * Get current log file path (rotates daily)
   */
  const getLogFilePath = () => {
    const dateStr = formatDate(new Date());
    return path.join(logDir, `${safeName}_${dateStr}.log`);
  };

  /**
   * Write to log file with proper formatting
   */
  const appendToFile = (level, message, metadata = null) => {
    const timestamp = new Date().toISOString();
    const metaStr = metadata ? ` | ${safeStringify(metadata)}` : '';
    const line = `${timestamp} | ${level.padEnd(7)} | [${name}] | ${message}${metaStr}\n`;
    
    // Async append to avoid blocking
    fs.appendFile(getLogFilePath(), line, (err) => {
      if (err) {
        console.error(`${colors.red}[Logger Error] Failed to write to log file:${colors.reset}`, err.message);
      }
    });
  };

  /**
   * Format console output with colors and structure
   */
  const formatConsoleMessage = (level, message, metadata = null) => {
    const levelConfig = logLevels[level] || logLevels.INFO;
    const timestamp = formatTime(new Date());
    const namePart = `${colors.dim}[${name}]${colors.reset}`;
    const timePart = `${colors.dim}${timestamp}${colors.reset}`;
    const levelPart = `${levelConfig.color}${levelConfig.icon} ${levelConfig.label}${colors.reset}`;
    
    let output = `${timePart} ${levelPart} ${namePart} ${message}`;
    
    if (metadata) {
      const metaStr = typeof metadata === 'object' 
        ? `\n${colors.dim}${safeStringify(metadata)}${colors.reset}`
        : ` ${colors.dim}${metadata}${colors.reset}`;
      output += metaStr;
    }
    
    return output;
  };

  /**
   * Core logging function
   */
  const log = (level, ...args) => {
    const levelConfig = logLevels[level];
    if (!levelConfig || levelConfig.priority < minPriority) {
      return; // Skip if below minimum level
    }

    let message = '';
    let metadata = null;

    // Parse arguments
    if (args.length === 0) {
      message = '';
    } else if (args.length === 1) {
      if (typeof args[0] === 'string') {
        message = args[0];
      } else {
        metadata = args[0];
      }
    } else {
      // First arg is message, rest is metadata
      message = typeof args[0] === 'string' ? args[0] : format(args[0]);
      if (args.length > 1) {
        metadata = args.length === 2 ? args[1] : args.slice(1);
      }
    }

    // Console output (colored and formatted)
    const consoleMsg = formatConsoleMessage(level, message, metadata);
    
    switch (level) {
      case 'ERROR':
        console.error(consoleMsg);
        break;
      case 'WARN':
        console.warn(consoleMsg);
        break;
      default:
        console.log(consoleMsg);
    }

    // File output (structured, no colors)
    const fileMessage = message + (metadata ? ` ${format(metadata)}` : '');
    appendToFile(level, fileMessage);
  };

  // Return logger interface
  return {
    /**
     * Debug level logging (lowest priority)
     */
    debug: (...args) => log('DEBUG', ...args),

    /**
     * Info level logging (general information)
     */
    info: (...args) => log('INFO', ...args),

    /**
     * Success level logging (successful operations)
     */
    success: (...args) => log('SUCCESS', ...args),

    /**
     * Warning level logging (potential issues)
     */
    warn: (...args) => log('WARN', ...args),

    /**
     * Error level logging (errors and exceptions)
     */
    error: (...args) => log('ERROR', ...args),

    /**
     * Create a child logger with extended name
     */
    child: (childName) => {
      return createLogger(`${name}.${childName}`, options);
    },

    /**
     * Get current log file path
     */
    getLogFilePath: () => getLogFilePath(),

    /**
     * Clean old log files (keep last N days)
     */
    cleanOldLogs: (daysToKeep = 7) => {
      try {
        const files = fs.readdirSync(logDir);
        const now = new Date();
        const cutoffTime = now.getTime() - (daysToKeep * 24 * 60 * 60 * 1000);

        files.forEach(file => {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            console.log(`${colors.dim}[Logger] Cleaned old log file: ${file}${colors.reset}`);
          }
        });
      } catch (error) {
        console.error(`${colors.red}[Logger] Failed to clean old logs:${colors.reset}`, error.message);
      }
    }
  };
}

module.exports = { createLogger };
