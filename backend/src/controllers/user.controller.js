'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User } = require('../../models');
const { applyGeoScope, getUserGeoScope, isGlobalAdmin } = require('../utils/geoScope');

// ————————————————————————
// Helpers
// ————————————————————————
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COUNTRY_NAME_TO_ISO2 = {
  'mali': 'ML', 'sénégal': 'SN', 'senegal': 'SN',
  "côte d\'ivoire": 'CI', 'cote d’ivoire': 'CI', 'cote d ivoire': 'CI',
  'ivory coast': 'CI', 'burkina faso': 'BF', 'niger': 'NE', 'guinée': 'GN',
  'guinee': 'GN', 'ghana': 'GH', 'togo': 'TG', 'benin': 'BJ',
  'france': 'FR', 'royaume-uni': 'GB', 'uk': 'GB', 'united states': 'US', 'usa': 'US'
};

function toSafeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function toSafeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    country: u.country,
    countryId: u.countryId ?? null,
    regionId: u.regionId ?? null,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function normalizeCountry(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  if (raw.length === 2) return raw.toUpperCase();
  const mapped = COUNTRY_NAME_TO_ISO2[raw.toLowerCase()];
  if (mapped) return mapped;
  const err = new Error("Pays invalide : utilisez un code ISO-2 (ex: ML, FR, SN).");
  err.status = 400;
  throw err;
}

// ————————————————————————
// CONTRÔLEURS EXISTANTS
// ————————————————————————

/** 🔹 Créer un agent (admin only, admin scoped via scope) */
exports.createAgent = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    let { email, password, firstName, lastName, phone, country } = req.body || {};

    email = (email || '').toLowerCase().trim();
    firstName = (firstName || '').trim();
    lastName = (lastName || '').trim();
    phone = (phone || '').trim();

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Email requis ou invalide" });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "Mot de passe requis (6 caractères min.)" });
    }

    const countryIso2 = normalizeCountry(country);
    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const scope = getUserGeoScope(req.user);

    const agent = await User.create({
      email,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      country: countryIso2,
      role: 'agent',
      countryId: isGlobalAdmin(req.user) ? toSafeInt(req.body?.countryId) : scope.countryId,
      regionId: isGlobalAdmin(req.user) ? toSafeInt(req.body?.regionId) : scope.regionId,
    });

    return res.status(201).json({
      message: 'Agent créé avec succès',
      agent: toSafeUser(agent),
    });
  } catch (e) {
    console.error('❌ Erreur création agent:', e);
    return res.status(500).json({ error: "Erreur lors de la création de l’agent" });
  }
};

/** 🔹 Lister les utilisateurs par rôle (admin only) */
exports.listByRole = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const role = String(req.query.role || '').trim().toLowerCase();
    if (!['client', 'agent', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const q = (req.query.q || '').trim();
    let where = { role };

    if (q) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } },
      ];
    }

    const users = await User.findAll({
      where: applyGeoScope(where, req.user),
      attributes: [
        'id',
        'email',
        'firstName',
        'lastName',
        'phone',
        'country',
        'countryId',
        'regionId',
        'role',
        'createdAt',
        'updatedAt',
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ users });
  } catch (e) {
    console.error('❌ Erreur listByRole:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
  }
};

/** 🔹 Profil de l’utilisateur connecté */
exports.me = async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id);
    if (!me) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.json({ user: toSafeUser(me) });
  } catch (e) {
    console.error('❌ Erreur me:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération du profil" });
  }
};

// ————————————————————————
// NOUVEAUX ENDPOINTS ADMIN CRUD
// ————————————————————————

/** 🔹 Créer un utilisateur */
exports.createUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { email, password, firstName, lastName, phone, country, role } = req.body;
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email invalide' });
    if (!['client', 'agent', 'admin'].includes(role))
      return res.status(400).json({ error: 'Rôle invalide' });

    const passwordHash = await bcrypt.hash(password, 10);
    const scope = getUserGeoScope(req.user);

    const u = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      country: normalizeCountry(country),
      role,
      countryId: isGlobalAdmin(req.user) ? toSafeInt(req.body?.countryId) : scope.countryId,
      regionId: isGlobalAdmin(req.user) ? toSafeInt(req.body?.regionId) : scope.regionId,
    });

    res.status(201).json({ user: toSafeUser(u) });
  } catch (e) {
    console.error('❌ createUser:', e);
    res.status(500).json({ error: 'Erreur création utilisateur' });
  }
};

/** 🔹 Lire un utilisateur par ID */
exports.getById = async (req, res) => {
  try {
    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user: toSafeUser(u) });
  } catch (e) {
    console.error('❌ getById:', e);
    res.status(500).json({ error: 'Erreur lecture utilisateur' });
  }
};

/** 🔹 Mettre à jour un utilisateur */
exports.updateUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const { firstName, lastName, phone, country, role, password } = req.body;
    if (role && !['client', 'agent', 'admin'].includes(role))
      return res.status(400).json({ error: 'Rôle invalide' });

    const scope = getUserGeoScope(req.user);
    const updateData = {
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      country: country ? normalizeCountry(country) : u.country,
      role: role || u.role,
      countryId: isGlobalAdmin(req.user) ? toSafeInt(req.body?.countryId) : scope.countryId,
      regionId: isGlobalAdmin(req.user) ? toSafeInt(req.body?.regionId) : scope.regionId,
    };

    if (password && password.length >= 6) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    await u.update(updateData);
    res.json({ user: toSafeUser(u) });
  } catch (e) {
    console.error('❌ updateUser:', e);
    res.status(500).json({ error: 'Erreur mise à jour utilisateur' });
  }
};

/** 🔹 Supprimer un utilisateur */
exports.deleteUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
    await u.destroy();
    res.json({ message: 'Utilisateur supprimé' });
  } catch (e) {
    console.error('❌ deleteUser:', e);
    res.status(500).json({ error: 'Erreur suppression utilisateur' });
  }
};
