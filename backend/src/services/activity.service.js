"use strict";

const { Activity } = require("../../models");
const {
  createNotifications,
  updateNotificationsForEntity,
  computeProgress,
} = require("./notification.service");

function toSafeInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function normalizeRecipientIds(ids = []) {
  const set = new Set();
  for (const raw of ids || []) {
    const id = toSafeInt(raw);
    if (id) set.add(id);
  }
  return [...set];
}

async function createActivities({
  recipients = [],
  actorId = null,
  entityType,
  entityId = null,
  action = "created",
  title = null,
  message = null,
  progress = null,
  entityStatus = null,
  metadata = null,
  countryId = null,
  regionId = null,
  excludeRecipientId = null,
} = {}) {
  const ids = normalizeRecipientIds(recipients).filter(
    (id) => !excludeRecipientId || String(id) !== String(excludeRecipientId)
  );

  if (!ids.length || !entityType) return [];

  const safeEntityId = toSafeInt(entityId);
  const safeActorId = toSafeInt(actorId);

  const finalProgress =
    progress || computeProgress(entityType, entityStatus || null);

  const rows = ids.map((userId) => ({
    userId,
    actorId: safeActorId,
    entityType: String(entityType),
    entityId: safeEntityId,
    action: action || "created",
    title,
    message,
    progress: finalProgress || "new",
    entityStatus: entityStatus ? String(entityStatus) : null,
    metadata,
    countryId: toSafeInt(countryId),
    regionId: toSafeInt(regionId),
  }));

  return Activity.bulkCreate(rows);
}

async function emitEvent({
  recipients = [],
  actorId = null,
  entityType,
  entityId = null,
  action = "created",
  title = null,
  message = null,
  status = "unread",
  progress = null,
  entityStatus = null,
  metadata = null,
  countryId = null,
  regionId = null,
  excludeRecipientId = null,
  notificationMode = "create", // create | update | skip
} = {}) {
  const ids = normalizeRecipientIds(recipients).filter(
    (id) => !excludeRecipientId || String(id) !== String(excludeRecipientId)
  );

  let activities = [];
  try {
    activities = await createActivities({
      recipients: ids,
      actorId,
      entityType,
      entityId,
      action,
      title,
      message,
      progress,
      entityStatus,
      metadata,
      countryId,
      regionId,
      excludeRecipientId: null,
    });
  } catch (err) {
    console.warn(
      "⚠️ Activity create failed (notifications will continue):",
      err?.message || err
    );
  }

  let notifications = null;
  if (notificationMode === "create") {
    if (!ids.length) return { activities, notifications: [] };
    notifications = await createNotifications({
      recipients: ids,
      actorId,
      entityType,
      entityId,
      action,
      title,
      message,
      status,
      progress: progress || computeProgress(entityType, entityStatus || null),
      entityStatus,
      metadata,
      countryId,
      regionId,
      excludeRecipientId: null,
    });
  } else if (notificationMode === "update") {
    notifications = await updateNotificationsForEntity(entityType, entityId, {
      action,
      title,
      message,
      progress: progress || computeProgress(entityType, entityStatus || null),
      entityStatus,
      metadata,
    });
  }

  return { activities, notifications };
}

module.exports = {
  createActivities,
  emitEvent,
};
