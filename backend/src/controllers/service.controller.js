"use strict";

const { Service, User, Property, sequelize } = require("../../models");
const { Op } = require("sequelize");
const {
  SERVICE_STATUSES,
  SERVICE_TYPES,
  getLabel,
} = require("../utils/labels");

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

const ALLOWED_TYPES = new Set(Object.keys(SERVICE_TYPES));
const ALLOWED_STATUSES = new Set(Object.keys(SERVICE_STATUSES));

/* ============================================================
   🏷️ Helper d’ajout des labels FR
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
   🟢 CRÉER UN SERVICE (client ou admin)
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
    } = req.body || {};

    /* -------------------------
       🔍 Validation de base
    ------------------------- */
    propertyId = toSafeInt(propertyId);
    if (!propertyId)
      return res.status(400).json({ error: "propertyId requis" });

    type = String(type || "").trim();
    if (!type || !ALLOWED_TYPES.has(type))
      return res.status(400).json({ error: "Type de service invalide" });

    title = String(title || "").trim();
    if (!title) return res.status(400).json({ error: "Titre requis" });

    const property = await Property.findByPk(propertyId);
    if (!property)
      return res.status(400).json({ error: "Bien immobilier introuvable" });

    /* -------------------------
       🔐 ACL : déterminer le client
    ------------------------- */
    let targetClientId = req.user.id;

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
    } else {
      if (String(property.ownerId) !== String(req.user.id)) {
        return res.status(403).json({
          error: "Ce bien n'appartient pas à l'utilisateur connecté",
        });
      }
    }

    /* -------------------------
       📝 Création
    ------------------------- */
    const service = await Service.create({
      clientId: targetClientId,
      agentId: null,
      propertyId,
      type,
      title,
      description: toTrimOrNull(description),
      contactPerson: toTrimOrNull(contactPerson),
      contactPhone: toTrimOrNull(contactPhone),
      address: toTrimOrNull(address),
      budget: toNullableNumber(budget),
      status: "created",
    });

    const full = await Service.findByPk(service.id, {
      include: [
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: Property,
          as: "property",
          attributes: ["id", "title", "city", "address", "photos"],
        },
      ],
    });

    return res.status(201).json({
      message: "Service créé",
      service: addLabels(full),
    });
  } catch (e) {
    console.error("❌ Erreur création service:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la création du service" });
  }
};

/* ============================================================
   📄 LISTE DES SERVICES POUR CLIENT / ADMIN
============================================================ */
exports.listClient = async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);
    const { clientId } = req.query;

    const where = {};

    if (req.user.role === "admin") {
      if (clientId) where.clientId = clientId;
    } else {
      where.clientId = req.user.id;
    }

    const rows = await Service.findAll({
      where,
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
          attributes: ["id", "title", "city", "address", "photos"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      services: rows.map((s) => addLabels(s)),
      pagination: { limit, offset, count: rows.length },
    });
  } catch (e) {
    console.error("❌ erreur listClient:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération des services" });
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

    const where = {};
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

    const finalWhere =
      andWhere.length > 0 ? { ...where, [Op.and]: andWhere } : where;

    const { rows, count } = await Service.findAndCountAll({
      where: finalWhere,
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
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération des services" });
  }
};

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
        throw Object.assign(new Error("Service introuvable"), {
          status: 404,
        });

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

    const updatable = [
      "title",
      "description",
      "contactPerson",
      "contactPhone",
      "address",
      "budget",
      "status",
    ];

    const updates = {};
    for (const field of updatable) {
      if (field in req.body) updates[field] = req.body[field];
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
    return res
      .status(500)
      .json({ error: "Erreur lors de la mise à jour du service" });
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

    await service.destroy();

    return res.json({ message: "Service supprimé" });
  } catch (e) {
    console.error("❌ erreur deleteService:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la suppression" });
  }
};

/* ============================================================
   🧑‍🔧 LISTE DES SERVICES ASSIGNÉS À UN AGENT
============================================================ */
exports.listAgent = async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);

    const rows = await Service.findAll({
      where: { agentId: req.user.id },
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email"],
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
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération des services" });
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
    return res
      .status(500)
      .json({ error: "Erreur lors du démarrage du service" });
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
    return res
      .status(500)
      .json({ error: "Erreur lors de la finalisation du service" });
  }
};
