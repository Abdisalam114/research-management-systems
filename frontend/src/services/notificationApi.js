import { api } from "./api";

export async function listMyNotifications(accessToken) {
  const res = await api.get("/api/notifications/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function markNotificationRead(accessToken, id) {
  const res = await api.post(`/api/notifications/${id}/read`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}
