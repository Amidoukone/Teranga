"use strict";

const { Op, Sequelize } = require("sequelize");
const { Notification, User } = require("../../models");
const DEFAULT_SUMMARY_CACHE_TTL_MS = 15000;
const summaryCache = new Map();
const summaryPending = new Map();

function toSafeInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function getSummaryCacheTtlMs() {
  const raw = Number.parseInt(
    String(process.env.NOTIFICATION_SUMMARY_CACHE_TTL_MS || ""),
    10
  );
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_SUMMARY_CACHE_TTL_MS;
  return raw;
}

const SUMMARY_CACHE_TTL_MS = getSummaryCacheTtlMs();

function normalizeSummary(result = {}) {
  return {
    unread: Number(result?.unread) || 0,
    byProgress: { ...(result?.byProgress || {}) },
  };
}

function readSummaryCache(userId) {
  if (SUMMARY_CACHE_TTL_MS <= 0) return null;

  const key = String(userId);
  const entry = summaryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    summaryCache.delete(key);
    return null;
  }

  return normalizeSummary(entry.value);
}

function writeSummaryCache(userId, result) {
  const normalized = normalizeSummary(result);

  if (SUMMARY_CACHE_TTL_MS > 0) {
    summaryCache.set(String(userId), {
      value: normalized,
      expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
    });
  }

  return normalized;
}

function invalidateNotificationSummary(userIds = null) {
  if (!userIds) {
    summaryCache.clear();
    summaryPending.clear();
    return;
  }

  const ids = Array.isArray(userIds) ? userIds : [userIds];
  for (const raw of ids) {
    const userId = toSafeInt(raw);
    if (!userId) continue;
    const key = String(userId);
    summaryCache.delete(key);
    summaryPending.delete(key);
  }
}

function normalizeRecipientIds(ids = []) {
  const set = new Set();
  for (const raw of ids || []) {
    const id = toSafeInt(raw);
    if (id) set.add(id);
  }
  return [...set];
}

function buildAdminScopeWhere({ countryId, regionId } = {}) {
  const or = [{ countryId: null, regionId: null }]; // admin global

  const safeRegion = toSafeInt(regionId);
  const safeCountry = toSafeInt(countryId);

  if (safeRegion) {
    or.push({ regionId: safeRegion });
  }

  if (safeCountry) {
    or.push({ regionId: null, countryId: safeCountry });
  }

  return { role: "admin", [Op.or]: or };
}

async function getAdminRecipientIds(scope = {}) {
  const where = buildAdminScopeWhere(scope);
  const admins = await User.findAll({ where, attributes: ["id"] });
  return admins.map((u) => u.id);
}

function computeProgress(entityType, status) {
  const s = status ? String(status).trim() : "";

  if (!s) return "new";

  const maps = {
    service: {
      new: ["created"],
      in_progress: ["in_progress"],
      done: ["completed", "validated", "cancelled"],
    },
    task: {
      new: ["created"],
      in_progress: ["in_progress"],
      done: ["completed", "validated", "cancelled"],
    },
    project: {
      new: ["created"],
      in_progress: ["in_progress"],
      done: ["completed", "validated", "cancelled"],
    },
    order: {
      new: ["created"],
      in_progress: ["processing", "paid", "shipped"],
      done: ["fulfilled", "delivered", "cancelled", "refunded"],
    },
  };

  const map = maps[entityType];
  if (!map) return "new";

  if (map.new.includes(s)) return "new";
  if (map.in_progress.includes(s)) return "in_progress";
  if (map.done.includes(s)) return "done";

  return "new";
}

function selectLatestPerUser(rows = []) {
  const grouped = new Map();
  for (const row of rows || []) {
    const key = String(row.userId);
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }

  const keepByUserId = new Map();
  const duplicateIds = [];

  for (const [key, list] of grouped.entries()) {
    if (list.length === 1) {
      keepByUserId.set(key, list[0]);
      continue;
    }

    list.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || 0) - (a.id || 0);
    });

    keepByUserId.set(key, list[0]);
    for (let i = 1; i < list.length; i += 1) {
      duplicateIds.push(list[i].id);
    }
  }

  return { keepByUserId, duplicateIds };
}

async function dedupeNotificationsForEntity(entityType, entityId) {
  const safeEntityId = toSafeInt(entityId);
  if (!entityType || !safeEntityId) return 0;

  const rows = await Notification.findAll({
    where: { entityType: String(entityType), entityId: safeEntityId },
    attributes: ["id", "userId", "createdAt", "updatedAt"],
  });

  const { duplicateIds } = selectLatestPerUser(rows);
  if (!duplicateIds.length) return 0;

  return Notification.destroy({ where: { id: { [Op.in]: duplicateIds } } });
}

async function createNotifications({
  recipients = [],
  actorId = null,
  entityType,
  entityId = null,
  action = "created",
  title = null,
  message = null,
  status = "unread",
  progress = "new",
  entityStatus = null,
  metadata = null,
  countryId = null,
  regionId = null,
  excludeRecipientId = null,
} = {}) {
  const ids = normalizeRecipientIds(recipients).filter(
    (id) => !excludeRecipientId || String(id) !== String(excludeRecipientId)
  );

  if (!ids.length) return [];

  const safeEntityId = toSafeInt(entityId);
  const nowPayload = {
    actorId: toSafeInt(actorId),
    action,
    title,
    message,
    status,
    progress,
    entityStatus: entityStatus ? String(entityStatus) : null,
    metadata,
    countryId: toSafeInt(countryId),
    regionId: toSafeInt(regionId),
    readAt: null,
  };

  if (!safeEntityId) {
    const rows = ids.map((userId) => ({
      userId,
      entityType,
      entityId: null,
      ...nowPayload,
    }));
    const created = await Notification.bulkCreate(rows);
    invalidateNotificationSummary(ids);
    return created;
  }

  const existing = await Notification.findAll({
    where: {
      userId: { [Op.in]: ids },
      entityType: String(entityType),
      entityId: safeEntityId,
    },
  });

  const { keepByUserId, duplicateIds } = selectLatestPerUser(existing);
  if (duplicateIds.length) {
    await Notification.destroy({ where: { id: { [Op.in]: duplicateIds } } });
  }

  const existingByUserId = keepByUserId;

  const updates = [];
  const creates = [];

  for (const userId of ids) {
    const existingRow = existingByUserId.get(String(userId));
    if (existingRow) {
      updates.push(
        existingRow.update({
          ...nowPayload,
          userId,
          entityType,
          entityId: safeEntityId,
        })
      );
    } else {
      creates.push({
        userId,
        entityType,
        entityId: safeEntityId,
        ...nowPayload,
      });
    }
  }

  const updatedRows = updates.length ? await Promise.all(updates) : [];
  const createdRows = creates.length
    ? await Notification.bulkCreate(creates)
    : [];

  invalidateNotificationSummary(ids);
  return [...updatedRows, ...createdRows];
}

async function updateNotificationsForEntity(entityType, entityId, patch = {}) {
  if (!entityType || !entityId) return 0;

  const updates = {};
  if (patch.action !== undefined) {
    updates.action = patch.action ? String(patch.action) : null;
  }
  if (patch.title !== undefined) {
    updates.title = patch.title !== null ? String(patch.title) : null;
  }
  if (patch.message !== undefined) {
    updates.message = patch.message !== null ? String(patch.message) : null;
  }
  if (patch.metadata !== undefined) {
    updates.metadata = patch.metadata;
  }
  if (patch.entityStatus !== undefined) {
    updates.entityStatus = patch.entityStatus ? String(patch.entityStatus) : null;
    if (patch.progress === undefined) {
      updates.progress = computeProgress(entityType, patch.entityStatus);
    }
  }
  if (patch.progress !== undefined) {
    updates.progress = patch.progress;
  }
  if (patch.status !== undefined) {
    updates.status = patch.status;
    if (patch.readAt !== undefined) {
      updates.readAt = patch.readAt;
    } else if (patch.status === "read") {
      updates.readAt = new Date();
    } else if (patch.status === "unread") {
      updates.readAt = null;
    }
  } else if (patch.readAt !== undefined) {
    updates.readAt = patch.readAt;
  }

  if (!Object.keys(updates).length) return 0;

  const [count] = await Notification.update(updates, {
    where: {
      entityType: String(entityType),
      entityId: toSafeInt(entityId),
    },
  });

  await dedupeNotificationsForEntity(entityType, entityId);
  invalidateNotificationSummary();

  return count;
}

async function getNotificationSummary(userId) {
  const uid = toSafeInt(userId);
  if (!uid) return { unread: 0, byProgress: {} };

  const cached = readSummaryCache(uid);
  if (cached) return cached;

  const pendingKey = String(uid);
  if (summaryPending.has(pendingKey)) {
    return summaryPending.get(pendingKey);
  }

  const loadPromise = (async () => {
    const unread = await Notification.count({
      where: { userId: uid, status: "unread" },
    });

    const rows = await Notification.findAll({
      attributes: [
        "progress",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
      ],
      where: { userId: uid },
      group: ["progress"],
      raw: true,
    });

    const byProgress = rows.reduce((acc, row) => {
      acc[row.progress] = Number(row.count) || 0;
      return acc;
    }, {});

    return writeSummaryCache(uid, { unread, byProgress });
  })();

  summaryPending.set(pendingKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    summaryPending.delete(pendingKey);
  }
}

module.exports = {
  getAdminRecipientIds,
  createNotifications,
  updateNotificationsForEntity,
  computeProgress,
  getNotificationSummary,
  invalidateNotificationSummary,
};
