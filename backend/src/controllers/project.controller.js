"use strict";

const { Project, ProjectPhase, Region, User } = require("../../models");
const { getLabel } = require("../utils/labels");
const { Op } = require("sequelize");
const {
  canAccessGeoResource,
  getCountryIdByIso,
  getUserGeoScope,
  isGlobalAdmin,
  applyGeoScopeForModel,
} = require("../utils/geoScope");

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
      return res.status(401).json({ error: "Non authentifie" });

    const {
      title,
      type,
      description,
      budget,
      currency = "XOF",
      clientId,
      agentId,

      // GEO (optionnel, admin)
      countryId,
      regionId,
      country_id,
      region_id,
    } = req.body || {};

    if (!title || !type)
      return res.status(400).json({ error: "Titre et type requis" });

    /* -----------------------------
       Determination du client
    ----------------------------- */
    let targetClientId = req.user.id;

    if (isAdminLike(req.user) && clientId) {
      const cid = toSafeInt(clientId);
      if (cid) targetClientId = cid;
    }

    const desiredCountryId = isAdminLike(req.user)
      ? toSafeInt(countryId ?? country_id)
      : null;
    const desiredRegionId = isAdminLike(req.user)
      ? toSafeInt(regionId ?? region_id)
      : null;

    const scope = getUserGeoScope(req.user);
    const targetClient = await User.findByPk(targetClientId, {
      attributes: ["id", "role", "countryId", "regionId", "country"],
    });

    if (!targetClient) {
      return res.status(400).json({ error: "Client introuvable" });
    }

    if (isAdminLike(req.user) && clientId && targetClient.role !== "client") {
      return res.status(400).json({ error: "clientId doit cibler un client" });
    }

    const clientScope = getUserGeoScope(targetClient);
    const legacyCountryId =
      !clientScope.countryId && targetClient?.country
        ? await getCountryIdByIso(targetClient.country)
        : null;

    let finalCountryId = isAdminLike(req.user)
      ? isGlobalAdmin(req.user)
        ? desiredCountryId ?? clientScope.countryId ?? legacyCountryId ?? null
        : scope.countryId ??
          desiredCountryId ??
          clientScope.countryId ??
          legacyCountryId ??
          null
      : clientScope.countryId ?? legacyCountryId ?? null;

    let finalRegionId = isAdminLike(req.user)
      ? isGlobalAdmin(req.user)
        ? desiredRegionId ?? clientScope.regionId ?? null
        : scope.regionId ?? desiredRegionId ?? clientScope.regionId ?? null
      : clientScope.regionId ?? null;

    if (!finalRegionId && finalCountryId) {
      const fallbackRegion = await Region.findOne({
        where: { countryId: finalCountryId },
        order: [["id", "ASC"]],
      });
      finalRegionId = fallbackRegion?.id ?? null;
    }

    if (
      isAdminLike(req.user) &&
      !isGlobalAdmin(req.user) &&
      !canAccessGeoResource({ countryId: finalCountryId, regionId: finalRegionId }, req.user)
    ) {
      return res.status(403).json({ error: "Creation hors scope geographique" });
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

      // Multi-pays (non destructif)
      countryId: finalCountryId,
      regionId: finalRegionId,
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
      message: "Projet cree avec succes",
      project: {
        ...full.toJSON(),
        statusLabel: getLabel(full.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    console.error("Erreur creation projet:", e);
    return res
      .status(500)
      .json({ error: "Erreur lors de la cr??ation du projet" });
  }
};

exports.list = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ error: "Non authentifié" });

    // Evite les 304 (ETag) qui masquent les changements pendant le debug
    res.set('Cache-Control', 'no-store');

    let where = {};

    // 🔐 ACL
    if (req.user.role === "client") where.clientId = req.user.id;
    if (req.user.role === "agent") where.agentId = req.user.id;

    // 🌍 Filtres géographiques (admin/agent)
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);

    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    where = applyGeoScopeForModel
      ? applyGeoScopeForModel(where, req.user, Project, { includeClients: true })
      : where;

    const projects = await Project.findAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "role", "country"],
        },
        {
          model: Region,
          as: "region",
          attributes: ["id", "countryId"],
          required: false,
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
          attributes: ["id", "firstName", "lastName", "email", "role", "country"],
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

    if (req.user.role === "agent" && project.agentId !== req.user.id) {
      return res.status(403).json({ error: "Accès non autorisé à ce projet" });
    }

    if (!canAccessGeoResource(project, req.user)) {
      return res.status(403).json({ error: "Accès hors scope géographique" });
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

    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "country"],
        },
      ],
    });
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

    if (!canAccessGeoResource(project, req.user)) {
      return res.status(403).json({ error: "Action hors scope géographique" });
    }

    const body = req.body || {};
    const scope = getUserGeoScope(req.user);
    const nextCountryId =
      adminOK && (body.countryId !== undefined || body.country_id !== undefined)
        ? toSafeInt(body.countryId ?? body.country_id)
        : project.countryId;
    const nextRegionId =
      adminOK && (body.regionId !== undefined || body.region_id !== undefined)
        ? toSafeInt(body.regionId ?? body.region_id)
        : project.regionId;

    if (adminOK && !isGlobalAdmin(req.user)) {
      if (scope.countryId && nextCountryId && nextCountryId !== scope.countryId) {
        return res.status(403).json({ error: "Mise à jour hors scope géographique" });
      }
      if (scope.regionId && nextRegionId && nextRegionId !== scope.regionId) {
        return res.status(403).json({ error: "Mise à jour hors scope géographique" });
      }
    }

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

      // 🔐 Admin only
      agentId: adminOK
        ? toSafeInt(body.agentId ?? project.agentId)
        : project.agentId,

      status: adminOK ? body.status ?? project.status : project.status,

      // 🌍 GEO (non destructif)
      countryId: adminOK
        ? (isGlobalAdmin(req.user)
            ? nextCountryId
            : scope.countryId ?? nextCountryId)
        : project.countryId,

      regionId: adminOK
        ? (isGlobalAdmin(req.user)
            ? nextRegionId
            : scope.regionId ?? nextRegionId)
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

    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "country"],
        },
      ],
    });
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

    if (!canAccessGeoResource(project, req.user)) {
      return res.status(403).json({ error: "Suppression hors scope géographique" });
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
