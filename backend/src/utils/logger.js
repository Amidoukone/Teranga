'use strict';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const levelIndex = LOG_LEVELS.indexOf(process.env.LOG_LEVEL || 'info');

function shouldLog(level) {
  return LOG_LEVELS.indexOf(level) >= levelIndex;
}

function log(level, meta, message) {
  if (!shouldLog(level)) return;

  const normalizedMeta = typeof meta === 'string' ? {} : meta || {};
  const normalizedMessage =
    typeof meta === 'string' ? meta : message || '';

  const entry = {
    level,
    message: normalizedMessage,
    time: new Date().toISOString(),
    ...normalizedMeta,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

const logger = {
  debug: (meta, message) => log('debug', meta, message),
  info: (meta, message) => log('info', meta, message),
  warn: (meta, message) => log('warn', meta, message),
  error: (meta, message) => log('error', meta, message),
};

module.exports = logger;
