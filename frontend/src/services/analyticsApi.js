import { api } from "./api";

export async function dashboardMetrics(accessToken) {
  const res = await api.get("/api/analytics/dashboard", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function institutionalAnalytics(accessToken) {
  const res = await api.get("/api/analytics/institutional", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

