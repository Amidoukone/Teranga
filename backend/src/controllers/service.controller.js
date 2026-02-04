"use strict";

const { Service, User, Property, Country, Sequelize, sequelize } = require("../../models");
const { Op } = require("sequelize");
const {
  SERVICE_STATUSES,
  SERVICE_TYPES,
  getLabel,
} = require("../utils/labels");

// 🌍 GeoScope utils (admin global / admin scoped)
const { applyGeoScopeWithLegacy, getUserGeoScope } = require("../utils/geoScope");

/* ============================================================
   🔧 Helpers généraux
============================================================ */
function toNullableNumber(v) {
  if (v === "" || v === undefined || v === null) return null;
  const n = Number(v);
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

function getPagination(req, defaultLimit = 25, maxLimit = 100) {
  const l = toSafeInt(req.query.limit, defaultLimit);
  const o = toSafeInt(req.query.offset, 0);
  const limit = Math.min(Math.max(l, 1), maxLimit);
  const offset = Math.max(o, 0);
  return { limit, offset };
}

function isTrue(x) {
  if (typeof x === "string") return x === "1" || x.toLowerCase() === "true";
  return !!x;
}

function isGlobalAdmin(user) {
  if (!user) return false;
  if (user.role !== "admin") return false;
  return user.countryId == null && user.regionId == null;
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
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;
  if (user.role !== "admin") return true;

  const scope = getUserGeoScope
    ? getUserGeoScope(user)
    : {
        countryId: toSafeInt(user.countryId),
        regionId: toSafeInt(user.regionId),
      };

  const rCountry = toSafeInt(resource?.countryId);
  const rRegion = toSafeInt(resource?.regionId);

  if (scope.regionId)
    return rRegion != null && String(rRegion) === String(scope.regionId);
  if (scope.countryId)
    return rCountry != null && String(rCountry) === String(scope.countryId);

  return false;
}

const ALLOWED_TYPES = new Set(Object.keys(SERVICE_TYPES));
const ALLOWED_STATUSES = new Set(Object.keys(SERVICE_STATUSES));

/* ============================================================
   🏷️ Labels FR
============================================================ */
function addLabels(service) {
  if (!service) return null;
  const s = service.toJSON ? service.toJSON() : service;
  return {
    ...s,
    statusLabel: getLabel(s.status, SERVICE_STATUSES),
    typeLabel: getLabel(s.type, SERVICE_TYPES),
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
      clientId,
      countryId,
      regionId,
    } = req.body || {};

    propertyId = toSafeInt(propertyId);

    type = String(type || "").trim();
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
      if (!clientId)
        return res
          .status(400)
          .json({ error: "clientId requis pour un admin" });

      const user = await User.findByPk(clientId);
      if (!user || user.role !== "client")
        return res
          .status(400)
          .json({ error: "clientId invalide (doit être un client)" });

      targetClientId = user.id;
      targetClient = user;
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

    if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
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
    }

    const service = await Service.create({
      clientId: targetClientId,
      agentId: null,
      propertyId: propertyId || null,
      type,
      title,
      description: toTrimOrNull(description),
      contactPerson: toTrimOrNull(contactPerson),
      contactPhone: toTrimOrNull(contactPhone),
      address: toTrimOrNull(address),
      budget: toNullableNumber(budget),
      status: "created",
      countryId: resolvedCountryId,
      regionId: resolvedRegionId,
    });

    const full = await Service.findByPk(service.id, {
      include: [
        { model: User, as: "agent", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "client", attributes: ["id", "firstName", "lastName", "email"] },
        { model: Property, as: "property", attributes: ["id", "title", "city", "address", "photos"] },
      ],
    });

    return res.status(201).json({
      message: "Service créé",
      service: addLabels(full),
    });
  } catch (e) {
    console.error("❌ Erreur création service:", e);
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
    const { limit, offset } = getPagination(req);
    const { clientId } = req.query;

    let where = {};

    if (req.user.role === "admin") {
      if (clientId) where.clientId = toSafeInt(clientId);
    } else {
      where.clientId = req.user.id;
    }

    if (req.user.role === "admin" || req.user.role === "agent") {
      where = await applyGeoScopeWithLegacy(where, req.user);
    }

    const rows = await Service.findAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "country"],
        },
        { model: User, as: "agent", attributes: ["id", "firstName", "lastName", "email"] },
        { model: Property, as: "property", attributes: ["id", "title", "city", "address", "photos"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      services: rows.map(addLabels),
      pagination: { limit, offset, count: rows.length },
    });
  } catch (e) {
    console.error("❌ erreur listClient:", e);
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

    const { limit, offset } = getPagination(req);
    const status = (req.query.status || "").trim();
    const unassigned = isTrue(req.query.unassigned);
    const q = (req.query.q || "").trim();

    let where = {};
    const andWhere = [];

    if (status && ALLOWED_STATUSES.has(status)) where.status = status;
    if (unassigned) where.agentId = null;

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

    where = await applyGeoScopeWithLegacy(where, req.user);

    const { rows, count } = await Service.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "country"],
        },
        { model: User, as: "agent", attributes: ["id", "firstName", "lastName", "email"] },
        { model: Property, as: "property", attributes: ["id", "title", "city", "address"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      services: rows.map(addLabels),
      pagination: { limit, offset, total: count },
    });
  } catch (e) {
    console.error("❌ erreur listAll:", e);
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

      // 🔐 Scope géographique
      if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
        if (!canAccessByGeoScope(req.user, service)) {
          throw Object.assign(
            new Error("Service hors scope géographique"),
            { status: 403 }
          );
        }
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

    return res.json({
      message: "Agent assigné",
      service: addLabels(result),
    });
  } catch (e) {
    const status = e.status || 500;
    console.error("❌ erreur assignAgent:", e);
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

    // 🔐 Scope géographique
    if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, service)) {
        return res
          .status(403)
          .json({ error: "Service hors scope géographique" });
      }
    }

    const updatable = [
      "title",
      "description",
      "contactPerson",
      "contactPhone",
      "address",
      "budget",
      "status",
      "type",
      "propertyId",
    ];

    const updates = {};
    for (const field of updatable) {
      if (field in req.body) updates[field] = req.body[field];
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

    await service.update(updates);

    const full = await Service.findByPk(id, {
      include: [
        {
          model: User,
          as: "client",
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
    console.error("❌ erreur updateService:", e);
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

    if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, service)) {
        return res
          .status(403)
          .json({ error: "Service hors scope géographique" });
      }
    }

    await service.destroy();

    return res.json({ message: "Service supprimé" });
  } catch (e) {
    console.error("❌ erreur deleteService:", e);
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
    const { limit, offset } = getPagination(req);

    let where = { agentId: req.user.id };

    where = await applyGeoScopeWithLegacy(where, req.user);

    const rows = await Service.findAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "country"],
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "title", "city", "address", "photos"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      services: rows.map(addLabels),
      pagination: { limit, offset, count: rows.length },
    });
  } catch (e) {
    console.error("❌ erreur listAgent:", e);
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

    if (service.agentId !== req.user.id)
      return res.status(403).json({ error: "Non autorisé" });

    if (service.status !== "created")
      return res.status(400).json({
        error: "Impossible de démarrer : service déjà démarré ou terminé",
      });

    await service.update({ status: "in_progress" });

    return res.json({
      message: "Service démarré",
      service: addLabels(service),
    });
  } catch (e) {
    console.error("❌ erreur startService:", e);
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

    return res.json({
      message: "Service terminé",
      service: addLabels(service),
    });
  } catch (e) {
    console.error("❌ erreur completeService:", e);
    return res.status(500).json({
      error: "Erreur lors de la finalisation du service",
    });
  }
};
