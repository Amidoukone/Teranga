'use strict';
const { Project, ProjectPhase, User } = require('../../models');
const { getLabel } = require('../utils/labels');

const PHASE_STATUSES = {
  pending: 'En attente',
  active: 'En cours',
  completed: 'Terminée',
};

/* =========================================================
   🧩 Helpers
========================================================= */
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
    project.clientId === user.id &&
    isWithinOneHour(project.createdAt)
  );
}

function isAdmin(user) {
  return user?.role === 'admin';
}

/* =========================================================
   🔹 Créer une phase
========================================================= */
exports.create = async (req, res) => {
  try {
    const { projectId, title, description, startDate, endDate } = req.body;
    if (!projectId || !title)
      return res.status(400).json({ error: 'projectId et title requis' });

    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientModify(project, req.user);
    if (!adminOK && !clientOK)
      return res.status(403).json({
        error:
          "Non autorisé. Les clients ne peuvent ajouter des phases que dans l'heure suivant la création du projet.",
      });

    const phase = await ProjectPhase.create({
      projectId,
      title,
      description,
      startDate: startDate || null,
      endDate: endDate || null,
      status: 'pending',
      progress: 0,
    });

    res.status(201).json({
      message: 'Phase créée avec succès',
      phase: {
        ...phase.toJSON(),
        statusLabel: getLabel(phase.status, PHASE_STATUSES),
      },
      projectId,
    });
  } catch (e) {
    console.error('❌ Erreur création phase:', e);
    res.status(500).json({ error: "Erreur lors de la création de la phase" });
  }
};

/* =========================================================
   🔹 Liste des phases d’un projet
========================================================= */
exports.listByProject = async (req, res) => {
  try {
    const projectId = req.query.projectId || req.params.projectId;
    if (!projectId)
      return res.status(400).json({ error: 'projectId requis' });

    const phases = await ProjectPhase.findAll({
      where: { projectId },
      order: [['createdAt', 'ASC']],
    });

    res.json({
      projectId,
      phases: phases.map((p) => ({
        ...p.toJSON(),
        statusLabel: getLabel(p.status, PHASE_STATUSES),
      })),
    });
  } catch (e) {
    console.error('❌ Erreur list phases:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des phases' });
  }
};

/* =========================================================
   🔹 Mise à jour d’une phase (1h pour client)
========================================================= */
exports.update = async (req, res) => {
  try {
    const phase = await ProjectPhase.findByPk(req.params.id);
    if (!phase) return res.status(404).json({ error: 'Phase introuvable' });

    const project = await Project.findByPk(phase.projectId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientModify(project, req.user);
    if (!adminOK && !clientOK)
      return res.status(403).json({
        error:
          "Non autorisé. Les clients ne peuvent modifier une phase que dans l'heure suivant la création du projet.",
      });

    await phase.update(req.body);

    res.json({
      message: 'Phase mise à jour avec succès',
      phase: {
        ...phase.toJSON(),
        statusLabel: getLabel(phase.status, PHASE_STATUSES),
      },
      projectId: project.id,
    });
  } catch (e) {
    console.error('❌ Erreur update phase:', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la phase' });
  }
};

/* =========================================================
   🔹 Suppression d’une phase (1h pour client)
========================================================= */
exports.remove = async (req, res) => {
  try {
    const phase = await ProjectPhase.findByPk(req.params.id);
    if (!phase) return res.status(404).json({ error: 'Phase introuvable' });

    const project = await Project.findByPk(phase.projectId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientModify(project, req.user);
    if (!adminOK && !clientOK)
      return res.status(403).json({
        error:
          "Non autorisé. Les clients ne peuvent supprimer une phase que dans l'heure suivant la création du projet.",
      });

    await phase.destroy();
    res.json({
      message: 'Phase supprimée avec succès',
      projectId: project.id,
    });
  } catch (e) {
    console.error('❌ Erreur suppression phase:', e);
    res.status(500).json({ error: 'Erreur lors de la suppression de la phase' });
  }
};
