import api from "./api";

export async function getActivities(params = {}) {
  const { data } = await api.get("/activities", { params });
  return data;
}

export async function deleteActivity(id) {
  const { data } = await api.delete(`/activities/${id}`);
  return data;
}

export async function cleanupActivities(params = {}) {
  const { data } = await api.delete("/activities/cleanup", { params });
  return data;
}
