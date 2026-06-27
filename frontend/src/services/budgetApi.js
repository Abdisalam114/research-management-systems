import { api } from "./api";

export async function listBudgets(accessToken) {
  const res = await api.get("/api/budgets", { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function createBudget(accessToken, payload) {
  const res = await api.post("/api/budgets", payload, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function addBudgetItem(accessToken, budgetId, payload) {
  const res = await api.post(`/api/budgets/${budgetId}/items`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function financeUpdateItem(accessToken, budgetId, itemId, payload) {
  const res = await api.patch(`/api/budgets/${budgetId}/items/${itemId}`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}
