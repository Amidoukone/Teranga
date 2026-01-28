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
  mali: 'ML',
  'sénégal': 'SN',
  senegal: 'SN',
  "côte d\'ivoire": 'CI',
  'cote d’ivoire': 'CI',
  'cote d ivoire': 'CI',
  'ivory coast': 'CI',
  'burkina faso': 'BF',
  niger: 'NE',
  guinée: 'GN',
  guinee: 'GN',
  ghana: 'GH',
  togo: 'TG',
  benin: 'BJ',
  gabon: 'GA',
  france: 'FR',
  'royaume-uni': 'GB',
  uk: 'GB',
  'united states': 'US',
  usa: 'US',
};

function toSafeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function toTrimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
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

/**
 * Normalise country legacy (ISO2)
 * - null/"" => null
 * - "ML" => "ML"
 * - "Mali" => "ML" (mapping)
 * - sinon throw 400
 */
function normalizeCountry(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  if (raw.length === 2) return raw.toUpperCase();

  const mapped = COUNTRY_NAME_TO_ISO2[raw.toLowerCase()];
  if (mapped) return mapped;

  const err = new Error(
    'Pays invalide : utilisez un code ISO-2 (ex: ML, FR, SN).'
  );
  err.status = 400;
  throw err;
}

/**
 * Petit helper pour distinguer :
 * - erreurs attendues (err.status) => réponses 4xx
 * - erreurs DB de contrainte => 409
 * - sinon => 500
 */
function sendError(res, err, fallbackMessage = 'Erreur serveur') {
  if (err?.status) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err?.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Conflit : valeur déjà existante' });
  }

  console.error('❌ Unexpected error:', err);
  return res.status(500).json({ error: fallbackMessage });
}

/* =========================================================
   🔒 SECURITY HELPERS (NEW — ZERO REGRESSION)
========================================================= */

/**
 * Admin MASTER = admin + scope (countryId ou regionId)
 * Admin GLOBAL = admin sans scope
 */
function isScopedAdmin(user) {
  if (!user || user.role !== 'admin') return false;
  return user.countryId != null || user.regionId != null;
}

function isAdminRole(role) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

/**
 * Vérifie si un admin (global ou master) peut accéder à un user (lecture/modif/suppression).
 * - Global admin: ok
 * - Master: doit respecter son scope :
 *   - si regionId => user.regionId doit matcher
 *   - sinon si countryId => user.countryId doit matcher
 */
function canAccessUserByScope(actor, targetUser) {
  if (!actor || actor.role !== 'admin') return false;
  if (!targetUser) return false;

  if (isGlobalAdmin(actor)) return true;

  const actorScope = getUserGeoScope(actor);
  if (actorScope.regionId != null) {
    return String(targetUser.regionId ?? '') === String(actorScope.regionId);
  }
  if (actorScope.countryId != null) {
    return String(targetUser.countryId ?? '') === String(actorScope.countryId);
  }

  // admin sans scope => global admin (déjà géré) ; mais par sécurité :
  return false;
}

/**
 * Bloque toute action admin/master si acteur n'est pas admin global.
 * - création admin (dont master) => global seulement
 * - update role vers admin => global seulement
 * - modification d'un admin => global seulement
 * - suppression d'un admin => global seulement
 */
function assertGlobalAdminOnly(reqUser, errMessage) {
  if (!isGlobalAdmin(reqUser)) {
    const err = new Error(errMessage || 'Action réservée à un administrateur global');
    err.status = 403;
    throw err;
  }
}

/* =========================================================
   🔎 GEO RESOLUTION (Country / Region)
========================================================= */

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
    const err = new Error(
      `Pays ambigu pour "${trimmed}" (précise le nom exact)`
    );
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
  if (name) {
    whereParts.push(sqlWhere(fn('LOWER', col('name')), name.toLowerCase()));
  }
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

/**
 * Résout le scope (countryId/regionId) à partir de multiples entrées possibles.
 * - supporte countryId/country_id + regionId/region_id
 * - supporte scopeCountry/scopeRegion (+ alias)
 * - vérifie cohérence région ↔ pays
 * - renvoie aussi hasGeoInput pour savoir si l’utilisateur a tenté un scope
 */
async function resolveGeoScopeInput(body = {}) {
  const rawCountryId = toSafeInt(body?.countryId ?? body?.country_id);
  const rawRegionId = toSafeInt(body?.regionId ?? body?.region_id);

  const scopeCountryInput = toTrimOrNull(
    body?.scopeCountry ??
      body?.countryName ??
      body?.scopeCountryName ??
      body?.countryScope
  );
  const scopeCountryIso = toTrimOrNull(body?.scopeCountryIso ?? body?.countryIso);

  const scopeRegionInput = toTrimOrNull(
    body?.scopeRegion ??
      body?.regionName ??
      body?.scopeRegionName ??
      body?.regionScope
  );
  const scopeRegionCode = toTrimOrNull(body?.scopeRegionCode ?? body?.regionCode);

  let countryId = rawCountryId ?? null;
  let regionId = rawRegionId ?? null;

  const hasGeoInput = Boolean(
    rawCountryId != null ||
      rawRegionId != null ||
      scopeCountryInput ||
      scopeCountryIso ||
      scopeRegionInput ||
      scopeRegionCode
  );

  // 1) Résoudre pays si absent
  if (!countryId && (scopeCountryInput || scopeCountryIso)) {
    const country = await findCountryByInput(scopeCountryIso || scopeCountryInput);
    countryId = country?.id ?? null;
  }

  // 2) Résoudre région si absente
  if (!regionId && (scopeRegionInput || scopeRegionCode)) {
    const region = await findRegionByInput(scopeRegionInput, scopeRegionCode, countryId);
    regionId = region?.id ?? null;

    // Inférer pays depuis région si absent
    if (!countryId) {
      countryId = region?.countryId ?? null;
    }

    // Cohérence région → pays
    if (
      countryId &&
      region?.countryId &&
      String(region.countryId) !== String(countryId)
    ) {
      const err = new Error('La région ne correspond pas au pays fourni');
      err.status = 400;
      throw err;
    }
  }

  // 3) Si regionId donné directement mais pays absent, inférer
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

/* =========================================================
   ✅ EXISTING CONTROLLERS
========================================================= */

/** 🔹 Créer un agent (admin only, scope imposé si admin scoped) */
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
      return res.status(400).json({ error: 'Email requis ou invalide' });
    }
    if (!password || String(password).length < 6) {
      return res
        .status(400)
        .json({ error: 'Mot de passe requis (6 caractères min.)' });
    }

    let countryIso2 = null;
    try {
      countryIso2 = normalizeCountry(country);
    } catch (err) {
      return sendError(res, err, 'Erreur normalisation pays');
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
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
      // Global admin peut fournir countryId/regionId, sinon scope imposé
      countryId: isGlobalAdmin(req.user)
        ? toSafeInt(req.body?.countryId ?? req.body?.country_id)
        : scope.countryId,
      regionId: isGlobalAdmin(req.user)
        ? toSafeInt(req.body?.regionId ?? req.body?.region_id)
        : scope.regionId,
    });

    return res.status(201).json({
      message: 'Agent créé avec succès',
      agent: toSafeUser(agent),
    });
  } catch (e) {
    console.error('❌ Erreur création agent:', e);
    return res.status(500).json({ error: 'Erreur lors de la création de l’agent' });
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
    const adminType = String(req.query.adminType || '').trim().toLowerCase();
    if (adminType && !['all', 'master', 'global'].includes(adminType)) {
      return res.status(400).json({ error: 'Type admin invalide' });
    }

    let where = { role };
    const andFilters = [];

    if (q) {
      andFilters.push({
        [Op.or]: [
          { firstName: { [Op.like]: `%${q}%` } },
          { lastName: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { phone: { [Op.like]: `%${q}%` } },
        ],
      });
    }

    if (role === 'admin' && adminType && adminType !== 'all') {
      if (adminType === 'master') {
        andFilters.push({
          [Op.or]: [
            { countryId: { [Op.not]: null } },
            { regionId: { [Op.not]: null } },
          ],
        });
      } else if (adminType === 'global') {
        andFilters.push({ countryId: null, regionId: null });
      }
    }

    if (andFilters.length > 0) {
      where = {
        ...where,
        [Op.and]: andFilters,
      };
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
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des utilisateurs' });
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
    return res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
};

/* =========================================================
   ✅ ADMIN CRUD (CREATE / READ / UPDATE / DELETE)
   🔒 SECURITY HARDENED (GLOBAL vs MASTER)
========================================================= */

/** 🔹 Créer un utilisateur (admin only) */
exports.createUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { email, password, firstName, lastName, phone, country, role } = req.body || {};

    // Validation minimale solide
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const targetRole = String(role || '').trim().toLowerCase();
    if (!['client', 'agent', 'admin'].includes(targetRole)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    // 🔒 MASTER cannot create admin/master (admin + scope)
    if (isScopedAdmin(req.user) && targetRole === 'admin') {
      return res.status(403).json({
        error: "Action réservée à l'admin global : création d'un compte admin/master interdite pour un MASTER",
      });
    }

    // Si quelqu’un veut créer un admin => admin global only
    if (targetRole === 'admin') {
      assertGlobalAdminOnly(req.user, "Seul l'administrateur global peut créer un admin/master");
    }

    // password requis à la création
    if (!password || String(password).length < 6) {
      return res.status(400).json({
        error: 'Mot de passe requis (6 caractères min.)',
      });
    }

    // Email unique
    const exists = await User.findOne({ where: { email: cleanEmail } });
    if (exists) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    // Pays legacy (ISO2)
    let normalizedCountry = null;
    try {
      normalizedCountry = normalizeCountry(country);
    } catch (err) {
      return sendError(res, err, 'Erreur normalisation pays');
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const actorScope = getUserGeoScope(req.user);

    // Résolution scope (uniquement global admin)
    let resolvedScope = { countryId: null, regionId: null, hasGeoInput: false };
    if (isGlobalAdmin(req.user)) {
      try {
        resolvedScope = await resolveGeoScopeInput(req.body);
      } catch (err) {
        return sendError(res, err, 'Erreur résolution périmètre');
      }
    }

    const u = await User.create({
      email: cleanEmail,
      passwordHash,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      phone: phone?.trim() || null,
      country: normalizedCountry,
      role: targetRole,
      // admin scoped => scope imposé; admin global => scope selon payload (ou null)
      countryId: isGlobalAdmin(req.user) ? resolvedScope.countryId : actorScope.countryId,
      regionId: isGlobalAdmin(req.user) ? resolvedScope.regionId : actorScope.regionId,
    });

    return res.status(201).json({ user: toSafeUser(u) });
  } catch (e) {
    return sendError(res, e, 'Erreur création utilisateur');
  }
};

/** 🔹 Lire un utilisateur par ID (admin only + scope enforced) */
exports.getById = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // 🔒 Scope enforcement
    if (!canAccessUserByScope(req.user, u)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    // 🔒 MASTER cannot access admin users
    if (isScopedAdmin(req.user) && isAdminRole(u.role)) {
      return res.status(403).json({
        error: "Action réservée à l'admin global : accès à un compte admin interdit pour un MASTER",
      });
    }

    return res.json({ user: toSafeUser(u) });
  } catch (e) {
    return sendError(res, e, 'Erreur lecture utilisateur');
  }
};

/** 🔹 Mettre à jour un utilisateur (admin only + scope + role hardening) */
exports.updateUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // 🔒 Scope enforcement
    if (!canAccessUserByScope(req.user, u)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    // 🔒 MASTER cannot update admin users
    if (isScopedAdmin(req.user) && isAdminRole(u.role)) {
      return res.status(403).json({
        error: "Action réservée à l'admin global : modification d'un admin interdite pour un MASTER",
      });
    }

    const { firstName, lastName, phone, country, role, password } = req.body || {};

    // Si role est fourni, valider
    const nextRole = role !== undefined ? String(role || '').trim().toLowerCase() : null;
    if (nextRole && !['client', 'agent', 'admin'].includes(nextRole)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    // 🔒 Promotion/définition vers admin => GLOBAL ONLY
    // - couvre aussi le cas où un MASTER tente de changer role vers admin
    if (nextRole === 'admin') {
      // si l'acteur n'est pas global => interdit
      assertGlobalAdminOnly(req.user, "Seul l'administrateur global peut promouvoir en admin/master");
    }

    // 🔒 Modifier un admin existant => GLOBAL ONLY (même si nextRole n'est pas fourni)
    if (isAdminRole(u.role)) {
      assertGlobalAdminOnly(req.user, "Seul l'administrateur global peut modifier un admin/master");
    }

    const actorScope = getUserGeoScope(req.user);

    // Pays legacy (ISO2)
    let normalizedCountry = u.country;
    if (country !== undefined) {
      try {
        normalizedCountry = normalizeCountry(country);
      } catch (err) {
        return sendError(res, err, 'Erreur normalisation pays');
      }
    }

    // Scope cible par défaut = actuel
    let nextCountryId = u.countryId ?? null;
    let nextRegionId = u.regionId ?? null;

    if (isGlobalAdmin(req.user)) {
      // admin global peut changer le scope si input fourni
      let resolvedScope = null;
      try {
        resolvedScope = await resolveGeoScopeInput(req.body);
      } catch (err) {
        return sendError(res, err, 'Erreur résolution périmètre');
      }

      if (resolvedScope?.hasGeoInput) {
        nextCountryId = resolvedScope.countryId;
        nextRegionId = resolvedScope.regionId;
      }
    } else {
      // admin scoped : impose son scope
      nextCountryId = actorScope.countryId;
      nextRegionId = actorScope.regionId;
    }

    const updateData = {
      firstName: firstName !== undefined ? (firstName?.trim() || null) : u.firstName,
      lastName: lastName !== undefined ? (lastName?.trim() || null) : u.lastName,
      phone: phone !== undefined ? (phone?.trim() || null) : u.phone,
      country: normalizedCountry,
      role: nextRole || u.role,
      countryId: nextCountryId,
      regionId: nextRegionId,
    };

    // Password optionnel en update
    if (password !== undefined && password !== null && String(password).length > 0) {
      if (String(password).length < 6) {
        return res.status(400).json({
          error: 'Mot de passe trop court (6 caractères min.)',
        });
      }
      updateData.passwordHash = await bcrypt.hash(String(password), 10);
    }

    await u.update(updateData);

    return res.json({ user: toSafeUser(u) });
  } catch (e) {
    return sendError(res, e, 'Erreur mise à jour utilisateur');
  }
};

/** 🔹 Supprimer un utilisateur (admin only + scope + global-only for admins) */
exports.deleteUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // 🔒 Scope enforcement
    if (!canAccessUserByScope(req.user, u)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    // 🔒 Suppression d'admin => GLOBAL ONLY
    if (isAdminRole(u.role)) {
      assertGlobalAdminOnly(req.user, "Seul l'administrateur global peut supprimer un admin/master");
    }

    await u.destroy();
    return res.json({ message: 'Utilisateur supprimé' });
  } catch (e) {
    return sendError(res, e, 'Erreur suppression utilisateur');
  }
};
