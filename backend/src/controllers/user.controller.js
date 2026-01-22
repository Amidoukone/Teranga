'use strict';

const bcrypt = require('bcrypt');
const { Op, fn, col, where: sqlWhere } = require('sequelize');
const { User, Country, Region } = require('../../models');
const { applyGeoScope, getUserGeoScope, isGlobalAdmin } = require('../utils/geoScope');

// ————————————————————————
// Helpers
// ————————————————————————
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COUNTRY_NAME_TO_ISO2 = {
  'mali': 'ML', 'sénégal': 'SN', 'senegal': 'SN',
  "côte d\'ivoire": 'CI', 'cote d’ivoire': 'CI', 'cote d ivoire': 'CI',
  'ivory coast': 'CI', 'burkina faso': 'BF', 'niger': 'NE', 'guinée': 'GN',
  'guinee': 'GN', 'ghana': 'GH', 'togo': 'TG', 'benin': 'BJ', 'gabon': 'GA',
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

function toTrimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
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

async function findCountryByInput(input) {
  const trimmed = toTrimOrNull(input);
  if (!trimmed) return null;

  const isoCandidate = trimmed.length === 2 ? trimmed.toUpperCase() : null;
  const normalizedName = trimmed.toLowerCase();

  const matches = await Country.findAll({
    where: {
      [Op.or]: [
        isoCandidate ? { isoCode: isoCandidate } : null,
        sqlWhere(fn('LOWER', col('name')), normalizedName),
      ].filter(Boolean),
    },
    limit: 2,
  });

  if (matches.length === 0) {
    const err = new Error(`Pays introuvable pour "${trimmed}"`);
    err.status = 400;
    throw err;
  }

  if (matches.length > 1) {
    const err = new Error(`Pays ambigu pour "${trimmed}" (précise le nom exact)`);
    err.status = 400;
    throw err;
  }

  return matches[0];
}

async function findRegionByInput(input, codeInput, countryId) {
  const name = toTrimOrNull(input);
  const code = toTrimOrNull(codeInput);
  if (!name && !code) return null;

  const whereParts = [];
  if (name) whereParts.push(sqlWhere(fn('LOWER', col('name')), name.toLowerCase()));
  if (code) whereParts.push({ code: code.toUpperCase() });

  const whereClause = { [Op.or]: whereParts };
  if (countryId) whereClause.countryId = countryId;

  const matches = await Region.findAll({
    where: whereClause,
    limit: 2,
  });

  if (matches.length === 0) {
    const err = new Error(`Région introuvable pour "${name || code}"`);
    err.status = 400;
    throw err;
  }

  if (matches.length > 1) {
    const err = new Error(
      `Région ambiguë pour "${name || code}" (précise le pays ou le code)`
    );
    err.status = 400;
    throw err;
  }

  return matches[0];
}

async function resolveGeoScopeInput(body = {}) {
  const rawCountryId = toSafeInt(body?.countryId ?? body?.country_id);
  const rawRegionId = toSafeInt(body?.regionId ?? body?.region_id);

  const scopeCountryInput = toTrimOrNull(
    body?.scopeCountry ?? body?.countryName ?? body?.scopeCountryName ?? body?.countryScope
  );
  const scopeCountryIso = toTrimOrNull(body?.scopeCountryIso ?? body?.countryIso);
  const scopeRegionInput = toTrimOrNull(
    body?.scopeRegion ?? body?.regionName ?? body?.scopeRegionName ?? body?.regionScope
  );
  const scopeRegionCode = toTrimOrNull(body?.scopeRegionCode ?? body?.regionCode);

  let countryId = rawCountryId ?? null;
  let regionId = rawRegionId ?? null;
  let hasGeoInput = Boolean(
    rawCountryId != null ||
      rawRegionId != null ||
      scopeCountryInput ||
      scopeCountryIso ||
      scopeRegionInput ||
      scopeRegionCode
  );

  if (!countryId && (scopeCountryInput || scopeCountryIso)) {
    const country = await findCountryByInput(scopeCountryIso || scopeCountryInput);
    countryId = country?.id ?? null;
  }

  if (!regionId && (scopeRegionInput || scopeRegionCode)) {
    const region = await findRegionByInput(scopeRegionInput, scopeRegionCode, countryId);
    regionId = region?.id ?? null;

    if (!countryId) {
      countryId = region?.countryId ?? null;
    }

    if (countryId && region?.countryId && String(region.countryId) !== String(countryId)) {
      const err = new Error('La région ne correspond pas au pays fourni');
      err.status = 400;
      throw err;
    }
  }

  if (regionId && !countryId) {
    const region = await Region.findByPk(regionId);
    if (!region) {
      const err = new Error('Région introuvable');
      err.status = 400;
      throw err;
    }
    countryId = region.countryId ?? null;
  }

  return { countryId, regionId, hasGeoInput };
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
    let normalizedCountry = null;

    try {
      normalizedCountry = normalizeCountry(country);
    } catch (err) {
      if (err?.status) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }

    let resolvedScope = { countryId: null, regionId: null, hasGeoInput: false };
    if (isGlobalAdmin(req.user)) {
      resolvedScope = await resolveGeoScopeInput(req.body);
    }

    const u = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      country: normalizedCountry,
      role,
      countryId: isGlobalAdmin(req.user) ? resolvedScope.countryId : scope.countryId,
      regionId: isGlobalAdmin(req.user) ? resolvedScope.regionId : scope.regionId,
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
    let normalizedCountry = u.country;

    if (country !== undefined) {
      try {
        normalizedCountry = normalizeCountry(country);
      } catch (err) {
        if (err?.status) {
          return res.status(err.status).json({ error: err.message });
        }
        throw err;
      }
    }

    let nextCountryId = u.countryId ?? null;
    let nextRegionId = u.regionId ?? null;

    if (isGlobalAdmin(req.user)) {
      const resolvedScope = await resolveGeoScopeInput(req.body);
      if (resolvedScope.hasGeoInput) {
        nextCountryId = resolvedScope.countryId;
        nextRegionId = resolvedScope.regionId;
      }
    } else {
      nextCountryId = scope.countryId;
      nextRegionId = scope.regionId;
    }

    const updateData = {
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      country: normalizedCountry,
      role: role || u.role,
      countryId: nextCountryId,
      regionId: nextRegionId,
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
