import api from "./api";

export async function getNotifications(params = {}) {
  const { data } = await api.get("/notifications", { params });
  return data;
}

export async function getNotificationSummary() {
  try {
    const { data } = await api.get("/notifications/summary", {
      timeout: 5000,
      silentAuth: true,
      skipAuthRedirect: true,
    });
    return data;
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
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch("/notifications/read-all");
  return data;
}
