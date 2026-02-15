import api from "./api";

export async function getActivities(params = {}) {
  const { data } = await api.get("/activities", { params });
  return data;
}
