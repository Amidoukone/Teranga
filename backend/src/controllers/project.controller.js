"use strict";

const { Project, ProjectPhase, User } = require("../../models");
const { getLabel } = require("../utils/labels");

/* =========================================================
   🏷️ Labels (FR)
========================================================= */
const PROJECT_STATUSES = {
  created: "Créé",
  in_progress: "En cours",
  completed: "Terminé",
  validated: "Validé",
  cancelled: "Annulé",
};

/* =========================================================
   🧩 Helpers
========================================================= */
function isWithinOneHour(date) {
  try {
    const created = new Date(date).getTime();
    return Number.isFinite(created) && Date.now() - created <= 3600000;
  } catch {
    return false;
  }
}

function isAdmin(user) {
  return user?.role === "admin";
}

function isClientOwner(project, user) {
  return project && user?.role === "client" && project.clientId === user.id;
}

function canClientEditOrDelete(project, user) {
  return isClientOwner(project, user) && isWithinOneHour(project.createdAt);
}

/* =========================================================
   🟢 CREATE PROJECT
========================================================= */
exports.create = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const {
      title,
      type,
      description,
      budget,
      currency = "XOF",
      clientId,
      agentId,
    } = req.body || {};

    if (!title || !type)
      return res.status(400).json({ error: "Titre et type requis" });

    // Détermination du propriétaire réel
    let targetClientId = req.user.id;

    if (isAdmin(req.user) && clientId) {
      const cid = parseInt(clientId, 10);
      if (Number.isFinite(cid)) targetClientId = cid;
    }

    const project = await Project.create({
      title: String(title).trim(),
      type: String(type).trim(),
      description: description ?? null,
      budget: budget ?? null,
      currency: currency || "XOF",
      clientId: targetClientId,
      agentId: isAdmin(req.user) && agentId ? agentId : null,
      status: "created",
    });

    const full = await Project.findByPk(project.id, {
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
      ],
    });

    return res.status(201).json({
      message: "Projet créé avec succès",
      project: {
        ...full.toJSON(),
        statusLabel: getLabel(full.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    console.error("❌ Erreur création projet:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la création du projet" });
  }
};

/* =========================================================
   🟡 LIST PROJECTS
========================================================= */
exports.list = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const where = {};

    if (req.user.role === "client") where.clientId = req.user.id;
    if (req.user.role === "agent") where.agentId = req.user.id;

    const projects = await Project.findAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const formatted = projects.map((p) => ({
      ...p.toJSON(),
      statusLabel: getLabel(p.status, PROJECT_STATUSES),
    }));

    return res.json({ projects: formatted });
  } catch (e) {
    console.error("❌ Erreur list projects:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération des projets" });
  }
};

/* =========================================================
   🔍 DETAIL PROJECT
========================================================= */
exports.detail = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: ProjectPhase, as: "phases" },
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
      ],
    });

    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    // ACL client
    if (req.user.role === "client" && project.clientId !== req.user.id)
      return res.status(403).json({ error: "Accès non autorisé à ce projet" });

    return res.json({
      project: {
        ...project.toJSON(),
        statusLabel: getLabel(project.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    console.error("❌ Erreur detail project:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la récupération du projet" });
  }
};

/* =========================================================
   🟠 UPDATE PROJECT
========================================================= */
exports.update = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const project = await Project.findByPk(req.params.id);
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientEditOrDelete(project, req.user);

    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Action non autorisée. Les clients ne peuvent modifier leur projet que dans l'heure suivant sa création.",
      });
    }

    const body = req.body || {};

    // Construction sécurisée
    const merged = {
      title: body.title ?? project.title,
      type: body.type ?? project.type,
      description:
        body.description !== undefined
          ? body.description
          : project.description,
      budget:
        body.budget !== undefined ? body.budget : project.budget,
      currency: body.currency ?? project.currency,

      // ⚠️ agentId modifiable uniquement par admin
      agentId: adminOK ? body.agentId ?? project.agentId : project.agentId,

      // ⚠️ status modifiable uniquement par admin
      status: adminOK ? body.status ?? project.status : project.status,

      clientId: project.clientId,
    };

    await project.update(merged);

    const updated = await Project.findByPk(project.id, {
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
        {
          model: User,
          as: "agent",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
      ],
    });

    return res.json({
      message: "Projet mis à jour avec succès",
      project: {
        ...updated.toJSON(),
        statusLabel: getLabel(updated.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    console.error("❌ Erreur update project:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la mise à jour du projet" });
  }
};

/* =========================================================
   🔴 DELETE PROJECT
========================================================= */
exports.remove = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    const project = await Project.findByPk(req.params.id);
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    const adminOK = isAdmin(req.user);
    const clientOK = canClientEditOrDelete(project, req.user);

    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Action non autorisée. Les clients ne peuvent supprimer leur projet que dans l'heure suivant sa création.",
      });
    }

    await project.destroy();

    return res.json({ message: "Projet supprimé avec succès" });
  } catch (e) {
    console.error("❌ Erreur suppression projet:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la suppression du projet" });
  }
};
