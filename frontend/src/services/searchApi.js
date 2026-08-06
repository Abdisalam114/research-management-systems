import { api } from "./api";

function flattenResults(results = {}) {
  if (Array.isArray(results.all) && results.all.length) return results.all;
  const order = [
    "proposals",
    "projects",
    "thesisGroups",
    "ethics",
    "publications",
    "grants",
    "fundingCalls",
    "researchGroups",
    "repository",
    "budgets",
    "payments",
    "purchaseOrders",
    "policies",
    "conversations",
    "notifications",
    "users",
    "departments",
    "auditEvents",
  ];
  return order.flatMap((key) =>
    (Array.isArray(results[key]) ? results[key] : []).map((item) => ({ ...item, section: key }))
  );
}

function countResults(results = {}) {
  return Object.entries(results).reduce((n, [key, items]) => {
    if (key === "all" || !Array.isArray(items)) return n;
    return n + items.length;
  }, 0);
}

export async function globalSearch(accessToken, q) {
  const { data } = await api.get("/api/search", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q },
  });
  const results = data.results || {};
  const all = flattenResults(results);
  const total = Number.isFinite(data.total) ? data.total : countResults(results);
  return {
    ...data,
    total,
    results: { ...results, all: results.all?.length ? results.all : all },
  };
}

export async function listRecentAudit(accessToken, params = {}) {
  const { data } = await api.get("/api/audit/recent", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return data;
}
