'use strict';

const bcrypt = require('bcrypt');
const db = require('../../models');  // <-- Chemin corrigé
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
      console.log(
        `⚠️ Bootstrap admin: variables manquantes, utilisation des valeurs par défaut en dev (${email}).`
      );
    }

    if (!email || !password) {
      console.log("⚠️ Variables BOOTSTRAP_ADMIN_EMAIL ou PASSWORD manquantes. Bootstrap ignoré.");
      return;
    }

    if (isProd && !enabled) {
      console.log("⚠️ Bootstrap admin désactivé en production (BOOTSTRAP_ADMIN_ENABLED=false).");
      return;
    }

    if (expiresAt) {
      const expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime()) || expiry < new Date()) {
        console.log("⚠️ Bootstrap admin expiré (BOOTSTRAP_ADMIN_EXPIRES_AT).");
        return;
      }
    }

    // Vérifie si l'admin existe déjà
    const exists = await User.findOne({ where: { email } });
    if (exists) {
      console.log(`ℹ️ Admin "${email}" existe déjà. Aucun bootstrap nécessaire.`);
      return;
    }

    console.log(`🛠️ Création du compte admin "${email}"…`);

    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      email,
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: "admin",
      emailVerified: true,
    });

    console.log(`✅ Admin "${email}" créé avec succès !`);
  } catch (err) {
    console.error("❌ Erreur bootstrap admin :", err.message);
  }
};
