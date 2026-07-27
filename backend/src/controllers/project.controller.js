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
const {
  getAdminRecipientIds,
  computeProgress,
} = require("../services/notification.service");
const { emitEvent } = require("../services/activity.service");
const { geocodeAddress } = require("../services/geocoding.service");
const logger = require('../utils/logger');

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

      // GEO (optionnel, admin)
      countryId,
      regionId,
      country_id,
      region_id,

      // Localisation (optionnelle, jamais bloquante — voir docs/DEV_SPEC_TERANGA_v3.md 0.5)
      address,
      city,
      latitude: rawLatitude,
      longitude: rawLongitude,
    } = req.body || {};

    if (!title || !type)
      return res.status(400).json({ error: "Titre et type requis" });

    const trimmedAddress = address ? String(address).trim() : null;
    const trimmedCity = city ? String(city).trim() : null;
    let latitude = rawLatitude != null ? Number(rawLatitude) : null;
    let longitude = rawLongitude != null ? Number(rawLongitude) : null;
    if (
      (!Number.isFinite(latitude) || !Number.isFinite(longitude)) &&
      (trimmedAddress || trimmedCity)
    ) {
      const geocoded = await geocodeAddress(
        [trimmedAddress, trimmedCity].filter(Boolean).join(', ')
      );
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      latitude = null;
      longitude = null;
    }

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

      // Localisation (non bloquante)
      address: trimmedAddress,
      city: trimmedCity,
      latitude,
      longitude,
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

    try {
      const adminIds = await getAdminRecipientIds({
        countryId: finalCountryId,
        regionId: finalRegionId,
      });

      const recipients = [
        ...adminIds,
        targetClientId,
        full?.agent?.id ?? project.agentId,
      ];

      await emitEvent({
        recipients,
        actorId: req.user.id,
        entityType: "project",
        entityId: project.id,
        action: "created",
        title: "Nouveau projet",
        message: project.title ? `Projet: ${project.title}` : "Projet créé",
        progress: computeProgress("project", "created"),
        entityStatus: "created",
        metadata: { projectId: project.id, title: project.title || null },
        countryId: finalCountryId,
        regionId: finalRegionId,
        notificationMode: "create",
      });
    } catch (err) {
      logger.warn({ err }, "project.notification.create.failed");
    }

    return res.status(201).json({
      message: "Projet créé avec succès",
      project: {
        ...full.toJSON(),
        statusLabel: getLabel(full.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    logger.error({ err: e }, "project.create.failed");
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
    logger.error({ err: e }, "project.list.failed");
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
    logger.error({ err: e }, "project.detail.failed");
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

    const previousStatus = project.status;
    const previousAgentId = project.agentId;

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

    const nextStatus = adminOK ? body.status ?? project.status : project.status;
    const nextAgentId = adminOK
      ? toSafeInt(body.agentId ?? project.agentId)
      : project.agentId;

    // Localisation (non bloquante) : re-géocode seulement si adresse/ville change
    // sans lat/lng explicites fournies dans la même requête.
    const addressChanged = body.address !== undefined || body.city !== undefined;
    const coordsProvided = body.latitude !== undefined || body.longitude !== undefined;
    let nextAddress = body.address !== undefined ? String(body.address).trim() || null : project.address;
    let nextCity = body.city !== undefined ? String(body.city).trim() || null : project.city;
    let nextLatitude = body.latitude !== undefined ? Number(body.latitude) : project.latitude;
    let nextLongitude = body.longitude !== undefined ? Number(body.longitude) : project.longitude;
    if (addressChanged && !coordsProvided && (nextAddress || nextCity)) {
      const geocoded = await geocodeAddress(
        [nextAddress, nextCity].filter(Boolean).join(', ')
      );
      if (geocoded) {
        nextLatitude = geocoded.latitude;
        nextLongitude = geocoded.longitude;
      }
    }
    if (!Number.isFinite(Number(nextLatitude)) || !Number.isFinite(Number(nextLongitude))) {
      nextLatitude = null;
      nextLongitude = null;
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
      agentId: nextAgentId,

      status: nextStatus,

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

      // Localisation (non bloquante)
      address: nextAddress,
      city: nextCity,
      latitude: nextLatitude,
      longitude: nextLongitude,
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

    if (nextAgentId && String(nextAgentId) !== String(previousAgentId || "")) {
      try {
        const clientRecipient = updated?.client?.id || updated?.clientId || null;
        await emitEvent({
          recipients: [nextAgentId, clientRecipient],
          actorId: req.user.id,
          entityType: "project",
          entityId: updated.id,
          action: "assigned",
          title: "Projet assigné",
          message: updated.title
            ? `Projet assigné: ${updated.title}`
            : "Un projet vous a été assigné",
          progress: computeProgress("project", updated.status),
          entityStatus: updated.status,
          metadata: { projectId: updated.id, title: updated.title || null },
          countryId: updated.countryId,
          regionId: updated.regionId,
          notificationMode: "create",
        });
      } catch (err) {
        logger.warn({ err }, "project.notification.assign.failed");
      }
    }

    if (nextStatus !== previousStatus) {
      try {
        const adminIds = await getAdminRecipientIds({
          countryId: updated.countryId,
          regionId: updated.regionId,
        });
        const recipients = [
          ...adminIds,
          updated?.client?.id ?? updated.clientId,
          updated?.agent?.id ?? updated.agentId,
        ];

        await emitEvent({
          recipients,
          actorId: req.user.id,
          entityType: "project",
          entityId: project.id,
          action: "status_updated",
          title: "Statut projet mis à jour",
          message: updated.title ? `Projet: ${updated.title}` : null,
          progress: computeProgress("project", nextStatus),
          entityStatus: nextStatus,
          metadata: { projectId: updated.id, title: updated.title || null },
          countryId: updated.countryId,
          regionId: updated.regionId,
          notificationMode: "update",
        });
      } catch (err) {
        logger.warn({ err }, "project.notification.status_update.failed");
      }
    }

    return res.json({
      message: "Projet mis à jour avec succès",
      project: {
        ...updated.toJSON(),
        statusLabel: getLabel(updated.status, PROJECT_STATUSES),
      },
    });
  } catch (e) {
    logger.error({ err: e }, "project.update.failed");
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
    logger.error({ err: e }, "project.remove.failed");
    return res
      .status(500)
      .json({ error: "Erreur lors de la suppression du projet" });
  }
};

