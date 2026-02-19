'use strict';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const levelIndex = LOG_LEVELS.indexOf(process.env.LOG_LEVEL || 'info');

function shouldLog(level) {
  return LOG_LEVELS.indexOf(level) >= levelIndex;
}

function normalizeError(err) {
  if (!err) return null;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error);
}

function parseLogArgs(args) {
  if (!args.length) return { message: '', meta: {} };

  const [first, second, ...rest] = args;

  if (typeof first === 'string') {
    const meta = {};

    if (second instanceof Error) {
      meta.err = normalizeError(second);
    } else if (isPlainObject(second)) {
      Object.assign(meta, second);
    } else if (second !== undefined) {
      meta.data = second;
    }

    if (rest.length) {
      meta.extra = rest.map((item) => (item instanceof Error ? normalizeError(item) : item));
    }

    return { message: first, meta };
  }

  if (first instanceof Error) {
    return {
      message: first.message || '',
      meta: { err: normalizeError(first) },
    };
  }

  if (isPlainObject(first)) {
    if (typeof second === 'string') {
      const meta = { ...first };
      if (rest.length) meta.extra = rest;
      return { message: second, meta };
    }
    return { message: '', meta: { ...first } };
  }

  return { message: String(first), meta: second && isPlainObject(second) ? second : {} };
}

function log(level, ...args) {
  if (!shouldLog(level)) return;

  const { message, meta } = parseLogArgs(args);

  const entry = {
    level,
    message: message || '',
    time: new Date().toISOString(),
    ...(meta || {}),
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
  debug: (...args) => log('debug', ...args),
  info: (...args) => log('info', ...args),
  warn: (...args) => log('warn', ...args),
  error: (...args) => log('error', ...args),
};

module.exports = logger;
