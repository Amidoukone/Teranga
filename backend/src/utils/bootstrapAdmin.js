'use strict';

const bcrypt = require('bcrypt');
const logger = require('./logger');
const db = require('../../models');

const { User } = db;

module.exports = async function bootstrapAdmin() {
  try {
    const isProd = (process.env.NODE_ENV || 'development') === 'production';
    const allowDefaults = process.env.BOOTSTRAP_ADMIN_ALLOW_DEFAULTS !== 'false';
    const defaultEmail = process.env.BOOTSTRAP_ADMIN_DEFAULT_EMAIL || 'admin@teranga.com';
    const defaultPassword = process.env.BOOTSTRAP_ADMIN_DEFAULT_PASSWORD || 'Admin123!';
    let email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    let password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const enabled = process.env.BOOTSTRAP_ADMIN_ENABLED === 'true';
    const expiresAt = process.env.BOOTSTRAP_ADMIN_EXPIRES_AT;

    if ((!email || !password) && !isProd && allowDefaults) {
      email = email || defaultEmail;
      password = password || defaultPassword;
      logger.info({ email }, 'bootstrap_admin.defaults_applied_dev');
    }

    if (!email || !password) {
      logger.info('bootstrap_admin.skipped.missing_credentials');
      return;
    }

    if (isProd && !enabled) {
      logger.info('bootstrap_admin.skipped.disabled_in_production');
      return;
    }

    if (expiresAt) {
      const expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime()) || expiry < new Date()) {
        logger.info({ expiresAt }, 'bootstrap_admin.skipped.expired');
        return;
      }
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) {
      logger.info({ email }, 'bootstrap_admin.skipped.already_exists');
      return;
    }

    logger.info({ email }, 'bootstrap_admin.create.started');

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'admin',
      emailVerified: true,
    });

    logger.info({ email }, 'bootstrap_admin.create.succeeded');
  } catch (err) {
    logger.error({ err }, 'bootstrap_admin.create.failed');
  }
};
