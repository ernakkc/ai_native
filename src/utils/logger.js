const { format } = require('util');
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function createLogger(name = 'app') {
  const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const prefix = () => `[${new Date().toISOString()}][${name}]`;

  // prepare log file under data/logs/<safeName>.log
  const logDir = path.resolve(process.cwd(), 'data', 'logs');
  ensureDir(logDir);
  const filePath = path.join(logDir, `${safeName}.log`);

  const appendFile = (level, msg) => {
    const line = `${new Date().toISOString()} ${level.toUpperCase()} [${name}] ${msg}\n`;
    // async append, don't block main flow
    fs.appendFile(filePath, line, (err) => {
      if (err) {
        // fallback to console.error if writing fails
        console.error(`[logger.error] failed to write to ${filePath}:`, err.message);
      }
    });
  };

  return {
    info: (...args) => {
      const msg = format(...args);
      console.log(prefix(), msg);
      appendFile('info', msg);
    },
    warn: (...args) => {
      const msg = format(...args);
      console.warn(prefix(), msg);
      appendFile('warn', msg);
    },
    error: (...args) => {
      const msg = format(...args);
      console.error(prefix(), msg);
      appendFile('error', msg);
    },
    debug: (...args) => {
      const msg = format(...args);
      console.debug(prefix(), msg);
      appendFile('debug', msg);
    },
    // expose file path for diagnostics
    _filePath: filePath
  };
}

module.exports = { createLogger };
