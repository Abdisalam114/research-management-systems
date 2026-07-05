import { api } from "./api";

function auth(t) { return { headers: { Authorization: `Bearer ${t}` } }; }

export async function listPurchaseOrders(t) {
  const { data } = await api.get("/api/procurement", auth(t));
  return data;
}

export async function createPurchaseOrder(t, body) {
  const { data } = await api.post("/api/procurement", body, auth(t));
  return data;
}

export async function procurementDecision(t, id, body) {
  const { data } = await api.post(`/api/procurement/${id}/procurement-decision`, body, auth(t));
  return data;
}

export async function directorDecision(t, id, body) {
  const { data } = await api.post(`/api/procurement/${id}/director-decision`, body, auth(t));
  return data;
}

export async function financePay(t, id, body) {
  const { data } = await api.post(`/api/procurement/${id}/pay`, body, auth(t));
  return data;
}

export async function financeReject(t, id, body) {
  const { data } = await api.post(`/api/procurement/${id}/reject`, body, auth(t));
  return data;
}
