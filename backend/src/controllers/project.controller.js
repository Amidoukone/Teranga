'use strict';
const { Project, ProjectPhase, User } = require('../../models');
const { getLabel } = require('../utils/labels');

const PROJECT_STATUSES = {
  created: 'Créé',
  in_progress: 'En cours',
  completed: 'Terminé',
  validated: 'Validé',
};

/* =========================================================
   🧩 Helpers autorisation & cohérence
========================================================= */
function isWithinOneHour(date) {
  try {
    const created = new Date(date).getTime();
    const now = Date.now();
    return Number.isFinite(created) && now - created <= 3600000;
  } catch {
    return false;
  }
}

function canClientEditOrDelete(project, user) {
  if (!user || !project) return false;
  return (
    user.role === 'client' &&
    project.clientId === user.id &&
    isWithinOneHour(project.createdAt)
  );
}

function isAdmin(user) {
  return user?.role === 'admin';
}

/* =========================================================
   🔹 Créer un projet (client ou admin)
========================================================= */
exports.create = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: 'Non authentifié' });

    const { title, type, description, budget, currency, clientId, agentId } =
      req.body;

    if (!title || !type)
      return res.status(400).json({ error: 'Titre et type requis' });

    // ✅ Admin peut choisir un client spécifique
    // ✅ Client normal => clientId = son propre ID
    let targetClientId = req.user.id;
    if (isAdmin(req.user) && clientId) {
      targetClientId = parseInt(clientId, 10);
    }

    const project = await Project.create({
      title,
      type,
      description: description ?? null,
      budget: budget ?? null,
      currency: currency ?? 'XOF',
      clientId: targetClientId,
      agentId: isAdmin(req.user) && agentId ? agentId : null,
      status: 'created',
    });

    // Récupération enrichie
    const created = await Project.findByPk(project.id, {
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
      ],
    });

    res.status(201).json({
      message: 'Projet créé avec succès',
      project: {
        ...created.toJSON(),
        statusLabel: getLabel(created.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    console.error('❌ Erreur création projet:', e);
    res.status(500).json({ error: 'Erreur lors de la création du projet' });
  }
};

/* =========================================================
   🔹 Liste des projets (vue par rôle)
========================================================= */
exports.list = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: 'Non authentifié' });

    const where = {};
    if (req.user.role === 'client') where.clientId = req.user.id;
    if (req.user.role === 'agent') where.agentId = req.user.id;

    const projects = await Project.findAll({
      where,
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const withLabels = projects.map((p) => ({
      ...p.toJSON(),
      statusLabel: getLabel(p.status, PROJECT_STATUSES),
    }));

    res.json({ projects: withLabels });
  } catch (e) {
    console.error('❌ Erreur list projects:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des projets' });
  }
};

/* =========================================================
   🔹 Détail d’un projet
========================================================= */
exports.detail = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: 'Non authentifié' });

    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: ProjectPhase, as: 'phases' },
        {
          model: User,
          as: 'client',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
      ],
    });

    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    // Vérification ACL basique : client ne peut voir que ses projets
    if (
      req.user.role === 'client' &&
      project.clientId !== req.user.id
    ) {
      return res.status(403).json({ error: 'Accès non autorisé à ce projet' });
    }

    res.json({
      project: {
        ...project.toJSON(),
        statusLabel: getLabel(project.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    console.error('❌ Erreur detail project:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération du projet' });
  }
};

/* =========================================================
   🔧 Mettre à jour un projet
   🧭 Admin : complet
   👤 Client : 1h après création max
========================================================= */
exports.update = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: 'Non authentifié' });

    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientEditOrDelete(project, req.user);
    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Action non autorisée. Les clients ne peuvent modifier leur projet que dans l'heure suivant sa création.",
      });
    }

    const {
      title,
      type,
      description,
      budget,
      currency,
      status,
      agentId,
    } = req.body;

    const payload = {};
    if (title !== undefined) payload.title = title;
    if (type !== undefined) payload.type = type;
    if (description !== undefined) payload.description = description ?? null;
    if (budget !== undefined) payload.budget = budget ?? null;
    if (currency !== undefined) payload.currency = currency ?? 'XOF';

    if (adminOK) {
      if (status !== undefined) payload.status = status;
      if (agentId !== undefined) payload.agentId = agentId || null;
    }

    await project.update(payload);

    const updated = await Project.findByPk(project.id, {
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        },
      ],
    });

    res.json({
      message: 'Projet mis à jour avec succès',
      project: {
        ...updated.toJSON(),
        statusLabel: getLabel(updated.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    console.error('❌ Erreur update project:', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du projet' });
  }
};

/* =========================================================
   🗑️ Supprimer un projet
========================================================= */
exports.remove = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: 'Non authentifié' });

    const project = await Project.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientEditOrDelete(project, req.user);
    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Action non autorisée. Les clients ne peuvent supprimer leur projet que dans l'heure suivant sa création.",
      });
    }

    await project.destroy();
    res.json({ message: 'Projet supprimé avec succès' });
  } catch (e) {
    console.error('❌ Erreur suppression projet:', e);
    res.status(500).json({ error: 'Erreur lors de la suppression du projet' });
  }
};
