import api from "./api";

const DEFAULT_SUMMARY_CACHE_TTL_MS = 15000;
const SUMMARY_CACHE_TTL_MS = (() => {
  const raw = Number.parseInt(
    String(process.env.REACT_APP_NOTIFICATIONS_SUMMARY_TTL_MS || ""),
    10
  );
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_SUMMARY_CACHE_TTL_MS;
  return raw;
})();

let summaryCacheValue = null;
let summaryCacheExpiresAt = 0;
let summaryCacheVersion = 0;
let summaryPendingPromise = null;
let summaryPendingVersion = 0;

function normalizeSummary(data = {}) {
  return {
    unread: Number(data?.unread) || 0,
    byProgress: { ...(data?.byProgress || {}) },
  };
}

function cloneSummary(data = {}) {
  return normalizeSummary(data);
}

function readSummaryCache() {
  if (SUMMARY_CACHE_TTL_MS <= 0) return null;
  if (!summaryCacheValue) return null;
  if (summaryCacheExpiresAt <= Date.now()) {
    summaryCacheValue = null;
    summaryCacheExpiresAt = 0;
    return null;
  }
  return cloneSummary(summaryCacheValue);
}

function writeSummaryCache(data, requestVersion) {
  const normalized = normalizeSummary(data);

  if (
    SUMMARY_CACHE_TTL_MS > 0 &&
    requestVersion === summaryCacheVersion
  ) {
    summaryCacheValue = normalized;
    summaryCacheExpiresAt = Date.now() + SUMMARY_CACHE_TTL_MS;
  }

  return cloneSummary(normalized);
}

function invalidateNotificationSummaryCache() {
  summaryCacheVersion += 1;
  summaryCacheValue = null;
  summaryCacheExpiresAt = 0;
  summaryPendingPromise = null;
  summaryPendingVersion = summaryCacheVersion;
}

export async function getNotifications(params = {}) {
  const { data } = await api.get("/notifications", { params });
  return data;
}

export async function getNotificationSummary(options = {}) {
  const force = options?.force === true;

  if (!force) {
    const cached = readSummaryCache();
    if (cached) return cached;
  }

  if (
    !force &&
    summaryPendingPromise &&
    summaryPendingVersion === summaryCacheVersion
  ) {
    return summaryPendingPromise;
  }

  const requestVersion = summaryCacheVersion;
  const request = (async () => {
    try {
      const { data } = await api.get("/notifications/summary", {
        timeout: 5000,
        silentAuth: true,
        skipAuthRedirect: true,
      });
      return writeSummaryCache(data, requestVersion);
    } catch (e) {
      const status = e?.response?.status;
      const isTimeout = e?.code === "ECONNABORTED";
      const isNetworkLike = !e?.response; // inclut CORS/502 gateway sans headers
      if (
        status !== 401 &&
        !isTimeout &&
        !isNetworkLike &&
        status !== 502 &&
        status !== 503 &&
        status !== 504
      ) {
        throw e;
      }
      return { unread: 0, byProgress: {} };
    }
  })();

  summaryPendingPromise = request;
  summaryPendingVersion = requestVersion;

  try {
    return await request;
  } finally {
    if (summaryPendingPromise === request) {
      summaryPendingPromise = null;
    }
  }
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  invalidateNotificationSummaryCache();
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch("/notifications/read-all");
  invalidateNotificationSummaryCache();
  return data;
}

export async function deleteNotification(id) {
  const { data } = await api.delete(`/notifications/${id}`);
  invalidateNotificationSummaryCache();
  return data;
}

export async function cleanupNotifications(params = {}) {
  const { data } = await api.delete("/notifications/cleanup", { params });
  invalidateNotificationSummaryCache();
  return data;
}
