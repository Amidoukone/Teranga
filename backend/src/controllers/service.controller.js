'use strict';

const { Service, User, Property, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { SERVICE_STATUSES, SERVICE_TYPES, getLabel } = require('../utils/labels');

// Helpers
const ALLOWED_TYPES = new Set(Object.keys(SERVICE_TYPES));
const ALLOWED_STATUSES = new Set(Object.keys(SERVICE_STATUSES));

function toNullableNumber(v) {
  if (v === '' || v === undefined || v === null) return null;
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
  const limit = Math.min(Math.max(toSafeInt(req.query.limit, defaultLimit), 1), maxLimit);
  const offset = Math.max(toSafeInt(req.query.offset, 0), 0);
  return { limit, offset };
}
function isTrue(x) {
  if (typeof x === 'string') return x === '1' || x.toLowerCase() === 'true';
  return !!x;
}

/* ======================================================
   ➕ Créer un service (client ou admin)
====================================================== */
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
      clientId, // facultatif pour admin
    } = req.body || {};

    propertyId = toSafeInt(propertyId);
    if (!propertyId) return res.status(400).json({ error: 'propertyId requis' });

    type = String(type || '').trim();
    title = String(title || '').trim();
    if (!type || !ALLOWED_TYPES.has(type))
      return res.status(400).json({ error: 'type requis ou invalide' });
    if (!title) return res.status(400).json({ error: 'title requis' });

    const prop = await Property.findByPk(propertyId);
    if (!prop) return res.status(400).json({ error: 'Bien introuvable' });

    // 🔍 Déterminer le client cible
    let targetClientId = req.user.id;
    if (req.user.role === 'admin') {
      if (!clientId) {
        return res.status(400).json({ error: 'clientId requis pour la création par un admin' });
      }
      const client = await User.findByPk(clientId);
      if (!client || client.role !== 'client') {
        return res.status(400).json({ error: 'clientId invalide (doit être un client existant)' });
      }
      targetClientId = client.id;
    } else if (String(prop.ownerId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Ce bien n'appartient pas à l'utilisateur connecté" });
    }

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
      status: 'created',
    });

    const created = await Service.findByPk(service.id, {
      include: [
        { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address', 'photos'] },
      ],
    });

    // 🏷️ Ajout des labels lisibles
    const serviceWithLabels = {
      ...created.toJSON(),
      statusLabel: getLabel(created.status, SERVICE_STATUSES),
      typeLabel: getLabel(created.type, SERVICE_TYPES),
    };

    return res.status(201).json({ message: 'Service créé', service: serviceWithLabels });
  } catch (e) {
    console.error('❌ Erreur création service:', e);
    return res.status(500).json({ error: "Erreur lors de la création du service" });
  }
};

/* ======================================================
   📜 Liste des services client / admin
====================================================== */
exports.listClient = async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);
    const { clientId } = req.query;

    const where = {};
    if (req.user.role === 'admin') {
      if (clientId) where.clientId = clientId;
    } else {
      where.clientId = req.user.id;
    }

    const services = await Service.findAll({
      where,
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address', 'photos'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // 🏷️ Ajout des labels
    const servicesWithLabels = services.map((s) => ({
      ...s.toJSON(),
      statusLabel: getLabel(s.status, SERVICE_STATUSES),
      typeLabel: getLabel(s.type, SERVICE_TYPES),
    }));

    return res.json({ services: servicesWithLabels, pagination: { limit, offset, count: services.length } });
  } catch (e) {
    console.error('❌ Erreur récupération services client/admin:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération des services" });
  }
};

/* ======================================================
   🧾 Liste tous les services (admin uniquement)
====================================================== */
exports.listAll = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const { limit, offset } = getPagination(req);
    const status = (req.query.status || '').trim();
    const unassigned = isTrue(req.query.unassigned);
    const q = (req.query.q || '').trim();

    const where = {};
    if (status && ALLOWED_STATUSES.has(status)) where.status = status;
    if (unassigned) where.agentId = null;

    const whereAnd = [];
    if (q) {
      const like = { [Op.like]: `%${q}%` };
      whereAnd.push({
        [Op.or]: [
          { title: like }, { description: like }, { contactPerson: like },
          { contactPhone: like }, { address: like },
          { '$client.firstName$': like }, { '$client.lastName$': like }, { '$client.email$': like },
          { '$property.title$': like }, { '$property.city$': like }, { '$property.address$': like },
        ],
      });
    }

    const finalWhere = whereAnd.length ? { ...where, [Op.and]: whereAnd } : where;
    const { rows, count } = await Service.findAndCountAll({
      where: finalWhere,
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // 🏷️ Ajout des labels
    const servicesWithLabels = rows.map((s) => ({
      ...s.toJSON(),
      statusLabel: getLabel(s.status, SERVICE_STATUSES),
      typeLabel: getLabel(s.type, SERVICE_TYPES),
    }));

    return res.json({ services: servicesWithLabels, pagination: { limit, offset, total: count } });
  } catch (e) {
    console.error('❌ Erreur listAll services:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération des services" });
  }
};

/* ======================================================
   👔 Admin assigne un agent à un service
====================================================== */
exports.assignAgent = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const sid = toSafeInt(req.body?.serviceId);
    const aid = toSafeInt(req.body?.agentId);
    if (!sid || !aid) {
      return res.status(400).json({ error: 'serviceId et agentId requis' });
    }

    const updated = await sequelize.transaction(async (t) => {
      const service = await Service.findByPk(sid, { transaction: t });
      if (!service) throw Object.assign(new Error('Service introuvable'), { status: 404 });
      if (['completed', 'validated'].includes(service.status)) {
        throw Object.assign(new Error("Impossible d'assigner un service finalisé/validé"), { status: 400 });
      }

      const agent = await User.findByPk(aid, { transaction: t });
      if (!agent || agent.role !== 'agent') {
        throw Object.assign(new Error("L'utilisateur cible n'est pas un agent valide"), { status: 400 });
      }

      await service.update({ agentId: aid, status: 'created' }, { transaction: t });

      return await service.reload({
        include: [
          { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Property, as: 'property', attributes: ['id', 'title', 'city'] },
        ],
        transaction: t,
      });
    });

    const serviceWithLabels = {
      ...updated.toJSON(),
      statusLabel: getLabel(updated.status, SERVICE_STATUSES),
      typeLabel: getLabel(updated.type, SERVICE_TYPES),
    };

    return res.json({ message: 'Agent assigné avec succès', service: serviceWithLabels });
  } catch (e) {
    const status = e?.status || 500;
    console.error('❌ Erreur assignAgent:', e);
    return res.status(status).json({ error: e.message || "Erreur lors de l'assignation" });
  }
};

/* ======================================================
   ✏️ Mettre à jour un service
====================================================== */
exports.updateService = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ error: 'Service introuvable' });

    if (req.user.role !== 'admin' && service.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé à modifier ce service' });
    }

    const fields = ['title', 'description', 'contactPerson', 'contactPhone', 'address', 'budget', 'status'];
    const updates = {};
    for (const f of fields) {
      if (f in req.body) updates[f] = req.body[f];
    }

    await service.update(updates);
    const updated = await Service.findByPk(id, {
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'agent', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address'] },
      ],
    });

    const serviceWithLabels = {
      ...updated.toJSON(),
      statusLabel: getLabel(updated.status, SERVICE_STATUSES),
      typeLabel: getLabel(updated.type, SERVICE_TYPES),
    };

    return res.json({ message: 'Service mis à jour', service: serviceWithLabels });
  } catch (e) {
    console.error('❌ Erreur updateService:', e);
    return res.status(500).json({ error: "Erreur lors de la mise à jour du service" });
  }
};

/* ======================================================
   ❌ Supprimer un service
====================================================== */
exports.deleteService = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ error: 'Service introuvable' });

    if (req.user.role !== 'admin' && service.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé à supprimer ce service' });
    }

    await service.destroy();
    return res.json({ message: 'Service supprimé' });
  } catch (e) {
    console.error('❌ Erreur deleteService:', e);
    return res.status(500).json({ error: "Erreur lors de la suppression du service" });
  }
};

/* ======================================================
   👷 Liste des services assignés à un agent
====================================================== */
exports.listAgent = async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);
    const services = await Service.findAll({
      where: { agentId: req.user.id },
      include: [
        { model: User, as: 'client', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'address', 'photos'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const servicesWithLabels = services.map((s) => ({
      ...s.toJSON(),
      statusLabel: getLabel(s.status, SERVICE_STATUSES),
      typeLabel: getLabel(s.type, SERVICE_TYPES),
    }));

    return res.json({ services: servicesWithLabels, pagination: { limit, offset, count: services.length } });
  } catch (e) {
    console.error('❌ Erreur récupération services agent:', e);
    return res.status(500).json({ error: "Erreur lors de la récupération des services" });
  }
};

/* ======================================================
   🚀 Agent démarre un service
====================================================== */
exports.startService = async (req, res) => {
  try {
    const sid = toSafeInt(req.params.id);
    const service = await Service.findByPk(sid);
    if (!service) return res.status(404).json({ error: 'Service introuvable' });
    if (service.agentId !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
    if (service.status !== 'created') return res.status(400).json({ error: "Service déjà démarré ou terminé" });

    await service.update({ status: 'in_progress' });

    const updated = {
      ...service.toJSON(),
      statusLabel: getLabel('in_progress', SERVICE_STATUSES),
      typeLabel: getLabel(service.type, SERVICE_TYPES),
    };

    return res.json({ message: 'Service démarré', service: updated });
  } catch (e) {
    console.error('❌ Erreur startService:', e);
    return res.status(500).json({ error: "Erreur lors du démarrage du service" });
  }
};

/* ======================================================
   ✅ Agent marque un service comme terminé
====================================================== */
exports.completeService = async (req, res) => {
  try {
    const sid = toSafeInt(req.params.id);
    const service = await Service.findByPk(sid);
    if (!service) return res.status(404).json({ error: 'Service introuvable' });
    if (service.agentId !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
    if (service.status !== 'in_progress') return res.status(400).json({ error: "Service non démarré ou déjà terminé" });

    await service.update({ status: 'completed' });

    const updated = {
      ...service.toJSON(),
      statusLabel: getLabel('completed', SERVICE_STATUSES),
      typeLabel: getLabel(service.type, SERVICE_TYPES),
    };

    return res.json({ message: 'Service marqué terminé', service: updated });
  } catch (e) {
    console.error('❌ Erreur completeService:', e);
    return res.status(500).json({ error: "Erreur lors de la finalisation du service" });
  }
};
