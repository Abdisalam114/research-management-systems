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

export async function financeReport(accessToken) {
  const res = await api.get("/api/analytics/finance-report", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function downloadAnnualReportPdf(accessToken) {
  const res = await api.get("/api/analytics/annual-report.pdf", {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: "blob",
  });
  return res.data;
}

export async function facultyReport(accessToken) {
  const res = await api.get("/api/analytics/faculty-report", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function downloadFacultyReportPdf(accessToken) {
  const res = await api.get("/api/analytics/faculty-report.pdf", {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: "blob",
  });
  return res.data;
}

export async function donorReport(accessToken) {
  const res = await api.get("/api/analytics/donor-report", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function researchJourney(accessToken, researcherId) {
  const params = researcherId ? { researcherId } : {};
  const res = await api.get("/api/analytics/research-journey", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return res.data;
}

