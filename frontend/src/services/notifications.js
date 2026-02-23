import api from "./api";

export async function getNotifications(params = {}) {
  const { data } = await api.get("/notifications", { params });
  return data;
}

export async function getNotificationSummary() {
  const { data } = await api.get("/notifications/summary", {
    timeout: 5000,
    silentAuth: true,
    skipAuthRedirect: true,
  });
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch("/notifications/read-all");
  return data;
}
