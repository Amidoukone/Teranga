'use strict';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', '']);

function parseBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return fallback;

  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
}

function isStrictRegionScopeEnabled(env = process.env) {
  return parseBooleanFlag(env.GEO_SCOPE_STRICT_MODE, false);
}

function resolveStrictRegionScope(options = {}, env = process.env) {
  if (typeof options.strictRegionScope === 'boolean') {
    return options.strictRegionScope;
  }
  return isStrictRegionScopeEnabled(env);
}

module.exports = {
  parseBooleanFlag,
  isStrictRegionScopeEnabled,
  resolveStrictRegionScope,
};

