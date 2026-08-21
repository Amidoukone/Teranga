"use strict";

const { getAdminRecipientIds, computeProgress } = require("./notification.service");
const { emitEvent } = require("./activity.service");
const logger = require("../utils/logger");

// Résout l'utilisateur lié à un prestataire (providers.userId), pour inclure les missions
// Teranga Pro dans les mêmes notifications de transition que le flux agent legacy
// (docs/DEV_SPEC_TERANGA_v3.md section 4.2). Import tardif pour éviter un cycle de require
// (models -> services -> ... -> models).
async function resolveProviderUserId(providerId) {
  if (!providerId) return null;
  try {
    const { Provider } = require("../../models");
    const provider = await Provider.findByPk(providerId, { attributes: ["userId"] });
    return provider?.userId ?? null;
  } catch (_err) {
    return null;
  }
}

function uniqRecipients(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function notifyServiceCreated({
  actorId,
  service,
  fullService,
  targetClientId,
  countryId,
  regionId,
}) {
  try {
    const adminIds = await getAdminRecipientIds({ countryId, regionId });
    const recipients = uniqRecipients([
      ...adminIds,
      targetClientId,
      fullService?.agent?.id ?? service?.agentId ?? null,
    ]);

    await emitEvent({
      recipients,
      actorId,
      entityType: "service",
      entityId: service.id,
      action: "created",
      title: "Nouveau service",
      message: service.title ? `Service: ${service.title}` : "Service créé",
      progress: computeProgress("service", "created"),
      entityStatus: "created",
      metadata: {
        serviceId: service.id,
        title: service.title || null,
        requestedVehicleType: service.requestedVehicleType || null,
        // Permet au clic frontend (NotificationsPage/ActivityCenterPage) de distinguer une
        // mission filière (ouvre /missions/:id/track) d'un service classique (ouvre
        // /services/:id), sans requête supplémentaire.
        missionStatus: service.missionStatus || null,
      },
      countryId,
      regionId,
      notificationMode: "create",
    });
  } catch (err) {
    logger.warn({ err }, "Notification service create échouée");
  }
}

async function notifyServiceAssigned({ actorId, service }) {
  try {
    const recipients = uniqRecipients([
      service?.agent?.id || service?.agentId,
      service?.client?.id || service?.clientId,
    ]);

    await emitEvent({
      recipients,
      actorId,
      entityType: "service",
      entityId: service.id,
      action: "assigned",
      title: "Service assigné",
      message: service.title
        ? `Service assigné: ${service.title}`
        : "Un service vous a été assigné",
      progress: computeProgress("service", service.status),
      entityStatus: service.status,
      metadata: {
        serviceId: service.id,
        title: service.title || null,
        requestedVehicleType: service.requestedVehicleType || null,
        // Permet au clic frontend (NotificationsPage/ActivityCenterPage) de distinguer une
        // mission filière (ouvre /missions/:id/track) d'un service classique (ouvre
        // /services/:id), sans requête supplémentaire.
        missionStatus: service.missionStatus || null,
      },
      countryId: service.countryId,
      regionId: service.regionId,
      excludeRecipientId: null,
      notificationMode: "create",
    });
  } catch (err) {
    logger.warn({ err }, "Notification service assign échouée");
  }
}

async function notifyServiceStatusUpdate({ actorId, service, title, status }) {
  try {
    const adminIds = await getAdminRecipientIds({
      countryId: service.countryId,
      regionId: service.regionId,
    });
    const providerUserId = await resolveProviderUserId(service.providerId);
    const recipients = uniqRecipients([
      ...adminIds,
      service.clientId,
      service.agentId,
      providerUserId,
    ]);

    await emitEvent({
      recipients,
      actorId,
      entityType: "service",
      entityId: service.id,
      action: "status_updated",
      title,
      message: service.title ? `Service: ${service.title}` : null,
      progress: computeProgress("service", status),
      entityStatus: status,
      metadata: {
        serviceId: service.id,
        title: service.title || null,
        requestedVehicleType: service.requestedVehicleType || null,
        // Permet au clic frontend (NotificationsPage/ActivityCenterPage) de distinguer une
        // mission filière (ouvre /missions/:id/track) d'un service classique (ouvre
        // /services/:id), sans requête supplémentaire.
        missionStatus: service.missionStatus || null,
      },
      countryId: service.countryId,
      regionId: service.regionId,
      notificationMode: "update",
    });
  } catch (err) {
    logger.warn({ err, status }, "Notification service status échouée");
  }
}

module.exports = {
  notifyServiceCreated,
  notifyServiceAssigned,
  notifyServiceStatusUpdate,
};
