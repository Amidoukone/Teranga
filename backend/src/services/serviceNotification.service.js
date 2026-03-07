"use strict";

const { getAdminRecipientIds, computeProgress } = require("./notification.service");
const { emitEvent } = require("./activity.service");
const logger = require("../utils/logger");

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
      metadata: { serviceId: service.id, title: service.title || null },
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
      metadata: { serviceId: service.id, title: service.title || null },
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
    const recipients = uniqRecipients([
      ...adminIds,
      service.clientId,
      service.agentId,
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
      metadata: { serviceId: service.id, title: service.title || null },
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
