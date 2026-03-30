'use strict';

function toRoundedMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Number(numeric.toFixed(2));
}

function composeSequelizeLogging(baseLogging, logger) {
  return (sql, timingMs) => {
    if (typeof baseLogging === 'function') {
      baseLogging(sql, timingMs);
    }

    if (!logger || typeof logger.debug !== 'function') return;

    const payload = { sql: String(sql || '') };
    const roundedMs = toRoundedMs(timingMs);
    if (roundedMs !== null) {
      payload.durationMs = roundedMs;
    }

    logger.debug(payload, 'sequelize.query');
  };
}

module.exports = {
  composeSequelizeLogging,
  toRoundedMs,
};
