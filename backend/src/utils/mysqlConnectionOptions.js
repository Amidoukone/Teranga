'use strict';

const fs = require('fs');
const path = require('path');
const { parseBooleanEnv } = require('./mediaStoragePolicy');

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function readMultilineEnv(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.replace(/\\n/g, '\n');
}

function readCaFromEnv(env) {
  const inlineCa = readMultilineEnv(firstNonEmpty(env.DB_SSL_CA, env.MYSQL_SSL_CA));
  if (inlineCa) return inlineCa;

  const caPath = firstNonEmpty(env.DB_SSL_CA_PATH, env.MYSQL_SSL_CA_PATH);
  if (!caPath) return null;

  return fs.readFileSync(path.resolve(caPath), 'utf8');
}

function buildMysqlSslOptions(env = process.env, baseSsl = undefined) {
  if (baseSsl === false) return false;

  const sslDecision = parseBooleanEnv(firstNonEmpty(env.DB_SSL, env.MYSQL_SSL));
  if (sslDecision === false) return false;

  const shouldEnableSsl = sslDecision === true || Boolean(baseSsl);
  if (!shouldEnableSsl) return undefined;

  const ssl =
    baseSsl && typeof baseSsl === 'object' && !Array.isArray(baseSsl)
      ? { ...baseSsl }
      : {};

  if (sslDecision === true && ssl.require === undefined) {
    ssl.require = true;
  }

  const rejectUnauthorized = parseBooleanEnv(
    firstNonEmpty(
      env.DB_SSL_REJECT_UNAUTHORIZED,
      env.MYSQL_SSL_REJECT_UNAUTHORIZED
    )
  );
  if (rejectUnauthorized !== null) {
    ssl.rejectUnauthorized = rejectUnauthorized;
  }

  const ca = readCaFromEnv(env);
  if (ca) ssl.ca = ca;

  const servername = firstNonEmpty(env.DB_SSL_SERVERNAME, env.MYSQL_SSL_SERVERNAME);
  if (servername) ssl.servername = servername;

  return ssl;
}

function buildMysqlDialectOptions({ env = process.env, baseDialectOptions = {} } = {}) {
  const dialectOptions = { ...baseDialectOptions };
  const ssl = buildMysqlSslOptions(env, baseDialectOptions.ssl);

  if (ssl === false) {
    delete dialectOptions.ssl;
    return dialectOptions;
  }

  if (ssl) {
    dialectOptions.ssl = ssl;
  }

  return dialectOptions;
}

function liftSslQueryParams(parsed, baseSsl) {
  const extraDialectOptions = {};
  const sslParam = parsed.searchParams.get('ssl');
  const sslModeParam =
    parsed.searchParams.get('ssl-mode') || parsed.searchParams.get('sslmode');

  if (sslParam) {
    const sslBoolean = parseBooleanEnv(sslParam);
    if (sslBoolean === false) {
      parsed.searchParams.delete('ssl');
      extraDialectOptions.ssl = false;
    } else if (sslBoolean === true) {
      parsed.searchParams.delete('ssl');
      extraDialectOptions.ssl = {
        ...(baseSsl || {}),
        require: true,
      };
    } else {
      try {
        const sslObject = JSON.parse(sslParam);
        if (
          sslObject &&
          typeof sslObject === 'object' &&
          !Array.isArray(sslObject)
        ) {
          parsed.searchParams.delete('ssl');
          extraDialectOptions.ssl = {
            ...(baseSsl || {}),
            ...sslObject,
          };
        }
      } catch (_err) {
        // Keep non-JSON SSL profiles in the URL for mysql2 to handle.
      }
    }
  }

  if (sslModeParam) {
    parsed.searchParams.delete('ssl-mode');
    parsed.searchParams.delete('sslmode');

    const normalizedMode = sslModeParam.trim().toUpperCase();
    if (normalizedMode === 'DISABLED') {
      extraDialectOptions.ssl = false;
    } else if (
      ['PREFERRED', 'REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY'].includes(
        normalizedMode
      )
    ) {
      extraDialectOptions.ssl = {
        ...(baseSsl || {}),
        ...(extraDialectOptions.ssl &&
        typeof extraDialectOptions.ssl === 'object'
          ? extraDialectOptions.ssl
          : {}),
        require: true,
      };

      if (['VERIFY_CA', 'VERIFY_IDENTITY'].includes(normalizedMode)) {
        extraDialectOptions.ssl.rejectUnauthorized = true;
      }

      if (
        normalizedMode === 'VERIFY_IDENTITY' &&
        !extraDialectOptions.ssl.servername
      ) {
        extraDialectOptions.ssl.servername = parsed.hostname;
      }
    }
  }

  return extraDialectOptions;
}

function normalizeMysqlDatabaseUrl(urlValue, sequelizeConfig = {}) {
  const raw = String(urlValue || '').trim();
  if (!raw) return { url: raw, extraDialectOptions: {} };

  try {
    const parsed = new URL(raw);
    const extraDialectOptions = liftSslQueryParams(
      parsed,
      sequelizeConfig?.dialectOptions?.ssl
    );

    return {
      url: parsed.toString(),
      extraDialectOptions,
    };
  } catch (_err) {
    return { url: raw, extraDialectOptions: {} };
  }
}

module.exports = {
  buildMysqlDialectOptions,
  buildMysqlSslOptions,
  normalizeMysqlDatabaseUrl,
};
