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

export async function getUnreadCount(accessToken) {
  const res = await api.get("/api/notifications/me/unread-count", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function markAllNotificationsRead(accessToken) {
  const res = await api.post("/api/notifications/me/read-all", null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function clearAllNotifications(accessToken) {
  const res = await api.post("/api/notifications/me/clear", null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** Notify TopBar and other listeners to refresh unread badge immediately. */
export function notifyNotificationsUpdated() {
  window.dispatchEvent(new CustomEvent("rms-notifications-updated"));
}
