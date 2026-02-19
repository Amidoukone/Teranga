'use strict';

const { Project, ProjectPhase } = require('../../models');
const { getLabel } = require('../utils/labels');
const { getUserGeoScope, isGlobalAdmin } = require('../utils/geoScope');
const logger = require('../utils/logger');

const PHASE_STATUSES = {
  pending: 'En attente',
  active: 'En cours',
  completed: 'Terminée',
};

/* =========================================================
   🧩 Helpers
========================================================= */
function toSafeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function isWithinOneHour(date) {
  if (!date) return false;
  const created = new Date(date).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 3600000;
}

function canClientModify(project, user) {
  if (!project || !user) return false;
  return (
    user.role === 'client' &&
    String(project.clientId) === String(user.id) &&
    isWithinOneHour(project.createdAt)
  );
}

function isAdmin(user) {
  return user?.role === 'admin';
}

/**
 * ✅ Master-scope (admin + countryId/regionId) :
 * - admin global (countryId=null & regionId=null) : accès total
 * - admin scoped : accès seulement si le projet est dans son scope
 * - role non-admin : pas concerné ici
 */
function canAdminAccessProjectByGeo(project, user) {
  if (!project || !user) return false;
  if (!isAdmin(user)) return false;

  // admin global => OK
  if (isGlobalAdmin(user)) return true;

  const scope = getUserGeoScope(user); // { countryId, regionId }
  // Si aucun scope n'est défini, on considère global (fallback safe)
  if (!scope?.countryId && !scope?.regionId) return true;

  // Scope country (si défini)
  if (scope.countryId && String(project.countryId) !== String(scope.countryId)) {
    return false;
  }

  // Scope region (si défini)
  if (scope.regionId && String(project.regionId) !== String(scope.regionId)) {
    return false;
  }

  return true;
}

/**
 * ACL lecture projet (pour listByProject)
 * - Admin: global ou scoped GEO
 * - Client: propriétaire
 * - Agent: assigné
 */
function canReadProject(project, user) {
  if (!project || !user?.role) return false;

  if (isAdmin(user)) return canAdminAccessProjectByGeo(project, user);

  if (user.role === 'client') {
    return String(project.clientId) === String(user.id);
  }

  if (user.role === 'agent') {
    return project.agentId != null && String(project.agentId) === String(user.id);
  }

  return false;
}

/* =========================================================
   🔹 Créer une phase
========================================================= */
exports.create = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { projectId, title, description, startDate, endDate } = req.body || {};
    const pid = toSafeInt(projectId);

    if (!pid || !title) {
      return res.status(400).json({ error: 'projectId et title requis' });
    }

    // Charger le projet avec les champs nécessaires à l’ACL GEO
    const project = await Project.findByPk(pid, {
      attributes: ['id', 'clientId', 'agentId', 'createdAt', 'countryId', 'regionId'],
    });
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user) && canAdminAccessProjectByGeo(project, req.user);
    const clientOK = canClientModify(project, req.user);

    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Non autorisé. Les clients ne peuvent ajouter des phases que dans l'heure suivant la création du projet.",
      });
    }

    const phase = await ProjectPhase.create({
      projectId: pid,
      title: String(title).trim(),
      description: description ?? null,
      startDate: startDate || null,
      endDate: endDate || null,
      status: 'pending',
      progress: 0,
    });

    return res.status(201).json({
      message: 'Phase créée avec succès',
      phase: {
        ...phase.toJSON(),
        statusLabel: getLabel(phase.status, PHASE_STATUSES),
      },
      projectId: pid,
    });
  } catch (e) {
    logger.error('❌ Erreur création phase:', e);
    return res.status(500).json({ error: "Erreur lors de la création de la phase" });
  }
};

/* =========================================================
   🔹 Liste des phases d’un projet (ACL + GEO scope)
========================================================= */
exports.listByProject = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const projectId = toSafeInt(req.query.projectId || req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'projectId requis' });

    // ✅ ACL lecture : project owner / agent assigné / admin (scopé)
    const project = await Project.findByPk(projectId, {
      attributes: ['id', 'clientId', 'agentId', 'countryId', 'regionId'],
    });
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    if (!canReadProject(project, req.user)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const phases = await ProjectPhase.findAll({
      where: { projectId },
      order: [['createdAt', 'ASC']],
    });

    return res.json({
      projectId,
      phases: phases.map((p) => ({
        ...p.toJSON(),
        statusLabel: getLabel(p.status, PHASE_STATUSES),
      })),
    });
  } catch (e) {
    logger.error('❌ Erreur list phases:', e);
    return res.status(500).json({ error: 'Erreur lors de la récupération des phases' });
  }
};

/* =========================================================
   🔹 Mise à jour d’une phase (1h pour client) + GEO scope admin
========================================================= */
exports.update = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const phase = await ProjectPhase.findByPk(req.params.id);
    if (!phase) return res.status(404).json({ error: 'Phase introuvable' });

    const project = await Project.findByPk(phase.projectId, {
      attributes: ['id', 'clientId', 'agentId', 'createdAt', 'countryId', 'regionId'],
    });
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user) && canAdminAccessProjectByGeo(project, req.user);
    const clientOK = canClientModify(project, req.user);

    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Non autorisé. Les clients ne peuvent modifier une phase que dans l'heure suivant la création du projet.",
      });
    }

    // On garde le comportement existant (update libre des champs envoyés)
    await phase.update(req.body);

    return res.json({
      message: 'Phase mise à jour avec succès',
      phase: {
        ...phase.toJSON(),
        statusLabel: getLabel(phase.status, PHASE_STATUSES),
      },
      projectId: project.id,
    });
  } catch (e) {
    logger.error('❌ Erreur update phase:', e);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de la phase' });
  }
};

/* =========================================================
   🔹 Suppression d’une phase (1h pour client) + GEO scope admin
========================================================= */
exports.remove = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const phase = await ProjectPhase.findByPk(req.params.id);
    if (!phase) return res.status(404).json({ error: 'Phase introuvable' });

    const project = await Project.findByPk(phase.projectId, {
      attributes: ['id', 'clientId', 'agentId', 'createdAt', 'countryId', 'regionId'],
    });
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user) && canAdminAccessProjectByGeo(project, req.user);
    const clientOK = canClientModify(project, req.user);

    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Non autorisé. Les clients ne peuvent supprimer une phase que dans l'heure suivant la création du projet.",
      });
    }

    await phase.destroy();

    return res.json({
      message: 'Phase supprimée avec succès',
      projectId: project.id,
    });
  } catch (e) {
    logger.error('❌ Erreur suppression phase:', e);
    return res.status(500).json({ error: 'Erreur lors de la suppression de la phase' });
  }
};
