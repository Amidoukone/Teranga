// backend/utils/bootstrapAdmin.js
const bcrypt = require("bcrypt");
const db = require("../models"); // chargé depuis models/index.js

async function bootstrapAdmin() {
  try {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    // Si pas de variables → on ignore
    if (!email || !password) {
      console.log("⚠️  Bootstrap admin désactivé (ENV non définies)");
      return;
    }

    const existing = await db.User.findOne({ where: { email } });

    if (existing) {
      console.log("ℹ️  Admin déjà existant → aucun nouveau compte créé.");
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    await db.User.create({
      email,
      passwordHash: hash,
      firstName: "Super",
      lastName: "Admin",
      role: "admin",
      emailVerified: true
    });

    console.log("✅ Compte admin créé automatiquement !");
  } catch (err) {
    console.error("❌ Erreur lors du bootstrap admin :", err);
  }
}

module.exports = bootstrapAdmin;
