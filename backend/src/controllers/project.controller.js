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
function toSafeInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function isWithinOneHour(date) {
  try {
    const created = new Date(date).getTime();
    return Number.isFinite(created) && Date.now() - created <= 3600000;
  } catch {
    return false;
  }
}

function isAdminLike(user) {
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

      // 🌍 GEO (optionnel, admin/master)
      countryId,
      regionId,
      country_id,
      region_id,
    } = req.body || {};

    if (!title || !type)
      return res.status(400).json({ error: "Titre et type requis" });

    /* -----------------------------
       🎯 Détermination du client
    ----------------------------- */
    let targetClientId = req.user.id;

    if (isAdminLike(req.user) && clientId) {
      const cid = toSafeInt(clientId);
      if (cid) targetClientId = cid;
    }

    const project = await Project.create({
      title: String(title).trim(),
      type: String(type).trim(),
      description: description ?? null,
      budget: budget ?? null,
      currency: currency || "XOF",
      clientId: targetClientId,
      agentId: isAdminLike(req.user) ? toSafeInt(agentId) : null,
      status: "created",

      // 🌍 Multi-pays (non destructif)
      countryId: isAdminLike(req.user)
        ? toSafeInt(countryId ?? country_id)
        : null,

      regionId: isAdminLike(req.user)
        ? toSafeInt(regionId ?? region_id)
        : null,
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

    // 🔐 ACL
    if (req.user.role === "client") where.clientId = req.user.id;
    if (req.user.role === "agent") where.agentId = req.user.id;

    // 🌍 Filtres géographiques (admin/master/agent)
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);

    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

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

    return res.json({
      projects: projects.map((p) => ({
        ...p.toJSON(),
        statusLabel: getLabel(p.status, PROJECT_STATUSES),
      })),
    });
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

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const project = await Project.findByPk(id, {
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

    if (req.user.role === "client" && project.clientId !== req.user.id) {
      return res.status(403).json({ error: "Accès non autorisé à ce projet" });
    }

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

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const project = await Project.findByPk(id);
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    const adminOK = isAdminLike(req.user);
    const clientOK = canClientEditOrDelete(project, req.user);

    if (!adminOK && !clientOK) {
      return res.status(403).json({
        error:
          "Action non autorisée. Les clients ne peuvent modifier leur projet que dans l'heure suivant sa création.",
      });
    }

    const body = req.body || {};

    await project.update({
      title: body.title ?? project.title,
      type: body.type ?? project.type,
      description:
        body.description !== undefined
          ? body.description
          : project.description,
      budget:
        body.budget !== undefined ? body.budget : project.budget,
      currency: body.currency ?? project.currency,

      // 🔐 Admin/master only
      agentId: adminOK
        ? toSafeInt(body.agentId ?? project.agentId)
        : project.agentId,

      status: adminOK ? body.status ?? project.status : project.status,

      // 🌍 GEO (non destructif)
      countryId:
        adminOK && (body.countryId !== undefined || body.country_id !== undefined)
          ? toSafeInt(body.countryId ?? body.country_id)
          : project.countryId,

      regionId:
        adminOK && (body.regionId !== undefined || body.region_id !== undefined)
          ? toSafeInt(body.regionId ?? body.region_id)
          : project.regionId,
    });

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

    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const project = await Project.findByPk(id);
    if (!project)
      return res.status(404).json({ error: "Projet introuvable" });

    const adminOK = isAdminLike(req.user);
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
