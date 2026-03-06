"use strict";

const { Service, User, Property, Country, Sequelize, sequelize } = require("../../models");
const { Op } = require("sequelize");
const {
  SERVICE_STATUSES,
  SERVICE_TYPES,
  CURRENCY_LABELS,
  canonicalizeServiceType,
  getLabel,
} = require("../utils/labels");
const {
  notifyServiceCreated,
  notifyServiceAssigned,
  notifyServiceStatusUpdate,
} = require("../services/serviceNotification.service");

// 🌍 GeoScope utils (strict)
const {
  applyGeoScopeForModel,
  canAccessGeoResource,
  getUserGeoScope,
  getCountryIdByIso,
} = require("../utils/geoScope");
const { getPagination } = require("../utils/pagination");
const logger = require('../utils/logger');

/* ============================================================
   🔧 Helpers généraux
============================================================ */
function toNullableNumber(v) {
  if (v === "" || v === undefined || v === null) return null;
  const normalized = String(v).trim().replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toTrimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toSafeInt(v, fallback = null) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const KNOWN_CURRENCIES = new Set(Object.keys(CURRENCY_LABELS || {}));

function normalizeCurrency(input, fallback = "XOF") {
  if (!input) return fallback;
  const cur = String(input).toUpperCase().trim();
  return KNOWN_CURRENCIES.has(cur) ? cur : fallback;
}

function isTrue(x) {
  if (typeof x === "string") return x === "1" || x.toLowerCase() === "true";
  return !!x;
}

function buildServiceOrder(sort) {
  if (!sort) return [["createdAt", "DESC"]];
  const raw = String(sort);
  const desc = raw.startsWith("-");
  const key = desc ? raw.slice(1) : raw;
  const dir = desc ? "DESC" : "ASC";

  switch (key) {
    case "createdAt":
      return [["createdAt", dir]];
    case "title":
      return [["title", dir]];
    default:
      return [["createdAt", "DESC"]];
  }
}

async function resolveCountryIdFromLegacy(countryValue) {
  const trimmed = toTrimOrNull(countryValue);
  if (!trimmed) return null;

  const isoCandidate = trimmed.length === 2 ? trimmed.toUpperCase() : null;
  const normalizedName = trimmed.toLowerCase();

  const record = await Country.findOne({
    where: {
      isActive: true,
      [Op.or]: [
        isoCandidate ? { isoCode: isoCandidate } : null,
        Sequelize.where(Sequelize.fn("lower", Sequelize.col("name")), normalizedName),
      ].filter(Boolean),
    },
    attributes: ["id"],
  });

  return record ? record.id : null;
}

function canAccessByGeoScope(user, resource) {
  return canAccessGeoResource(resource, user);
}

async function canAssignAgentByGeoScope(service, agent) {
  if (!service || !agent) return false;

  // Cas moderne (countryId/regionId renseignés)
  if (canAccessGeoResource(service, agent)) return true;

  // Compat legacy: certains agents n'ont pas encore countryId/regionId,
  // mais ont un ISO dans `country` (ex: "SN").
  const agentCountryIso = toTrimOrNull(agent?.country)?.toUpperCase() || null;
  const serviceCountryId = toSafeInt(service?.countryId);
  const serviceRegionId = toSafeInt(service?.regionId);

  // Si le service est scoped à une région, on reste strict (pas d'inférence legacy fiable).
  if (serviceRegionId) return false;
  if (!serviceCountryId || !agentCountryIso) return false;

  const agentCountryId = await getCountryIdByIso(agentCountryIso);
  if (!agentCountryId) return false;

  return String(agentCountryId) === String(serviceCountryId);
}

function applyServiceGeoScope(where = {}, user) {
  return applyGeoScopeForModel
    ? applyGeoScopeForModel(where, user, Service, { includeClients: true })
    : where;
}

const ALLOWED_TYPES = new Set(Object.keys(SERVICE_TYPES));
const ALLOWED_STATUSES = new Set(Object.keys(SERVICE_STATUSES));

/* ============================================================
   🏷️ Labels FR
============================================================ */
function addLabels(service) {
  if (!service) return null;
  const s = service.toJSON ? service.toJSON() : service;
  const normalizedType = canonicalizeServiceType(s.type, s.type);
  const normalizedCurrency = normalizeCurrency(s.currency, "XOF");
  return {
    ...s,
    type: normalizedType,
    currency: normalizedCurrency,
    statusLabel: getLabel(s.status, SERVICE_STATUSES),
    typeLabel: getLabel(normalizedType, SERVICE_TYPES),
    currencyLabel: getLabel(normalizedCurrency, CURRENCY_LABELS),
  };
}

/* ============================================================
   🟢 CRÉER UN SERVICE
   - multi-pays SAFE
   - admin global / admin scoped OK
============================================================ */
exports.create = async (req, res) => {
  try {
    let {
      propertyId,
      type,
      title,
      description,
      contactPerson,
      contactPhone,
      address,
      budget,
      currency,
      clientId,
      countryId,
      regionId,
    } = req.body || {};

    propertyId = toSafeInt(propertyId);

    type = canonicalizeServiceType(type, null);
    if (!type || !ALLOWED_TYPES.has(type))
      return res.status(400).json({ error: "Type de service invalide" });

    title = String(title || "").trim();
    if (!title) return res.status(400).json({ error: "Titre requis" });

    let property = null;
    if (propertyId) {
      property = await Property.findByPk(propertyId);
      if (!property)
        return res.status(400).json({ error: "Bien immobilier introuvable" });
    }

    let targetClientId = req.user.id;
    let targetClient = req.user;

    if (req.user.role === "admin") {
      const parsedClientId = toSafeInt(clientId);
      if (!parsedClientId)
        return res
          .status(400)
          .json({ error: "clientId requis pour un admin" });

      const user = await User.findByPk(parsedClientId);
      if (!user || user.role !== "client")
        return res
          .status(400)
          .json({ error: "clientId invalide (doit être un client)" });

      targetClientId = user.id;
      targetClient = user;

      if (property && String(property.ownerId) !== String(targetClientId)) {
        return res.status(400).json({
          error: "Le bien sélectionné n'appartient pas au client choisi",
        });
      }
    } else {
      if (property && String(property.ownerId) !== String(req.user.id))
        return res.status(403).json({
          error: "Ce bien n'appartient pas à l'utilisateur connecté",
        });
    }

    const clientScope = getUserGeoScope
      ? getUserGeoScope(targetClient)
      : {
          countryId: toSafeInt(targetClient?.countryId),
          regionId: toSafeInt(targetClient?.regionId),
        };

    const desiredCountryId = toSafeInt(countryId);
    const desiredRegionId = toSafeInt(regionId);

    let resolvedCountryId =
      property?.countryId ??
      (req.user.role === "admin"
        ? desiredCountryId ?? clientScope.countryId ?? null
        : clientScope.countryId ?? null);

    const resolvedRegionId =
      property?.regionId ??
      (req.user.role === "admin"
        ? desiredRegionId ?? clientScope.regionId ?? null
        : clientScope.regionId ?? null);

    if (resolvedCountryId === null && targetClient?.country) {
      resolvedCountryId = await resolveCountryIdFromLegacy(targetClient.country);
    }

    if (
      !canAccessByGeoScope(req.user, {
        countryId: resolvedCountryId,
        regionId: resolvedRegionId,
      })
    ) {
      return res.status(403).json({
        error: "Création hors scope géographique",
      });
    }

    const service = await Service.create({
      clientId: targetClientId,
      agentId: null,
      createdById: req.user.id,
      propertyId: propertyId || null,
      type,
      title,
      description: toTrimOrNull(description),
      contactPerson: toTrimOrNull(contactPerson),
      contactPhone: toTrimOrNull(contactPhone),
      address: toTrimOrNull(address),
      budget: toNullableNumber(budget),
      currency: normalizeCurrency(currency, "XOF"),
      status: "created",
      countryId: resolvedCountryId,
      regionId: resolvedRegionId,
    });

    const full = await Service.findByPk(service.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "agent", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "client", attributes: ["id", "firstName", "lastName", "email"] },
        { model: Property, as: "property", attributes: ["id", "title", "city", "address", "photos"] },
      ],
    });

    await notifyServiceCreated({
      actorId: req.user.id,
      service,
      fullService: full,
      targetClientId,
      countryId: resolvedCountryId,
      regionId: resolvedRegionId,
    });

    return res.status(201).json({
      message: "Service créé",
      service: addLabels(full),
    });
  } catch (e) {
    logger.error({ err: e }, "service.create.failed");
    return res.status(500).json({
      error: "Erreur lors de la création du service",
    });
  }
};

/* ============================================================
   📄 LISTE DES SERVICES CLIENT / ADMIN
============================================================ */
exports.listClient = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req, 25, 100);
    const { clientId } = req.query;
    const q = toTrimOrNull(req.query?.q);
    const status = toTrimOrNull(req.query?.status);
    const type = canonicalizeServiceType(req.query?.type, null);
    const propertyId = toSafeInt(req.query?.propertyId);
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
    const sort = toTrimOrNull(req.query?.sort);

    let where = {};
    const andWhere = [];

    if (req.user.role === "admin") {
      if (clientId) where.clientId = toSafeInt(clientId);
    } else {
      where.clientId = req.user.id;
    }

    if (status && ALLOWED_STATUSES.has(status)) where.status = status;
    if (type && ALLOWED_TYPES.has(type)) where.type = type;
    if (propertyId) where.propertyId = propertyId;
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      andWhere.push({
        [Op.or]: [
          { title: like },
          { description: like },
          { address: like },
          { contactPerson: like },
          { contactPhone: like },
          { "$client.firstName$": like },
          { "$client.lastName$": like },
          { "$client.email$": like },
          { "$property.title$": like },
          { "$property.address$": like },
          { "$property.city$": like },
        ],
      });
    }

    if (andWhere.length > 0) {
      where = { ...where, [Op.and]: andWhere };
    }

    where = applyServiceGeoScope(where, req.user);

    const { rows, count } = await Service.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "country"],
        },
        { model: User, as: "creator", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "agent", attributes: ["id", "firstName", "lastName", "email"] },
        { model: Property, as: "property", attributes: ["id", "title", "city", "address", "photos"] },
      ],
      order: buildServiceOrder(sort),
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      services: rows.map(addLabels),
      pagination: { page, limit, offset, total: count, count },
    });
  } catch (e) {
    logger.error({ err: e }, "service.list_client.failed");
    return res.status(500).json({
      error: "Erreur lors de la récupération des services",
    });
  }
};

/* ============================================================
   🧾 LISTE TOUTES LES DEMANDES (ADMIN)
============================================================ */
exports.listAll = async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès interdit" });

    const { limit, offset, page } = getPagination(req, 25, 100);
    const status = (req.query.status || "").trim();
    const unassigned = isTrue(req.query.unassigned);
    const q = (req.query.q || "").trim();
    const type = canonicalizeServiceType(req.query?.type, null);
    const propertyId = toSafeInt(req.query?.propertyId);
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
    const sort = toTrimOrNull(req.query?.sort);

    let where = {};
    const andWhere = [];

    if (status && ALLOWED_STATUSES.has(status)) where.status = status;
    if (unassigned) where.agentId = null;
    if (type && ALLOWED_TYPES.has(type)) where.type = type;
    if (propertyId) where.propertyId = propertyId;
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      andWhere.push({
        [Op.or]: [
          { title: like },
          { description: like },
          { address: like },
          { contactPerson: like },
          { contactPhone: like },
          { "$client.firstName$": like },
          { "$client.lastName$": like },
          { "$client.email$": like },
          { "$property.title$": like },
          { "$property.address$": like },
          { "$property.city$": like },
        ],
      });
    }

    if (andWhere.length > 0) {
      where = { ...where, [Op.and]: andWhere };
    }

    where = applyServiceGeoScope(where, req.user);

    const { rows, count } = await Service.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "country"],
        },
        { model: User, as: "creator", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "agent", attributes: ["id", "firstName", "lastName", "email"] },
        { model: Property, as: "property", attributes: ["id", "title", "city", "address"] },
      ],
      order: buildServiceOrder(sort),
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      services: rows.map(addLabels),
      pagination: { page, limit, offset, total: count, count },
    });
  } catch (e) {
    logger.error({ err: e }, "service.list_all.failed");
    return res.status(500).json({
      error: "Erreur lors de la récupération des services",
    });
  }
};

/* ============================================================
   👔 ADMIN ASSIGNE UN AGENT
============================================================ */
/* ============================================================
   👔 ADMIN ASSIGNE UN AGENT
============================================================ */
exports.assignAgent = async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Accès interdit" });

    const serviceId = toSafeInt(req.body?.serviceId);
    const agentId = toSafeInt(req.body?.agentId);

    if (!serviceId || !agentId)
      return res
        .status(400)
        .json({ error: "serviceId et agentId requis" });

    const result = await sequelize.transaction(async (t) => {
      const service = await Service.findByPk(serviceId, { transaction: t });
      if (!service)
        throw Object.assign(new Error("Service introuvable"), { status: 404 });

      // 🔐 Scope géographique (strict)
      if (!canAccessByGeoScope(req.user, service)) {
        throw Object.assign(
          new Error("Service hors scope géographique"),
          { status: 403 }
        );
      }

      if (["completed", "validated"].includes(service.status)) {
        throw Object.assign(
          new Error("Impossible d'assigner un service terminé/validé"),
          { status: 400 }
        );
      }

      const agent = await User.findByPk(agentId, { transaction: t });
      if (!agent || agent.role !== "agent") {
        throw Object.assign(
          new Error("agentId invalide : ce n'est pas un agent"),
          { status: 400 }
        );
      }

      if (!(await canAssignAgentByGeoScope(service, agent))) {
        throw Object.assign(
          new Error("Agent hors scope géographique"),
          { status: 403 }
        );
      }

      await service.update(
        { agentId: agent.id, status: "created" },
        { transaction: t }
      );

      return service.reload({
        include: [
          {
            model: User,
            as: "client",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: User,
            as: "creator",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: User,
            as: "agent",
            attributes: ["id", "firstName", "lastName", "email"],
          },
          {
            model: Property,
            as: "property",
            attributes: ["id", "title", "city"],
          },
        ],
        transaction: t,
      });
    });

    await notifyServiceAssigned({
      actorId: req.user.id,
      service: result,
    });

    return res.json({
      message: "Agent assigné",
      service: addLabels(result),
    });
  } catch (e) {
    const status = e.status || 500;
    logger.error({ err: e }, "service.assign_agent.failed");
    return res.status(status).json({ error: e.message });
  }
};

/* ============================================================
   ✏️ MISE À JOUR D’UN SERVICE
   - admin scoped SAFE
============================================================ */
exports.updateService = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const service = await Service.findByPk(id);

    if (!service)
      return res.status(404).json({ error: "Service introuvable" });

    if (req.user.role !== "admin" && service.clientId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Non autorisé à modifier ce service" });
    }

    // 🔐 Scope géographique (strict)
    if (!canAccessByGeoScope(req.user, service)) {
      return res
        .status(403)
        .json({ error: "Service hors scope géographique" });
    }

    const updatable = [
      "title",
      "description",
      "contactPerson",
      "contactPhone",
      "address",
      "budget",
      "currency",
      "status",
      "type",
      "propertyId",
    ];

    const updates = {};
    for (const field of updatable) {
      if (field in req.body) updates[field] = req.body[field];
    }

    if ("type" in updates) {
      const normalizedType = canonicalizeServiceType(updates.type, null);
      if (!normalizedType || !ALLOWED_TYPES.has(normalizedType)) {
        return res.status(400).json({ error: "Type de service invalide" });
      }
      updates.type = normalizedType;
    }

    if ("status" in updates) {
      const nextStatus = toTrimOrNull(updates.status);
      if (!nextStatus || !ALLOWED_STATUSES.has(nextStatus)) {
        return res.status(400).json({ error: "Statut de service invalide" });
      }
      updates.status = nextStatus;
    }

    if ("budget" in updates) {
      updates.budget = toNullableNumber(updates.budget);
    }

    if ("currency" in updates) {
      updates.currency = normalizeCurrency(updates.currency, service.currency || "XOF");
    }

    if ("propertyId" in updates) {
      const newPid = toSafeInt(updates.propertyId);
      if (!newPid) {
        updates.propertyId = null;
      } else {
        const property = await Property.findByPk(newPid);
        if (!property)
          return res
            .status(400)
            .json({ error: "Bien immobilier introuvable" });

        if (req.user.role !== "admin" && String(property.ownerId) !== String(req.user.id)) {
          return res.status(403).json({
            error: "Ce bien n'appartient pas à l'utilisateur connecté",
          });
        }

        updates.propertyId = newPid;
        updates.countryId = property.countryId ?? service.countryId;
        updates.regionId = property.regionId ?? service.regionId;
      }
    }

    const nextScope = {
      countryId: updates.countryId ?? service.countryId,
      regionId: updates.regionId ?? service.regionId,
    };

    if (!canAccessByGeoScope(req.user, nextScope)) {
      return res
        .status(403)
        .json({ error: "Mise à jour hors scope géographique" });
    }

    const previousStatus = service.status;
    await service.update(updates);

    if (updates.status && updates.status !== previousStatus) {
      await notifyServiceStatusUpdate({
        actorId: req.user.id,
        service,
        title: "Statut service mis a jour",
        status: updates.status,
      });
    }

    const full = await Service.findByPk(id, {
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "title", "city", "address"],
        },
      ],
    });

    return res.json({
      message: "Service mis à jour",
      service: addLabels(full),
    });
  } catch (e) {
    logger.error({ err: e }, "service.update.failed");
    return res.status(500).json({
      error: "Erreur lors de la mise à jour du service",
    });
  }
};

/* ============================================================
   ❌ SUPPRESSION D’UN SERVICE
============================================================ */
exports.deleteService = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const service = await Service.findByPk(id);

    if (!service)
      return res.status(404).json({ error: "Service introuvable" });

    if (req.user.role !== "admin" && req.user.id !== service.clientId)
      return res.status(403).json({ error: "Non autorisé" });

    if (!canAccessByGeoScope(req.user, service)) {
      return res
        .status(403)
        .json({ error: "Service hors scope géographique" });
    }

    await service.destroy();

    return res.json({ message: "Service supprimé" });
  } catch (e) {
    logger.error({ err: e }, "service.delete.failed");
    return res.status(500).json({
      error: "Erreur lors de la suppression",
    });
  }
};

/* ============================================================
   🧑‍🔧 LISTE DES SERVICES ASSIGNÉS À UN AGENT
============================================================ */
exports.listAgent = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req, 25, 100);
    const q = toTrimOrNull(req.query?.q);
    const status = toTrimOrNull(req.query?.status);
    const type = canonicalizeServiceType(req.query?.type, null);
    const propertyId = toSafeInt(req.query?.propertyId);
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
    const sort = toTrimOrNull(req.query?.sort);

    let where = { agentId: req.user.id };
    const andWhere = [];

    if (status && ALLOWED_STATUSES.has(status)) where.status = status;
    if (type && ALLOWED_TYPES.has(type)) where.type = type;
    if (propertyId) where.propertyId = propertyId;
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    if (q) {
      const like = { [Op.like]: `%${q}%` };
      andWhere.push({
        [Op.or]: [
          { title: like },
          { description: like },
          { address: like },
          { contactPerson: like },
          { contactPhone: like },
          { "$client.firstName$": like },
          { "$client.lastName$": like },
          { "$client.email$": like },
          { "$property.title$": like },
          { "$property.address$": like },
          { "$property.city$": like },
        ],
      });
    }

    if (andWhere.length > 0) {
      where = { ...where, [Op.and]: andWhere };
    }

    where = applyServiceGeoScope(where, req.user);

    const { rows, count } = await Service.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "country"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "title", "city", "address", "photos"],
        },
      ],
      order: buildServiceOrder(sort),
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      services: rows.map(addLabels),
      pagination: { page, limit, offset, total: count, count },
    });
  } catch (e) {
    logger.error({ err: e }, "service.list_agent.failed");
    return res.status(500).json({
      error: "Erreur lors de la récupération des services",
    });
  }
};

/* ============================================================
   🚀 AGENT DÉMARRE UN SERVICE
============================================================ */
exports.startService = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const service = await Service.findByPk(id);

    if (!service)
      return res.status(404).json({ error: "Service introuvable" });

    if (!canAccessByGeoScope(req.user, service)) {
      return res
        .status(403)
        .json({ error: "Service hors scope géographique" });
    }

    if (!canAccessByGeoScope(req.user, service)) {
      return res
        .status(403)
        .json({ error: "Service hors scope géographique" });
    }

    if (service.agentId !== req.user.id)
      return res.status(403).json({ error: "Non autorisé" });

    if (service.status !== "created")
      return res.status(400).json({
        error: "Impossible de démarrer : service déjà démarré ou terminé",
      });

    await service.update({ status: "in_progress" });

    await notifyServiceStatusUpdate({
      actorId: req.user.id,
      service,
      title: "Service demarre",
      status: "in_progress",
    });

    return res.json({
      message: "Service démarré",
      service: addLabels(service),
    });
  } catch (e) {
    logger.error({ err: e }, "service.start.failed");
    return res.status(500).json({
      error: "Erreur lors du démarrage du service",
    });
  }
};

/* ============================================================
   ✅ AGENT TERMINE UN SERVICE
============================================================ */
exports.completeService = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const service = await Service.findByPk(id);

    if (!service)
      return res.status(404).json({ error: "Service introuvable" });

    if (service.agentId !== req.user.id)
      return res.status(403).json({ error: "Non autorisé" });

    if (service.status !== "in_progress")
      return res.status(400).json({
        error: "Service non démarré ou déjà terminé",
      });

    await service.update({ status: "completed" });

    await notifyServiceStatusUpdate({
      actorId: req.user.id,
      service,
      title: "Service termine",
      status: "completed",
    });

    return res.json({
      message: "Service terminé",
      service: addLabels(service),
    });
  } catch (e) {
    logger.error({ err: e }, "service.complete.failed");
    return res.status(500).json({
      error: "Erreur lors de la finalisation du service",
    });
  }
};





