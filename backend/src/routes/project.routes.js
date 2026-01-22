// backend/src/routes/project.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/project.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { canAccessGeoResource, isGlobalAdmin } = require('../utils/geoScope');

/* =========================================================
   🔹 CRUD de base (cohérent avec tes règles métier)
   - Client:
     • peut créer
     • peut lire ses projets
     • peut mettre à jour/supprimer ≤ 1h (contrôlé côté controller)
   - Agent:
     • peut lister/voir les projets qui lui sont assignés
   - Admin:
     • tout accès (scope géré côté contrôleur/service)
========================================================= */
router.post('/', auth, requireRoles('client', 'admin'), ctrl.create);
router.get('/', auth, requireRoles('client', 'agent', 'admin'), ctrl.list);
router.get('/:id', auth, requireRoles('client', 'agent', 'admin'), ctrl.detail);
router.put('/:id', auth, requireRoles('client', 'admin'), ctrl.update);
router.delete('/:id', auth, requireRoles('client', 'admin'), ctrl.remove);

/* =========================================================
   🧩 Assignation d’un agent à un projet (ADMIN uniquement)
   - POST /api/projects/assign
   - Body: { projectId: number, agentId: number|null }
     • agentId = null → désassigner l’agent
   - Sécurisée et idempotente, réponses enrichies
========================================================= */
router.post('/assign', auth, requireRoles('admin'), async (req, res) => {
  try {
    const { projectId, agentId } = req.body || {};

    // ✅ Validation simple des entrées
    const pid = Number(projectId);
    const aid = agentId === null || agentId === '' ? null : Number(agentId);

    if (!pid || Number.isNaN(pid)) {
      return res.status(400).json({ error: 'projectId invalide ou manquant.' });
    }

    // Chargement dynamique pour éviter les imports circulaires
    const { Project, User } = require('../../models');

    // ✅ Vérifier l’existence du projet
    const project = await Project.findByPk(pid);
    if (!project) {
      return res.status(404).json({ error: 'Projet introuvable.' });
    }

    if (!isGlobalAdmin(req.user) && !canAccessGeoResource(project, req.user)) {
      return res.status(403).json({ error: 'Projet hors scope géographique.' });
    }

    // ✅ Vérifier l’agent si fourni (aid !== null)
    let agent = null;
    if (aid !== null) {
      agent = await User.findByPk(aid);
      if (!agent || agent.role !== 'agent') {
        return res.status(400).json({
          error:
            "Utilisateur invalide : l'identifiant fourni doit correspondre à un utilisateur au rôle 'agent'.",
        });
      }

      if (!isGlobalAdmin(req.user) && !canAccessGeoResource(agent, req.user)) {
        return res.status(403).json({ error: 'Agent hors scope géographique.' });
      }
    }

    // ✅ Idempotence: si l’état cible = état actuel → juste renvoyer l’agrégat
    const currentAgentId = project.agentId ?? null;
    const targetAgentId = aid;

    if (currentAgentId === targetAgentId) {
      const hydrated = await Project.findByPk(project.id, {
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

      return res.json({
        message:
          targetAgentId === null
            ? 'Aucun changement : le projet est déjà sans agent assigné.'
            : `Aucun changement : le projet est déjà assigné à l’agent ${hydrated.agent.firstName} ${hydrated.agent.lastName}.`,
        project: hydrated,
      });
    }

    // ✅ Appliquer (ré)assignation / désassignation
    project.agentId = targetAgentId;
    await project.save();

    // ✅ Recharger le projet enrichi pour la réponse
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

    // ✅ Message clair
    const msg =
      targetAgentId === null
        ? `✅ Agent désassigné du projet “${updated.title}”.`
        : `✅ Agent ${updated.agent.firstName} ${updated.agent.lastName} assigné au projet “${updated.title}”.`;

    res.json({ message: msg, project: updated });
  } catch (e) {
    console.error('❌ Erreur assignation projet:', e);
    res
      .status(500)
      .json({ error: "Erreur lors de l’assignation de l’agent au projet." });
  }
});

module.exports = router;
